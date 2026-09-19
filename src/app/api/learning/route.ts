import { randomUUID, createHash } from "node:crypto";
import { signalWriter } from "@/lib/learning-signals/server";
import { classifyQuestion } from "@/lib/learning-signals/adapter";
import { learningRequest } from "@/lib/validation/contracts";
import {
  assertOrigin,
  profileSession,
  rateLimit,
  readBody,
  RequestError,
  safeError,
} from "@/lib/server/session";
import { emptyProgress, snapshot, withProgress } from "@/lib/server/store";
import { completeProgress, gradeAnswer } from "@/lib/learning/rules";
import {
  CONTENT_VERSION,
  ROUND_ID,
  round,
  sources,
  unsupportedAnswer,
} from "@/lib/content/round";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const id = await profileSession();
    if (!id)
      throw new RequestError(
        "Refresh the workspace to begin a demo session.",
        401,
      );
    await rateLimit(`learn:${id}`, 90);
    const parsed = learningRequest.safeParse(await readBody(request));
    if (!parsed.success)
      throw new RequestError(
        "Unknown content or invalid request. Please use the current round.",
      );
    const body = parsed.data;
    const result = await withProgress(id, (data) => {
      let extra: Record<string, unknown> = {};
      if (body.action === "preferences") data.preferences = body.preferences;
      else if (body.action === "reset") Object.assign(data, emptyProgress());
      else if (body.action === "begin") {
        data.run = {
          mode: body.mode ?? "preview",
          id: randomUUID(),
          stage: "briefing",
          section: 0,
          grade: null,
          completed: false,
        };
        if (data.run.mode === "preview") signalWriter(data).start();
      } else {
        if (!data.run || data.run.id !== body.runId)
          throw new RequestError(
            "This event belongs to an earlier round. Reopen the current round.",
            409,
          );
        const signals = signalWriter(data);
        if (body.action === "observe") {
          signals.observe(body.observation, body.eventId);
        } else if (body.action === "stage") {
          const current = data.run.stage;
          const allowed: Record<string, string[]> = {
            briefing: ["briefing", "challenge"],
            challenge: ["challenge"],
            feedback: ["questions"],
            questions: ["questions"],
            completed: [],
            ready: [],
          };
          if (!allowed[current].includes(body.stageId))
            throw new RequestError(
              "Finish the current section before continuing.",
              409,
            );
          const index = body.sectionId
            ? round.sections.findIndex((s) => s.id === body.sectionId)
            : data.run.section;
          if (
            body.stageId === "briefing" &&
            (index < data.run.section || index > data.run.section + 1)
          )
            throw new RequestError("Invalid section checkpoint.", 409);
          if (body.stageId === "challenge" && data.run.section < 2)
            throw new RequestError(
              "Finish the briefing before the challenge.",
              409,
            );
          data.run.stage = body.stageId;
          data.run.section = index;
          signals.start();
          if (body.stageId === "briefing") signals.section();
          if (body.stageId === "challenge") signals.briefingCompleted();
        } else if (body.action === "answer" || body.action === "complete") {
          const fingerprint = createHash("sha256")
            .update(JSON.stringify(body))
            .digest("hex");
          const prior = data.requests[body.requestId];
          if (prior) {
            const priorFingerprint = /^[a-f0-9]{64}$/.test(prior.fingerprint)
              ? prior.fingerprint
              : createHash("sha256").update(prior.fingerprint).digest("hex");
            if (priorFingerprint !== fingerprint)
              throw new RequestError(
                "Request ID already used for another operation.",
                409,
              );
            return { ...snapshot(data), ...(prior.result as object) };
          }
          if (body.action === "answer") {
            if (data.run.grade) extra = { grade: data.run.grade };
            else {
              if (data.run.stage !== "challenge")
                throw new RequestError(
                  "Open the challenge before submitting an answer.",
                  409,
                );
              const grade = gradeAnswer(body.answer);
              extra = { grade };
              if (grade.verdict !== "clarify") {
                signals.start();
                signals.grade(
                  grade.answerId! as "A" | "B" | "C",
                  grade.verdict === "correct",
                );
                data.run.grade = grade;
                data.run.stage = "feedback";
                data.attempts.push({
                  id: randomUUID(),
                  roundId: ROUND_ID,
                  version: CONTENT_VERSION,
                  answerId: grade.answerId!,
                  correct: grade.verdict === "correct",
                  at: new Date().toISOString(),
                });
              }
            }
          } else {
            if (!["questions", "completed"].includes(data.run.stage))
              throw new RequestError(
                "Continue to your questions before completing the round.",
                409,
              );
            completeProgress(data, new Date());
            signals.complete();
          }
          data.requests[body.requestId] = { fingerprint, result: extra };
          const keys = Object.keys(data.requests);
          if (keys.length > 500) delete data.requests[keys[0]];
        } else if (body.action === "question") {
          signals.observe(
            {
              type: "question_asked",
              category: classifyQuestion(body.question),
            },
            randomUUID(),
          );
          const q = body.question
            .toLowerCase()
            .trim()
            .replace(/[?!.]+$/, "");
          let answer = unsupportedAnswer,
            sourceIds: string[] = [];
          if (
            /^(who was (included|studied)|who was included in (that|the) study|what was the (study )?population)$/.test(
              q,
            )
          ) {
            answer = round.sections[0].text;
            sourceIds = ["dapa-hf"];
          } else if (
            /^(did (participants|patients) need diabetes|was diabetes required|what about (people )?without diabetes)$/.test(
              q,
            )
          ) {
            answer = sources[1].summary;
            sourceIds = ["dapa-diabetes"];
          } else if (
            /^(what (did the study find|was the result|were the results)|what was the primary (outcome|endpoint))$/.test(
              q,
            )
          ) {
            answer = sources[0].summary;
            sourceIds = ["dapa-hf"];
          } else if (
            /^(what (is|was|are|were) (the |an? )?(important )?limitations?|what does(n’t| not) it establish)$/.test(
              q,
            )
          ) {
            answer = sources[1].scope;
            sourceIds = ["dapa-diabetes"];
          }
          extra = { answer, sourceIds, supported: sourceIds.length > 0 };
        }
      }
      return { ...snapshot(data), ...extra };
    });
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return safeError(error);
  }
}
