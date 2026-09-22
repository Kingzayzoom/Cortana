import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { applyLearningAction } from "../src/lib/learning/actions";
import { emptyProgress, type StoredProgress } from "../src/lib/server/store";
import { ROUND_ID, unsupportedAnswer } from "../src/lib/content/round";

function begin() {
  const data = emptyProgress();
  applyLearningAction(data, { action: "begin", mode: "preview" });
  return { data, runId: data.run!.id };
}

function toChallenge(data: StoredProgress, runId: string) {
  for (const sectionId of ["finding", "limitation"] as const)
    applyLearningAction(data, {
      action: "stage",
      runId,
      stageId: "briefing",
      sectionId,
    });
  applyLearningAction(data, { action: "stage", runId, stageId: "challenge" });
}

const answer = (runId: string, text: string, requestId = randomUUID()) => ({
  action: "answer" as const,
  runId,
  roundId: ROUND_ID as typeof ROUND_ID,
  questionId: "diabetes-eligibility" as const,
  answer: text,
  requestId,
});

describe("applyLearningAction", () => {
  it("refuses to skip the briefing or jump more than one section", () => {
    const { data, runId } = begin();
    expect(() =>
      applyLearningAction(data, {
        action: "stage",
        runId,
        stageId: "challenge",
      }),
    ).toThrow("Finish the briefing");
    expect(() =>
      applyLearningAction(data, {
        action: "stage",
        runId,
        stageId: "briefing",
        sectionId: "limitation",
      }),
    ).toThrow("Invalid section checkpoint");
  });

  it("rejects events from an earlier run", () => {
    const { data } = begin();
    expect(() =>
      applyLearningAction(data, {
        action: "stage",
        runId: randomUUID(),
        stageId: "briefing",
      }),
    ).toThrow("earlier round");
  });

  it("does not record an unclear answer as an attempt", () => {
    const { data, runId } = begin();
    toChallenge(data, runId);
    const result = applyLearningAction(data, answer(runId, "maybe B or C"));
    expect(result).toMatchObject({ grade: { verdict: "clarify" } });
    expect(data.attempts).toHaveLength(0);
    expect(data.run!.stage).toBe("challenge");
  });

  it("returns the original grade for a retried request and refuses a reused id", () => {
    const { data, runId } = begin();
    toChallenge(data, runId);
    const requestId = randomUUID();
    const first = applyLearningAction(data, answer(runId, "B", requestId));
    const retry = applyLearningAction(data, answer(runId, "B", requestId));
    expect(retry).toEqual(first);
    expect(data.attempts).toHaveLength(1);
    expect(() =>
      applyLearningAction(data, answer(runId, "A", requestId)),
    ).toThrow("already used");
  });

  it("stores only a digest of the request, never the spoken answer", () => {
    const { data, runId } = begin();
    toChallenge(data, runId);
    applyLearningAction(data, answer(runId, "I think it is B, Jane Doe"));
    expect(JSON.stringify(data.requests)).not.toContain("Jane Doe");
  });

  it("answers curated questions from a source and declines the rest", () => {
    const { data, runId } = begin();
    expect(
      applyLearningAction(data, {
        action: "question",
        runId,
        question: "Was diabetes required?",
      }),
    ).toMatchObject({ supported: true, sourceIds: ["dapa-diabetes"] });
    expect(
      applyLearningAction(data, {
        action: "question",
        runId,
        question: "What dose should I prescribe?",
      }),
    ).toEqual({ answer: unsupportedAnswer, sourceIds: [], supported: false });
  });
});
