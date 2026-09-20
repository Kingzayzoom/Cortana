import { z } from "zod";
import type { SourceMessage } from "@/lib/email-summary/types";
import { RequestError } from "../errors";
import { config, GMAIL_SCOPE } from "./config";
import { decryptToken, type Connection, updateTokens } from "./store";

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";
const MAX_MESSAGES = 30;
const excludedLabels = new Set([
  "SPAM", "TRASH", "CATEGORY_PROMOTIONS", "CATEGORY_SOCIAL", "CATEGORY_FORUMS",
]);

export async function gmailGet(
  path: string,
  accessToken: string,
  params?: Record<string, string | string[]>,
): Promise<unknown> {
  const url = new URL(`${GMAIL_API}/${path}`);
  for (const [key, value] of Object.entries(params ?? {})) {
    for (const item of Array.isArray(value) ? value : [value]) url.searchParams.append(key, item);
  }
  let response: Response;
  try {
    response = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new RequestError("Gmail could not be reached.", 502);
  }
  if (response.status === 401 || response.status === 403)
    throw new RequestError("Reconnect Gmail to renew read-only access.", 409);
  if (!response.ok) throw new RequestError("Gmail could not load recent inbox messages.", 502);
  return response.json() as Promise<unknown>;
}

async function accessTokenFor(connection: Connection) {
  if (new Date(connection.access_expires_at).getTime() > Date.now() + 60_000)
    return decryptToken(connection.access_token_ciphertext);
  const settings = config();
  let response: Response;
  try {
    response = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: settings.clientId,
        client_secret: settings.clientSecret,
        refresh_token: decryptToken(connection.refresh_token_ciphertext),
        grant_type: "refresh_token",
      }),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new RequestError("Google token refresh could not be reached.", 502);
  }
  if (!response.ok) throw new RequestError("Reconnect Gmail to renew read-only access.", 409);
  const token = z.object({
    access_token: z.string().min(1),
    expires_in: z.number().int().positive(),
    refresh_token: z.string().min(1).optional(),
    scope: z.string().optional(),
  }).safeParse(await response.json());
  // Older connections may hold the optional draft scope; the briefing uses
  // read-only Gmail endpoints regardless of that historical grant.
  const knownScopes = new Set([
    GMAIL_SCOPE,
    "https://www.googleapis.com/auth/gmail.compose",
  ]);
  const granted = new Set(token.success && token.data.scope
    ? token.data.scope.split(/\s+/).filter(Boolean) : []);
  if (!token.success || (token.data.scope &&
      (!granted.has(GMAIL_SCOPE) || [...granted].some((scope) => !knownScopes.has(scope)))))
    throw new RequestError("Reconnect Gmail to renew the authorized access.", 409);
  await updateTokens(connection, {
    accessToken: token.data.access_token,
    refreshToken: token.data.refresh_token,
    expiresIn: token.data.expires_in,
  });
  return token.data.access_token;
}

const gmailMessageSchema = z.object({
  labelIds: z.array(z.string()).default([]),
  snippet: z.string().default(""),
  internalDate: z.string(),
  payload: z.object({
    headers: z.array(z.object({ name: z.string(), value: z.string() })).default([]),
  }).default({ headers: [] }),
});

function compact(value: string, max: number) {
  return value.replace(/\s+/g, " ").trim().slice(0, max);
}

export function sourceFromGmailMessage(value: unknown, now = Date.now()): SourceMessage | null {
  const parsed = gmailMessageSchema.safeParse(value);
  if (!parsed.success) return null;
  const message = parsed.data;
  if (!message.labelIds.includes("INBOX") || message.labelIds.some((label) => excludedLabels.has(label)))
    return null;
  const headers = new Map(
    message.payload.headers.map((header) => [header.name.toLowerCase(), header.value]),
  );
  if (
    headers.has("list-unsubscribe") || headers.has("list-unsubscribe-post") ||
    headers.has("list-id") || /^(bulk|list)$/i.test(headers.get("precedence")?.trim() ?? "") ||
    /\bnewsletter\b/i.test(`${headers.get("from") ?? ""} ${headers.get("subject") ?? ""}`)
  ) return null;
  const date = new Date(Number(message.internalDate));
  // Allow for the scheduler's execution window without reading older mail.
  if (Number.isNaN(date.getTime()) || now - date.getTime() > 30 * 60 * 60 * 1000 ||
      date.getTime() > now + 5 * 60 * 1000) return null;
  return {
    sender: compact(headers.get("from") ?? "Unknown sender", 160),
    subject: compact(headers.get("subject") ?? "(No subject)", 200),
    snippet: compact(message.snippet, 300),
    date: date.toISOString(),
  };
}

export async function fetchRecentInbox(connection: Connection): Promise<SourceMessage[]> {
  const accessToken = await accessTokenFor(connection);
  const listing = z.object({
    messages: z.array(z.object({ id: z.string().min(1) })).default([]),
  }).parse(await gmailGet("messages", accessToken, {
    q: "in:inbox newer_than:2d -category:promotions -category:social -category:forums -in:spam -in:trash",
    labelIds: "INBOX",
    maxResults: String(MAX_MESSAGES),
    includeSpamTrash: "false",
  }));
  const details: unknown[] = [];
  for (let index = 0; index < Math.min(listing.messages.length, MAX_MESSAGES); index += 5) {
    const batch = listing.messages.slice(index, index + 5);
    details.push(...await Promise.all(batch.map((message) =>
      // METADATA contains headers and snippet, never message bodies or attachments.
      gmailGet(`messages/${encodeURIComponent(message.id)}`, accessToken, {
        format: "metadata",
        metadataHeaders: ["From", "Subject", "List-Unsubscribe", "List-Unsubscribe-Post", "List-Id", "Precedence"],
      }),
    )));
  }
  return details.map((value) => sourceFromGmailMessage(value))
    .filter((message): message is SourceMessage => Boolean(message));
}
