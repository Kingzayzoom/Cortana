import { z } from "zod";
import {
  assertOrigin,
  profileSession,
  readBody,
  rateLimit,
  RequestError,
  safeError,
} from "@/lib/server/session";
import { readActiveScenario } from "@/lib/context/store";
import { queryContext, isContextTool } from "@/lib/context/tools";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ tool: string }> },
) {
  try {
    assertOrigin(request);
    const id = await profileSession();
    if (!id) throw new RequestError("No active profile.", 401);
    await rateLimit("context-tool:" + id, 90);
    const { tool } = await context.params;
    if (!isContextTool(tool))
      throw new RequestError("Unknown context tool.", 404);
    return Response.json(
      queryContext(await readActiveScenario(id), tool, await readBody(request)),
      { headers: { "Cache-Control": "no-store, private" } },
    );
  } catch (error) {
    return safeError(
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
