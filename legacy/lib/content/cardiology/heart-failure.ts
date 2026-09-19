import type { ClinicalCase, Round } from "../types"

export const heartFailureRound: Round = {
  id: "hf-round-001",
  topicId: "heart-failure",
  title: "Heart Failure",
  specialty: "Cardiology",
  estimatedMinutes: 2,
  focus: "The evidence behind SGLT2 inhibitors in heart failure with reduced ejection fraction.",
  sourceIds: ["src-dapa-hf", "src-aha-acc-hfsa-2022"],
  caseId: "hf-case-001",
  review: {
    status: "draft",
    note: "Prototype content. Verify every figure against the primary sources before clinical or public use.",
  },
  sections: [
    {
      id: "study",
      title: "What the study examined",
      sourceIds: ["src-dapa-hf"],
      points: [
        "DAPA-HF randomized 4,744 adults with heart failure with reduced ejection fraction — EF 40% or less, NYHA class II to IV.",
        "Patients received dapagliflozin 10 mg once daily or placebo, on top of recommended heart failure therapy.",
        "The trial deliberately enrolled patients both with and without type 2 diabetes.",
      ],
    },
    {
      id: "finding",
      title: "The key finding",
      sourceIds: ["src-dapa-hf"],
      points: [
        "Over a median of 18.2 months, worsening heart failure or cardiovascular death occurred in 16.3% with dapagliflozin versus 21.2% with placebo — a hazard ratio of 0.74.",
        "Death from any cause was also lower: 11.6% versus 13.9%.",
        "The benefit on the primary outcome was similar whether or not patients had diabetes.",
      ],
    },
    {
      id: "limitation",
      title: "An important limitation",
      sourceIds: ["src-dapa-hf"],
      points: [
        "Patients with an eGFR below 30 or systolic blood pressure below 95 were excluded, so the trial does not directly speak to them.",
        "Relatively few participants were on sacubitril–valsartan at baseline.",
        "Median follow-up was about 18 months, so longer-term effects were not established by this trial.",
      ],
    },
  ],
}

export const heartFailureCase: ClinicalCase = {
  id: "hf-case-001",
  roundId: "hf-round-001",
  questionId: "hf-q-001",
  label: "Synthetic learning case",
  patient: "67-year-old adult with chronic heart failure with reduced ejection fraction",
  findings: [
    "LVEF 32%, NYHA class II symptoms",
    "On sacubitril–valsartan, a beta-blocker and an MRA at tolerated doses",
    "No history of diabetes",
    "eGFR 58 mL/min/1.73 m², BP 118/72 mmHg",
  ],
  question: "Based on the evidence we just discussed, which option is best supported?",
  options: [
    { id: "A", text: "An SGLT2 inhibitor isn't indicated because the patient doesn't have diabetes." },
    { id: "B", text: "Adding an SGLT2 inhibitor such as dapagliflozin is supported, regardless of diabetes status." },
    { id: "C", text: "Wait until eGFR falls below 30 before considering an SGLT2 inhibitor." },
    { id: "D", text: "Replace the beta-blocker with an SGLT2 inhibitor to limit pill burden." },
  ],
}
