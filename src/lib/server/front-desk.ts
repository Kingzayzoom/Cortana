// Samantha can pass a message to the front desk during a call ("tell them I'm
// running twenty minutes late"). The agent never chooses the recipient: this
// server holds one configured address, composes the email, and marks it as demo
// traffic. The model supplies only the words, after reading them back.
import { z } from "zod";
import { RequestError } from "./errors";
import { clinician, facility } from "../content/briefings";
import { setting } from "./env";

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

type FrontDeskRequest = z.infer<typeof frontDeskRequest>;

// One preset recipient for the demo. The agent can never address a message
// anywhere else, whatever it is asked to do on a call.
const frontDeskAddress = () =>
  setting("FRONT_DESK_EMAIL") || "kingzayzoom@gmail.com";

function emailConfigured() {
  return Boolean(process.env.RESEND_API_KEY && frontDeskAddress());
}

const surname = (name: string) => name.split(" ").at(-1)!;

const headline: Record<FrontDeskRequest["reason"], string> = {
  running_late: "running late",
  emergency: "emergency",
  other: "message",
};

/** Masks the address so a transcript or log never carries it in full. */
const maskEmail = (address: string) => {
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
  // The agent writes the name the way it says it; the email uses the real spelling.
  const message = request.message.replaceAll(
    surname(clinician.spokenName),
    surname(clinician.displayName),
  );
  const subject = `${clinician.displayName} — ${headline[request.reason]} (${facility.unit})`;
  // Reads like a note from a colleague, not a form. One quiet line at the end
  // keeps it honest about where it came from.
  const text = [
    `Hi — Samantha here, on behalf of ${clinician.displayName}.`,
    "",
    message,
    ...(request.etaMinutes
      ? [`Expected in about ${request.etaMinutes} minutes.`]
      : []),
    "",
    "Sent from a Samantha voice call · demonstration message",
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
        from: setting("EMAIL_FROM") || "Samantha <onboarding@resend.dev>",
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
      "[samantha] front desk email failed",
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
