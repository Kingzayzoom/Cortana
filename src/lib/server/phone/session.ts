// Credentials for the phone agent's webhook tools. A phone has no browser and
// no cookie, so each tool request proves itself twice:
//   1. a shared secret in the Authorization header (the request came from our
//      ElevenLabs agent, not the open internet), and
//   2. a signed session naming one profile and one run, issued when the call
//      was placed and valid for 45 minutes (it can touch nothing else).
import { RequestError } from "../errors";
import { hmac, safeEqual } from "../session";
import { setting } from "../env";

const SESSION_TTL_MS = 45 * 60 * 1000;

/** `base64url({p: profile, r: run, e: expiry}).hmac` — passed to the agent as a dynamic variable. */
export async function createPhoneSession(profileId: string, runId: string) {
  const payload = Buffer.from(
    JSON.stringify({ p: profileId, r: runId, e: Date.now() + SESSION_TTL_MS }),
  ).toString("base64url");
  return `${payload}.${await hmac(`phone:${payload}`)}`;
}

// Check 2 of 2: the session is ours, unexpired, and names what it may touch.
// Every failure reads the same, so a caller learns nothing from probing.
export async function readPhoneSession(token: string) {
  const [payload, signature] = token.split(".");
  const unknown = new RequestError("This call session is not recognized.", 401);
  if (!payload || !signature) throw unknown;
  if (!safeEqual(await hmac(`phone:${payload}`), signature)) throw unknown;
  let data: { p?: unknown; r?: unknown; e?: unknown };
  try {
    data = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
  } catch {
    throw unknown;
  }
  if (typeof data.p !== "string" || typeof data.r !== "string") throw unknown;
  if (typeof data.e !== "number" || Date.now() > data.e)
    throw new RequestError("This call session has expired.", 401);
  return { profileId: data.p, runId: data.r };
}

// Check 1 of 2: the request came from the configured agent.
export function assertToolSecret(request: Request) {
  const secret = setting("PHONE_TOOL_SECRET");
  if (
    !secret ||
    !safeEqual(request.headers.get("authorization") ?? "", `Bearer ${secret}`)
  )
    throw new RequestError("This tool request is not authorized.", 401);
}

// Someone who dials the number has no profile behind them, so their agent's
// tools send this constant instead of a signed session. See ./tools guestTools
// for the little it unlocks.
export const GUEST_SESSION = "guest-inbound-caller";
