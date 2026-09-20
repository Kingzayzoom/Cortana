import { z } from "zod";
import {
  buildPhoneBriefingContext,
  CONTEXT_FALLBACK,
  GROUNDING_RULE,
  SYNTHETIC_NOTICE,
  getCase,
} from "./selectors";
import type { ContextScenario } from "./types";
const empty = z.object({}).strict();
const caseRequest = z
  .object({ caseId: z.string().min(1).max(80).optional() })
  .strict();
export const caseSectionSchema = z.enum([
  "history",
  "status",
  "vitals",
  "labs",
  "changes",
  "schedule",
  "review_items",
]);
export const contextToolSchemas = {
  get_context_summary: empty,
  get_shift_context: empty,
  get_primary_case: empty,
  get_recent_changes: caseRequest,
  get_case_section: z
    .object({ caseId: z.string().min(1).max(80), section: caseSectionSchema })
    .strict(),
  get_scheduled_events: caseRequest,
  get_hospital_timeline: empty,
  get_education_triggers: empty,
};
export type ContextToolName = keyof typeof contextToolSchemas;
export const contextToolNames = Object.keys(
  contextToolSchemas,
) as ContextToolName[];
export function isContextTool(name: string): name is ContextToolName {
  return Object.hasOwn(contextToolSchemas, name);
}
export function queryContext(
  s: ContextScenario | null,
  name: string,
  input: unknown,
) {
  if (!isContextTool(name)) throw new Error("Unknown context tool.");
  const args = contextToolSchemas[name].parse(input);
  const caseId = "caseId" in args ? args.caseId : undefined;
  const item = getCase(s, caseId);
  let result: unknown = null;
  if (s && (!caseId || item))
    switch (name) {
      case "get_context_summary":
        result = buildPhoneBriefingContext(s);
        break;
      case "get_shift_context":
        result = {
          clinician: s.clinician,
          facility: s.facility,
          shift: s.shift,
          hospitalStatus: s.hospitalStatus ?? null,
          physicianUrgency: s.physicianUrgency ?? null,
          secondaryCases: s.secondaryCases.map((c) => ({
            caseId: c.id,
            displayName: c.displayName,
            currentStatus: c.currentStatus,
            physicianUrgency: c.physicianUrgency ?? null,
          })),
          consults: s.consults,
        };
        break;
      case "get_primary_case":
        result = item
          ? {
              caseId: item.id,
              displayName: item.displayName,
              demographics: item.demographics,
              physicianUrgency: item.physicianUrgency ?? null,
              reasonForAdmission: item.reasonForAdmission,
              history: item.history,
              currentStatus: item.currentStatus,
            }
          : null;
        break;
      case "get_recent_changes":
        result = item?.changes;
        break;
      case "get_scheduled_events":
        result = item?.scheduledEvents;
        break;
      case "get_hospital_timeline":
        result =
          s.timeline.length ||
          s.hospitalEvents.length ||
          s.hospitalStatus?.events.length
            ? {
                timeline: s.timeline,
                hospitalEvents: [
                  ...s.hospitalEvents,
                  ...(s.hospitalStatus?.events ?? []),
                ],
              }
            : null;
        break;
      case "get_education_triggers":
        result = s.educationTriggers;
        break;
      case "get_case_section": {
        if (item && "section" in args) {
          const sections = {
            history: item.history,
            status: item.currentStatus,
            vitals: item.currentStatus.vitals,
            labs: item.labs,
            changes: item.changes,
            schedule: item.scheduledEvents,
            review_items: item.itemsForReview,
          };
          result = sections[args.section];
        }
      }
    }
  const available =
    result != null && !(Array.isArray(result) && result.length === 0);
  return {
    synthetic: true,
    notice: SYNTHETIC_NOTICE,
    scenarioId: s?.id ?? null,
    grounding: GROUNDING_RULE,
    available,
    data: available ? result : null,
    ...(!available ? { message: CONTEXT_FALLBACK } : {}),
  };
}
