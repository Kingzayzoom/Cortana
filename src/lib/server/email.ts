import { z } from "zod";
import { RequestError } from "./errors";
import { clinician, facility } from "../content/briefing";

// Cortana can pass a message to the front desk during a call. The agent never
// chooses the recipient: this server holds one configured address, composes the
// message, and marks every send as demo traffic. The model only supplies words.
const ENDPOINT = "https://api.resend.com/emails";

export const frontDeskRequest = z
  .object({
    reason: z.enum(["running_late", "emergency", "other"]),
    message: z.string().trim().min(1).max(300),
    etaMinutes: z.number().int().min(1).max(240).optional(),
    // The agent asserts it read the message back and heard a yes.
    confirmed: z.literal(true),
  })
  .strict();

export type FrontDeskRequest = z.infer<typeof frontDeskRequest>;

// One preset recipient for the demo. The agent can never address a message
// anywhere else, whatever it is asked to do on a call.
export const frontDeskAddress = () =>
  process.env.CORTANA_FRONT_DESK_EMAIL || "kingzayzoom@gmail.com";

export function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && frontDeskAddress());
}

const headline: Record<FrontDeskRequest["reason"], string> = {
  running_late: "running late",
  emergency: "emergency",
  other: "message",
};

/** Masks the address so a transcript or log never carries it in full. */
export const maskEmail = (address: string) => {
  const [name, domain] = address.split("@");
  return `${name.slice(0, 2)}${"•".repeat(Math.max(name.length - 2, 1))}@${domain ?? ""}`;
};

export async function notifyFrontDesk(request: FrontDeskRequest) {
  if (!emailConfigured())
    throw new RequestError(
      "Front desk messages are not configured on this server.",
      503,
    );
  const to = frontDeskAddress();
  // The voice says "Zabish"; anything written uses the real spelling.
  const message = request.message.replace(/Zabish/g, "Zaybish");
  const subject = `${clinician.displayName} — ${headline[request.reason]} (${facility.unit})`;
  // Reads like a note from a colleague, not a form. One quiet line at the end
  // keeps it honest about where it came from.
  const text = [
    `Hi — Cortana here, on behalf of ${clinician.displayName}.`,
    "",
    message,
    ...(request.etaMinutes
      ? [`Expected in about ${request.etaMinutes} minutes.`]
      : []),
    "",
    "Sent from a Cortana voice call · demonstration message",
  ].join("\n");

  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: "POST",
      headers: {
        authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "content-type": "application/json",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
      body: JSON.stringify({
        from:
          process.env.CORTANA_EMAIL_FROM || "Cortana <onboarding@resend.dev>",
        to: [to],
        subject,
        text,
      }),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      ["TimeoutError", "AbortError"].includes(error.name)
    )
      throw new RequestError(
        "The message service timed out. Please retry.",
        504,
      );
    throw new RequestError("The server could not reach the mail service.", 502);
  }
  if (!response.ok) {
    // Never forward the provider's body; choose one of our own messages.
    const detail = JSON.stringify(await response.json().catch(() => ({})));
    console.error(
      "[cortana] front desk email failed",
      response.status,
      detail.slice(0, 200),
    );
    if ([401, 403].includes(response.status))
      throw new RequestError(
        "The mail service rejected the server's credentials.",
        502,
      );
    if (response.status === 429)
      throw new RequestError(
        "The mail service is rate limiting. Retry shortly.",
        429,
      );
    throw new RequestError(
      "The message could not be sent. Tell the clinician it did not go through.",
      502,
    );
  }
  return {
    sent: true,
    to: maskEmail(to),
    subject,
    say: `I've sent that to the ${facility.unit} front desk.`,
  };
}
