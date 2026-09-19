import { z } from "zod";
export const conceptId = z.enum([
  "trial-population",
  "primary-endpoint",
  "evidence-limitations",
]);
export type ConceptId = z.infer<typeof conceptId>;
export const conceptLabels: Record<ConceptId, string> = {
  "trial-population": "Trial population",
  "primary-endpoint": "Primary endpoint",
  "evidence-limitations": "Evidence limitations",
};
export const questionCategory = z.enum([
  "evidence",
  "study_population",
  "study_design",
  "endpoint",
  "safety",
  "mechanism",
  "limitation",
  "clarification",
  "other",
]);
export type QuestionCategory = z.infer<typeof questionCategory>;
export const evidenceSourceId = z.enum(["dapa-hf", "dapa-diabetes"]);
export const signalStage = z.enum([
  "briefing",
  "challenge",
  "feedback",
  "questions",
  "completed",
]);
export const sectionId = z.enum(["population", "finding", "limitation"]);
const base = {
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  roundId: z.literal("dapa-hf-01"),
  topicId: z.literal("heart-failure"),
  conceptIds: z.array(conceptId).max(3),
  sessionId: z.string().uuid(),
  evidenceSourceIds: z.array(evidenceSourceId).max(2).optional(),
};
export const learningSignalSchema = z.discriminatedUnion("type", [
  z
    .object({
      ...base,
      type: z.literal("round_started"),
      mode: z.enum(["voice", "preview"]),
    })
    .strict(),
  z
    .object({ ...base, type: z.literal("briefing_section_viewed"), sectionId })
    .strict(),
  z.object({ ...base, type: z.literal("briefing_completed") }).strict(),
  z
    .object({
      ...base,
      type: z.literal("briefing_interrupted"),
      stage: z.literal("briefing"),
      sectionId,
    })
    .strict(),
  z
    .object({
      ...base,
      type: z.literal("question_asked"),
      category: questionCategory,
      stage: signalStage,
    })
    .strict(),
  z
    .object({
      ...base,
      type: z.literal("evidence_viewed"),
      sourceId: evidenceSourceId,
      stage: signalStage,
    })
    .strict(),
  z
    .object({
      ...base,
      type: z.literal("challenge_attempted"),
      questionId: z.literal("diabetes-eligibility"),
      selectedOptionId: z.enum(["A", "B", "C"]),
      attemptNumber: z.number().int().positive(),
    })
    .strict(),
  z
    .object({
      ...base,
      type: z.literal("challenge_resolved"),
      questionId: z.literal("diabetes-eligibility"),
      correct: z.boolean(),
      attemptNumber: z.number().int().positive(),
    })
    .strict(),
  z.object({ ...base, type: z.literal("concept_reinforced") }).strict(),
  z.object({ ...base, type: z.literal("round_completed") }).strict(),
]);
export type LearningSignal = z.infer<typeof learningSignalSchema>;
export type SignalDetail = LearningSignal extends infer S
  ? S extends LearningSignal
    ? Omit<S, keyof typeof base>
    : never
  : never;
// Client observations only. Grading, concepts, timestamps and completion are server-owned.
export const observationSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("round_started"),
      mode: z.enum(["voice", "preview"]),
    })
    .strict(),
  z.object({ type: z.literal("briefing_interrupted"), sectionId }).strict(),
  z
    .object({ type: z.literal("question_asked"), category: questionCategory })
    .strict(),
  z
    .object({ type: z.literal("evidence_viewed"), sourceId: evidenceSourceId })
    .strict(),
]);
export type Observation = z.infer<typeof observationSchema>;
