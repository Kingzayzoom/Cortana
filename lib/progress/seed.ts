import type { OptionId } from "@/lib/content/types"
import { addDays, XP_RULES, type Attempt, type Completion, type Progress } from "@/lib/learning/progress"
import type { Confidence } from "@/lib/learning/types"

type SampleDay = {
  daysAgo: number
  topicId: string
  isCorrect: boolean
  confidence: Confidence
}

// Sample history for the demo profile, dated relative to today so the demo
// works on any day. Every record is flagged `sample` and labeled in the UI.
const SAMPLE_DAYS: SampleDay[] = [
  { daysAgo: 12, topicId: "heart-failure", isCorrect: false, confidence: "somewhat" },
  { daysAgo: 9, topicId: "hypertension", isCorrect: true, confidence: "somewhat" },
  { daysAgo: 8, topicId: "hypertension", isCorrect: true, confidence: "very" },
  { daysAgo: 5, topicId: "heart-failure", isCorrect: true, confidence: "very" },
  { daysAgo: 4, topicId: "hypertension", isCorrect: true, confidence: "very" },
  { daysAgo: 3, topicId: "anticoagulation", isCorrect: true, confidence: "somewhat" },
  { daysAgo: 2, topicId: "hypertension", isCorrect: true, confidence: "very" },
  { daysAgo: 1, topicId: "anticoagulation", isCorrect: false, confidence: "very" },
]

export function createSampleProgress(today: string): Progress {
  const attempts: Attempt[] = []
  const completions: Completion[] = []

  for (const day of SAMPLE_DAYS) {
    const date = addDays(today, -day.daysAgo)
    const roundId = `sample-${day.topicId}`
    attempts.push({
      id: `${roundId}:q:${date}`,
      roundId,
      questionId: `${roundId}-q`,
      topicId: day.topicId,
      answer: (day.isCorrect ? "B" : "C") as OptionId,
      isCorrect: day.isCorrect,
      confidence: day.confidence,
      answeredOn: date,
      answeredAt: `${date}T08:00:00.000Z`,
      sample: true,
    })
    completions.push({
      id: `${roundId}:${date}`,
      roundId,
      topicId: day.topicId,
      completedOn: date,
      xpEarned: XP_RULES.roundComplete + (day.isCorrect ? XP_RULES.correctAnswer : 0),
      sample: true,
    })
  }

  return {
    version: 1,
    xp: completions.reduce((sum, c) => sum + c.xpEarned, 0),
    // Days 5 through 1 ago are consecutive.
    streak: { current: 5, longest: 5, lastCompletedOn: addDays(today, -1) },
    attempts,
    completions,
  }
}
