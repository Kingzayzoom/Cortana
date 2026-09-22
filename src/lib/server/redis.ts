// Upstash Redis client for serverless hosting, where instances share no memory
// or disk. Finds credentials under any of the names Vercel's integration uses.
import { Redis } from "@upstash/redis";
import { RequestError } from "./errors";
import { setting } from "./env";

// Shared storage for serverless hosting (Vercel). Each Vercel function instance
// has its own memory and a read-only file system, so progress, locks and rate
// limits live in Upstash Redis whenever it is configured. Vercel's Upstash
// integration injects KV_REST_API_*; a direct Upstash database uses UPSTASH_*.
let cached: { config: string; client: Redis } | undefined;

function credentials() {
  const env = process.env;
  for (const [url, token] of [
    ["KV_REST_API_URL", "KV_REST_API_TOKEN"],
    ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_TOKEN"],
  ])
    if (env[url] && env[token]) return { url: env[url], token: env[token] };
  // Vercel can connect a store with a custom prefix, e.g. STORAGE_KV_REST_API_URL.
  for (const url of Object.keys(env)) {
    const match = /^(.+_)(REST_API_URL|REDIS_REST_URL)$/.exec(url);
    const token = match && match[1] + match[2].replace(/URL$/, "TOKEN");
    if (token && env[url] && env[token])
      return { url: env[url], token: env[token] };
  }
  return null;
}

export function redis(): Redis | null {
  const found = credentials();
  if (!found) return null;
  const { url, token } = found;
  const config = `${url}\n${token}`;
  if (cached?.config !== config)
    cached = {
      config,
      client: new Redis({
        url,
        token,
        // Values are JSON we parse ourselves; each command is sent on its own
        // so a failed write never hides inside a batch.
        automaticDeserialization: false,
        enableAutoPipelining: false,
      }),
    };
  return cached.client;
}

// Lets preview and production deployments share one database without mixing data.
export const redisKey = (...parts: string[]) =>
  [
    // The storage namespace predates the rename. Changing it would make every
    // saved profile unreachable, so it stays unless a deployment sets its own.
    setting("REDIS_PREFIX") || "cortana",
    ...parts,
  ].join(":");

export const onVercel = () => Boolean(process.env.VERCEL);

// Turns network and provider failures into a retryable, non-revealing error.
export async function database<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    console.error("[samantha] Redis request failed", error);
    throw new RequestError(
      "Progress storage is unavailable. Please retry in a moment.",
      503,
    );
  }
}
