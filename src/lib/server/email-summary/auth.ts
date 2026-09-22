// Gmail OAuth for the email briefing (read-only scope), and the signed cookie
// that remembers which connection belongs to this browser.
//
// Gmail uses the same Google OAuth client as sign-in and the same registered
// redirect URI (/api/auth/google/callback), so connecting Gmail needs no extra
// setup in Google Cloud. Its `state` carries a "gmail." prefix; the sign-in
// callback sees it and hands the request to gmailCallback below.
import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import { z } from "zod";
import { RequestError } from "../errors";
import { redirectUri } from "../auth";
import { appOrigin } from "../http";
import { config, GMAIL_SCOPE } from "./config";
import { connectionById, deleteConnection, saveConnection } from "./store";
import { gmailGet } from "./gmail";

const OAUTH_COOKIE = "samantha_gmail_oauth";
// base64url has no dots, so a sign-in state can never look like this.
const STATE_PREFIX = "gmail.";
const SESSION_COOKIE = "samantha_gmail_session";
const SESSION_AGE_SECONDS = 60 * 60 * 24 * 90;
type GmailOAuthErrorCode =
  | "denied"
  | "google_unreachable"
  | "google_rejected"
  | "google_response"
  | "gmail_unreachable"
  | "gmail_denied"
  | "gmail_response"
  | "storage";

export class GmailOAuthError extends Error {
  constructor(public readonly code: GmailOAuthErrorCode) {
    super(`Gmail OAuth failed at ${code}`);
  }
}
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/api/email-summary",
};
// The in-flight OAuth cookie must also reach /api/auth/google/callback.
const oauthCookieOptions = { ...cookieOptions, path: "/api", maxAge: 600 };

export const isGmailState = (state: string | null) =>
  Boolean(state?.startsWith(STATE_PREFIX));

function equal(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

function sign(value: string) {
  return createHmac("sha256", config().clientSecret)
    .update(`email-summary:${value}`)
    .digest("base64url");
}

export async function connectedAccount() {
  const raw = (await cookies()).get(SESSION_COOKIE)?.value;
  if (!raw) return null;
  const [id, issued, mac] = raw.split(".");
  const age = Math.floor(Date.now() / 1000) - Number(issued);
  if (
    !z.string().uuid().safeParse(id).success ||
    !Number.isInteger(age) ||
    age < 0 ||
    age > SESSION_AGE_SECONDS ||
    !mac ||
    !equal(sign(`${id}.${issued}`), mac)
  )
    return null;
  return connectionById(id);
}

export async function disconnectGmail() {
  const connection = await connectedAccount();
  if (connection) await deleteConnection(connection.id);
  (await cookies()).delete({ name: SESSION_COOKIE, path: cookieOptions.path });
}

export async function beginGmailOAuth(request: Request) {
  const settings = config();
  const state = randomBytes(24).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const issued = Math.floor(Date.now() / 1000).toString();
  const payload = `${state}.${verifier}.${issued}.read`;
  (await cookies()).set(
    OAUTH_COOKIE,
    `${payload}.${sign(payload)}`,
    oauthCookieOptions,
  );
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", settings.clientId);
  url.searchParams.set("redirect_uri", redirectUri(request));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", GMAIL_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent select_account");
  url.searchParams.set("state", STATE_PREFIX + state);
  url.searchParams.set(
    "code_challenge",
    createHash("sha256").update(verifier).digest("base64url"),
  );
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

const tokenSchema = z.object({
  access_token: z.string().min(1),
  refresh_token: z.string().min(1),
  expires_in: z.number().int().positive(),
  scope: z.string(),
});

async function completeGmailOAuth(
  request: Request,
  code: string,
  prefixedState: string,
) {
  const state = prefixedState.slice(STATE_PREFIX.length);
  const jar = await cookies();
  const raw = jar.get(OAUTH_COOKIE)?.value;
  jar.delete({ name: OAUTH_COOKIE, path: oauthCookieOptions.path });
  const parts = raw?.split(".") ?? [];
  const [cookieState, verifier, issued] = parts;
  const mode = parts.length === 5 ? parts[3] : "read";
  const mac = parts.length === 5 ? parts[4] : parts[3];
  const payload =
    parts.length === 5
      ? `${cookieState}.${verifier}.${issued}.${mode}`
      : `${cookieState}.${verifier}.${issued}`;
  const age = Math.floor(Date.now() / 1000) - Number(issued);
  if (
    !cookieState ||
    !verifier ||
    !mac ||
    mode !== "read" ||
    !Number.isInteger(age) ||
    age < 0 ||
    age > 600 ||
    !equal(state, cookieState) ||
    !equal(mac, sign(payload))
  )
    throw new RequestError(
      "Gmail authorization expired. Try connecting again.",
      401,
    );

  const settings = config();
  let response: Response;
  try {
    response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: settings.clientId,
        client_secret: settings.clientSecret,
        // Must match the authorization request exactly.
        redirect_uri: redirectUri(request),
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new GmailOAuthError("google_unreachable");
  }
  if (!response.ok) throw new GmailOAuthError("google_rejected");
  let tokenBody: unknown;
  try {
    tokenBody = await response.json();
  } catch {
    throw new GmailOAuthError("google_response");
  }
  const parsed = tokenSchema.safeParse(tokenBody);
  const granted = new Set(
    parsed.success ? parsed.data.scope.split(/\s+/).filter(Boolean) : [],
  );
  if (!parsed.success || granted.size !== 1 || !granted.has(GMAIL_SCOPE))
    throw new GmailOAuthError("google_response");
  let profile: { emailAddress: string };
  try {
    profile = z
      .object({ emailAddress: z.string().email() })
      .parse(await gmailGet("profile", parsed.data.access_token));
  } catch (error) {
    throw new GmailOAuthError(
      error instanceof RequestError &&
        error.message === "Gmail could not be reached."
        ? "gmail_unreachable"
        : error instanceof RequestError && error.status === 409
          ? "gmail_denied"
          : "gmail_response",
    );
  }
  let connection;
  try {
    connection = await saveConnection({
      email: profile.emailAddress,
      accessToken: parsed.data.access_token,
      refreshToken: parsed.data.refresh_token,
      expiresIn: parsed.data.expires_in,
    });
  } catch {
    throw new GmailOAuthError("storage");
  }
  if (!connection) throw new GmailOAuthError("storage");
  const issuedAt = Math.floor(Date.now() / 1000).toString();
  const sessionPayload = `${connection.id}.${issuedAt}`;
  jar.set(SESSION_COOKIE, `${sessionPayload}.${sign(sessionPayload)}`, {
    ...cookieOptions,
    maxAge: SESSION_AGE_SECONDS,
  });
}

/**
 * Finishes the Gmail flow and returns to /email-summary with either
 * email_connected=1 or an email_error code the page explains.
 */
export async function gmailCallback(request: Request) {
  const destination = new URL("/email-summary", appOrigin(request));
  const params = new URL(request.url).searchParams;
  const code = params.get("code"),
    state = params.get("state");
  try {
    // The user declined on the consent screen.
    if (params.get("error")) throw new GmailOAuthError("denied");
    if (!code || !state || !isGmailState(state))
      throw new RequestError("Gmail authorization expired.", 401);
    await completeGmailOAuth(request, code, state);
    destination.searchParams.set("email_connected", "1");
  } catch (error) {
    destination.searchParams.set(
      "email_error",
      error instanceof GmailOAuthError
        ? error.code
        : error instanceof RequestError && error.status === 401
          ? "expired"
          : "failed",
    );
  }
  return Response.redirect(destination, 302);
}
