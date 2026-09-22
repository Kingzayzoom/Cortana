import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { cookies } from "next/headers";
import { z } from "zod";
import { appOrigin, hmac, safeEqual } from "./session";
import { RequestError } from "./errors";

const AUTHORIZE = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN = "https://oauth2.googleapis.com/token";
const ISSUERS = ["https://accounts.google.com", "accounts.google.com"];
const OAUTH_COOKIE = "cortana_oauth";
const googleVerifier = new OAuth2Client();

export function googleConfigured() {
  return Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
  );
}

/** Google subjects are numeric strings. Constrain them: this value names a file. */
export const googleSubject = z.string().regex(/^\d{1,64}$/);

/** Storage id for a signed-in account. Anonymous ids stay plain UUIDs. */
export const accountId = (subject: string) => `g-${subject}`;

export const redirectUri = (request: Request) =>
  `${appOrigin(request)}/api/auth/google/callback`;

const base64url = (input: Buffer) => input.toString("base64url");

/**
 * Starts the authorization-code flow with PKCE. The verifier and state live in
 * a short-lived signed HttpOnly cookie, so neither survives past this exchange.
 */
export async function beginGoogleAuth(request: Request) {
  if (!googleConfigured())
    throw new RequestError(
      "Google sign-in is not configured on this server.",
      503,
    );
  const state = base64url(randomBytes(24));
  const verifier = base64url(randomBytes(32));
  const challenge = base64url(createHash("sha256").update(verifier).digest());
  const payload = `${state}.${verifier}`;
  const jar = await cookies();
  jar.set(OAUTH_COOKIE, `${payload}.${await hmac(`oauth:${payload}`)}`, {
    httpOnly: true,
    sameSite: "lax", // The provider redirects back with a cross-site GET.
    secure: process.env.NODE_ENV === "production",
    maxAge: 600,
    path: "/api/auth",
  });
  const url = new URL(AUTHORIZE);
  url.searchParams.set("client_id", process.env.GOOGLE_CLIENT_ID!);
  url.searchParams.set("redirect_uri", redirectUri(request));
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", "openid email profile");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  url.searchParams.set("prompt", "select_account");
  return url.toString();
}

/** Reads and clears the PKCE cookie, returning the verifier for a matching state. */
export async function consumeOAuthCookie(state: string) {
  const jar = await cookies();
  const raw = jar.get(OAUTH_COOKIE)?.value;
  jar.delete({ name: OAUTH_COOKIE, path: "/api/auth" });
  if (!raw) return null;
  const [cookieState, verifier, signature] = raw.split(".");
  if (!cookieState || !verifier || !signature) return null;
  const payload = `${cookieState}.${verifier}`;
  if (!safeEqual(await hmac(`oauth:${payload}`), signature)) return null;
  const a = Buffer.from(cookieState),
    b = Buffer.from(state);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  return verifier;
}

const idTokenClaims = z.object({
  iss: z.string(),
  aud: z.string(),
  exp: z.number(),
  sub: googleSubject,
  email: z.string().email().optional(),
  email_verified: z.boolean().optional(),
  name: z.string().max(200).optional(),
  picture: z.string().url().optional(),
});

/** Verifies Google's signature and validates the identity claims we consume. */
async function readIdToken(idToken: string) {
  let decoded: unknown;
  try {
    const ticket = await googleVerifier.verifyIdToken({
      idToken,
      audience: process.env.GOOGLE_CLIENT_ID!,
    });
    decoded = ticket.getPayload();
  } catch {
    throw new RequestError(
      "Google could not verify that sign-in token. Please try again.",
      401,
    );
  }
  const claims = idTokenClaims.safeParse(decoded);
  if (!claims.success)
    throw new RequestError("Google returned an incomplete sign-in token.", 502);
  if (!ISSUERS.includes(claims.data.iss))
    throw new RequestError(
      "That sign-in token came from an unexpected issuer.",
      401,
    );
  if (claims.data.aud !== process.env.GOOGLE_CLIENT_ID)
    throw new RequestError(
      "That sign-in token was issued for another application.",
      401,
    );
  if (claims.data.exp * 1000 <= Date.now())
    throw new RequestError(
      "That sign-in attempt expired. Please try again.",
      401,
    );
  if (claims.data.email && claims.data.email_verified === false)
    throw new RequestError(
      "Verify your Google email address, then sign in again.",
      403,
    );
  return claims.data;
}

/** Exchanges the authorization code and returns the verified account. */
export async function completeGoogleAuth(
  request: Request,
  code: string,
  verifier: string,
) {
  if (!googleConfigured())
    throw new RequestError(
      "Google sign-in is not configured on this server.",
      503,
    );
  let response: Response;
  try {
    response = await fetch(TOKEN, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID!,
        client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri(request),
        grant_type: "authorization_code",
        code_verifier: verifier,
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(12_000),
    });
  } catch (error) {
    if (
      error instanceof Error &&
      ["TimeoutError", "AbortError"].includes(error.name)
    )
      throw new RequestError(
        "Google sign-in timed out. Please try again.",
        504,
      );
    throw new RequestError(
      "The server could not reach Google. Check the network and retry.",
      502,
    );
  }
  // Never surface the provider body: it carries tokens and client details.
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = JSON.stringify(body ?? {}).toLowerCase();
    if (detail.includes("invalid_grant"))
      throw new RequestError(
        "That sign-in link was already used or expired. Please try again.",
        401,
      );
    if (detail.includes("redirect_uri_mismatch"))
      throw new RequestError(
        "This server's redirect URI is not registered on the Google OAuth client.",
        500,
      );
    if (detail.includes("invalid_client"))
      throw new RequestError(
        "Google rejected this application's credentials.",
        500,
      );
    throw new RequestError(
      "Google could not complete the sign-in. Please try again.",
      502,
    );
  }
  const token = z.object({ id_token: z.string().min(1) }).safeParse(body);
  if (!token.success)
    throw new RequestError(
      "Google did not return a sign-in token. Please try again.",
      502,
    );
  const claims = await readIdToken(token.data.id_token);
  return {
    provider: "google" as const,
    subject: claims.sub,
    email: claims.email ?? null,
    name: claims.name ?? null,
    picture: claims.picture ?? null,
  };
}
