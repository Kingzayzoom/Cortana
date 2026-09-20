import { randomUUID } from "node:crypto";
import { withProgress, type StoredProgress } from "../server/store";
import { RequestError } from "../server/errors";
import { localDate, shiftDay, streak } from "../learning/rules";
import { ProfileLearningSignalRepository } from "../learning-signals/storage";
import type { LearningSignal, ConceptId } from "../learning-signals/types";
import { questions } from "./questions/bank";
import { buildDailyPrime } from "./generator";
import { gradePrimeAnswer, normalizePrimeAnswer } from "./grading";
import {
  primeActionSchema,
  type PrimeSession,
  type PrimeView,
  type Review,
} from "./types";
import { defaultScenario } from "../context/demo";
import { phoneConfigured } from "../server/phone";
import { primeToolSchemas } from "./tools";
export async function runPrimeTool(
  profile: string,
  tool: keyof typeof primeToolSchemas,
  input: unknown,
) {
  const args = primeToolSchemas[tool].parse(input);
  const result =
    tool === "get_prime_session"
      ? await actPrime(profile, { action: "start" })
      : tool === "get_prime_feedback"
        ? await readPrime(profile)
        : await actPrime(profile, {
            ...args,
            action:
              tool === "submit_prime_answer"
                ? "answer"
                : tool === "advance_prime"
                  ? "next"
                  : "complete",
          });
  if ("sessionId" in args && args.sessionId !== result.session?.id)
    throw new RequestError("Prime session does not match.", 409);
  return {
    ...result,
    instruction:
      "Ask only the current question. Wait for submit_prime_answer before correctness or explanation. After feedback and learner confirmation call advance_prime. After three graded questions call complete_prime. No clinical advice.",
  };
}
export function reviewAfter(
  previous: Review | undefined,
  conceptId: ConceptId,
  correct: boolean,
  at: Date,
  date: string,
): Review {
  const successfulReviews = correct
    ? (previous?.successfulReviews ?? 0) + 1
    : 0;
  return {
    conceptId,
    lastReviewedAt: at.toISOString(),
    nextReviewAt: shiftDay(
      date,
      correct
        ? successfulReviews === 1
          ? 2
          : successfulReviews === 2
            ? 5
            : 10
        : 1,
    ),
    successfulReviews,
    missedReviews: (previous?.missedReviews ?? 0) + (correct ? 0 : 1),
    needsReinforcement: !correct,
  };
}
function state(data: StoredProgress) {
  return (data.prime ??= { sessions: [], reviews: {} });
}
function daily(data: StoredProgress, now: Date) {
  const p = state(data),
    date = localDate(now, data.preferences.timezone);
  // Finish a started set even when the local calendar crosses midnight.
  let session =
    p.sessions.findLast((s) => s.startedAt && !s.completedAt) ??
    p.sessions.find(
      (s) =>
        s.date === date ||
        (s.completedAt &&
          localDate(new Date(s.completedAt), data.preferences.timezone) ===
            date),
    );
  if (!session) {
    const scenario =
      data.contextScenario === undefined
        ? defaultScenario
        : data.contextScenario;
    session = {
      id: randomUUID(),
      date,
      selection: buildDailyPrime(
        p,
        questions,
        date,
        scenario?.educationTriggers,
        data.learningSignals,
      ),
      cursor: 0,
      answers: {},
      xp: 0,
    };
    p.sessions.push(session);
  }
  if(!session.startedAt){
    const context=data.contextScenario===undefined?defaultScenario:data.contextScenario;
    session.selection=buildDailyPrime({...p,sessions:p.sessions.filter(s=>s.id!==session.id)},questions,date,context?.educationTriggers,data.learningSignals);
  }
  return session;
}
function emit(
  data: StoredProgress,
  s: PrimeSession,
  type: LearningSignal["type"],
  now: Date,
  questionId?: string,
  sourceId?: "dapa-hf" | "dapa-diabetes",
) {
  const q = questions.find((q) => q.id === questionId);
  const signals = (data.learningSignals ??= []);
  // Semantic idempotency: one event of each kind per question/source in a session.
  if (
    signals.some(
      (e) =>
        e.sessionId === s.id &&
        e.type === type &&
        ("questionId" in e ? e.questionId : undefined) === questionId &&
        ("sourceId" in e ? e.sourceId : undefined) === sourceId,
    )
  )
    return;
  new ProfileLearningSignalRepository(signals).append({
    id: randomUUID(),
    timestamp: now.toISOString(),
    roundId: "dapa-hf-01",
    topicId: "heart-failure",
    sessionId: s.id,
    conceptIds: q?.conceptIds ?? [],
    type,
    ...(questionId ? { questionId } : {}),
    ...(sourceId ? { sourceId } : {}),
    evidenceSourceIds: q?.sourceIds ?? [],
  } as LearningSignal);
}
function view(data: StoredProgress, now: Date): PrimeView {
  const p = state(data),
    s = daily(data, now),
    today = localDate(now, data.preferences.timezone);
  const answers = p.sessions.flatMap((s) => Object.values(s.answers));
  return {
    session: s,
    questions: s.selection.map((item) => {
      const q = questions.find((q) => q.id === item.questionId)!;
      const { correctOptionId, explanation, ...safe } = q;
      void correctOptionId;
      void explanation;
      return safe;
    }),
    reviews: Object.values(p.reviews),
    stats: {
      questions: answers.length,
      correct: answers.filter((a) => a.correct).length,
      reinforced: answers.filter((a) => a.reinforced).length,
      due: Object.values(p.reviews).filter((r) => r.nextReviewAt <= today)
        .length,
    },
    streak: streak(data.practiceDays, today),
    today,
    phoneConfigured: phoneConfigured(),
  };
}
export async function readPrime(profile: string, now = new Date()) {
  return withProgress(profile, (data) => view(data, now));
}
export async function actPrime(
  profile: string,
  input: unknown,
  now = new Date(),
) {
  const action = primeActionSchema.parse(input);
  return withProgress(profile, (data) => {
    const p = state(data),
      s = daily(data, now),
      date = localDate(now, data.preferences.timezone);
    if ("sessionId" in action && action.sessionId !== s.id)
      throw new RequestError(
        "This Prime session is no longer current. Refresh Prime.",
        409,
      );
    if (action.action === "start") {
      if (s.selection.length !== 3)
        throw new RequestError(
          "There are not enough supported questions for today's Prime.",
          409,
        );
      if (!s.startedAt) {
        s.startedAt = now.toISOString();
        emit(data, s, "prime_started", now);
      }
    } else {
      if (!s.startedAt) throw new RequestError("Start Prime first.", 409);
      if (action.action === "answer") {
        const existing = s.answers[action.questionId];
        if (existing) return view(data, now);
        if (
          s.completedAt ||
          s.selection[s.cursor]?.questionId !== action.questionId
        )
          throw new RequestError("Answer the current question in order.", 409);
        const q = questions.find((q) => q.id === action.questionId)!;
        const option = normalizePrimeAnswer(action.answer, q);
        if (!option)
          throw new RequestError(
            "Please choose one supplied option or say its full text. I won't grade an ambiguous response.",
          );
        const grade = gradePrimeAnswer(q.id, option);
        const reinforced =
          grade.correct &&
          (q.conceptIds.some((c) => p.reviews[c]?.needsReinforcement) || s.selection[s.cursor].reason==="reinforcement");
        s.answers[q.id] = { ...grade, reinforced };
        for (const c of q.conceptIds)
          p.reviews[c] = reviewAfter(p.reviews[c], c, grade.correct, now, date);
        emit(data, s, "prime_question_attempted", now, q.id);
        emit(
          data,
          s,
          grade.correct ? "prime_question_correct" : "prime_question_missed",
          now,
          q.id,
        );
        if (reinforced)
          new ProfileLearningSignalRepository(
            (data.learningSignals ??= []),
          ).append({
            id: randomUUID(),
            timestamp: now.toISOString(),
            roundId: "dapa-hf-01",
            topicId: "heart-failure",
            sessionId: s.id,
            conceptIds: q.conceptIds,
            type: "concept_reinforced",
          });
      }
      if (action.action === "next") {
        const index = s.selection.findIndex(
          (q) => q.questionId === action.questionId,
        );
        if (index >= 0 && index < s.cursor) return view(data, now);
        if (index !== s.cursor)
          throw new RequestError("Continue from the current question.", 409);
        if (!s.answers[s.selection[s.cursor]?.questionId])
          throw new RequestError("Submit an answer before continuing.", 409);
        if (s.cursor < 2) s.cursor++;
      }
      if (action.action === "complete" && !s.completedAt) {
        if (s.selection.length !== 3 || Object.keys(s.answers).length !== 3)
          throw new RequestError(
            "Practice all three questions before completing Prime.",
            409,
          );
        s.completedAt = now.toISOString();
        s.xp =
          50 +
          Object.values(s.answers).filter((a) => a.correct).length * 10 +
          Object.values(s.answers).filter((a) => a.reinforced).length * 10;
        if (!data.practiceDays.includes(date)) data.practiceDays.push(date);
        emit(data, s, "prime_completed", now);
      }
      if (action.action === "evidence") {
        const feedback = s.answers[action.questionId];
        if (!feedback?.sourceIds.includes(action.sourceId))
          throw new RequestError(
            "Evidence must belong to an answered question.",
            400,
          );
        emit(
          data,
          s,
          "prime_evidence_viewed",
          now,
          action.questionId,
          action.sourceId,
        );
      }
    }
    return view(data, now);
  });
}
