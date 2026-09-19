import type { OptionId, Round } from "@/lib/content/types"
import type { AgentStage } from "@/lib/validation/tools"

import type { CompletionSummary, Confidence, GradeResult } from "./types"

// Lesson state is deliberately separate from connection and voice state:
// the round can be mid-challenge whether or not anyone is currently speaking.
export const LESSON_STAGES = ["ready", "briefing", "challenge", "feedback", "questions", "completed"] as const
export type LessonStage = (typeof LESSON_STAGES)[number]

export type LessonState = {
  roundId: string
  stage: LessonStage
  /** Checkpoint inside the brief, so an interruption resumes rather than restarts. */
  sectionIndex: number
  /** Section that was playing when the learner last interrupted. */
  interruptedSectionIndex: number | null
  caseId: string | null
  confidence: Confidence | null
  pendingAnswer: OptionId | null
  grade: GradeResult | null
  evidence: { open: boolean; sourceIds: string[] }
  completion: CompletionSummary | null
}

export type LessonAction =
  | { type: "start" }
  | { type: "show_stage"; stage: AgentStage }
  | { type: "show_section"; index: number }
  | { type: "interrupted" }
  | { type: "show_case"; caseId: string }
  | { type: "set_confidence"; confidence: Confidence | null }
  | { type: "answer_pending"; answer: OptionId }
  | { type: "answer_failed" }
  | { type: "answer_graded"; grade: GradeResult }
  | { type: "open_evidence"; sourceIds: string[] }
  | { type: "close_evidence" }
  | { type: "complete"; completion: CompletionSummary }
  | { type: "reset" }

export function initialLesson(roundId: string): LessonState {
  return {
    roundId,
    stage: "ready",
    sectionIndex: 0,
    interruptedSectionIndex: null,
    caseId: null,
    confidence: null,
    pendingAnswer: null,
    grade: null,
    evidence: { open: false, sourceIds: [] },
    completion: null,
  }
}

const order = (stage: LessonStage) => LESSON_STAGES.indexOf(stage)

/**
 * Whether the round may move to `stage`. Stages only move forward, and the
 * questions stage requires a graded answer. The reason is returned to the
 * agent verbatim so it can correct course.
 */
export function canEnterStage(state: LessonState, stage: AgentStage): { ok: true } | { ok: false; reason: string } {
  if (state.stage === "completed") return { ok: false, reason: "The round is already complete." }
  if (stage === "briefing" && order(state.stage) > order("briefing")) {
    return { ok: false, reason: "The brief is finished; stages only move forward." }
  }
  if (stage === "challenge" && order(state.stage) > order("feedback")) {
    return { ok: false, reason: "The challenge is finished; stages only move forward." }
  }
  if (stage === "questions" && !state.grade) {
    return { ok: false, reason: "Present the case with show_case and grade an answer with submit_answer before the questions stage." }
  }
  return { ok: true }
}

export function lessonReducer(state: LessonState, action: LessonAction): LessonState {
  switch (action.type) {
    case "start":
      return state.stage === "ready" ? { ...state, stage: "briefing", sectionIndex: 0 } : state

    case "show_stage": {
      if (!canEnterStage(state, action.stage).ok) return state
      // Re-entering "challenge" while feedback is showing keeps the feedback.
      if (action.stage === "challenge" && state.stage === "feedback") return state
      return { ...state, stage: action.stage }
    }

    case "show_section":
      if (order(state.stage) > order("briefing")) return state
      return { ...state, stage: "briefing", sectionIndex: action.index, interruptedSectionIndex: null }

    case "interrupted":
      return state.stage === "briefing" ? { ...state, interruptedSectionIndex: state.sectionIndex } : state

    case "show_case":
      if (order(state.stage) > order("feedback")) return state
      return { ...state, caseId: action.caseId, stage: state.grade ? "feedback" : "challenge" }

    case "set_confidence":
      return state.grade ? state : { ...state, confidence: action.confidence }

    case "answer_pending":
      return state.grade ? state : { ...state, pendingAnswer: action.answer }

    case "answer_failed":
      return { ...state, pendingAnswer: null }

    case "answer_graded":
      return { ...state, grade: action.grade, pendingAnswer: null, stage: "feedback" }

    case "open_evidence":
      return { ...state, evidence: { open: true, sourceIds: action.sourceIds } }

    case "close_evidence":
      return { ...state, evidence: { ...state.evidence, open: false } }

    case "complete":
      return { ...state, stage: "completed", completion: action.completion, evidence: { ...state.evidence, open: false } }

    case "reset":
      return initialLesson(state.roundId)
  }
}

/** Which of the three round steps (brief, challenge, questions) a stage belongs to. */
export function roundStep(stage: LessonStage): 0 | 1 | 2 | null {
  switch (stage) {
    case "briefing":
      return 0
    case "challenge":
    case "feedback":
      return 1
    case "questions":
      return 2
    default:
      return null
  }
}

export function currentSection(state: LessonState, round: Round) {
  return round.sections[Math.min(state.sectionIndex, round.sections.length - 1)]
}
