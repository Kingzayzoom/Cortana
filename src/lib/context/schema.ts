import { z } from "zod";
export const MAX_CONTEXT_BYTES = 64 * 1024;
const text = z.string().trim().min(1).max(600);
const id = z
  .string()
  .regex(
    /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/,
    "Use a nonempty ID containing letters, numbers, hyphens or underscores",
  );
const list = z.array(text).max(30).default([]);
const value = z.union([z.string().max(100), z.number().finite()]);
const time = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:mm, for example 08:30");
const timestamp = z.iso.datetime({ offset: true });
export const clinicianSchema = z
  .object({ id, displayName: text, specialty: text, role: text })
  .strict();
export const facilitySchema = z
  .object({ id, displayName: text, unit: text, locationLabel: text.optional() })
  .strict();
export const shiftSchema = z
  .object({
    date: z.iso.date(),
    startTime: time,
    endTime: time.optional(),
    prioritySummary: list,
  })
  .strict();
export const changeSchema = z
  .object({
    id,
    concept: text,
    direction: z.enum(["up", "down", "stable", "new", "changed"]),
    previous: value.optional(),
    current: value.optional(),
    unit: z.string().max(40).optional(),
    explanation: text,
    timestamp: timestamp.optional(),
  })
  .strict();
export const scheduledEventSchema = z
  .object({
    id,
    time,
    label: text,
    category: z.enum([
      "lab",
      "imaging",
      "rounds",
      "consult",
      "procedure",
      "other",
    ]),
    status: z.enum(["scheduled", "pending", "completed"]),
  })
  .strict();
export const labSchema = z
  .object({
    id,
    name: text,
    value,
    unit: z.string().max(40).optional(),
    previous: value.optional(),
    timestamp: timestamp.optional(),
  })
  .strict();
export const caseSchema = z
  .object({
    id,
    displayName: z
      .string()
      .regex(
        /^Synthetic Patient \d{1,6}$/,
        "Use a synthetic label such as Synthetic Patient 024; never a real name",
      ),
    synthetic: z.literal(true),
    demographics: z
      .object({ age: z.number().int().min(0).max(120), sex: text })
      .strict(),
    reasonForAdmission: text,
    history: list,
    currentStatus: z
      .object({
        summary: text,
        vitals: z
          .record(z.string().min(1).max(60), value)
          .refine((v) => Object.keys(v).length <= 20, "At most 20 vitals")
          .optional(),
      })
      .strict(),
    changes: z.array(changeSchema).max(30).default([]),
    labs: z.array(labSchema).max(30).default([]),
    scheduledEvents: z.array(scheduledEventSchema).max(30).default([]),
    itemsForReview: list,
    allowedQuestions: list,
  })
  .strict();
export const consultSchema = z
  .object({
    id,
    caseId: id,
    specialty: text,
    reason: text,
    time: time.optional(),
    status: z.enum(["requested", "scheduled", "completed"]),
  })
  .strict();
export const hospitalEventSchema = z
  .object({ id, time, label: text, detail: text })
  .strict();
export const timelineSchema = z
  .object({
    id,
    time,
    label: text,
    detail: text.optional(),
    caseId: id.optional(),
  })
  .strict();
export const educationSchema = z
  .object({ id, topic: text, reason: text, roundId: id.optional() })
  .strict();
export const contextScenarioSchema = z
  .object({
    schemaVersion: z.literal("1.0"),
    id,
    title: text,
    description: text,
    synthetic: z.literal(true),
    clinician: clinicianSchema,
    facility: facilitySchema,
    shift: shiftSchema,
    primaryCase: caseSchema.optional(),
    secondaryCases: z.array(caseSchema).max(5).default([]),
    consults: z.array(consultSchema).max(20).default([]),
    hospitalEvents: z.array(hospitalEventSchema).max(30).default([]),
    timeline: z.array(timelineSchema).max(40).default([]),
    educationTriggers: z.array(educationSchema).max(10).default([]),
    metadata: z
      .object({
        createdAt: timestamp,
        source: z.literal("demo"),
        tags: z.array(z.string().min(1).max(60)).max(20),
      })
      .strict(),
  })
  .strict()
  .superRefine((scenario, ctx) => {
    const seen = new Set<string>();
    const visit = (node: unknown, path: (string | number)[] = []) => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) {
        node.forEach((v, i) => visit(v, [...path, i]));
        return;
      }
      for (const [key, v] of Object.entries(node)) {
        if (key === "id" && typeof v === "string") {
          if (seen.has(v))
            ctx.addIssue({
              code: "custom",
              path: [...path, key],
              message: "Duplicate ID: " + v,
            });
          seen.add(v);
        } else visit(v, [...path, key]);
      }
    };
    visit(scenario);
    const cases = new Set(
      [scenario.primaryCase, ...scenario.secondaryCases]
        .filter(Boolean)
        .map((c) => c!.id),
    );
    for (const field of ["consults", "timeline"] as const)
      scenario[field].forEach((item, index) => {
        if (item.caseId && !cases.has(item.caseId))
          ctx.addIssue({
            code: "custom",
            path: [field, index, "caseId"],
            message: "Unknown case ID",
          });
      });
  });
