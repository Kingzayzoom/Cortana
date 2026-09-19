import { Redis } from "@upstash/redis";
import { RequestError } from "./errors";

// Shared storage for serverless hosting (Vercel). Each Vercel function instance
// has its own memory and a read-only file system, so progress, locks and rate
// limits live in Upstash Redis whenever it is configured. Vercel's Upstash
// integration injects KV_REST_API_*; a direct Upstash database uses UPSTASH_*.
let cached: { config: string; client: Redis } | undefined;

export function redis(): Redis | null {
  const url = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
  const token =
    process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
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
  [process.env.CORTANA_REDIS_PREFIX || "cortana", ...parts].join(":");

export const onVercel = () => Boolean(process.env.VERCEL);

// Turns network and provider failures into a retryable, non-revealing error.
export async function database<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    console.error("[cortana] Redis request failed", error);
    throw new RequestError(
      "Progress storage is unavailable. Please retry in a moment.",
      503,
    );
  }
}
