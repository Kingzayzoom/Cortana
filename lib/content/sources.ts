import type { Source } from "./types"

// Curated evidence bundle. Every field here is shown to learners and handed to
// the model as the only evidence it may use, so keep it verifiable: real
// titles, real DOIs, descriptive section pointers, paraphrased summaries.
export const sources: Record<string, Source> = {
  "src-dapa-hf": {
    id: "src-dapa-hf",
    shortName: "DAPA-HF",
    title:
      "Dapagliflozin in Patients with Heart Failure and Reduced Ejection Fraction (DAPA-HF)",
    kind: "Randomized trial",
    authors: "McMurray JJV, Solomon SD, Inzucchi SE, et al.",
    publisher: "New England Journal of Medicine",
    year: 2019,
    citation: "N Engl J Med. 2019;381:1995–2008",
    url: "https://doi.org/10.1056/NEJMoa1911303",
    section: "Abstract — Methods and Results",
    summary:
      "Placebo-controlled trial that randomized 4,744 patients with NYHA class II–IV heart failure and an ejection fraction of 40% or less to dapagliflozin 10 mg once daily or placebo, in addition to recommended therapy. Over a median of 18.2 months, the primary composite of worsening heart failure or cardiovascular death occurred in 16.3% with dapagliflozin versus 21.2% with placebo (hazard ratio 0.74; 95% CI 0.65–0.85). Results were similar in patients with and without diabetes.",
    keyPoints: [
      "4,744 patients with HFrEF (EF ≤40%), NYHA class II–IV.",
      "Dapagliflozin 10 mg daily vs placebo, added to recommended therapy.",
      "Primary outcome: worsening heart failure or cardiovascular death.",
      "Primary outcome 16.3% vs 21.2%; HR 0.74 (95% CI 0.65–0.85); median follow-up 18.2 months.",
      "Death from any cause 11.6% vs 13.9%.",
      "Effect on the primary outcome was similar with and without diabetes.",
      "Volume depletion, renal adverse events and hypoglycemia were infrequent and similar between groups.",
    ],
    limitations: [
      "Excluded patients with eGFR below 30 mL/min/1.73 m² or systolic blood pressure below 95 mmHg.",
      "Relatively few participants were taking sacubitril–valsartan at baseline.",
      "Median follow-up of about 18 months; longer-term effects were not established by this trial.",
      "Enrolled reduced ejection fraction only (EF ≤40%).",
    ],
  },
  "src-aha-acc-hfsa-2022": {
    id: "src-aha-acc-hfsa-2022",
    shortName: "AHA/ACC/HFSA guideline",
    title: "2022 AHA/ACC/HFSA Guideline for the Management of Heart Failure",
    kind: "Clinical guideline",
    authors: "Heidenreich PA, Bozkurt B, Aguilar D, et al.",
    publisher: "Circulation",
    year: 2022,
    citation: "Circulation. 2022;145:e895–e1032",
    url: "https://doi.org/10.1161/CIR.0000000000001063",
    section: "Pharmacological treatment for HFrEF — SGLT2 inhibitors",
    summary:
      "In patients with symptomatic chronic heart failure with reduced ejection fraction, SGLT2 inhibitors are recommended to reduce hospitalization for heart failure and cardiovascular mortality, irrespective of the presence of type 2 diabetes (Class 1, Level of Evidence A).",
    keyPoints: [
      "SGLT2 inhibitors: Class 1 recommendation in symptomatic chronic HFrEF.",
      "Recommendation applies irrespective of type 2 diabetes.",
      "Goal: reduce heart failure hospitalization and cardiovascular mortality.",
    ],
    limitations: [
      "A guideline synthesizes trial evidence; the underlying trials carry their own eligibility limits.",
    ],
  },
}
