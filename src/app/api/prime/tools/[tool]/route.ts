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
import { isPrimeTool, primeToolSchemas } from "@/lib/prime/tools";
export const runtime = "nodejs";
export async function POST(
  request: Request,
  context: { params: Promise<{ tool: string }> },
) {
  try {
    assertOrigin(request);
    const id = await profileSession();
    if (!id) throw new RequestError("Refresh the workspace first.", 401);
    await rateLimit("prime-tool:" + id, 90);
    const { tool } = await context.params;
    if (!isPrimeTool(tool)) throw new RequestError("Unknown Prime tool.", 404);
    const args = primeToolSchemas[tool].parse(await readBody(request));
    const result =
      tool === "get_prime_session"
        ? await actPrime(id, { action: "start" })
        : tool === "get_prime_feedback"
          ? await readPrime(id)
          : await actPrime(id, {
              ...args,
              action:
                tool === "submit_prime_answer"
                  ? "answer"
                  : tool === "advance_prime"
                    ? "next"
                    : "complete",
            });
    if ("sessionId" in args && args.sessionId !== result.session?.id)
      throw new RequestError("Prime session does not match.", 409);
    return Response.json(
      {
        ...result,
        instruction:
          "Ask only the current question. Wait for submit_prime_answer before correctness or explanation. After feedback and learner confirmation call advance_prime. After three graded questions call complete_prime. No clinical advice.",
      },
      { headers: { "Cache-Control": "no-store, private" } },
    );
  } catch (e) {
    if (e instanceof z.ZodError)
      return Response.json(
        { error: "Invalid Prime tool parameters." },
        { status: 400 },
      );
    return safeError(e);
  }
}
