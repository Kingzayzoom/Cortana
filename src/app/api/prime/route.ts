// /api/prime — the daily three-question practice set. GET reads today's set;
// POST applies one action (start, answer, next, complete, evidence).
import { z } from "zod";
import {
  assertOrigin,
  errorResponse,
  json,
  rateLimit,
  readBody,
  requireProfile,
} from "@/lib/server/http";
import { RequestError } from "@/lib/server/errors";
import { actPrime, readPrime } from "@/lib/prime/server";
export const runtime = "nodejs";

export async function GET() {
  try {
    return json(await readPrime(await requireProfile()));
  } catch (error) {
    return errorResponse(error);
  }
}

export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const id = await requireProfile();
    await rateLimit("prime:" + id, 90);
    return json(await actPrime(id, await readBody(request)));
  } catch (error) {
    return errorResponse(
      error instanceof z.ZodError
        ? new RequestError("Invalid Prime request.")
        : error,
    );
  }
}
