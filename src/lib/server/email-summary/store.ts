// Supabase persistence for the email briefing: connections with encrypted
// tokens, and the latest summary per connection.
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { z } from "zod";
import type { EmailSummary, SourceMessage } from "@/lib/email-summary/types";
import { RequestError } from "../errors";
import { config, tokenKey } from "./config";

export const connectionSchema = z.object({
  id: z.string().uuid(),
  email_address: z.string().email(),
  access_token_ciphertext: z.string().min(1),
  refresh_token_ciphertext: z.string().min(1),
  access_expires_at: z.string(),
});
export type Connection = z.infer<typeof connectionSchema>;

function dbUrl(
  table: "email_connections" | "email_summaries",
  query?: Record<string, string>,
) {
  const url = new URL(`/rest/v1/${table}`, config().supabaseUrl);
  for (const [key, value] of Object.entries(query ?? {}))
    url.searchParams.set(key, value);
  return url;
}

async function dbRequest(
  table: "email_connections" | "email_summaries",
  method: "GET" | "POST" | "PATCH" | "DELETE",
  query?: Record<string, string>,
  body?: unknown,
): Promise<unknown> {
  const { serviceKey } = config();
  const headers = new Headers({
    apikey: serviceKey,
    "Content-Type": "application/json",
    Prefer:
      method === "POST"
        ? "resolution=merge-duplicates,return=representation"
        : "return=representation",
  });
  if (!serviceKey.startsWith("sb_secret_"))
    headers.set("Authorization", `Bearer ${serviceKey}`);
  let response: Response;
  try {
    response = await fetch(dbUrl(table, query), {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      cache: "no-store",
      signal: AbortSignal.timeout(15_000),
    });
  } catch {
    throw new RequestError("The Email Summary database is unavailable.", 502);
  }
  if (!response.ok)
    throw new RequestError(
      response.status === 404
        ? "Email Summary tables have not been created in Supabase."
        : "The Email Summary database request failed.",
      502,
    );
  return response.status === 204 ? [] : response.json();
}

function firstConnection(value: unknown): Connection | null {
  return z.array(connectionSchema).parse(value)[0] ?? null;
}

const connectionSelect =
  "id,email_address,access_token_ciphertext,refresh_token_ciphertext,access_expires_at";

export async function connectionById(id: string) {
  return firstConnection(
    await dbRequest("email_connections", "GET", {
      id: `eq.${id}`,
      select: connectionSelect,
      limit: "1",
    }),
  );
}

export async function saveConnection(args: {
  email: string;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}) {
  const now = new Date().toISOString();
  return firstConnection(
    await dbRequest(
      "email_connections",
      "POST",
      {
        on_conflict: "email_address",
      },
      {
        provider: "gmail",
        email_address: args.email,
        access_token_ciphertext: encryptToken(args.accessToken),
        refresh_token_ciphertext: encryptToken(args.refreshToken),
        access_expires_at: new Date(
          Date.now() + args.expiresIn * 1000,
        ).toISOString(),
        updated_at: now,
      },
    ),
  );
}

export async function updateTokens(
  connection: Connection,
  args: {
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
  },
) {
  await dbRequest(
    "email_connections",
    "PATCH",
    { id: `eq.${connection.id}` },
    {
      access_token_ciphertext: encryptToken(args.accessToken),
      refresh_token_ciphertext: args.refreshToken
        ? encryptToken(args.refreshToken)
        : connection.refresh_token_ciphertext,
      access_expires_at: new Date(
        Date.now() + args.expiresIn * 1000,
      ).toISOString(),
      updated_at: new Date().toISOString(),
    },
  );
}

export async function deleteConnection(id: string) {
  await dbRequest("email_connections", "DELETE", { id: `eq.${id}` });
}

export async function latestSummary(
  connectionId: string,
  date?: string,
): Promise<EmailSummary | null> {
  const rows = z.array(z.object({ summary_json: z.unknown() })).parse(
    await dbRequest("email_summaries", "GET", {
      connection_id: `eq.${connectionId}`,
      ...(date ? { summary_date: `eq.${date}` } : {}),
      select: "summary_json",
      order: "generated_at.desc",
      limit: "1",
    }),
  );
  return (rows[0]?.summary_json as EmailSummary | undefined) ?? null;
}

export async function saveSummary(
  connectionId: string,
  date: string,
  messages: SourceMessage[],
  summary: EmailSummary,
) {
  await dbRequest(
    "email_summaries",
    "POST",
    {
      on_conflict: "connection_id",
    },
    {
      connection_id: connectionId,
      summary_date: date,
      generated_at: summary.generatedAt,
      source_messages: messages,
      summary_json: summary,
    },
  );
}

export async function listConnections() {
  const connections: Connection[] = [];
  for (let offset = 0; ; offset += 500) {
    const page = z.array(connectionSchema).parse(
      await dbRequest("email_connections", "GET", {
        select: connectionSelect,
        order: "id.asc",
        limit: "500",
        offset: String(offset),
      }),
    );
    connections.push(...page);
    if (page.length < 500) return connections;
  }
}

function encryptToken(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", tokenKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return `v1:${iv.toString("base64url")}:${cipher.getAuthTag().toString("base64url")}:${encrypted.toString("base64url")}`;
}

export function decryptToken(value: string) {
  const [version, iv, tag, encrypted] = value.split(":");
  if (version !== "v1" || !iv || !tag || !encrypted)
    throw new RequestError(
      "Reconnect Gmail to renew the saved authorization.",
      409,
    );
  try {
    const decipher = createDecipheriv(
      "aes-256-gcm",
      tokenKey(),
      Buffer.from(iv, "base64url"),
    );
    decipher.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([
      decipher.update(Buffer.from(encrypted, "base64url")),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    throw new RequestError(
      "Reconnect Gmail to renew the saved authorization.",
      409,
    );
  }
}
