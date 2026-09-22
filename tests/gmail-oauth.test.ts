import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const jar = vi.hoisted(() => ({
  store: new Map<string, { value: string; path?: string }>(),
}));
vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({
    get: (name: string) => jar.store.get(name),
    set: (name: string, value: string, options?: { path?: string }) =>
      jar.store.set(name, { value, path: options?.path }),
    delete: ({ name }: { name: string }) => jar.store.delete(name),
  })),
}));

import { beginGmailOAuth } from "../src/lib/server/email-summary/auth";
import { GET as googleCallback } from "../src/app/api/auth/google/callback/route";

const ORIGIN = "http://localhost:3100";
const request = (path: string) =>
  new Request(ORIGIN + path, { headers: { host: "localhost:3100" } });
const redirectedTo = (response: Response) =>
  new URL(response.headers.get("location")!);

beforeEach(() => {
  jar.store.clear();
  vi.stubEnv("SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-role-key");
  vi.stubEnv("GOOGLE_CLIENT_ID", "123.apps.googleusercontent.com");
  vi.stubEnv("GOOGLE_CLIENT_SECRET", "client-secret");
  vi.stubEnv("SAMANTHA_SESSION_SECRET", "s".repeat(48));
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe("Gmail OAuth", () => {
  it("uses the sign-in callback Google already has registered", async () => {
    const url = new URL(
      await beginGmailOAuth(request("/api/email-summary/connect")),
    );
    expect(url.searchParams.get("redirect_uri")).toBe(
      `${ORIGIN}/api/auth/google/callback`,
    );
    expect(url.searchParams.get("scope")).toBe(
      "https://www.googleapis.com/auth/gmail.readonly",
    );
    expect(url.searchParams.get("state")).toMatch(/^gmail\./);
    // The in-flight cookie has to reach /api/auth/google/callback.
    expect(jar.store.get("samantha_gmail_oauth")?.path).toBe("/api");
  });

  it("hands a Gmail return to the email briefing, not to sign-in", async () => {
    const url = new URL(
      await beginGmailOAuth(request("/api/email-summary/connect")),
    );
    const state = url.searchParams.get("state")!;
    vi.mocked(fetch).mockResolvedValueOnce(new Response("{}", { status: 400 }));

    const response = await googleCallback(
      request(`/api/auth/google/callback?code=abc&state=${state}`),
    );
    const back = redirectedTo(response);
    expect(back.pathname).toBe("/email-summary");
    // The token exchange reached Google with the same redirect URI.
    const exchange = vi.mocked(fetch).mock.calls[0];
    expect(String(exchange[0])).toBe("https://oauth2.googleapis.com/token");
    expect(
      new URLSearchParams(String(exchange[1]!.body)).get("redirect_uri"),
    ).toBe(`${ORIGIN}/api/auth/google/callback`);
    expect(back.searchParams.get("email_error")).toBe("google_rejected");
  });

  it("reports a declined consent screen on the email page", async () => {
    const response = await googleCallback(
      request("/api/auth/google/callback?error=access_denied&state=gmail.x"),
    );
    expect(redirectedTo(response).pathname).toBe("/email-summary");
    expect(redirectedTo(response).searchParams.get("email_error")).toBe(
      "denied",
    );
  });

  it("refuses a Gmail return without its cookie", async () => {
    const response = await googleCallback(
      request("/api/auth/google/callback?code=abc&state=gmail.forged"),
    );
    expect(redirectedTo(response).searchParams.get("email_error")).toBe(
      "expired",
    );
    expect(fetch).not.toHaveBeenCalled();
  });
});
