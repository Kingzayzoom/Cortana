import type { OptionId } from "@/lib/content/types"

export const CONFIDENCE_LEVELS = ["guessing", "somewhat", "very"] as const
export type Confidence = (typeof CONFIDENCE_LEVELS)[number]

export const CONFIDENCE_LABELS: Record<Confidence, string> = {
  guessing: "Guessing",
  somewhat: "Somewhat confident",
  very: "Very confident",
}

/** Result of deterministic, server-side grading. */
export type GradeResult = {
  roundId: string
  questionId: string
  caseId: string
  submitted: OptionId
  correctOption: OptionId
  isCorrect: boolean
  rationale: string
  worthNoting?: string
  /** Feedback for the option the learner chose. */
  feedback: string
  sourceIds: string[]
}

export type CompletionSummary = {
  roundId: string
  xpEarned: number
  breakdown: { label: string; xp: number }[]
  totalXp: number
  streak: { current: number; longest: number; extended: boolean }
  alreadyCompleted: boolean
}

export type GroundedAnswer = {
  answer: string
  sourceIds: string[]
  coveredByEvidence: boolean
}
