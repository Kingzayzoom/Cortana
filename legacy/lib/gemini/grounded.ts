import "server-only"

import { ApiError } from "@google/genai"
import { z } from "zod"

import type { Round } from "@/lib/content/types"
import { buildRoundContext } from "@/lib/learning/round-context"
import type { GroundedAnswer } from "@/lib/learning/types"

import { GEMINI_MODEL, getGemini } from "./client"
import { groundedAnswerSystemPrompt, groundedAnswerUserPrompt } from "./prompts"

const groundedAnswerSchema = z.object({
  answer: z.string(),
  source_ids: z.array(z.string()),
  covered_by_evidence: z.boolean(),
})

export class GeminiUnavailableError extends Error {
  constructor(
    readonly code: "not_configured" | "rate_limited" | "upstream_error" | "bad_output",
    message: string,
  ) {
    super(message)
  }
}

/** Answers a learner question from the round's curated evidence only. */
export async function answerFromEvidence(round: Round, question: string): Promise<GroundedAnswer> {
  const ai = getGemini()
  if (!ai) throw new GeminiUnavailableError("not_configured", "GEMINI_API_KEY is not set.")

  const context = buildRoundContext(round)
  let text: string | undefined
  try {
    const response = await ai.models.generateContent({
      model: GEMINI_MODEL,
      contents: groundedAnswerUserPrompt(context, question),
      config: {
        systemInstruction: groundedAnswerSystemPrompt(),
        responseMimeType: "application/json",
        responseJsonSchema: z.toJSONSchema(groundedAnswerSchema),
        temperature: 0.2,
      },
    })
    text = response.text
  } catch (err) {
    if (err instanceof ApiError && err.status === 429) {
      throw new GeminiUnavailableError("rate_limited", "Gemini rate limit reached. Try again shortly.")
    }
    throw new GeminiUnavailableError("upstream_error", err instanceof Error ? err.message : "Gemini request failed.")
  }

  const parsed = groundedAnswerSchema.safeParse(safeJson(text))
  if (!parsed.success) throw new GeminiUnavailableError("bad_output", "Gemini returned an unexpected response.")

  // Never surface a citation that isn't in this round's evidence bundle.
  const allowed = new Set(round.sourceIds)
  return {
    answer: parsed.data.answer,
    sourceIds: [...new Set(parsed.data.source_ids)].filter((id) => allowed.has(id)),
    coveredByEvidence: parsed.data.covered_by_evidence,
  }
}

function safeJson(text: string | undefined): unknown {
  try {
    return text ? JSON.parse(text) : null
  } catch {
    return null
  }
}
