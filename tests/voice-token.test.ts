import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createConversationToken } from "../src/lib/server/elevenlabs";
import { POST } from "../src/app/api/elevenlabs/token/route";
const state = vi.hoisted(() => ({
  session: "profile-1",
  run: "ba5f7f6a-6e89-4db2-9582-c349348e84c1",
}));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("../src/lib/server/session", async (original) => ({
  ...(await original<typeof import("../src/lib/server/session")>()),
  profileSession: vi.fn(() => state.session),
}));
vi.mock("../src/lib/server/http", async (original) => ({
  ...(await original<typeof import("../src/lib/server/http")>()),
  rateLimit: vi.fn(),
}));
vi.mock("../src/lib/server/store", () => ({
  withProgress: vi.fn((_id, operation) =>
    operation({ run: { id: state.run, completed: false } }),
  ),
}));
beforeEach(() => {
  vi.stubEnv("ELEVENLABS_API_KEY", "sk_test_secret_never_return");
  vi.stubEnv("ELEVENLABS_AGENT_ID", "agent_private_config");
  vi.stubEnv("SAMANTHA_DEMO_ACCESS_CODE", "private-demo-code");
  vi.stubEnv("SAMANTHA_SESSION_SECRET", "s".repeat(48));
  vi.stubGlobal("fetch", vi.fn());
  state.session = "profile-1";
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});
const request = (overrides = {}) =>
  new Request("http://localhost:3100/api/elevenlabs/token", {
    method: "POST",
    headers: {
      origin: "http://localhost:3100",
      host: "localhost:3100",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      accessCode: "private-demo-code",
      consent: true,
      runId: state.run,
      ...overrides,
    }),
  });
describe("WebRTC token boundary", () => {
  it("returns only the temporary token and conversation ID, without caching", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({
        token: "temporary-token",
        conversation_id: "conv_test",
        api_key: "sk_test_secret_never_return",
      }),
    );
    const response = await POST(request());
    expect(await response.json()).toEqual({
      token: "temporary-token",
      conversationId: "conv_test",
    });
    expect(response.headers.get("Cache-Control")).toBe("no-store, private");
    const [url, options] = vi.mocked(fetch).mock.calls[0];
    expect(String(url)).toBe(
      "https://api.elevenlabs.io/v1/convai/conversation/token?agent_id=agent_private_config",
    );
    expect(options).toMatchObject({
      method: "GET",
      cache: "no-store",
      headers: { "xi-api-key": "sk_test_secret_never_return" },
    });
  });
  it.each([
    [401, {}, 401, "denied access"],
    [403, {}, 403, "denied access"],
    [402, {}, 429, "billing limit"],
    [429, {}, 429, "billing limit"],
    [
      401,
      { detail: { status: "missing_permissions", message: "convai_write" } },
      403,
      "Write access",
    ],
    [400, { detail: { status: "api_key_id_used_as_api_key" } }, 401, "key ID"],
    [500, { secret: "sk_test_secret_never_return" }, 502, "could not create"],
  ])(
    "maps provider %s to a safe visible error",
    async (status, body, expected, message) => {
      vi.mocked(fetch).mockResolvedValue(Response.json(body, { status }));
      const response = await POST(request());
      const text = await response.text();
      expect(response.status).toBe(expected);
      expect(text).toContain(message);
      expect(text).not.toContain("sk_test_secret_never_return");
      expect(response.headers.get("Cache-Control")).toContain("no-store");
    },
  );
  it.each([
    { token: "" },
    { token: "valid" },
    { conversation_id: "conv_test" },
    null,
  ])("rejects malformed credential %j", async (body) => {
    vi.mocked(fetch).mockResolvedValue(Response.json(body));
    await expect(createConversationToken()).rejects.toMatchObject({
      status: 502,
    });
  });
  it("rejects consent, session, origin, and access-code failures before provider contact", async () => {
    expect((await POST(request({ consent: false }))).status).toBe(400);
    expect((await POST(request({ accessCode: "wrong" }))).status).toBe(403);
    const crossOrigin = request();
    crossOrigin.headers.set("origin", "https://other.example");
    expect((await POST(crossOrigin)).status).toBe(403);
    state.session = "";
    expect((await POST(request())).status).toBe(401);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("handles missing env and network timeout without disclosing transport data", async () => {
    vi.stubEnv("ELEVENLABS_API_KEY", "");
    await expect(createConversationToken()).rejects.toMatchObject({
      status: 503,
    });
    vi.stubEnv("ELEVENLABS_API_KEY", "sk_test_secret_never_return");
    vi.mocked(fetch).mockRejectedValue(
      new DOMException("sensitive transport", "TimeoutError"),
    );
    await expect(createConversationToken()).rejects.toMatchObject({
      status: 504,
    });
    vi.mocked(fetch).mockRejectedValue(new TypeError("sensitive URL"));
    await expect(createConversationToken()).rejects.toMatchObject({
      status: 502,
      message: expect.stringContaining("network"),
    });
  });
});
