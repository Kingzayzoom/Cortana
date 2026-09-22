// POST /api/learning — every change to the evidence round: begin, stage
// checkpoints, answers, completion, questions, preferences and reset. Called by
// the page and by the browser voice agent's client tools.
import { applyLearningAction } from "@/lib/learning/actions";
import { learningRequest } from "@/lib/validation/contracts";
import {
  assertOrigin,
  errorResponse,
  json,
  rateLimit,
  readBody,
  requireProfile,
} from "@/lib/server/http";
import { RequestError } from "@/lib/server/errors";
import { snapshot, withProgress } from "@/lib/server/store";
export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const id = await requireProfile(
      "Refresh the workspace to begin a demo session.",
    );
    await rateLimit(`learn:${id}`, 90);
    const parsed = learningRequest.safeParse(await readBody(request));
    if (!parsed.success)
      throw new RequestError(
        "Unknown content or invalid request. Please use the current round.",
      );
    return json(
      await withProgress(id, (data) => {
        // Apply first: the snapshot must describe the profile after the change.
        const result = applyLearningAction(data, parsed.data);
        return { ...snapshot(data), ...result };
      }),
    );
  } catch (error) {
    return errorResponse(error);
  }
}
