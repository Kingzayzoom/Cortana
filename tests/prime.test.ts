import { afterEach, beforeEach, describe, it, expect, vi } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { questions } from "../src/lib/prime/questions/bank";
import { primeQuestionSchema } from "../src/lib/prime/types";
import { buildDailyPrime } from "../src/lib/prime/generator";
import {
  gradePrimeAnswer,
  normalizePrimeAnswer,
} from "../src/lib/prime/grading";
import {
  readPrime,
  actPrime,
  reviewAfter,
  runPrimeTool,
} from "../src/lib/prime/server";
import { snapshot, withProgress } from "../src/lib/server/store";
import { defaultScenario } from "../src/lib/context/demo";
const now = new Date("2026-09-19T16:00:00Z");
beforeEach(async () => {
  vi.stubEnv("CORTANA_DATA_DIR", await mkdtemp(path.join(tmpdir(), "prime-")));
});
afterEach(() => vi.unstubAllEnvs());
const empty = () => ({ sessions: [], reviews: {} });
describe("Prime selection and grading", () => {
  it("has twelve valid source-grounded questions covering every supported concept and all formats", () => {
    expect(questions).toHaveLength(12);
    for (const q of questions)
      expect(primeQuestionSchema.safeParse(q).success).toBe(true);
    expect(new Set(questions.map((q) => q.type)).size).toBe(3);
  });
  it("selects three distinct concepts deterministically from empty history", () => {
    const a = buildDailyPrime(empty(), questions, "2026-09-19");
    expect(a).toEqual(buildDailyPrime(empty(), questions, "2026-09-19"));
    expect(new Set(a.map((x) => x.questionId)).size).toBe(3);
    expect(a.every((x) => x.reason === "new")).toBe(true);
  });
  it("prioritizes reinforcement, then due review, then a new concept", () => {
    const state = empty() as Parameters<typeof buildDailyPrime>[0];
    state.reviews["trial-population"] = reviewAfter(
      undefined,
      "trial-population",
      false,
      now,
      "2026-09-18",
    );
    state.reviews["primary-endpoint"] = reviewAfter(
      undefined,
      "primary-endpoint",
      true,
      now,
      "2026-09-16",
    );
    expect(
      buildDailyPrime(state, questions, "2026-09-19").map((q) => q.reason),
    ).toEqual(["reinforcement", "review", "new"]);
  });
  it("avoids yesterday's questions and handles all concepts due", () => {
    const state = empty() as Parameters<typeof buildDailyPrime>[0];
    const first = buildDailyPrime(state, questions, "2026-09-18");
    state.sessions.push({
      id: "old",
      date: "2026-09-18",
      selection: first,
      answers: {},
      cursor: 2,
      xp: 0,
    });
    for (const c of [
      "trial-population",
      "primary-endpoint",
      "evidence-limitations",
    ] as const)
      state.reviews[c] = reviewAfter(undefined, c, true, now, "2026-09-16");
    const next = buildDailyPrime(state, questions, "2026-09-19");
    expect(
      next.every(
        (q) =>
          q.reason === "review" &&
          !first.some((p) => p.questionId === q.questionId),
      ),
    ).toBe(true);
  });
  it("does not fabricate missing questions and deduplicates the bank", () => {
    expect(buildDailyPrime(empty(), [], "2026-09-19")).toEqual([]);
    expect(
      buildDailyPrime(empty(), [questions[0], questions[0]], "2026-09-19"),
    ).toHaveLength(1);
  });
  it("labels only supported contextual relevance", () => {
    expect(
      buildDailyPrime(
        empty(),
        questions,
        "2026-09-19",
        defaultScenario.educationTriggers,
      ).every((q) => q.contextRelevant),
    ).toBe(true);
    expect(
      buildDailyPrime(empty(), questions, "2026-09-19", [
        { id: "x", topic: "Unreviewed topic", reason: "demo" },
      ]).some((q) => q.contextRelevant),
    ).toBe(false);
  });
  it("grades deterministically and rejects invalid answers", () => {
    expect(gradePrimeAnswer("population-1", "B").correct).toBe(true);
    expect(gradePrimeAnswer("population-1", "A").correct).toBe(false);
    expect(() => gradePrimeAnswer("unknown", "B")).toThrow();
    expect(() => gradePrimeAnswer("population-1", "D")).toThrow();
  });
  it.each([
    ["Option B.", "B"],
    ["I choose B", "B"],
    ["2", "B"],
    ["A or B", null],
    ["not B", null],
    ["maybe B", null],
  ])("normalizes speech safely: %s", (input, output) =>
    expect(normalizePrimeAnswer(input, questions[0])).toBe(output),
  );
  it("supports spoken true/false", () =>
    expect(normalizePrimeAnswer("False", questions[1])).toBe("B"));
  it("uses calendar-safe 2/5/10-day intervals and one day after a miss", () => {
    let r = reviewAfter(undefined, "trial-population", true, now, "2026-12-31");
    expect(r.nextReviewAt).toBe("2027-01-02");
    r = reviewAfter(r, "trial-population", true, now, "2027-01-02");
    expect(r.nextReviewAt).toBe("2027-01-07");
    r = reviewAfter(r, "trial-population", true, now, "2027-01-07");
    expect(r.nextReviewAt).toBe("2027-01-17");
    expect(
      reviewAfter(r, "trial-population", false, now, "2027-01-17").nextReviewAt,
    ).toBe("2027-01-18");
  });
});
async function finish(profile: string, date = now) {
  let view = await actPrime(profile, { action: "start" }, date);
  const s = view.session!;
  for (let i = 0; i < 3; i++) {
    const q = questions.find((q) => q.id === s.selection[i].questionId)!;
    view = await actPrime(
      profile,
      {
        action: "answer",
        sessionId: s.id,
        questionId: q.id,
        answer: q.correctOptionId,
      },
      date,
    );
    if (i < 2)
      await actPrime(
        profile,
        { action: "next", sessionId: s.id, questionId: q.id },
        date,
      );
  }
  return actPrime(profile, { action: "complete", sessionId: s.id }, date);
}
describe("Prime persistence", () => {
  it("reinforces a miss with a different question and awards its bonus once",async()=>{
    const first=await actPrime("reinforce",{action:"start"},now),q=questions.find(q=>q.id===first.questions[0].id)!;
    await actPrime("reinforce",{action:"answer",sessionId:first.session!.id,questionId:q.id,answer:q.options.find(o=>o.id!==q.correctOptionId)!.id},now);
    await finish("reinforce",now);
    const tomorrow=new Date("2026-09-20T16:00:00Z"),next=await actPrime("reinforce",{action:"start"},tomorrow);
    expect(next.session!.selection[0].reason).toBe("reinforcement");
    expect(next.questions[0].id).not.toBe(q.id);
    expect(next.questions[0].conceptIds).toEqual(q.conceptIds);
    const done=await finish("reinforce",tomorrow);
    expect(done.session!.xp).toBe(90);expect(done.stats.reinforced).toBe(1);
    await actPrime("reinforce",{action:"complete",sessionId:done.session!.id},tomorrow);
    expect((await readPrime("reinforce",tomorrow)).session!.xp).toBe(90);
  });
  it("never reveals grading keys or explanations for unanswered questions", async () => {
    const view = await readPrime("a", now);
    expect(JSON.stringify(view)).not.toContain("correctOptionId");
    expect(JSON.stringify(view)).not.toContain("explanation");
  });
  it("rejects out-of-order answers and incomplete completion", async () => {
    const v = await actPrime("a", { action: "start" }, now);
    await expect(
      actPrime(
        "a",
        {
          action: "answer",
          sessionId: v.session!.id,
          questionId: v.questions[1].id,
          answer: "A",
        },
        now,
      ),
    ).rejects.toThrow("current question");
    await expect(
      actPrime("a", { action: "complete", sessionId: v.session!.id }, now),
    ).rejects.toThrow("three");
  });
  it("is profile scoped", async () => {
    const a = await actPrime("a", { action: "start" }, now);
    await expect(
      actPrime(
        "b",
        {
          action: "answer",
          sessionId: a.session!.id,
          questionId: a.questions[0].id,
          answer: "A",
        },
        now,
      ),
    ).rejects.toThrow("current");
    expect((await readPrime("b", now)).stats.questions).toBe(0);
  });
  it("persists one answer and one reward across retries, concurrent submissions and reloads", async () => {
    const a = await actPrime("a", { action: "start" }, now),
      q = questions.find((q) => q.id === a.questions[0].id)!;
    const body = {
      action: "answer",
      sessionId: a.session!.id,
      questionId: q.id,
      answer: q.correctOptionId,
    };
    await Promise.all([actPrime("a", body, now), actPrime("a", body, now)]);
    expect((await readPrime("a", now)).stats.questions).toBe(1);
    const complete = await finish("a");
    expect(complete.session!.xp).toBe(80);
    await actPrime(
      "a",
      { action: "complete", sessionId: complete.session!.id },
      now,
    );
    const stored = await withProgress("a", (data) => data);
    expect(snapshot(stored).xp).toBe(80);
    expect(stored.practiceDays).toEqual(["2026-09-19"]);
    expect(
      stored.learningSignals!.filter((e) => e.type === "prime_completed"),
    ).toHaveLength(1);
    expect(
      stored.learningSignals!.filter(
        (e) => e.type === "prime_question_correct",
      ),
    ).toHaveLength(3);
  });
  it("updates the shared streak and keeps midnight completion stable", async () => {
    await withProgress("a", (data) => {
      data.practiceDays = ["2026-09-18"];
    });
    const done = await finish("a");
    expect(done.streak).toBe(2);
    const tomorrow = new Date("2026-09-20T16:00:00Z");
    expect((await readPrime("a", tomorrow)).session!.id).not.toBe(
      done.session!.id,
    );
    await actPrime("b", { action: "start" }, new Date("2026-09-20T03:59:00Z"));
    const overnight = await finish("b", new Date("2026-09-20T04:01:00Z"));
    expect(overnight.session!.completedAt).toBeTruthy();
    expect(
      (await readPrime("b", new Date("2026-09-20T12:00:00Z"))).session!.id,
    ).toBe(overnight.session!.id);
  });
  it("records source-scoped evidence idempotently", async () => {
    const v = await finish("a"),
      q = v.questions[0],
      body = {
        action: "evidence",
        sessionId: v.session!.id,
        questionId: q.id,
        sourceId: q.sourceIds[0],
      };
    await actPrime("a", body, now);
    await actPrime("a", body, now);
    expect(
      await withProgress(
        "a",
        (d) =>
          d.learningSignals!.filter((e) => e.type === "prime_evidence_viewed")
            .length,
      ),
    ).toBe(1);
  });
  it("keeps advance retries on the same cursor", async () => {
    let v = await actPrime("a", { action: "start" }, now);
    const q = v.questions[0];
    await actPrime(
      "a",
      {
        action: "answer",
        sessionId: v.session!.id,
        questionId: q.id,
        answer: "A",
      },
      now,
    );
    const body = { action: "next", sessionId: v.session!.id, questionId: q.id };
    await actPrime("a", body, now);
    v = await actPrime("a", body, now);
    expect(v.session!.cursor).toBe(1);
  });
  it("voice tools enforce schemas and return authoritative feedback", async () => {
    const v = await runPrimeTool("voice", "get_prime_session", {});
    const q = questions.find((q) => q.id === v.questions[0].id)!;
    const answer = await runPrimeTool("voice", "submit_prime_answer", {
      sessionId: v.session!.id,
      questionId: q.id,
      answer: "Option " + q.correctOptionId,
    });
    expect(answer.session!.answers[q.id].correct).toBe(true);
    await expect(
      runPrimeTool("voice", "complete_prime", {
        sessionId: v.session!.id,
        profileId: "other",
      }),
    ).rejects.toThrow();
  });
});
