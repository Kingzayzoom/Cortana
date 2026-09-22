// POST /api/phone/tools/:tool — webhook tools for the phone agents.
//
// Called by ElevenLabs during a call, not by a browser: there is no cookie and
// no Origin. A shared secret proves the request came from our agent, then the
// `session` field decides what it may touch:
//   - a signed phone session → that profile's run (round, Prime, context, front desk)
//   - the guest constant     → inbound callers: briefing, topics, front desk only
import { z } from "zod";
import { isContextTool, queryContext } from "@/lib/context/tools";
import { readActiveScenario } from "@/lib/context/store";
import { isPrimeTool } from "@/lib/prime/tools";
import { runPrimeTool } from "@/lib/prime/server";
import { errorResponse, json, rateLimit, readBody } from "@/lib/server/http";
import { RequestError } from "@/lib/server/errors";
import {
  assertToolSecret,
  GUEST_SESSION,
  readPhoneSession,
} from "@/lib/server/phone/session";
import { guestTools, phoneTools } from "@/lib/server/phone/tools";
export const runtime = "nodejs";

// The union of every tool's parameters. Each tool validates its own subset
// again; this only bounds sizes and rejects unknown fields.
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

// Messages leave the building, so they get a far tighter limit than lookups.
const FRONT_DESK_LIMIT = [3, 600_000] as const;

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
    const { session, conversationId, ...args } = parsed.data;

    if (session === GUEST_SESSION) {
      await rateLimit("phone-guest", 120);
      return json(await guest(tool, args, conversationId));
    }

    const { profileId, runId } = await readPhoneSession(session);
    await rateLimit(`phone-tool:${profileId}`, 60);
    if (isPrimeTool(tool)) {
      // Confirms the run is still the one this call was placed for.
      await readActiveScenario(profileId, runId);
      return json(await runPrimeTool(profileId, tool, args));
    }
    if (isContextTool(tool))
      return json(
        queryContext(await readActiveScenario(profileId, runId), tool, args),
      );
    return json(await round(tool, profileId, runId, args));
  } catch (error) {
    if (error instanceof z.ZodError)
      return errorResponse(new RequestError("Invalid tool parameters."));
    return errorResponse(error);
  }
}

async function guest(
  tool: string,
  args: Record<string, unknown>,
  conversationId: string | undefined,
) {
  switch (tool) {
    case "get_shift_briefing":
      // No conversation id: rotate by the hour instead, steady within a call.
      return guestTools.get_shift_briefing(
        conversationId || `guest-${new Date().getUTCHours()}`,
      );
    case "get_topics":
      return guestTools.get_topics();
    case "email_front_desk":
      // Inbound callers have no profile to key this against, so every guest
      // call shares one deliberately tight allowance.
      await rateLimit("front-desk:guest", ...FRONT_DESK_LIMIT);
      return phoneTools.email_front_desk(args);
    default:
      throw new RequestError(
        "That isn't available on an inbound call. Offer to call them back from the app, where their progress is saved.",
        409,
      );
  }
}

async function round(
  tool: string,
  profileId: string,
  runId: string,
  args: { answer?: string },
) {
  switch (tool) {
    case "get_shift_briefing":
      return phoneTools.get_shift_briefing(runId);
    case "get_topics":
      return phoneTools.get_topics();
    case "email_front_desk":
      await rateLimit(`front-desk:${profileId}`, ...FRONT_DESK_LIMIT);
      return phoneTools.email_front_desk(args);
    case "get_round_context":
      return phoneTools.get_round_context(profileId, runId);
    case "submit_answer":
      if (!args.answer)
        throw new RequestError(
          "Include the learner's spoken answer as the answer field.",
        );
      return phoneTools.submit_answer(profileId, runId, args.answer);
    case "complete_round":
      return phoneTools.complete_round(profileId, runId);
    default:
      throw new RequestError("Unknown tool.", 404);
  }
}
