// GET /api/bootstrap — the page's first request. Issues an anonymous profile
// cookie if there is none and returns the profile snapshot.
import { errorResponse, json } from "@/lib/server/http";
import { profileSession } from "@/lib/server/session";
import { snapshot, withProgress } from "@/lib/server/store";
export const runtime = "nodejs";

export async function GET() {
  try {
    const id = (await profileSession(true))!;
    return json(await withProgress(id, snapshot));
  } catch (error) {
    return errorResponse(error);
  }
}
