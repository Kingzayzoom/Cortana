import "server-only"

import type { AnswerKey } from "./types"

// Answer keys never ship to the browser. Grading reads them on the server only.
export const answerKeys: Record<string, AnswerKey> = {
  "hf-q-001": {
    questionId: "hf-q-001",
    caseId: "hf-case-001",
    correctOption: "B",
    rationale:
      "DAPA-HF enrolled patients with reduced ejection fraction with and without type 2 diabetes, and dapagliflozin lowered worsening heart failure or cardiovascular death (hazard ratio 0.74) with a similar effect in both groups. The 2022 AHA/ACC/HFSA guideline gives SGLT2 inhibitors a Class 1 recommendation in symptomatic chronic HFrEF irrespective of diabetes.",
    worthNoting:
      "This patient is on sacubitril–valsartan, and relatively few DAPA-HF participants were. The guideline recommendation still applies across symptomatic chronic HFrEF.",
    optionFeedback: {
      A: "The benefit in DAPA-HF was similar in patients without diabetes, so the absence of diabetes isn't a reason to withhold it.",
      B: "Supported by DAPA-HF and a Class 1 guideline recommendation, independent of diabetes status.",
      C: "DAPA-HF excluded patients with eGFR below 30. Its evidence applies at this patient's eGFR, so waiting withholds a benefit the trial showed.",
      D: "Dapagliflozin was studied in addition to recommended therapy, not as a replacement for it.",
    },
    sourceIds: ["src-dapa-hf", "src-aha-acc-hfsa-2022"],
  },
}
