// A small library of shift briefings. Every patient, name, room and value here
// is invented for the demo; the people do not exist. Cases carry ordinary names
// so a call sounds like a handover instead of a database dump, and the agent
// discloses once, at the start, that the data is simulated.
import { sayDecimal, sayPercent, sayPressure, sayRate } from "./speech";

export const BRIEFING_LIBRARY_VERSION = "2026-09-20.2";

export const clinician = {
  displayName: "Dr. Zaybish",
  // The y is silent: say "Za-bish". The voice reads text, not instructions.
  spokenName: "Dr. Zabish",
  specialty: "Cardiology",
  role: "Attending cardiologist",
} as const;

type Vitals = {
  heartRate: number;
  systolic: number;
  diastolic: number;
  oxygen: number;
  temperature: number;
};

type Case = {
  id: string;
  patient: string;
  room: string;
  age: number;
  sex: "male" | "female";
  admittedFor: string;
  history: string[];
  previousStatus: string;
  currentStatus: string;
  now: Vitals;
  before: Vitals;
  labs: {
    name: string;
    value: number;
    previous: number;
    unit: string;
    priority: string;
  }[];
  headline: string;
  asOf: string;
  requestedBy: string;
  requestedWithin: string;
  careTeamMessage: string;
  careTeamAt: string;
  scheduled: { at: string; what: string }[];
};

type Scenario = {
  id: string;
  unit: string;
  location: string;
  shift: string;
  summary: string;
  primary: Case;
  others: {
    patient: string;
    room: string;
    trend: string;
    summary: string;
    review: string;
  }[];
  consults: {
    patient: string;
    expectedAt: string;
    reason: string;
    priority: string;
    review: string;
  }[];
  timeline: { at: string; what: string }[];
};

const scenarios: Scenario[] = [
  {
    id: "step-down-hypotension",
    unit: "Cardiac Step-Down",
    location: "North Tower, Level 4",
    shift: "seven a.m. to three p.m. today",
    summary:
      "One patient is worsening, a new consult is waiting, and a repeat panel is due mid-morning.",
    primary: {
      id: "alvarez",
      patient: "Marcus Alvarez",
      room: "four twelve",
      age: 67,
      sex: "male",
      admittedFor: "acute decompensated heart failure",
      history: [
        "heart failure with reduced ejection fraction",
        "high blood pressure",
        "type 2 diabetes",
      ],
      previousStatus: "stable overnight, breathing more comfortably at rest",
      currentStatus:
        "new low blood pressure, with the step-down team at the bedside",
      now: {
        heartRate: 98,
        systolic: 88,
        diastolic: 56,
        oxygen: 94,
        temperature: 98.4,
      },
      before: {
        heartRate: 82,
        systolic: 118,
        diastolic: 72,
        oxygen: 96,
        temperature: 98.4,
      },
      labs: [
        {
          name: "Creatinine",
          value: 1.5,
          previous: 1.2,
          unit: "",
          priority: "worth a look soon",
        },
        {
          name: "Potassium",
          value: 4.3,
          previous: 4.2,
          unit: "",
          priority: "routine",
        },
      ],
      headline: "a new drop in blood pressure this morning",
      asOf: "six forty-two this morning",
      requestedBy: "the step-down team",
      requestedWithin: "fifteen minutes",
      careTeamMessage:
        "Cardiology review requested after the blood pressure fell.",
      careTeamAt: "six forty-eight this morning",
      scheduled: [
        { at: "eight thirty", what: "a repeat metabolic panel" },
        { at: "ten o'clock", what: "cardiology team rounds" },
      ],
    },
    others: [
      {
        patient: "Ruth Feldman",
        room: "four oh six",
        trend: "stable",
        summary: "Quiet overnight, with nothing new documented.",
        review: "during normal rounds",
      },
    ],
    consults: [
      {
        patient: "Daniel Okoye",
        expectedAt: "seven thirty",
        reason: "chest discomfort",
        priority: "worth a look soon",
        review: "within the hour",
      },
    ],
    timeline: [
      { at: "six forty-two", what: "Mr. Alvarez's blood pressure dropped" },
      { at: "six forty-eight", what: "the team asked for cardiology review" },
      { at: "seven thirty", what: "a new consult is expected" },
      { at: "eight thirty", what: "a repeat panel is scheduled" },
    ],
  },
  {
    id: "ccu-rapid-af",
    unit: "Coronary Care",
    location: "South Tower, Level 3",
    shift: "seven a.m. to three p.m. today",
    summary:
      "One patient went into a fast heart rhythm overnight, and two others are steady.",
    primary: {
      id: "raman",
      patient: "Priya Raman",
      room: "three oh nine",
      age: 74,
      sex: "female",
      admittedFor: "chest pain and shortness of breath",
      history: [
        "atrial fibrillation",
        "high blood pressure",
        "chronic kidney disease",
      ],
      previousStatus: "comfortable, with a steady heart rhythm",
      currentStatus:
        "a fast irregular rhythm since the early hours, awake and talking",
      now: {
        heartRate: 142,
        systolic: 104,
        diastolic: 68,
        oxygen: 95,
        temperature: 98.1,
      },
      before: {
        heartRate: 78,
        systolic: 126,
        diastolic: 74,
        oxygen: 97,
        temperature: 98.2,
      },
      labs: [
        {
          name: "Potassium",
          value: 3.2,
          previous: 4.0,
          unit: "",
          priority: "urgent",
        },
        {
          name: "Magnesium",
          value: 1.6,
          previous: 1.9,
          unit: "",
          priority: "worth a look soon",
        },
      ],
      headline: "a fast irregular heart rhythm since three this morning",
      asOf: "three fifteen this morning",
      requestedBy: "the coronary care nurse in charge",
      requestedWithin: "thirty minutes",
      careTeamMessage:
        "Rhythm change documented; cardiology asked to review the plan.",
      careTeamAt: "three twenty this morning",
      scheduled: [
        { at: "nine o'clock", what: "a repeat electrocardiogram" },
        { at: "eleven o'clock", what: "an echocardiogram" },
      ],
    },
    others: [
      {
        patient: "Helen Ward",
        room: "three fourteen",
        trend: "stable",
        summary: "Improving after yesterday's procedure, walking the corridor.",
        review: "during normal rounds",
      },
      {
        patient: "Sam Whitfield",
        room: "three eleven",
        trend: "stable",
        summary: "No overnight events, and the family has been updated.",
        review: "during normal rounds",
      },
    ],
    consults: [
      {
        patient: "Grace Lindqvist",
        expectedAt: "eight fifteen",
        reason: "an abnormal rhythm strip from the ward",
        priority: "worth a look soon",
        review: "before midday",
      },
    ],
    timeline: [
      {
        at: "three fifteen",
        what: "Ms. Raman's rhythm went fast and irregular",
      },
      { at: "three twenty", what: "the nurse in charge asked for review" },
      { at: "six o'clock", what: "morning bloods were drawn" },
      { at: "nine o'clock", what: "a repeat tracing is scheduled" },
    ],
  },
  {
    id: "post-pci-bleed",
    unit: "Cardiac Step-Down",
    location: "North Tower, Level 4",
    shift: "seven a.m. to three p.m. today",
    summary:
      "One patient after a stent has oozing at the wrist site, and the unit is otherwise quiet.",
    primary: {
      id: "chen",
      patient: "Wei Chen",
      room: "four twenty",
      age: 61,
      sex: "male",
      admittedFor: "a stent to the right coronary artery yesterday",
      history: ["coronary artery disease", "high cholesterol"],
      previousStatus: "dry dressing, comfortable, eating breakfast",
      currentStatus: "oozing at the wrist access site, pressure band reapplied",
      now: {
        heartRate: 96,
        systolic: 112,
        diastolic: 64,
        oxygen: 97,
        temperature: 98.6,
      },
      before: {
        heartRate: 74,
        systolic: 128,
        diastolic: 76,
        oxygen: 98,
        temperature: 98.5,
      },
      labs: [
        {
          name: "Hemoglobin",
          value: 10.8,
          previous: 12.6,
          unit: "",
          priority: "urgent",
        },
        {
          name: "Platelets",
          value: 188,
          previous: 201,
          unit: "",
          priority: "routine",
        },
      ],
      headline: "bleeding at the wrist site after yesterday's stent",
      asOf: "five fifty this morning",
      requestedBy: "the night nurse",
      requestedWithin: "twenty minutes",
      careTeamMessage:
        "Pressure band reapplied; cardiology asked to look at the site.",
      careTeamAt: "five fifty-five this morning",
      scheduled: [
        { at: "eight o'clock", what: "a repeat blood count" },
        { at: "ten thirty", what: "a wound check" },
      ],
    },
    others: [
      {
        patient: "Arthur Boyd",
        room: "four eighteen",
        trend: "stable",
        summary: "Waiting for a discharge letter, no issues overnight.",
        review: "during normal rounds",
      },
    ],
    consults: [],
    timeline: [
      { at: "five fifty", what: "Mr. Chen's wrist site began oozing" },
      { at: "five fifty-five", what: "the night nurse asked for review" },
      { at: "eight o'clock", what: "a repeat blood count is scheduled" },
    ],
  },
  {
    id: "hf-clinic-overflow",
    unit: "Heart Failure Unit",
    location: "West Wing, Level 2",
    shift: "eight a.m. to four p.m. today",
    summary:
      "One patient is retaining fluid again, and two clinic patients need a decision before noon.",
    primary: {
      id: "okafor",
      patient: "Blessing Okafor",
      room: "two oh seven",
      age: 58,
      sex: "female",
      admittedFor: "worsening swelling and breathlessness",
      history: [
        "heart failure with preserved ejection fraction",
        "type 2 diabetes",
      ],
      previousStatus:
        "two kilos lighter after yesterday's treatment, sleeping flat",
      currentStatus:
        "swelling is back at the ankles and she is breathless walking to the bathroom",
      now: {
        heartRate: 104,
        systolic: 138,
        diastolic: 82,
        oxygen: 92,
        temperature: 98.3,
      },
      before: {
        heartRate: 88,
        systolic: 132,
        diastolic: 78,
        oxygen: 96,
        temperature: 98.3,
      },
      labs: [
        {
          name: "Creatinine",
          value: 1.9,
          previous: 1.4,
          unit: "",
          priority: "urgent",
        },
        {
          name: "Sodium",
          value: 133,
          previous: 137,
          unit: "",
          priority: "worth a look soon",
        },
      ],
      headline: "fluid building up again overnight",
      asOf: "six ten this morning",
      requestedBy: "the heart failure nurse",
      requestedWithin: "forty-five minutes",
      careTeamMessage:
        "Weight is up and kidney numbers have moved; review requested.",
      careTeamAt: "six fifteen this morning",
      scheduled: [
        { at: "nine thirty", what: "a repeat weight and panel" },
        { at: "noon", what: "the heart failure clinic list" },
      ],
    },
    others: [
      {
        patient: "Thomas Reilly",
        room: "two eleven",
        trend: "stable",
        summary: "Steady, and the discharge plan is agreed for tomorrow.",
        review: "during normal rounds",
      },
    ],
    consults: [
      {
        patient: "Nadia Haddad",
        expectedAt: "ten o'clock",
        reason: "breathlessness on the medical ward",
        priority: "worth a look soon",
        review: "before the clinic list",
      },
    ],
    timeline: [
      { at: "six ten", what: "Ms. Okafor's weight and swelling were charted" },
      { at: "six fifteen", what: "the nurse asked for review" },
      { at: "nine thirty", what: "a repeat weight is scheduled" },
    ],
  },
  {
    id: "quiet-unit",
    unit: "Cardiac Step-Down",
    location: "North Tower, Level 4",
    shift: "seven a.m. to three p.m. today",
    summary:
      "A quiet unit: nothing urgent, one discharge, and one consult to see.",
    primary: {
      id: "delacroix",
      patient: "Yvette Delacroix",
      room: "four oh two",
      age: 69,
      sex: "female",
      admittedFor: "an episode of fainting",
      history: ["high blood pressure", "an underactive thyroid"],
      previousStatus: "monitored overnight with no events",
      currentStatus: "comfortable, walking, and asking about going home",
      now: {
        heartRate: 72,
        systolic: 124,
        diastolic: 76,
        oxygen: 98,
        temperature: 98.2,
      },
      before: {
        heartRate: 76,
        systolic: 128,
        diastolic: 78,
        oxygen: 98,
        temperature: 98.1,
      },
      labs: [
        {
          name: "Potassium",
          value: 4.1,
          previous: 4.0,
          unit: "",
          priority: "routine",
        },
        {
          name: "Creatinine",
          value: 0.9,
          previous: 0.9,
          unit: "",
          priority: "routine",
        },
      ],
      headline: "no events overnight, and a discharge question for you",
      asOf: "seven o'clock this morning",
      requestedBy: "the step-down team",
      requestedWithin: "during rounds",
      careTeamMessage:
        "Monitoring has been clear; the team asked whether she can go home.",
      careTeamAt: "seven o'clock this morning",
      scheduled: [{ at: "ten o'clock", what: "cardiology team rounds" }],
    },
    others: [
      {
        patient: "Peter Nowak",
        room: "four oh nine",
        trend: "stable",
        summary: "Comfortable, with family visiting this morning.",
        review: "during normal rounds",
      },
    ],
    consults: [
      {
        patient: "Iris Bennett",
        expectedAt: "eleven o'clock",
        reason: "a murmur heard on the surgical ward",
        priority: "routine",
        review: "this afternoon",
      },
    ],
    timeline: [
      {
        at: "seven o'clock",
        what: "the night team handed over with no events",
      },
      { at: "ten o'clock", what: "cardiology rounds begin" },
    ],
  },
];

const vitalsFor = (v: Vitals) => ({
  heartRate: { value: v.heartRate, spoken: sayRate(v.heartRate) },
  bloodPressure: {
    value: `${v.systolic}/${v.diastolic}`,
    spoken: sayPressure(v.systolic, v.diastolic),
  },
  oxygenSaturation: { value: `${v.oxygen}%`, spoken: sayPercent(v.oxygen) },
  temperature: {
    value: `${v.temperature} F`,
    spoken: `${sayDecimal(v.temperature)} degrees`,
  },
});

function changes(now: Vitals, before: Vitals) {
  const list = [];
  if (now.systolic !== before.systolic)
    list.push({
      concept: "Blood pressure",
      direction: now.systolic < before.systolic ? "down" : "up",
      spoken: `blood pressure went from ${sayPressure(before.systolic, before.diastolic)} to ${sayPressure(now.systolic, now.diastolic)}`,
    });
  if (now.heartRate !== before.heartRate)
    list.push({
      concept: "Heart rate",
      direction: now.heartRate > before.heartRate ? "up" : "down",
      spoken: `heart rate went from ${sayRate(before.heartRate)} to ${sayRate(now.heartRate)}`,
    });
  if (now.oxygen !== before.oxygen)
    list.push({
      concept: "Oxygen saturation",
      direction: now.oxygen < before.oxygen ? "down" : "up",
      spoken: `oxygen saturation went from ${sayPercent(before.oxygen)} to ${sayPercent(now.oxygen)}`,
    });
  return list;
}

/** Same call always hears the same briefing; a new call usually hears another. */
export function briefingFor(seed: string) {
  let hash = 0;
  for (const character of seed)
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  const scenario = scenarios[hash % scenarios.length];
  const c = scenario.primary;
  const title = c.sex === "male" ? "Mr." : "Ms.";
  const surname = `${title} ${c.patient.split(" ").at(-1)}`;
  return {
    version: BRIEFING_LIBRARY_VERSION,
    simulated: true,
    disclosure:
      "Say once, early: this briefing is simulated for the demonstration. Do not repeat it.",
    unit: scenario.unit,
    location: scenario.location,
    shift: scenario.shift,
    summary: scenario.summary,
    urgent: {
      patient: surname,
      fullName: c.patient,
      room: c.room,
      headline: c.headline,
      asOf: c.asOf,
      requestedBy: c.requestedBy,
      requestedWithin: c.requestedWithin,
    },
    primaryCase: {
      patient: surname,
      fullName: c.patient,
      room: c.room,
      age: c.age,
      sex: c.sex,
      admittedFor: c.admittedFor,
      history: c.history,
      previousStatus: c.previousStatus,
      currentStatus: c.currentStatus,
      currentVitals: vitalsFor(c.now),
      previousVitals: vitalsFor(c.before),
      changes: changes(c.now, c.before),
      labs: c.labs.map((lab) => ({
        name: lab.name,
        spoken: `${lab.name.toLowerCase()} is ${sayDecimal(lab.value)}, ${
          lab.value === lab.previous
            ? "unchanged"
            : `${lab.value > lab.previous ? "up" : "down"} from ${sayDecimal(lab.previous)}`
        }`,
        priority: lab.priority,
      })),
      careTeamMessage: {
        from: c.requestedBy,
        at: c.careTeamAt,
        message: c.careTeamMessage,
      },
      scheduled: c.scheduled,
    },
    otherPatients: scenario.others,
    consults: scenario.consults,
    timeline: scenario.timeline,
  };
}

export const scenarioCount = scenarios.length;
export const notInBriefing =
  "That isn't in this briefing. I can tell you what it does cover.";
