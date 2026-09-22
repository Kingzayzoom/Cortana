// POST /api/context/tools/:tool — the browser voice agent's context tools.
// Read-only queries against the caller's active scenario; the phone agent
// reaches the same queryContext through /api/phone/tools.
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
import { readActiveScenario } from "@/lib/context/store";
import { queryContext, isContextTool } from "@/lib/context/tools";
export const runtime = "nodejs";

export async function POST(
  request: Request,
  context: { params: Promise<{ tool: string }> },
) {
  try {
    assertOrigin(request);
    const id = await requireProfile("No active profile.");
    await rateLimit("context-tool:" + id, 90);
    const { tool } = await context.params;
    if (!isContextTool(tool))
      throw new RequestError("Unknown context tool.", 404);
    return json(
      queryContext(await readActiveScenario(id), tool, await readBody(request)),
    );
  } catch (error) {
    // The model reads this, so say which parameter was wrong.
    return errorResponse(
      error instanceof z.ZodError
        ? new RequestError(
            "Invalid context tool parameters: " +
              error.issues
                .map((i) => i.path.join(".") + ": " + i.message)
                .join("; "),
          )
        : error,
    );
  }
}
