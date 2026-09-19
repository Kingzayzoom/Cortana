import { profileSession, safeError } from "@/lib/server/session";
import { snapshot, withProgress } from "@/lib/server/store";
export const runtime = "nodejs";
export async function GET() {
  try {
    const id = await profileSession(true);
    return Response.json(await withProgress(id!, snapshot), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return safeError(error);
  }
}
