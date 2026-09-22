// Who is making this request. A profile is identified by an HMAC-signed,
// HttpOnly cookie: either an anonymous demo profile or a Google account.
// The same signing key backs every other server-issued token (phone sessions,
// OAuth state), each prefixed with its own purpose.
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
import { onVercel } from "./redis";
import { setting } from "./env";

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
    `${id}.${await hmac(id)}`,
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
      safeEqual(await hmac(id), signature)
    )
      return id;
  }
  if (!create) return null;
  const id = randomUUID();
  jar.set(SESSION_COOKIE, `${id}.${await hmac(id)}`, sessionCookie);
  return id;
}
