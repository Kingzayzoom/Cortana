import { z } from "zod";
import {
  assertOrigin,
  profileSession,
  rateLimit,
  RequestError,
  safeError,
} from "@/lib/server/session";
import { readActiveScenario, setActiveScenario } from "@/lib/context/store";
import { parseScenarioJSON } from "@/lib/context/normalize";
import { MAX_CONTEXT_BYTES } from "@/lib/context/schema";
import { phoneConfigured } from "@/lib/server/phone";
export const runtime = "nodejs";
const headers = { "Cache-Control": "no-store, private" };
async function profile() {
  const id = await profileSession();
  if (!id) throw new RequestError("Refresh the workspace first.", 401);
  return id;
}
export async function GET() {
  try {
    return Response.json(
      {
        activeScenario: await readActiveScenario(await profile()),
        phoneConfigured: phoneConfigured(),
      },
      { headers },
    );
  } catch (error) {
    return safeError(error);
  }
}
export async function PUT(request: Request) {
  try {
    assertOrigin(request);
    const id = await profile();
    await rateLimit("context:" + id, 20);
    // Bound actual streamed bytes as well as Content-Length.
    if (Number(request.headers.get("content-length")) > MAX_CONTEXT_BYTES)
      throw new RequestError("Scenario exceeds the 64 KB limit.", 413);
    const reader = request.body?.getReader();
    if (!reader) throw new RequestError("JSON is required.");
    const chunks: Uint8Array[] = [];
    let total = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_CONTEXT_BYTES) {
        await reader.cancel();
        throw new RequestError("Scenario exceeds the 64 KB limit.", 413);
      }
      chunks.push(value);
    }
    const text = Buffer.concat(chunks).toString("utf8");
    let scenario;
    try {
      scenario = parseScenarioJSON(text);
    } catch (error) {
      if (error instanceof z.ZodError)
        return Response.json(
          {
            error: "Scenario validation failed.",
            issues: error.issues.map((i) => ({
              path: i.path.join("."),
              message: i.message,
            })),
          },
          { status: 400, headers },
        );
      throw new RequestError(
        error instanceof Error ? error.message : "Invalid scenario.",
      );
    }
    return Response.json(
      { activeScenario: await setActiveScenario(id, scenario) },
      { headers },
    );
  } catch (error) {
    return safeError(error);
  }
}
export async function DELETE(request: Request) {
  try {
    assertOrigin(request);
    return Response.json(
      { activeScenario: await setActiveScenario(await profile(), null) },
      { headers },
    );
  } catch (error) {
    return safeError(error);
  }
}
