import { z } from "zod";
import {
  assertOrigin,
  profileSession,
  rateLimit,
  readBody,
  RequestError,
  safeError,
} from "@/lib/server/session";
import { actPrime, readPrime } from "@/lib/prime/server";
export const runtime = "nodejs";
async function profile() {
  const id = await profileSession();
  if (!id) throw new RequestError("Refresh the workspace first.", 401);
  return id;
}
const headers = { "Cache-Control": "no-store, private" };
export async function GET() {
  try {
    return Response.json(await readPrime(await profile()), { headers });
  } catch (e) {
    return safeError(e);
  }
}
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const id = await profile();
    await rateLimit("prime:" + id, 90);
    return Response.json(await actPrime(id, await readBody(request)), {
      headers,
    });
  } catch (e) {
    if (e instanceof z.ZodError)
      return Response.json(
        { error: "Invalid Prime request." },
        { status: 400, headers },
      );
    return safeError(e);
  }
}
