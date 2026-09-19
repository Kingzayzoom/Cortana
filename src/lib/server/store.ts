import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";
import { dataDirectory, voiceConfigured } from "./session";
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
  };
}
const queues = new Map<string, Promise<unknown>>();
export async function withProgress<T>(
  id: string,
  operation: (data: StoredProgress) => T | Promise<T>,
): Promise<T> {
  const previous = queues.get(id) ?? Promise.resolve();
  const next = previous
    .catch(() => {})
    .then(async () => {
      const directory = dataDirectory();
      await mkdir(directory, { recursive: true });
      const file = path.join(directory, `${id}.json`);
      let progress: StoredProgress;
      try {
        progress = JSON.parse(await readFile(file, "utf8"));
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
        progress = emptyProgress();
      }
      const result = await operation(progress);
      const temporary = file + ".tmp";
      await writeFile(temporary, JSON.stringify(progress), { mode: 0o600 });
      await rename(temporary, file);
      return result;
    });
  queues.set(id, next);
  try {
    return await next;
  } finally {
    if (queues.get(id) === next) queues.delete(id);
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
    xp: progress.completions.reduce((sum, c) => sum + c.xp, 0),
    streak: streak(
      progress.practiceDays,
      localDate(new Date(), progress.preferences.timezone),
    ),
    voiceConfigured: voiceConfigured(),
    storage: "Saved on this demo server · linked to this browser",
  };
}
