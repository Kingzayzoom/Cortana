import { z } from "zod";
import { conceptId, evidenceSourceId } from "../learning-signals/types";
export const primeQuestionSchema = z
  .object({
    id: z.string().min(1),
    topicId: z.literal("heart-failure"),
    conceptIds: z.array(conceptId).min(1),
    type: z.enum(["multiple_choice", "true_false", "best_supported"]),
    prompt: z.string().min(1),
    options: z
      .array(z.object({ id: z.enum(["A", "B", "C"]), text: z.string().min(1) }))
      .min(2)
      .max(3),
    correctOptionId: z.enum(["A", "B", "C"]),
    explanation: z.string().min(1),
    sourceIds: z.array(evidenceSourceId).min(1),
    difficulty: z.enum(["foundation", "standard", "advanced"]),
    tags: z.array(z.string()),
  })
  .strict()
  .superRefine((q, c) => {
    if (
      !q.options.some((o) => o.id === q.correctOptionId) ||
      new Set(q.options.map((o) => o.id)).size !== q.options.length
    )
      c.addIssue({ code: "custom", message: "Invalid option IDs" });
    if (
      q.type === "true_false" &&
      (q.options.length !== 2 ||
        q.options[0].text !== "True" ||
        q.options[1].text !== "False")
    )
      c.addIssue({ code: "custom", message: "True/false options required" });
  });
export type PrimeQuestion = z.infer<typeof primeQuestionSchema>;
export type PublicQuestion = Omit<
  PrimeQuestion,
  "correctOptionId" | "explanation"
>;
export type Review = {
  conceptId: z.infer<typeof conceptId>;
  lastReviewedAt: string;
  nextReviewAt: string;
  successfulReviews: number;
  missedReviews: number;
  needsReinforcement: boolean;
};
export type Grade = {
  correct: boolean;
  selectedOptionId: string;
  correctOptionId: string;
  explanation: string;
  sourceIds: string[];
  reinforced: boolean;
};
export type Selection = {
  questionId: string;
  reason: "reinforcement" | "review" | "new" | "practice";
  contextRelevant: boolean;
};
export type PrimeSession = {
  id: string;
  date: string;
  selection: Selection[];
  cursor: number;
  startedAt?: string;
  completedAt?: string;
  answers: Record<string, Grade>;
  xp: number;
};
export type PrimeState = {
  sessions: PrimeSession[];
  reviews: Partial<Record<z.infer<typeof conceptId>, Review>>;
};
export type PrimeView = {
  session: PrimeSession | null;
  questions: PublicQuestion[];
  reviews: Review[];
  stats: {
    questions: number;
    correct: number;
    reinforced: number;
    due: number;
  };
  streak: number;
  today: string;
  phoneConfigured: boolean;
};
export const primeActionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start") }).strict(),
  z
    .object({
      action: z.literal("answer"),
      sessionId: z.string().uuid(),
      questionId: z.string().min(1).max(80),
      answer: z.string().trim().min(1).max(300),
    })
    .strict(),
  z
    .object({
      action: z.literal("next"),
      sessionId: z.string().uuid(),
      questionId: z.string().min(1).max(80),
    })
    .strict(),
  z
    .object({ action: z.literal("complete"), sessionId: z.string().uuid() })
    .strict(),
  z
    .object({
      action: z.literal("evidence"),
      sessionId: z.string().uuid(),
      questionId: z.string().min(1).max(80),
      sourceId: evidenceSourceId,
    })
    .strict(),
]);
