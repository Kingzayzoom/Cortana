// Configuration for the email briefing, checked on use so the rest of the app
// runs without it.
import { createHash } from "node:crypto";
import { RequestError } from "../errors";

export const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
export const SUMMARY_TIME_ZONE = "America/New_York";

export function required(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new RequestError(`Email Summary is missing ${name}.`, 503);
  return value;
}

export function config() {
  const supabaseUrl = new URL(required("SUPABASE_URL"));
  const redirectUri = new URL(required("GOOGLE_REDIRECT_URI"));
  if (
    redirectUri.pathname !== "/api/email-summary/callback" ||
    redirectUri.search ||
    redirectUri.hash ||
    (redirectUri.protocol !== "https:" && redirectUri.hostname !== "localhost")
  )
    throw new RequestError(
      "GOOGLE_REDIRECT_URI must be the registered Email Summary callback URL.",
      503,
    );
  return {
    supabaseUrl,
    serviceKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    clientId: required("GOOGLE_CLIENT_ID"),
    clientSecret: required("GOOGLE_CLIENT_SECRET"),
    redirectUri: redirectUri.toString(),
  };
}

// Derive a separate AES key from the existing server secret. Rotating the
// Supabase service key requires users to reconnect Gmail.
export function tokenKey() {
  return (
    createHash("sha256")
      // Predates the rename; it salts the key for stored tokens, so it must not change.
      .update("cortana-email-summary-token-v1:")
      .update(config().serviceKey)
      .digest()
  );
}
