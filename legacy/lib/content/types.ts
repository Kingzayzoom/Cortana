export const OPTION_IDS = ["A", "B", "C", "D"] as const
export type OptionId = (typeof OPTION_IDS)[number]

export type ReviewStatus = {
  status: "draft" | "clinician-reviewed"
  note: string
}

export type Source = {
  id: string
  /** Short label for citation chips, e.g. "DAPA-HF". */
  shortName: string
  title: string
  kind: "Randomized trial" | "Clinical guideline"
  authors: string
  publisher: string
  year: number
  citation: string
  url: string
  /** Descriptive pointer into the source. Never an invented page number. */
  section: string
  /** Paraphrased summary written for this prototype, not a verbatim quote. */
  summary: string
  keyPoints: string[]
  limitations: string[]
}

export type BriefingSection = {
  id: string
  title: string
  /** Vetted statements the agent may paraphrase. Nothing outside these. */
  points: string[]
  sourceIds: string[]
}

export type Round = {
  id: string
  topicId: string
  title: string
  specialty: string
  estimatedMinutes: number
  focus: string
  sections: BriefingSection[]
  caseId: string
  sourceIds: string[]
  review: ReviewStatus
}

export type CaseOption = { id: OptionId; text: string }

/** Client-safe view of a case. The answer key lives in answer-keys.ts. */
export type ClinicalCase = {
  id: string
  roundId: string
  questionId: string
  label: string
  patient: string
  findings: string[]
  question: string
  options: CaseOption[]
}

export type AnswerKey = {
  questionId: string
  caseId: string
  correctOption: OptionId
  rationale: string
  worthNoting?: string
  optionFeedback: Record<OptionId, string>
  sourceIds: string[]
}

export type Topic = {
  id: string
  name: string
  specialty: string
  /** Rounds that exist for this topic in the content bundle. */
  roundIds: string[]
}
