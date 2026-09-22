// Shared by the agent configuration scripts: a small ElevenLabs Agents API
// client, and the --url argument that says where the deployed app lives.
import { setting } from "./settings.mjs";

/**
 * Returns `api(path, method?, body?)` for https://api.elevenlabs.io/v1/convai.
 * Failures throw with the status in the message, e.g. "(404)", so callers can
 * tell a deleted resource from a real error. Response bodies are never logged
 * except 422 validation locations, with the key redacted.
 */
export function elevenlabs(apiKey, { timeoutMs = 30_000 } = {}) {
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set.");
  return async function api(path, method = "GET", body) {
    const response = await fetch(
      `https://api.elevenlabs.io/v1/convai/${path}`,
      {
        method,
        headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(timeoutMs),
      },
    );
    if (!response.ok) {
      const failure = await response.json().catch(() => null);
      if (response.status === 422 && Array.isArray(failure?.detail))
        console.log(
          JSON.stringify({
            validation: failure.detail.map(({ loc, msg, type }) => ({
              loc,
              msg: String(msg).replaceAll(apiKey, "[REDACTED]"),
              type,
            })),
          }),
        );
      throw new Error(
        `ElevenLabs ${method} ${path} failed (${response.status}). No credentials were logged.`,
      );
    }
    return response.json();
  };
}

/** The deployed origin from --url=… or SAMANTHA_PUBLIC_URL, without a trailing slash. */
export function publicUrl() {
  return (
    process.argv.find((a) => a.startsWith("--url="))?.slice(6) ||
    setting("PUBLIC_URL") ||
    ""
  ).replace(/\/$/, "");
}

export const isNotFound = (error) => String(error?.message).includes("(404)");
