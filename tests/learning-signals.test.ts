import { describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { emptyProgress } from "../src/lib/server/store";
import { signalWriter } from "../src/lib/learning-signals/server";
import {
  classifyQuestion,
  conceptsForQuestion,
} from "../src/lib/learning-signals/adapter";
import {
  observationSchema,
  learningSignalSchema,
} from "../src/lib/learning-signals/types";
import { reduceLearningSignals } from "../src/lib/learning-signals/reducer";
import { selectLearningSummary } from "../src/lib/learning-signals/selectors";
import {
  selectNextRound,
  supportedRounds,
} from "../src/lib/adaptive-learning/selectNextRound";
import {
  buildLearningSignalPayload,
  learningSignalPayloadSchema,
} from "../src/lib/impiricus/buildLearningSignalPayload";
import { ProfileLearningSignalRepository } from "../src/lib/learning-signals/storage";
function profile() {
  const data = emptyProgress();
  data.run = {
    id: randomUUID(),
    stage: "briefing",
    section: 0,
    grade: null,
    completed: false,
  };
  return data;
}
describe("learning signal lifecycle", () => {
  it("completes the briefing with a unique, bounded concept list", () => {
    const data = profile();
    signalWriter(data).start();
    signalWriter(data).briefingCompleted();
    expect(
      data.learningSignals!.find((e) => e.type === "briefing_completed")
        ?.conceptIds,
    ).toEqual(["trial-population", "primary-endpoint", "evidence-limitations"]);
  });
  it("records a round once across callback replay, reload and reconnect", () => {
    const data = profile();
    signalWriter(data).start("voice");
    signalWriter(data).start("voice");
    const restored = JSON.parse(JSON.stringify(data));
    signalWriter(restored).start("voice");
    expect(
      restored.learningSignals.filter(
        (e: { type: string }) => e.type === "round_started",
      ),
    ).toHaveLength(1);
    expect(
      restored.learningSignals.filter(
        (e: { type: string }) => e.type === "briefing_section_viewed",
      ),
    ).toHaveLength(1);
  });
  it("creates practice events from an authoritative grade, without calling first success reinforcement", () => {
    const data = profile(),
      writer = signalWriter(data);
    writer.start();
    writer.grade("B", true);
    writer.grade("B", true);
    writer.complete();
    writer.complete();
    expect(selectLearningSummary(data.learningSignals!)).toMatchObject({
      attempted: 1,
      correct: 1,
      reinforced: [],
    });
    expect(
      data.learningSignals!.filter((e) => e.type === "round_completed"),
    ).toHaveLength(1);
    expect(
      data.learningSignals!.find((e) => e.type === "challenge_attempted"),
    ).toMatchObject({ selectedOptionId: "B", attemptNumber: 1 });
  });
  it("raises transparent priority after an incorrect response and reinforcement clears prior reasons", () => {
    const data = profile(),
      writer = signalWriter(data);
    writer.start();
    writer.grade("A", false);
    data.run!.stage = "feedback";
    writer.observe(
      { type: "question_asked", category: "clarification" },
      randomUUID(),
    );
    writer.observe(
      { type: "evidence_viewed", sourceId: "dapa-hf" },
      randomUUID(),
    );
    const population = reduceLearningSignals(data.learningSignals!).find(
      (c) => c.id === "trial-population",
    )!;
    expect(population).toMatchObject({
      priority: 6,
      unresolvedMiss: true,
      status: "REVIEW NEXT",
    });
    expect(selectNextRound(data.learningSignals!)?.kind).toBe("reinforcement");
    data.run = { ...data.run!, id: randomUUID(), stage: "briefing" };
    const second = signalWriter(data);
    second.start();
    second.grade("B", true);
    expect(
      reduceLearningSignals(data.learningSignals!).find(
        (c) => c.id === "trial-population",
      ),
    ).toMatchObject({
      priority: 0,
      unresolvedMiss: false,
      status: "REINFORCED",
    });
    expect(
      selectLearningSummary(data.learningSignals!, data.run.id).reinforced,
    ).toContain("trial-population");
  });
  it("counts one evidence interaction once and a deliberate reopening separately", () => {
    const data = profile(),
      writer = signalWriter(data),
      id = randomUUID();
    writer.start();
    writer.observe({ type: "evidence_viewed", sourceId: "dapa-hf" }, id);
    writer.observe({ type: "evidence_viewed", sourceId: "dapa-hf" }, id);
    expect(selectLearningSummary(data.learningSignals!).evidenceFollowUps).toBe(
      1,
    );
    writer.observe(
      { type: "evidence_viewed", sourceId: "dapa-hf" },
      randomUUID(),
    );
    expect(selectLearningSummary(data.learningSignals!).evidenceFollowUps).toBe(
      2,
    );
  });
  it("ignores interruptions outside briefing and stale section checkpoints", () => {
    const data = profile(),
      writer = signalWriter(data);
    writer.start("voice");
    writer.observe(
      { type: "briefing_interrupted", sectionId: "finding" },
      randomUUID(),
    );
    data.run!.stage = "challenge";
    writer.observe(
      { type: "briefing_interrupted", sectionId: "population" },
      randomUUID(),
    );
    expect(
      data.learningSignals!.some((e) => e.type === "briefing_interrupted"),
    ).toBe(false);
    data.run!.stage = "briefing";
    writer.observe(
      { type: "briefing_interrupted", sectionId: "population" },
      randomUUID(),
    );
    expect(
      data.learningSignals!.filter((e) => e.type === "briefing_interrupted"),
    ).toHaveLength(1);
  });
  it("computes elapsed time from saved timestamps and retains mode", () => {
    const data = profile();
    signalWriter(data, new Date("2026-09-19T12:00:00Z")).start("voice");
    signalWriter(data, new Date("2026-09-19T12:02:05Z")).complete();
    expect(
      selectLearningSummary(data.learningSignals!, data.run!.id),
    ).toMatchObject({ durationSeconds: 125, mode: "voice" });
  });
  it("isolates sessions while preserving real cross-session reinforcement history", () => {
    const data = profile();
    signalWriter(data).start();
    const prior = data.run!.id;
    data.run!.id = randomUUID();
    signalWriter(data).start();
    const repo = new ProfileLearningSignalRepository(data.learningSignals!);
    expect(repo.listForSession(prior)).toHaveLength(2);
    expect(repo.listForRound("dapa-hf-01")).toHaveLength(4);
    expect(repo.listForTopic("unknown")).toEqual([]);
  });
});
describe("privacy and boundaries", () => {
  it.each([
    ["Who was studied?", "study_population"],
    ["What was the primary endpoint?", "endpoint"],
    ["Please clarify the limitation", "clarification"],
    ["What were the limitations?", "limitation"],
    [
      "My patient Jane Doe, DOB 01/01/1970, MRN 12345: was diabetes required?",
      "study_population",
    ],
  ])("classifies without returning raw text: %s", (text, category) => {
    expect(classifyQuestion(text)).toBe(category);
  });
  it("rejects free text, unknown concepts/categories, extra fields and client grades", () => {
    expect(
      observationSchema.safeParse({
        type: "question_asked",
        category: "PHI patient",
      }).success,
    ).toBe(false);
    expect(
      observationSchema.safeParse({
        type: "question_asked",
        category: "other",
        text: "Jane Doe",
      }).success,
    ).toBe(false);
    expect(
      observationSchema.safeParse({ type: "challenge_resolved", correct: true })
        .success,
    ).toBe(false);
    const data = profile();
    signalWriter(data).start();
    expect(
      learningSignalSchema.safeParse({
        ...data.learningSignals![0],
        conceptIds: ["unknown"],
      }).success,
    ).toBe(false);
    expect(conceptsForQuestion("mechanism", ["trial-population"])).toEqual([]);
  });
  it("exports only validated structured metadata, with no identity or raw question fields", () => {
    const data = profile(),
      writer = signalWriter(data);
    writer.start();
    const text = "Jane Doe MRN 12345 was diabetes required?";
    writer.observe(
      { type: "question_asked", category: classifyQuestion(text) },
      randomUUID(),
    );
    writer.grade("B", true);
    writer.complete();
    const payload = buildLearningSignalPayload(
      data.learningSignals!,
      data.run!.id,
    );
    expect(learningSignalPayloadSchema.safeParse(payload).success).toBe(true);
    expect(payload?.learning.questionsAsked).toEqual([
      { category: "study_population", count: 1 },
    ]);
    expect(JSON.stringify(data.learningSignals)).not.toMatch(/Jane|12345|MRN/);
    expect(JSON.stringify(payload)).not.toMatch(
      /sessionId|transcript|Jane|12345|profile/,
    );
    expect(buildLearningSignalPayload([], randomUUID())).toBeNull();
  });
});
describe("adaptive selection", () => {
  it("explains the empty-history demo selection and never invents a new topic", () => {
    expect(selectNextRound([])).toMatchObject({
      roundId: "dapa-hf-01",
      kind: "new",
    });
    expect(selectNextRound([])?.reason).toContain("No learning history");
    expect(selectNextRound([], [])).toBeNull();
  });
  it("selects previous misses before overdue and chooses overdue before new supported topics", () => {
    const data = profile(),
      writer = signalWriter(data);
    writer.start();
    writer.grade("A", false);
    expect(
      selectNextRound(data.learningSignals!, supportedRounds, undefined, {
        "dapa-hf-01": "2020-01-01T00:00:00Z",
      })?.kind,
    ).toBe("missed");
    const good = profile();
    signalWriter(good).start();
    signalWriter(good).grade("B", true);
    expect(
      selectNextRound(good.learningSignals!, supportedRounds, undefined, {
        "dapa-hf-01": "2020-01-01T00:00:00Z",
      })?.kind,
    ).toBe("overdue");
  });
  it("ignores an unknown concept priority instead of selecting unsupported content", () => {
    const unknown = [
      { id: "invented", priority: 100, unresolvedMiss: true },
    ] as unknown as ReturnType<typeof reduceLearningSignals>;
    expect(selectNextRound([], supportedRounds, unknown)?.kind).toBe("new");
  });
});
