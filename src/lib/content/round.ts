export const ROUND_ID = "dapa-hf-01";
export const CONTENT_VERSION = "2026-09-19.1";
export const sources = [
  {
    id: "dapa-hf",
    shortTitle: "DAPA-HF · NEJM",
    publisher: "New England Journal of Medicine",
    title:
      "Dapagliflozin in Patients with Heart Failure and Reduced Ejection Fraction",
    authors: "McMurray JJV, Solomon SD, Inzucchi SE, et al.",
    date: "2019-09-19",
    url: "https://www.nejm.org/doi/full/10.1056/NEJMoa1911303",
    section: "Abstract · Methods and Results; primary composite outcome",
    excerpt:
      "Findings in patients with diabetes were similar to those in patients without diabetes.",
    summary:
      "The trial enrolled 4,744 participants with symptomatic heart failure and LVEF ≤40%. The primary composite occurred in 16.3% with dapagliflozin and 21.2% with placebo over a median 18.2 months (HR 0.74; 95% CI 0.65–0.85).",
    scope:
      "A selected trial population receiving background therapy. These results do not determine treatment for an individual or establish benefit at every ejection fraction.",
  },
  {
    id: "dapa-diabetes",
    shortTitle: "Diabetes subgroup · JAMA",
    publisher: "JAMA",
    title:
      "Effect of Dapagliflozin on Worsening Heart Failure and Cardiovascular Death in Patients With Heart Failure With and Without Diabetes",
    authors: "Petrie MC, Verma S, Docherty KF, et al.",
    date: "2020-03-27",
    url: "https://jamanetwork.com/journals/jama/fullarticle/2763950",
    section: "Key Points · Findings; exploratory diabetes subgroup analysis",
    excerpt:
      "Dapagliflozin was effective at reducing cardiovascular morbidity and mortality in patients with heart failure and reduced ejection fraction independently of diabetes status.",
    summary:
      "This exploratory DAPA-HF analysis found a reduction in the composite of worsening heart failure or cardiovascular death in participants with and without diabetes. Diabetes was not required for trial inclusion.",
    scope:
      "A subgroup analysis of the same trial, not independent replication. Composite outcomes should not be interpreted as identical effects on every component.",
  },
] as const;
export type SourceId = (typeof sources)[number]["id"];
export const round = {
  id: ROUND_ID,
  version: CONTENT_VERSION,
  title: "Heart failure, beyond diabetes",
  topic: "Heart failure",
  duration: "About 2 minutes",
  description:
    "A closer look at DAPA-HF: who was studied, what changed, and where the evidence stops.",
  sections: [
    {
      id: "population",
      title: "Who was studied",
      sourceIds: ["dapa-hf"],
      text: "Today, let’s look at DAPA-HF. Researchers compared dapagliflozin with placebo, alongside usual therapy, in people with symptomatic heart failure and a left ventricular ejection fraction of 40% or less. Both groups included people with and without diabetes.",
    },
    {
      id: "finding",
      title: "What the study found",
      sourceIds: ["dapa-diabetes"],
      text: "The main outcome combined worsening heart failure and cardiovascular death. The trial favored dapagliflozin, and the diabetes subgroup analysis found a similar direction of benefit whether or not participants had diabetes. The key distinction: diabetes was not an entry requirement.",
    },
    {
      id: "limitation",
      title: "Where the evidence stops",
      sourceIds: ["dapa-diabetes"],
      text: "Keep the study population in view. An exploratory subgroup finding does not establish an identical effect for every person, or replace a clinical assessment. Our challenge is about interpreting the evidence, not choosing a treatment. Ready to apply that distinction?",
    },
  ],
  case: {
    id: "hf-case-01",
    questionId: "diabetes-eligibility",
    label: "Synthetic learning case",
    description:
      "In a teaching scenario, a 66-year-old adult has symptomatic heart failure, an LVEF of 35%, and no diabetes.",
    question: "Which statement best reflects the DAPA-HF evidence?",
    options: [
      { id: "A", text: "The evidence applies only to people with diabetes." },
      { id: "B", text: "The trial included people with and without diabetes." },
      {
        id: "C",
        text: "The trial establishes benefit at every ejection fraction.",
      },
    ],
  },
};
export const unsupportedAnswer =
  "The sources in this round do not establish that. I can show you what they do cover.";
export function sourceById(id: string) {
  return sources.find((source) => source.id === id);
}
