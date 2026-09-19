import "server-only"

const ELEVENLABS_API = "https://api.elevenlabs.io"

export class VoiceNotConfiguredError extends Error {}

/**
 * Mints a short-lived WebRTC conversation token so the API key never reaches
 * the browser.
 */
export async function createConversationToken(): Promise<string> {
  const apiKey = process.env.ELEVENLABS_API_KEY
  const agentId = process.env.ELEVENLABS_AGENT_ID
  if (!apiKey || !agentId) {
    throw new VoiceNotConfiguredError("Set ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID to enable voice.")
  }

  const url = `${ELEVENLABS_API}/v1/convai/conversation/token?agent_id=${encodeURIComponent(agentId)}`
  const res = await fetch(url, { headers: { "xi-api-key": apiKey }, cache: "no-store" })
  if (!res.ok) {
    const detail = await res.text().catch(() => "")
    throw new Error(`ElevenLabs token request failed (${res.status}) ${detail.slice(0, 200)}`)
  }

  const data = (await res.json()) as { token?: unknown }
  if (typeof data.token !== "string" || !data.token) throw new Error("ElevenLabs returned no conversation token.")
  return data.token
}
