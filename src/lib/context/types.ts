// Types inferred from the scenario schema, so the contract is written once.
import type { z } from "zod";
import type { contextScenarioSchema, educationSchema } from "./schema";
export type ContextScenario = z.infer<typeof contextScenarioSchema>;
export type EducationTrigger = z.infer<typeof educationSchema>;
