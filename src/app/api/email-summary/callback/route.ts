// GET /api/email-summary/callback — for a Google client that registers this
// path. The default flow returns through /api/auth/google/callback instead,
// which hands Gmail requests to the same gmailCallback.
import { gmailCallback } from "@/lib/server/email-summary/auth";

export const runtime = "nodejs";

export const GET = gmailCallback;
