// /api/context — the profile's active shift scenario for the Context Feed.
// GET reads it, PUT validates and activates an uploaded scenario, DELETE clears it.
import { z } from "zod";
import {
  assertOrigin,
  errorResponse,
  json,
  rateLimit,
  requireProfile,
} from "@/lib/server/http";
import { RequestError } from "@/lib/server/errors";
import { readActiveScenario, setActiveScenario } from "@/lib/context/store";
import { parseScenarioJSON } from "@/lib/context/normalize";
import { MAX_CONTEXT_BYTES } from "@/lib/context/schema";
import { phoneConfigured } from "@/lib/server/phone/outbound";
export const runtime = "nodejs";

export async function GET() {
  try {
    return json({
      activeScenario: await readActiveScenario(await requireProfile()),
      phoneConfigured: phoneConfigured(),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function PUT(request: Request) {
  try {
    assertOrigin(request);
    const id = await requireProfile();
    await rateLimit("context:" + id, 20);
    const text = await readLimited(request, MAX_CONTEXT_BYTES);
    let scenario;
    try {
      scenario = parseScenarioJSON(text);
    } catch (error) {
      // Authors fix their JSON from these, so return every issue with its path.
      if (error instanceof z.ZodError)
        return json(
          {
            error: "Scenario validation failed.",
            issues: error.issues.map((i) => ({
              path: i.path.join("."),
              message: i.message,
            })),
          },
          { status: 400 },
        );
      throw new RequestError(
        error instanceof Error ? error.message : "Invalid scenario.",
      );
    }
    return json({ activeScenario: await setActiveScenario(id, scenario) });
  } catch (error) {
    return errorResponse(error);
  }
}

export async function DELETE(request: Request) {
  try {
    assertOrigin(request);
    return json({
      activeScenario: await setActiveScenario(await requireProfile(), null),
    });
  } catch (error) {
    return errorResponse(error);
  }
}

// Content-Length can be absent or wrong, so the limit is enforced on the bytes
// actually streamed, and the upload is cancelled as soon as it is crossed.
async function readLimited(request: Request, limit: number) {
  const tooLarge = () =>
    new RequestError(`Scenario exceeds the ${limit / 1024} KB limit.`, 413);
  if (Number(request.headers.get("content-length")) > limit) throw tooLarge();
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError("JSON is required.");
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      await reader.cancel();
      throw tooLarge();
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString("utf8");
}
