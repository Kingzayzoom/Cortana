// Connection and voice are separate state machines from the lesson. Whether
// someone is speaking says nothing about where the round is.
export type ConnectionState = "idle" | "connecting" | "connected" | "disconnecting" | "error"
export type VoiceState = "quiet" | "user-speaking" | "assistant-speaking" | "awaiting-response"

export function deriveVoiceState(input: {
  connected: boolean
  agentSpeaking: boolean
  userSpeaking: boolean
  awaitingResponse: boolean
}): VoiceState {
  if (!input.connected) return "quiet"
  if (input.agentSpeaking) return "assistant-speaking"
  if (input.userSpeaking) return "user-speaking"
  if (input.awaitingResponse) return "awaiting-response"
  return "quiet"
}

export const VOICE_STATUS_TEXT: Record<VoiceState, string> = {
  quiet: "Listening",
  "user-speaking": "Listening…",
  "assistant-speaking": "Speaking",
  "awaiting-response": "Thinking",
}
