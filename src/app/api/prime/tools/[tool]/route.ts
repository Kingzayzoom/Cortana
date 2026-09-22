// POST /api/prime/tools/:tool — the browser voice agent's Prime tools. The
// phone agent reaches the same runPrimeTool through /api/phone/tools.
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
import { runPrimeTool } from "@/lib/prime/server";
import { isPrimeTool } from "@/lib/prime/tools";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ tool: string }> },
) {
  try {
    assertOrigin(request);
    const id = await requireProfile();
    await rateLimit("prime-tool:" + id, 90);
    const { tool } = await context.params;
    if (!isPrimeTool(tool)) throw new RequestError("Unknown Prime tool.", 404);
    return json(await runPrimeTool(id, tool, await readBody(request)));
  } catch (error) {
    return errorResponse(
      error instanceof z.ZodError
        ? new RequestError("Invalid Prime tool parameters.")
        : error,
    );
  }
}
