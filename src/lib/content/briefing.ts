// The shift briefings themselves moved to briefings.ts, which holds a library
// of named cases. This module keeps the facility details and re-exports the
// clinician so existing imports keep working.
export { clinician, notInBriefing } from "./briefings";

export const facility = {
  name: "Cortana Medical Center",
  unit: "Cardiac Step-Down",
  location: "North Tower, Level 4",
} as const;
