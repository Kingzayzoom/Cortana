import {
  createHmac,
  randomBytes,
  randomUUID,
  timingSafeEqual,
} from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { cookies } from "next/headers";
import { RequestError } from "./errors";
import { database, onVercel, redis, redisKey } from "./redis";
import { setting } from "./env";
export { RequestError };
// Local state from before the rename lives here, including the IDs of live
// ElevenLabs agents, so the folder keeps its name rather than being orphaned.
export const dataDirectory = () =>
  setting("DATA_DIR") || path.join(process.cwd(), ".cortana");
let secretPromise: Promise<string> | undefined;
async function secret() {
  const configured = setting("SESSION_SECRET");
  if (configured) return configured;
  // Serverless instances can't share a generated key file.
  if (onVercel())
    throw new RequestError(
      "SAMANTHA_SESSION_SECRET is not set on this deployment.",
      503,
    );
  secretPromise ??= (async () => {
    await mkdir(dataDirectory(), { recursive: true });
    const file = path.join(dataDirectory(), ".session-key");
    try {
      await writeFile(file, randomBytes(48).toString("hex"), {
        flag: "wx",
        mode: 0o600,
      });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
    }
    return readFile(file, "utf8");
  })();
  return secretPromise;
}
export function safeEqual(a: string, b: string) {
  const x = Buffer.from(a),
    y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}
async function sign(id: string) {
  return createHmac("sha256", await secret())
    .update(id)
    .digest("hex");
}
// Signs other server-issued values. Callers prefix their own purpose so tokens
// from one feature can never be replayed in another.
export async function hmac(value: string) {
  return createHmac("sha256", await secret())
    .update(value)
    .digest("hex");
}
/** An anonymous demo profile, or a signed-in Google account as `g-<subject>`. */
const PROFILE_ID = /^(?:[0-9a-f-]{36}|g-\d{1,64})$/;
export const isAccount = (id: string) => id.startsWith("g-");

const SESSION_COOKIE = "samantha_session";
// Issued before the rename. Still accepted until it expires, so nobody is
// signed out and no saved profile is orphaned by the new name.
const LEGACY_SESSION_COOKIE = "cortana_session";

const sessionCookie = {
  httpOnly: true,
  // Lax rather than strict: Google's callback arrives as a cross-site GET and
  // must already carry the session that the callback then upgrades.
  sameSite: "lax",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 24 * 90,
  path: "/",
} as const;

export async function setProfileSession(id: string) {
  if (!PROFILE_ID.test(id)) throw new RequestError("Invalid profile.", 400);
  (await cookies()).set(
    SESSION_COOKIE,
    `${id}.${await sign(id)}`,
    sessionCookie,
  );
  return id;
}

export async function clearProfileSession() {
  const jar = await cookies();
  jar.delete({ name: SESSION_COOKIE, path: "/" });
  jar.delete({ name: LEGACY_SESSION_COOKIE, path: "/" });
}

export async function profileSession(create = false): Promise<string | null> {
  const jar = await cookies();
  const value =
    jar.get(SESSION_COOKIE)?.value ?? jar.get(LEGACY_SESSION_COOKIE)?.value;
  if (value) {
    const [id, signature] = value.split(".");
    if (
      PROFILE_ID.test(id) &&
      signature &&
      safeEqual(await sign(id), signature)
    )
      return id;
  }
  if (!create) return null;
  const id = randomUUID();
  jar.set(SESSION_COOKIE, `${id}.${await sign(id)}`, sessionCookie);
  return id;
}
// Next can construct request.url with the 0.0.0.0 bind address. The browser's
// Host header retains the actual origin; use it, or explicit proxy origins
// (comma-separated). Hosts such as Vercel terminate HTTPS and forward the scheme.
function expectedOrigins(request: Request) {
  const protocol =
    request.headers.get("x-forwarded-proto")?.split(",")[0].trim() ||
    new URL(request.url).protocol.replace(":", "");
  const configured = setting("APP_ORIGIN");
  return configured
    ? // A browser's Origin header never has a trailing slash, but a pasted URL
      // usually does; tolerate it rather than rejecting every request.
      configured.split(",").map((o) => o.trim().replace(/\/+$/, ""))
    : [`${protocol}://${request.headers.get("host")}`];
}

/**
 * The canonical origin for links back into this app. The first configured
 * origin wins, so an OAuth redirect URI stays stable across preview hosts.
 */
export function appOrigin(request: Request) {
  return expectedOrigins(request)[0];
}

export function assertOrigin(request: Request) {
  const origin = request.headers.get("origin");
  const expected = expectedOrigins(request);
  if (!origin || !expected.includes(origin))
    throw new RequestError(
      "This request must come from the Samantha workspace.",
      403,
    );
}
const windows = new Map<string, { count: number; until: number }>();
// Fixed-window limit. With Redis the count is shared by every serverless
// instance; without it, it applies to this process only.
export async function rateLimit(
  key: string,
  max: number,
  duration = 60_000,
  message = "Too many requests. Please wait a minute and try again.",
) {
  const db = redis();
  if (db) {
    const bucket = redisKey("rate", key);
    // Creating the key with its expiry first means a counter can never outlive its window.
    const count = await database(async () => {
      await db.set(bucket, 0, { nx: true, px: duration });
      return db.incr(bucket);
    });
    if (count > max) throw new RequestError(message, 429);
    return;
  }
  const now = Date.now();
  for (const [id, bucket] of windows)
    if (bucket.until <= now) windows.delete(id);
  const existing = windows.get(key);
  if (!existing) windows.set(key, { count: 1, until: now + duration });
  else if (++existing.count > max) throw new RequestError(message, 429);
}
export async function readBody(request: Request) {
  const text = await request.text();
  if (text.length > 12_000)
    throw new RequestError("The request is too large.", 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new RequestError("Invalid request format.");
  }
}
export function safeError(error: unknown) {
  if (error instanceof RequestError) {
    if (error.status >= 500) console.error("[samantha]", error.message);
    return Response.json({ error: error.message }, { status: error.status });
  }
  // The response stays generic; the server log keeps the detail for debugging.
  console.error("[samantha] unexpected server error", error);
  return Response.json(
    { error: "The request could not be completed. Please try again." },
    { status: 500 },
  );
}
export function voiceConfigured() {
  return Boolean(
    process.env.ELEVENLABS_API_KEY &&
    process.env.ELEVENLABS_AGENT_ID &&
    (setting("DEMO_ACCESS_CODE")?.length ?? 0) >= 12 &&
    (setting("SESSION_SECRET")?.length ?? 0) >= 32,
  );
}
