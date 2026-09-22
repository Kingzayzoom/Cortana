// The exportable learning-signal payload, schema 1.0: counts and closed enums
// only, validated before download. A proposal, not an agreed contract.
import { z } from "zod";
import {
  conceptId,
  evidenceSourceId,
  questionCategory,
  learningSignalSchema,
  type LearningSignal,
} from "../learning-signals/types";
import { selectLearningSummary } from "../learning-signals/selectors";
export const learningSignalPayloadSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    source: z.literal("samantha"),
    eventType: z.literal("hcp_learning_signal"),
    timestamp: z.string().datetime(),
    round: z
      .object({
        id: z.literal("dapa-hf-01"),
        specialty: z.literal("Cardiology"),
        topic: z.literal("Heart failure"),
      })
      .strict(),
    learning: z
      .object({
        conceptsExplored: z.array(conceptId),
        questionsAsked: z.array(
          z
            .object({
              category: questionCategory,
              count: z.number().int().nonnegative(),
            })
            .strict(),
        ),
        evidenceViewed: z.array(evidenceSourceId),
        practice: z
          .object({
            attempted: z.number().int().nonnegative(),
            correct: z.number().int().nonnegative(),
          })
          .strict(),
        reinforcementTopics: z.array(conceptId),
      })
      .strict(),
  })
  .strict();
export function buildLearningSignalPayload(
  signals: readonly LearningSignal[],
  sessionId: string,
) {
  const valid = signals.map((event) => learningSignalSchema.parse(event));
  const summary = selectLearningSummary(valid, sessionId);
  if (!summary.signals.length) return null;
  return learningSignalPayloadSchema.parse({
    schemaVersion: "1.0",
    source: "samantha",
    eventType: "hcp_learning_signal",
    timestamp: summary.signals.at(-1)!.timestamp,
    round: {
      id: "dapa-hf-01",
      specialty: "Cardiology",
      topic: "Heart failure",
    },
    learning: {
      conceptsExplored: summary.conceptsExplored,
      questionsAsked: Object.entries(summary.categories).map(
        ([category, count]) => ({ category, count }),
      ),
      evidenceViewed: summary.evidenceViewed,
      practice: { attempted: summary.attempted, correct: summary.correct },
      reinforcementTopics: summary.reviewNext.map((concept) => concept.id),
    },
  });
}
