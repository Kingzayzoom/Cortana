import { z } from "zod";
import { ROUND_ID } from "../content/round";
import { observationSchema } from "../learning-signals/types";
export const sourceId = z.enum(["dapa-hf", "dapa-diabetes"]);
export const stageTool = z
  .object({
    stageId: z.enum(["briefing", "challenge", "questions"]),
    sectionId: z.enum(["population", "finding", "limitation"]).optional(),
  })
  .strict();
export const caseTool = z.object({ caseId: z.literal("hf-case-01") }).strict();
export const evidenceTool = z
  .object({ sourceIds: z.array(sourceId).min(1).max(2) })
  .strict();
export const answerTool = z
  .object({
    roundId: z.literal(ROUND_ID),
    questionId: z.literal("diabetes-eligibility"),
    answer: z.string().trim().min(1).max(600),
    requestId: z.string().uuid(),
  })
  .strict();
export const completionTool = z
  .object({ roundId: z.literal(ROUND_ID), requestId: z.string().uuid() })
  .strict();
// The model supplies semantic parameters; the app owns idempotency IDs.
export const clientAnswerTool = answerTool.omit({ requestId: true });
export const clientCompletionTool = completionTool.omit({ requestId: true });
export const contextTool = z.object({ roundId: z.literal(ROUND_ID) }).strict();
export const preferencesSchema = z
  .object({
    name: z.string().trim().min(1).max(40),
    timezone: z
      .string()
      .max(80)
      .refine((v) => {
        try {
          new Intl.DateTimeFormat("en", { timeZone: v });
          return true;
        } catch {
          return false;
        }
      }),
    reducedMotion: z.boolean(),
    transcript: z.boolean(),
  })
  .strict();
const run = { runId: z.string().uuid() };
export const learningRequest = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("begin"),
      mode: z.enum(["voice", "preview"]).optional(),
    })
    .strict(),
  z
    .object({
      action: z.literal("observe"),
      ...run,
      eventId: z.string().uuid(),
      observation: observationSchema,
    })
    .strict(),
  z.object({ action: z.literal("stage"), ...run, ...stageTool.shape }).strict(),
  z
    .object({ action: z.literal("answer"), ...run, ...answerTool.shape })
    .strict(),
  z
    .object({ action: z.literal("complete"), ...run, ...completionTool.shape })
    .strict(),
  z
    .object({
      action: z.literal("question"),
      ...run,
      question: z.string().trim().min(1).max(600),
    })
    .strict(),
  z
    .object({
      action: z.literal("preferences"),
      preferences: preferencesSchema,
    })
    .strict(),
  z
    .object({ action: z.literal("reset"), confirmation: z.literal("RESET") })
    .strict(),
]);
