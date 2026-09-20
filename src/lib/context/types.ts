import type { z } from "zod";
import type {
  contextScenarioSchema,
  clinicianSchema,
  facilitySchema,
  shiftSchema,
  caseSchema,
  changeSchema,
  scheduledEventSchema,
  labSchema,
  consultSchema,
  hospitalEventSchema,
  timelineSchema,
  educationSchema,
} from "./schema";
export type ContextScenario = z.infer<typeof contextScenarioSchema>;
export type ClinicianContext = z.infer<typeof clinicianSchema>;
export type FacilityContext = z.infer<typeof facilitySchema>;
export type ShiftContext = z.infer<typeof shiftSchema>;
export type SyntheticCase = z.infer<typeof caseSchema>;
export type ContextChange = z.infer<typeof changeSchema>;
export type ScheduledEvent = z.infer<typeof scheduledEventSchema>;
export type LabResult = z.infer<typeof labSchema>;
export type ConsultContext = z.infer<typeof consultSchema>;
export type HospitalEvent = z.infer<typeof hospitalEventSchema>;
export type TimelineEvent = z.infer<typeof timelineSchema>;
export type EducationTrigger = z.infer<typeof educationSchema>;
