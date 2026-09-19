import "server-only"

import { GoogleGenAI } from "@google/genai"

// A Flash-class model keeps latency low. Override with GEMINI_MODEL to pin a
// specific model that your AI Studio project has quota for.
export const GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-latest"

let client: GoogleGenAI | null = null

/** Null when GEMINI_API_KEY isn't set, so callers can degrade gracefully. */
export function getGemini(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) return null
  client ??= new GoogleGenAI({ apiKey })
  return client
}
