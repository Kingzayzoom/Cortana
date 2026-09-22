// Applies one learning request to a profile. The browser round and the voice
// agent's client tools both arrive here through POST /api/learning, inside a
// withProgress transaction, so every step is validated against saved state
// rather than against what the page or the model claims.
import { createHash, randomUUID } from "node:crypto";
import type { z } from "zod";
import type { StoredProgress } from "../server/store";
import { emptyProgress } from "../server/store";
import { RequestError } from "../server/errors";
import { signalWriter } from "../learning-signals/server";
import { classifyQuestion } from "../learning-signals/adapter";
import type { learningRequest } from "../validation/contracts";
import { answerFromSources, round } from "../content/round";
import { completeProgress, gradeAnswer, recordGrade } from "./rules";
import type { LessonStage } from "./types";

type LearningRequest = z.infer<typeof learningRequest>;
type RunRequest = Exclude<
  LearningRequest,
  { action: "begin" | "preferences" | "reset" }
>;

// Which stage a run may move to from where it is. Repeating the current stage
// is allowed (a reconnect replays it); skipping ahead or going back is not, so
// a late tool call from an old connection cannot rewind the round.
const NEXT_STAGES: Record<LessonStage, LessonStage[]> = {
  ready: [],
  briefing: ["briefing", "challenge"],
  challenge: ["challenge"],
  feedback: ["questions"],
  questions: ["questions"],
  completed: [],
};

// Retried requests are recognised by requestId. Only a digest of the body is
// kept, because an answer body can hold free text the learner said.
const MAX_REMEMBERED_REQUESTS = 500;

/** Returns the fields to merge into the profile snapshot sent back. */
export function applyLearningAction(
  data: StoredProgress,
  body: LearningRequest,
): Record<string, unknown> {
  switch (body.action) {
    case "preferences":
      data.preferences = body.preferences;
      return {};
    case "reset":
      Object.assign(data, emptyProgress());
      return {};
    case "begin":
      data.run = {
        mode: body.mode ?? "preview",
        id: randomUUID(),
        stage: "briefing",
        section: 0,
        grade: null,
        completed: false,
      };
      // A voice run starts its signal when the SDK actually connects.
      if (data.run.mode === "preview") signalWriter(data).start();
      return {};
    default:
      return applyToRun(data, body);
  }
}

function applyToRun(data: StoredProgress, body: RunRequest) {
  const run = data.run;
  if (!run || run.id !== body.runId)
    throw new RequestError(
      "This event belongs to an earlier round. Reopen the current round.",
      409,
    );
  const signals = signalWriter(data);
  switch (body.action) {
    case "observe":
      signals.observe(body.observation, body.eventId);
      return {};

    case "stage": {
      if (!NEXT_STAGES[run.stage].includes(body.stageId))
        throw new RequestError(
          "Finish the current section before continuing.",
          409,
        );
      const index = body.sectionId
        ? round.sections.findIndex((s) => s.id === body.sectionId)
        : run.section;
      // Sections advance one at a time.
      if (
        body.stageId === "briefing" &&
        (index < run.section || index > run.section + 1)
      )
        throw new RequestError("Invalid section checkpoint.", 409);
      if (
        body.stageId === "challenge" &&
        run.section < round.sections.length - 1
      )
        throw new RequestError(
          "Finish the briefing before the challenge.",
          409,
        );
      run.stage = body.stageId;
      run.section = index;
      signals.start();
      if (body.stageId === "briefing") signals.section();
      if (body.stageId === "challenge") signals.briefingCompleted();
      return {};
    }

    case "question":
      // The text is classified and discarded; only the category is stored.
      signals.observe(
        { type: "question_asked", category: classifyQuestion(body.question) },
        randomUUID(),
      );
      return answerFromSources(body.question);

    case "answer":
    case "complete":
      return once(data, body, () => {
        if (body.action === "complete") {
          if (!["questions", "completed"].includes(run.stage))
            throw new RequestError(
              "Continue to your questions before completing the round.",
              409,
            );
          completeProgress(data, new Date());
          signals.complete();
          return {};
        }
        if (run.grade) return { grade: run.grade };
        if (run.stage !== "challenge")
          throw new RequestError(
            "Open the challenge before submitting an answer.",
            409,
          );
        const grade = gradeAnswer(body.answer);
        // An unclear answer is not an attempt: ask again rather than guess.
        if (grade.verdict !== "clarify") {
          signals.start();
          signals.grade(
            grade.answerId as "A" | "B" | "C",
            grade.verdict === "correct",
          );
          recordGrade(data, grade);
        }
        return { grade };
      });
  }
}

// Runs a rewarding operation at most once per requestId. A retry with the same
// body gets the original result; the same id with a different body is refused.
function once(
  data: StoredProgress,
  body: RunRequest & { requestId: string },
  operation: () => Record<string, unknown>,
) {
  const fingerprint = createHash("sha256")
    .update(JSON.stringify(body))
    .digest("hex");
  const prior = data.requests[body.requestId];
  if (prior) {
    if (prior.fingerprint !== fingerprint)
      throw new RequestError(
        "Request ID already used for another operation.",
        409,
      );
    return prior.result as Record<string, unknown>;
  }
  const result = operation();
  data.requests[body.requestId] = { fingerprint, result };
  const ids = Object.keys(data.requests);
  if (ids.length > MAX_REMEMBERED_REQUESTS) delete data.requests[ids[0]];
  return result;
}
