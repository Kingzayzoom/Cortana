import { randomUUID } from "node:crypto";
import {
  assertOrigin,
  profileSession,
  rateLimit,
  readBody,
  RequestError,
  safeEqual,
  safeError,
} from "@/lib/server/session";
import { withProgress } from "@/lib/server/store";
import {
  createPhoneSession,
  maskNumber,
  phoneCallRequest,
  phoneConfigured,
  startOutboundCall,
} from "@/lib/server/phone";
import { localDate, streak } from "@/lib/learning/rules";
import { ROUND_ID } from "@/lib/content/round";
import { readActiveScenario } from "@/lib/context/store";
import { buildPhoneBriefingContext } from "@/lib/context/selectors";
import { clinician } from "@/lib/content/briefing";
import { actPrime } from "@/lib/prime/server";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const id = await profileSession();
    if (!id)
      throw new RequestError(
        "Refresh the workspace before requesting a call.",
        401,
      );
    // Calls cost money and ring a real phone: keep both limits tight.
    await rateLimit("phone:global", 12, 3_600_000);
    await rateLimit(`phone:${id}`, 3, 600_000);
    if (!phoneConfigured())
      throw new RequestError(
        "Phone rounds are not configured on this server.",
        503,
      );
    const parsed = phoneCallRequest.safeParse(await readBody(request));
    if (!parsed.success)
      throw new RequestError(
        parsed.error.issues[0]?.message ??
          "Check the phone number, the demo code and both confirmations.",
      );
    const { accessCode, phoneNumber, mode } = parsed.data;
    if (!safeEqual(accessCode, process.env.CORTANA_DEMO_ACCESS_CODE!))
      throw new RequestError("That demo access code is incorrect.", 403);
    const briefing =
      mode === "context"
        ? buildPhoneBriefingContext(await readActiveScenario(id))
        : null;
    if (mode === "prime") await actPrime(id, { action: "start" });
    if (mode === "context" && !briefing)
      throw new RequestError(
        "Activate a synthetic scenario before requesting a briefing.",
        409,
      );
    // A phone round is a fresh run against the caller's own saved progress.
    const run = await withProgress(id, (data) => {
      data.run = {
        id: randomUUID(),
        stage: "briefing",
        section: 0,
        grade: null,
        completed: false,
      };
      return {
        id: data.run.id,
        name: data.preferences.name,
        completions: data.completions.length,
        streakDays: streak(
          data.practiceDays,
          localDate(new Date(), data.preferences.timezone),
        ),
      };
    });
    const { conversationId } = await startOutboundCall(phoneNumber, {
      phone_session: await createPhoneSession(id, run.id),
      context_mode: mode,
      context_briefing: briefing ? JSON.stringify(briefing) : "",
      // The demo briefing names the clinician it belongs to, and carries the
      // spelling the voice should speak rather than the one shown on screen.
      learner_name: briefing?.clinicianName ?? clinician.spokenName,
      round_id: ROUND_ID,
      streak_days: String(run.streakDays),
      returning_learner: run.completions > 0 ? "yes" : "no",
    });
    // The phone number itself is never stored; only the conversation reference.
    if (conversationId)
      await withProgress(id, (data) => {
        if (data.run?.id === run.id)
          data.run.phone = { conversationId, at: new Date().toISOString() };
      });
    return Response.json(
      { conversationId, calling: maskNumber(phoneNumber) },
      { headers: { "Cache-Control": "no-store, private" } },
    );
  } catch (error) {
    const response = safeError(error);
    response.headers.set("Cache-Control", "no-store, private");
    return response;
  }
}
