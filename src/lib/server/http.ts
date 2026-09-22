// Request guards and response helpers shared by every API route.
//
// A route handler here is: check the caller (origin, profile, rate limit),
// validate the body, call into src/lib, and return JSON. Anything that decides
// an outcome belongs in src/lib, not in the route.
import { z } from "zod";
import { RequestError } from "./errors";
import { database, redis, redisKey } from "./redis";
import { profileSession } from "./session";
import { setting } from "./env";

// Every response carries per-profile state, so none of it may be cached by a
// browser or shared by a CDN.
const PRIVATE = { "Cache-Control": "no-store, private" };

export function json(body: unknown, init: ResponseInit = {}) {
  return Response.json(body, {
    ...init,
    headers: { ...PRIVATE, ...init.headers },
  });
}

/**
 * Maps a thrown error to a response. RequestError messages were written for the
 * user and are shown as is; anything else is logged and replaced with a generic
 * message so internals never reach the client.
 */
export function errorResponse(error: unknown) {
  if (error instanceof RequestError) {
    if (error.status >= 500) console.error("[samantha]", error.message);
    return json({ error: error.message }, { status: error.status });
  }
  if (error instanceof z.ZodError)
    return json({ error: "The request was not understood." }, { status: 400 });
  console.error("[samantha] unexpected server error", error);
  return json(
    { error: "The request could not be completed. Please try again." },
    { status: 500 },
  );
}

/** The caller's profile id, or a 401 telling them to reload. */
export async function requireProfile(message = "Refresh the workspace first.") {
  const id = await profileSession();
  if (!id) throw new RequestError(message, 401);
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

// CSRF defence for cookie-authenticated mutations. SameSite=Lax still lets a
// top-level cross-site navigation through, so state changes also require an
// Origin header that names this app.
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

// Bodies are small JSON commands. Anything larger is a mistake or an attack.
const MAX_BODY_CHARS = 12_000;

export async function readBody(request: Request) {
  const text = await request.text();
  if (text.length > MAX_BODY_CHARS)
    throw new RequestError("The request is too large.", 413);
  try {
    return JSON.parse(text);
  } catch {
    throw new RequestError("Invalid request format.");
  }
}
