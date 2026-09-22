// What Samantha may quiz on. A topic without a round has no questions, so the
// agent offers only the available ones instead of inventing content.
import { ROUND_ID, round } from "./round";

export const topics = [
  {
    id: "heart-failure",
    name: "Heart failure",
    available: true,
    roundId: ROUND_ID,
    summary: round.description,
    minutes: 2,
  },
  { id: "hypertension", name: "Hypertension", available: false },
  { id: "anticoagulation", name: "Anticoagulation", available: false },
  {
    id: "preventive-cardiology",
    name: "Preventive cardiology",
    available: false,
  },
] as const;
