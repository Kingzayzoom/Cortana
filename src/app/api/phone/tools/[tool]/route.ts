import { z } from "zod";
import { isContextTool, queryContext } from "@/lib/context/tools";
import { readActiveScenario } from "@/lib/context/store";
import { isPrimeTool } from "@/lib/prime/tools";
import { runPrimeTool } from "@/lib/prime/server";
import {
  rateLimit,
  readBody,
  RequestError,
  safeError,
} from "@/lib/server/session";
import {
  assertToolSecret,
  GUEST_SESSION,
  guestTools,
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
    caseId: z.string().min(1).max(80).optional(),
    section: z.string().min(1).max(30).optional(),
    sessionId: z.string().uuid().optional(),
    questionId: z.string().min(1).max(80).optional(),
    // Front desk message. The recipient is never one of these fields.
    reason: z.string().max(40).optional(),
    message: z.string().max(400).optional(),
    etaMinutes: z.number().optional(),
    confirmed: z.boolean().optional(),
    // Supplied by the platform so a guest briefing stays the same all call.
    conversationId: z.string().max(120).optional(),
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
    if (parsed.data.session === GUEST_SESSION) {
      await rateLimit("phone-guest", 120);
      const seed =
        parsed.data.conversationId || `guest-${new Date().getUTCHours()}`;
      if (tool === "get_shift_briefing")
        return Response.json(guestTools.get_shift_briefing(seed), {
          headers: { "Cache-Control": "no-store, private" },
        });
      if (tool === "get_topics")
        return Response.json(guestTools.get_topics(), {
          headers: { "Cache-Control": "no-store, private" },
        });
      if (tool === "email_front_desk") {
        // Inbound callers have no learner profile to key this against, so the
        // demo shares one deliberately tight allowance across all guest calls.
        await rateLimit("front-desk:guest", 3, 600_000);
        const {
          session: _session,
          conversationId: _conversationId,
          ...emailRequest
        } = parsed.data;
        void _session;
        void _conversationId;
        return Response.json(await phoneTools.email_front_desk(emailRequest), {
          headers: { "Cache-Control": "no-store, private" },
        });
      }
      throw new RequestError(
        "That isn't available on an inbound call. Offer to call them back from the app, where their progress is saved.",
        409,
      );
    }
    const { profileId, runId } = await readPhoneSession(parsed.data.session);
    await rateLimit(`phone-tool:${profileId}`, 60);
    if (isPrimeTool(tool)) {
      await readActiveScenario(profileId, runId);
      const { session: _session, ...args } = parsed.data;
      void _session;
      try {
        return Response.json(await runPrimeTool(profileId, tool, args), {
          headers: { "Cache-Control": "no-store, private" },
        });
      } catch (e) {
        if (e instanceof z.ZodError)
          throw new RequestError("Invalid Prime tool parameters.");
        throw e;
      }
    }
    if (isContextTool(tool)) {
      const { session: _session, ...args } = parsed.data;
      void _session;
      try {
        return Response.json(
          queryContext(await readActiveScenario(profileId, runId), tool, args),
          { headers: { "Cache-Control": "no-store, private" } },
        );
      } catch (error) {
        if (error instanceof z.ZodError)
          throw new RequestError("Invalid context tool parameters.");
        throw error;
      }
    }
    if (tool === "email_front_desk")
      // Messages leave the building: far tighter than the other tools.
      await rateLimit(`front-desk:${profileId}`, 3, 600_000);
    const result = await run(tool, profileId, runId, parsed.data);
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
  body: { answer?: string; [key: string]: unknown },
) {
  const answer = body.answer;
  switch (tool) {
    case "get_shift_briefing":
      return phoneTools.get_shift_briefing(runId);
    case "email_front_desk": {
      const { session: _session, ...request } = body;
      void _session;
      return phoneTools.email_front_desk(request);
    }
    case "get_topics":
      return phoneTools.get_topics();
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
