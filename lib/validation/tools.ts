import { z } from "zod"

import { OPTION_IDS, type OptionId } from "@/lib/content/types"
import { CONFIDENCE_LEVELS, type Confidence } from "@/lib/learning/types"

/** Accepts "B", "b", "option B", "I think B" → "B". */
export function parseOptionId(raw: unknown): OptionId | null {
  if (typeof raw !== "string") return null
  const s = raw.trim().toUpperCase()
  if ((OPTION_IDS as readonly string[]).includes(s)) return s as OptionId
  const match = s.match(/\b([A-D])\b/)
  return match ? (match[1] as OptionId) : null
}

/**
 * Parses a typed answer like "B", "my answer is B" or "I think b." — but not
 * a question such as "is B right?". Returns null when the text isn't an answer.
 */
export function parseTypedAnswer(text: string): OptionId | null {
  const match = text
    .trim()
    .match(/^(?:(?:my answer is|answer|i think(?: it'?s)?|i(?:'ll)? (?:choose|pick|go with)|option)\s*:?\s*)?\(?([a-d])\)?[.!]?$/i)
  return match ? (match[1].toUpperCase() as OptionId) : null
}

function parseConfidence(raw: unknown): Confidence | unknown {
  if (typeof raw !== "string") return raw
  const s = raw.toLowerCase()
  if (s.includes("very") || s.includes("high")) return "very"
  if (s.includes("somewhat") || s.includes("fairly") || s.includes("moderate")) return "somewhat"
  if (s.includes("guess") || s.includes("unsure") || s.includes("not sure") || s.includes("low")) return "guessing"
  return raw
}

const optionId = z.preprocess((v) => parseOptionId(v) ?? v, z.enum(OPTION_IDS))
const confidence = z.preprocess(parseConfidence, z.enum(CONFIDENCE_LEVELS))

/** Models sometimes send lists as "a, b" strings instead of arrays. */
const idList = z.preprocess(
  (v) => (typeof v === "string" ? v.split(/[\s,]+/).filter(Boolean) : v),
  z.array(z.string()).min(1),
)

/** Stages the agent may move to. Feedback and completion come from grading and complete_round. */
export const AGENT_STAGES = ["briefing", "challenge", "questions"] as const
export type AgentStage = (typeof AGENT_STAGES)[number]

// Parameters for the ElevenLabs client tools. Names and fields must match the
// tool definitions in docs/tool-contracts.md.
export const toolParams = {
  get_round_context: z.object({ round_id: z.string().optional() }),
  show_stage: z.object({ stage: z.enum(AGENT_STAGES) }),
  show_section: z.object({ section_id: z.string() }),
  show_case: z.object({ case_id: z.string() }),
  show_evidence: z.object({ source_ids: idList }),
  submit_answer: z.object({
    answer: optionId,
    confidence: confidence.optional(),
    question_id: z.string().optional(),
  }),
  complete_round: z.object({ round_id: z.string().optional() }),
  get_next_review: z.object({}),
}

export type ToolName = keyof typeof toolParams

// API request bodies.
export const answerRequest = z.object({
  questionId: z.string().min(1),
  answer: optionId,
})

export const askRequest = z.object({
  question: z.string().trim().min(1).max(500),
})
