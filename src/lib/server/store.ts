import { randomUUID, createHash } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDirectory, voiceConfigured } from "./session";
import { RequestError } from "./errors";
import { database, onVercel, redis, redisKey } from "./redis";
import type { Progress, Snapshot } from "../learning/types";
import { localDate, streak } from "../learning/rules";
export type StoredProgress = Progress & {
  requests: Record<string, { fingerprint: string; result: unknown }>;
};
export function emptyProgress(): StoredProgress {
  return {
    preferences: {
      name: "Dr. Patel",
      timezone: "America/New_York",
      reducedMotion: false,
      transcript: false,
    },
    attempts: [],
    completions: [],
    practiceDays: [],
    review: null,
    run: null,
    requests: {},
    learningSignals: [],
  };
}
type Operation<T> = (data: StoredProgress) => T | Promise<T>;
function migrateReplayFingerprints(progress: StoredProgress) {
  for (const saved of Object.values(progress.requests)) {
    if (!/^[a-f0-9]{64}$/.test(saved.fingerprint))
      saved.fingerprint = createHash("sha256")
        .update(saved.fingerprint)
        .digest("hex");
  }
}
// Matches the session cookie lifetime, so abandoned demo profiles expire.
const PROFILE_TTL_SECONDS = 60 * 60 * 24 * 90;
const LOCK_TTL_MS = 10_000;
const LOCK_WAIT_MS = 5_000;
const queues = new Map<string, Promise<unknown>>();
// Serializes each profile's read-modify-write. The in-process queue covers one
// server; the Redis lock covers several serverless instances at once.
export async function withProgress<T>(
  id: string,
  operation: Operation<T>,
): Promise<T> {
  const previous = queues.get(id) ?? Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(() => {
      if (redis()) return withRedisProgress(id, operation);
      if (onVercel())
        throw new RequestError(
          "Progress storage isn't configured on this deployment. Connect Upstash Redis to the Vercel project.",
          503,
        );
      return withFileProgress(id, operation);
    });
  queues.set(id, next);
  try {
    return await next;
  } finally {
    if (queues.get(id) === next) queues.delete(id);
  }
}
async function withFileProgress<T>(id: string, operation: Operation<T>) {
  const directory = dataDirectory();
  await mkdir(directory, { recursive: true });
  const file = path.join(directory, `${id}.json`);
  let stored: string | null = null;
  try {
    stored = await readFile(file, "utf8");
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
  }
  const progress: StoredProgress = stored
    ? JSON.parse(stored)
    : emptyProgress();
  migrateReplayFingerprints(progress);
  const result = await operation(progress);
  const updated = JSON.stringify(progress);
  if (updated !== stored) {
    const temporary = file + ".tmp";
    await writeFile(temporary, updated, { mode: 0o600 });
    await rename(temporary, file);
  }
  return result;
}
async function withRedisProgress<T>(id: string, operation: Operation<T>) {
  const db = redis()!;
  const lock = redisKey("lock", id),
    profile = redisKey("profile", id),
    token = randomUUID();
  const deadline = Date.now() + LOCK_WAIT_MS;
  while (
    (await database(() =>
      db.set(lock, token, { nx: true, px: LOCK_TTL_MS }),
    )) !== "OK"
  ) {
    if (Date.now() > deadline)
      throw new RequestError(
        "Your workspace is busy saving. Please retry in a moment.",
        503,
      );
    await new Promise((resolve) =>
      setTimeout(resolve, 25 + Math.random() * 50),
    );
  }
  try {
    const stored = await database(() => db.get<string>(profile));
    const progress: StoredProgress = stored
      ? JSON.parse(stored)
      : emptyProgress();
    migrateReplayFingerprints(progress);
    const result = await operation(progress);
    const updated = JSON.stringify(progress);
    if (updated !== stored)
      await database(() =>
        db.set(profile, updated, { ex: PROFILE_TTL_SECONDS }),
      );
    return result;
  } finally {
    // Release only our own lock; an expired one may belong to another request.
    try {
      if ((await db.get<string>(lock)) === token) await db.del(lock);
    } catch (error) {
      console.error("[cortana] could not release progress lock", error);
    }
  }
}
export function snapshot(progress: Progress): Snapshot {
  return {
    preferences: progress.preferences,
    attempts: progress.attempts,
    completions: progress.completions,
    practiceDays: progress.practiceDays,
    run: progress.run,
    review: progress.review,
    learningSignals: progress.learningSignals ?? [],
    xp: progress.completions.reduce((sum, c) => sum + c.xp, 0),
    streak: streak(
      progress.practiceDays,
      localDate(new Date(), progress.preferences.timezone),
    ),
    voiceConfigured: voiceConfigured(),
    storage: redis()
      ? "Saved in the demo database · linked to this browser"
      : "Saved on this demo server · linked to this browser",
  };
}
