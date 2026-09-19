import "server-only"

import { answerKeys } from "@/lib/content/answer-keys"
import type { OptionId } from "@/lib/content/types"

import type { GradeResult } from "./types"

/**
 * Deterministic grading against the stored answer key. The model never decides
 * correctness; it only explains the result this returns.
 */
export function gradeAnswer(roundId: string, questionId: string, answer: OptionId): GradeResult | null {
  const key = answerKeys[questionId]
  if (!key) return null

  return {
    roundId,
    questionId,
    caseId: key.caseId,
    submitted: answer,
    correctOption: key.correctOption,
    isCorrect: answer === key.correctOption,
    rationale: key.rationale,
    worthNoting: key.worthNoting,
    feedback: key.optionFeedback[answer],
    sourceIds: key.sourceIds,
  }
}
