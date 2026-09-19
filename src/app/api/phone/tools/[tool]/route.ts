import { z } from "zod";
import {
  rateLimit,
  readBody,
  RequestError,
  safeError,
} from "@/lib/server/session";
import {
  assertToolSecret,
  phoneTools,
  readPhoneSession,
} from "@/lib/server/phone";
export const runtime = "nodejs";
// Called by the ElevenLabs phone agent, not by a browser: there is no app
// session cookie and no origin, so a shared secret plus the signed call session
// decide what this request may do. The server still owns grading and rewards.
const toolRequest = z
  .object({
    session: z.string().min(10).max(600),
    answer: z.string().trim().min(1).max(600).optional(),
  })
  .strict();
export async function POST(
  request: Request,
  context: { params: Promise<{ tool: string }> },
) {
  try {
    assertToolSecret(request);
    const { tool } = await context.params;
    const parsed = toolRequest.safeParse(await readBody(request));
    if (!parsed.success)
      throw new RequestError("The tool request was not understood.");
    const { profileId, runId } = await readPhoneSession(parsed.data.session);
    await rateLimit(`phone-tool:${profileId}`, 60);
    const result = await run(tool, profileId, runId, parsed.data.answer);
    return Response.json(result, {
      headers: { "Cache-Control": "no-store, private" },
    });
  } catch (error) {
    const response = safeError(error);
    response.headers.set("Cache-Control", "no-store, private");
    return response;
  }
}
function run(
  tool: string,
  profileId: string,
  runId: string,
  answer: string | undefined,
) {
  switch (tool) {
    case "get_round_context":
      return phoneTools.get_round_context(profileId, runId);
    case "submit_answer":
      if (!answer)
        throw new RequestError(
          "Include the learner's spoken answer as the answer field.",
        );
      return phoneTools.submit_answer(profileId, runId, answer);
    case "complete_round":
      return phoneTools.complete_round(profileId, runId);
    default:
      throw new RequestError("Unknown tool.", 404);
  }
}
