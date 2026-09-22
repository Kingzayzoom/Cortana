// POST /api/elevenlabs/token — mints a single-use WebRTC token for the browser
// voice round. Gated by the demo access code and an active run, so the voice
// minutes this costs can't be spent by anyone who merely finds the page.
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
import { safeEqual } from "@/lib/server/session";
import { withProgress } from "@/lib/server/store";
import {
  createConversationToken,
  voiceConfigured,
} from "@/lib/server/elevenlabs";
import { setting } from "@/lib/server/env";
export const runtime = "nodejs";
export async function POST(request: Request) {
  try {
    assertOrigin(request);
    const id = await requireProfile(
      "Refresh the workspace before starting voice.",
    );
    await rateLimit("voice:global", 40, 3_600_000);
    await rateLimit(`voice:${id}`, 6);
    if (!voiceConfigured())
      throw new RequestError(
        "Voice connection not configured. Explore the local preview below.",
        503,
      );
    const parsed = z
      .object({
        accessCode: z.string().max(200),
        runId: z.string().uuid(),
        consent: z.literal(true),
        mode: z.enum(["round", "prime"]).default("round"),
      })
      .strict()
      .safeParse(await readBody(request));
    if (!parsed.success)
      throw new RequestError(
        "Confirm voice consent and enter your demo access code.",
      );
    if (!safeEqual(parsed.data.accessCode, setting("DEMO_ACCESS_CODE")!))
      throw new RequestError("That demo access code is incorrect.", 403);
    await withProgress(id, (data) => {
      if (parsed.data.mode === "prime") {
        if (
          !data.prime?.sessions.some(
            (s) => s.id === parsed.data.runId && s.startedAt && !s.completedAt,
          )
        )
          throw new RequestError("Start a current Prime first.", 409);
        return;
      }
      if (data.run?.id !== parsed.data.runId || data.run.completed)
        throw new RequestError("Start or resume a current round first.", 409);
    });
    return json(await createConversationToken());
  } catch (error) {
    return errorResponse(error);
  }
}
