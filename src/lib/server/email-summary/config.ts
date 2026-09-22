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

// No redirect URI here: Gmail shares the Google client and its registered
// callback with sign-in (see ./auth.ts).
export function config() {
  return {
    supabaseUrl: new URL(required("SUPABASE_URL")),
    serviceKey: required("SUPABASE_SERVICE_ROLE_KEY"),
    clientId: required("GOOGLE_CLIENT_ID"),
    clientSecret: required("GOOGLE_CLIENT_SECRET"),
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
