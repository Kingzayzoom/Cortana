// The synthetic shift briefing Cortana delivers when it calls. Everything here
// is invented for the demo: no real patient, unit or clinician is described.
// Values carry a spoken form so the voice never reads "88/56" as "slash".
export const BRIEFING_VERSION = "2026-09-20.1";

export const clinician = {
  displayName: "Dr. Zaybish",
  // The y is silent: say "Za-bish". The voice reads text, not instructions,
  // so the agent is told to speak this spelling and never the written one.
  spokenName: "Dr. Zabish",
  specialty: "Cardiology",
  role: "Attending cardiologist",
} as const;

export const facility = {
  name: "Cortana Medical Center",
  unit: "Cardiac Step-Down",
  location: "North Tower, Level 4",
} as const;

const vitals = (
  heartRate: number,
  bloodPressure: string,
  spokenPressure: string,
  oxygen: number,
  temperature: string,
) => ({
  heartRate: { value: heartRate, spoken: `${heartRate} beats per minute` },
  bloodPressure: { value: bloodPressure, spoken: spokenPressure },
  oxygenSaturation: { value: `${oxygen}%`, spoken: `${oxygen} percent` },
  temperature: { value: `${temperature} F`, spoken: `${temperature} degrees` },
});

export const briefing = {
  version: BRIEFING_VERSION,
  synthetic: true,
  title: "Urgent cardiology morning update",
  shift: { spoken: "your seven a.m. to three p.m. shift today" },
  status: {
    overall: "busy",
    urgentCount: 1,
    summary:
      "One synthetic case is worsening, one new consult is waiting, and one procedure needs cardiology review.",
  },
  // Lead with this. Everything below is offered only if the clinician asks.
  urgent: {
    patient: "synthetic patient twenty-four",
    headline: "new low blood pressure this morning",
    asOf: "six forty-two this morning",
    requestedBy: "the cardiac step-down team",
    requestedWithin: "fifteen minutes",
    reason:
      "New low blood pressure was documented and cardiology review was requested.",
  },
  primaryCase: {
    patient: "synthetic patient twenty-four",
    age: 67,
    sex: "male",
    admittedFor: "acute decompensated heart failure",
    history: [
      "heart failure with reduced ejection fraction",
      "high blood pressure",
      "type 2 diabetes",
    ],
    trend: "worsening",
    previousStatus: "stable overnight, breathing more comfortably at rest",
    currentStatus:
      "new low blood pressure, with continued monitoring by the step-down team",
    currentVitals: vitals(
      98,
      "88/56",
      "eighty-eight over fifty-six",
      94,
      "98.4",
    ),
    previousVitals: vitals(
      82,
      "118/72",
      "one eighteen over seventy-two",
      96,
      "98.4",
    ),
    changes: [
      {
        concept: "Blood pressure",
        direction: "down",
        spoken:
          "blood pressure fell from one eighteen over seventy-two to eighty-eight over fifty-six",
        priority: "urgent",
      },
      {
        concept: "Heart rate",
        direction: "up",
        spoken:
          "heart rate rose from eighty-two to ninety-eight beats per minute",
        priority: "worth a look soon",
      },
      {
        concept: "Oxygen saturation",
        direction: "down",
        spoken:
          "oxygen saturation slipped from ninety-six to ninety-four percent",
        priority: "worth a look soon",
      },
    ],
    labs: [
      {
        name: "Creatinine",
        spoken: "creatinine is one point five, up from one point two",
        priority: "worth a look soon",
      },
      {
        name: "Potassium",
        spoken: "potassium is four point three, essentially unchanged",
        priority: "routine",
      },
    ],
    careTeamMessage: {
      from: "the cardiac step-down team",
      at: "six forty-eight this morning",
      message: "Cardiology review requested after the new low blood pressure.",
    },
    scheduled: [
      { at: "eight thirty", what: "repeat metabolic panel" },
      { at: "ten o'clock", what: "cardiology team rounds" },
    ],
  },
  otherPatients: [
    {
      patient: "synthetic patient thirty-one",
      trend: "stable",
      priority: "routine",
      summary: "Stable overnight, with no new events documented.",
      review: "during normal rounds",
    },
  ],
  consults: [
    {
      patient: "synthetic consult fifty-two",
      expectedAt: "seven thirty",
      reason: "chest discomfort evaluation",
      status: "waiting",
      priority: "worth a look soon",
      review: "within the hour",
    },
  ],
  timeline: [
    {
      at: "six forty-two",
      what: "the primary case developed new low blood pressure",
    },
    {
      at: "six forty-eight",
      what: "the step-down team requested cardiology review",
    },
    { at: "seven thirty", what: "a new cardiology consult is expected" },
    { at: "eight thirty", what: "a repeat metabolic panel is scheduled" },
  ],
} as const;

export const notInBriefing =
  "That isn't in this briefing. I can tell you what it does cover.";
