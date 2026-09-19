import { createConversationToken, VoiceNotConfiguredError } from "@/lib/elevenlabs/session"

export async function GET() {
  try {
    const conversationToken = await createConversationToken()
    return Response.json({ conversationToken }, { headers: { "Cache-Control": "no-store" } })
  } catch (err) {
    if (err instanceof VoiceNotConfiguredError) {
      return Response.json({ error: "voice_not_configured", message: err.message }, { status: 503 })
    }
    console.error("[elevenlabs/session]", err)
    return Response.json({ error: "voice_unavailable", message: "Couldn't start a voice session." }, { status: 502 })
  }
}
