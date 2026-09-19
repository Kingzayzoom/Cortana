import { z } from "zod";
import { RequestError } from "./session";

// Never forward a provider body: it can contain credentials, internal IDs or URLs.
export async function createConversationToken() {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  const agentId = process.env.ELEVENLABS_AGENT_ID;
  if (!apiKey || !agentId)
    throw new RequestError(
      "Voice is not configured. Set ELEVENLABS_API_KEY and ELEVENLABS_AGENT_ID on the server.",
      503,
    );
  const endpoint = new URL(
    "https://api.elevenlabs.io/v1/convai/conversation/token",
  );
  endpoint.searchParams.set("agent_id", agentId);
  let response: Response;
  try {
    response = await fetch(endpoint, {
      method: "GET",
      headers: { "xi-api-key": apiKey },
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      ["TimeoutError", "AbortError"].includes(error.name)
    )
      throw new RequestError("The voice service timed out. Please retry.", 504);
    throw new RequestError(
      "The server could not reach ElevenLabs. Check the network and retry.",
      502,
    );
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    // Only inspect the error to select one of our own fixed, safe messages.
    const detail = JSON.stringify(body ?? {}).toLowerCase();
    if (
      detail.includes("missing_permissions") &&
      detail.includes("convai_write")
    )
      throw new RequestError(
        "The ElevenLabs API key needs Write access for ElevenAgents (convai_write). Update the key's permissions, then retry.",
        403,
      );
    if (detail.includes("api_key_id_used_as_api_key"))
      throw new RequestError(
        "ElevenLabs rejected a key ID. Set ELEVENLABS_API_KEY to the secret key shown when the key is created or rotated (starts with sk_).",
        401,
      );
    if (
      [402, 429].includes(response.status) ||
      /quota|billing|insufficient_credit|credit_balance/.test(detail)
    )
      throw new RequestError(
        "ElevenLabs has reached a usage or billing limit. Check the account balance and limits, then retry.",
        429,
      );
    if (
      [401, 403].includes(response.status) ||
      /invalid_api_key|authentication_error/.test(detail)
    )
      throw new RequestError(
        "ElevenLabs denied access. Check the server API key and its permission to access this agent.",
        response.status === 403 ? 403 : 401,
      );
    if (response.status === 404)
      throw new RequestError(
        "The configured ElevenLabs agent was not found. Check ELEVENLABS_AGENT_ID on the server.",
        502,
      );
    throw new RequestError(
      "ElevenLabs could not create a voice session. Check the agent configuration and retry.",
      502,
    );
  }
  const payload = z
    .object({
      token: z.string().trim().min(1),
      conversation_id: z.string().trim().min(1),
    })
    .safeParse(body);
  if (!payload.success)
    throw new RequestError(
      "ElevenLabs returned an invalid session credential. Please retry.",
      502,
    );
  return {
    token: payload.data.token,
    conversationId: payload.data.conversation_id,
  };
}
