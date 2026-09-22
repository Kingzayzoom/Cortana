// Places an outbound call: ElevenLabs dials the learner through the carrier and
// runs the phone agent, seeded with dynamic variables (the signed session, the
// learner's name, the briefing). Provider errors are mapped to our own messages
// and never forwarded.
import { z } from "zod";
import { RequestError } from "../errors";
import { setting } from "../env";

// Twilio is a native ElevenLabs integration; every other carrier (Telnyx,
// Plivo, SignalWire, …) arrives as a SIP trunk. Same request, different path.
const callEndpoint = () =>
  `https://api.elevenlabs.io/v1/convai/${
    setting("PHONE_PROVIDER") === "sip" ? "sip-trunk" : "twilio"
  }/outbound-call`;

export function phoneConfigured() {
  return Boolean(
    process.env.ELEVENLABS_API_KEY &&
    process.env.ELEVENLABS_PHONE_AGENT_ID &&
    process.env.ELEVENLABS_PHONE_NUMBER_ID &&
    (setting("PHONE_TOOL_SECRET")?.length ?? 0) >= 32 &&
    (setting("DEMO_ACCESS_CODE")?.length ?? 0) >= 12 &&
    (setting("SESSION_SECRET")?.length ?? 0) >= 32,
  );
}

export const phoneCallRequest = z
  .object({
    accessCode: z.string().max(200),
    // E.164, the format ElevenLabs and Twilio expect.
    phoneNumber: z
      .string()
      .trim()
      .regex(
        /^\+[1-9]\d{7,14}$/,
        "Enter the number in international format, for example +15715550123.",
      ),
    consent: z.literal(true),
    permission: z.literal(true),
    mode: z.enum(["round", "context", "prime"]).default("round"),
  })
  .strict();

export const maskNumber = (number: string) =>
  `${number.slice(0, 2)}${"•".repeat(Math.max(number.length - 4, 0))}${number.slice(-2)}`;

export async function startOutboundCall(
  phoneNumber: string,
  dynamicVariables: Record<string, string>,
) {
  let response: Response;
  try {
    response = await fetch(callEndpoint(), {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY!,
        "Content-Type": "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(20_000),
      body: JSON.stringify({
        agent_id: process.env.ELEVENLABS_PHONE_AGENT_ID,
        agent_phone_number_id: process.env.ELEVENLABS_PHONE_NUMBER_ID,
        to_number: phoneNumber,
        conversation_initiation_client_data: {
          dynamic_variables: dynamicVariables,
        },
      }),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      ["TimeoutError", "AbortError"].includes(error.name)
    )
      throw new RequestError("The call request timed out. Please retry.", 504);
    throw new RequestError(
      "The server could not reach ElevenLabs to place the call.",
      502,
    );
  }
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    // Inspect only to choose one of our own fixed messages; never forward the body.
    const detail = JSON.stringify(body ?? {}).toLowerCase();
    if (/unverified|verified caller|trial/.test(detail))
      throw new RequestError(
        "The carrier account is on a trial and can only call verified numbers. Verify this number with the carrier, or add funds to the account.",
        400,
      );
    if (/invalid|not a valid phone|to_number/.test(detail))
      throw new RequestError(
        "That phone number was rejected. Check the country code and digits.",
        400,
      );
    if (
      [402, 429].includes(response.status) ||
      /quota|billing|credit|balance|insufficient/.test(detail)
    )
      throw new RequestError(
        "The ElevenLabs or Twilio account has reached a usage or billing limit.",
        429,
      );
    if ([401, 403].includes(response.status))
      throw new RequestError(
        "ElevenLabs denied the call request. Check the API key and the phone number's permissions.",
        502,
      );
    if (response.status === 404)
      throw new RequestError(
        "The configured phone agent or phone number was not found in ElevenLabs.",
        502,
      );
    throw new RequestError(
      "ElevenLabs could not place the call. Check the phone agent configuration and retry.",
      502,
    );
  }
  const payload = z
    .object({
      success: z.boolean().optional(),
      message: z.string().optional(),
      conversation_id: z.string().nullable().optional(),
      // Twilio returns callSid; a SIP trunk returns sip_call_id.
      callSid: z.string().nullable().optional(),
      sip_call_id: z.string().nullable().optional(),
    })
    .safeParse(body);
  if (!payload.success || payload.data.success === false)
    throw new RequestError(
      "ElevenLabs did not start the call. Check the phone number and agent, then retry.",
      502,
    );
  return { conversationId: payload.data.conversation_id ?? null };
}
