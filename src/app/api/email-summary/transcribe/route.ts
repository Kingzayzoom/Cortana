// POST /api/email-summary/transcribe — speech-to-text for the email drafting
// panel in browsers without built-in speech recognition (Firefox). Takes one
// short recording as multipart form data; nothing is stored.
import {
  errorResponse,
  assertOrigin,
  json,
  rateLimit,
} from "@/lib/server/http";
import { RequestError } from "@/lib/server/errors";
import { transcribeAudio } from "@/lib/server/email-summary/gemini";

export const runtime = "nodejs";
export const maxDuration = 45;

// About twenty seconds of compressed speech.
const MAX_AUDIO_BYTES = 2_000_000;
const allowedTypes = new Set([
  "audio/ogg",
  "audio/webm",
  "audio/mp4",
  "audio/mpeg",
  "audio/wav",
]);

export async function POST(request: Request) {
  try {
    assertOrigin(request);
    await rateLimit("email-summary:voice-transcribe", 12, 60_000);
    // Refuse an oversized upload before reading it; the form overhead is small.
    const declaredSize = Number(request.headers.get("content-length") ?? 0);
    if (declaredSize > MAX_AUDIO_BYTES + 20_000)
      throw new RequestError(
        "The voice message is too long. Keep it under 20 seconds.",
        413,
      );
    const audio = (await request.formData()).get("audio");
    if (!(audio instanceof File))
      throw new RequestError("Record a voice message first.");
    const mimeType = audio.type.split(";")[0].toLowerCase();
    if (
      !allowedTypes.has(mimeType) ||
      audio.size < 500 ||
      audio.size > MAX_AUDIO_BYTES
    )
      throw new RequestError(
        "The voice recording is unsupported or too long.",
        413,
      );
    const text = await transcribeAudio(
      mimeType,
      Buffer.from(await audio.arrayBuffer()),
    );
    if (!text)
      throw new RequestError(
        "I didn't catch that. Try again or type below.",
        422,
      );
    return json({ text });
  } catch (error) {
    return errorResponse(error);
  }
}
