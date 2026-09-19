import { mkdtemp, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { startUpstashEmulator } from "./upstash-emulator.mjs";

vi.mock("next/headers", () => ({
  cookies: vi.fn(async () => ({ get: () => undefined, set: vi.fn() })),
}));

type Store = typeof import("../src/lib/server/store");
type Session = typeof import("../src/lib/server/session");
type Emulator = Awaited<ReturnType<typeof startUpstashEmulator>>;
let emulator: Emulator;
let dataDir: string;
// Each call returns fresh module state, like a separate serverless instance.
async function instance(): Promise<{ store: Store; session: Session }> {
  vi.resetModules();
  return {
    store: await import("../src/lib/server/store"),
    session: await import("../src/lib/server/session"),
  };
}
const profile = "3f8e2a8e-5d33-4c55-9a4f-1d2f0b6c7e90";
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

beforeAll(async () => {
  emulator = await startUpstashEmulator();
});
afterAll(() => emulator.close());
beforeEach(async () => {
  emulator.data.clear();
  dataDir = path.join(await mkdtemp(path.join(tmpdir(), "cortana-")), "data");
  vi.stubEnv("KV_REST_API_URL", emulator.url);
  vi.stubEnv("KV_REST_API_TOKEN", emulator.token);
  vi.stubEnv("CORTANA_DATA_DIR", dataDir);
  vi.stubEnv("CORTANA_SESSION_SECRET", "s".repeat(48));
  vi.stubEnv("VERCEL", "1");
});
afterEach(() => {
  vi.unstubAllEnvs();
});

describe("Redis progress storage", () => {
  it("persists learning signals and replay privacy across serverless instances", async () => {
    const a = await instance(),
      b = await instance();
    const { signalWriter } = await import("../src/lib/learning-signals/server");
    const data = a.store.emptyProgress();
    const eventId = "3f8e2a8e-5d33-4c55-9a4f-1d2f0b6c7e91";
    data.run = {
      id: eventId,
      mode: "voice",
      section: 0,
      stage: "briefing",
      grade: null,
      completed: false,
    };
    delete data.learningSignals;
    data.requests[eventId] = {
      fingerprint: JSON.stringify({ answer: "Jane Example MRN 98765" }),
      result: {},
    };
    emulator.data.set("cortana:profile:" + profile, {
      value: JSON.stringify(data),
      expires: Date.now() + 60000,
    });
    await a.store.withProgress(profile, (data) =>
      signalWriter(data).start("voice"),
    );
    await b.store.withProgress(profile, (data) => {
      const writer = signalWriter(data);
      writer.start("voice");
      writer.grade("B", true);
      writer.complete();
    });
    await a.store.withProgress(profile, (data) => {
      signalWriter(data).grade("B", true);
      signalWriter(data).complete();
    });
    const snapshot = await b.store.withProgress(profile, b.store.snapshot);
    for (const type of [
      "round_started",
      "challenge_attempted",
      "challenge_resolved",
      "round_completed",
    ])
      expect(
        snapshot.learningSignals!.filter((event) => event.type === type),
      ).toHaveLength(1);
    expect(
      snapshot.learningSignals!.some(
        (event) => event.type === "concept_reinforced",
      ),
    ).toBe(false);
    expect(
      emulator.data.get("cortana:profile:" + profile)!.value,
    ).not.toContain("98765");
    await expect(stat(dataDir)).rejects.toMatchObject({ code: "ENOENT" });
  });
  it("shares progress between instances and never touches the file system", async () => {
    const a = await instance(),
      b = await instance();
    await a.store.withProgress(profile, (data) => {
      data.preferences.name = "Dr. Rivera";
    });
    const name = await b.store.withProgress(
      profile,
      (data) => data.preferences.name,
    );
    expect(name).toBe("Dr. Rivera");
    await expect(stat(dataDir)).rejects.toMatchObject({ code: "ENOENT" });
    const stored = emulator.data.get(`cortana:profile:${profile}`);
    expect(stored?.expires).toBeGreaterThan(Date.now() + 89 * 86_400_000);
    expect(b.store.snapshot(JSON.parse(stored!.value)).storage).toMatch(
      /demo database/,
    );
  });

  it("serializes simultaneous updates from different instances", async () => {
    const a = await instance(),
      b = await instance();
    // Each update reads, pauses, then writes: without a shared lock these overlap and lose updates.
    await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        (i % 2 ? a : b).store.withProgress(profile, async (data) => {
          const seen = data.practiceDays.length;
          await wait(5);
          data.practiceDays = [
            ...data.practiceDays.slice(0, seen),
            `2026-09-${String(i + 1).padStart(2, "0")}`,
          ];
        }),
      ),
    );
    const days = await a.store.withProgress(
      profile,
      (data) => data.practiceDays,
    );
    expect(days).toHaveLength(12);
    expect([...emulator.data.keys()].some((k) => k.includes(":lock:"))).toBe(
      false,
    );
  });

  it("skips the write for read-only access and keeps failed operations unsaved", async () => {
    const { store } = await instance();
    await store.withProgress(profile, (data) => {
      data.preferences.name = "Dr. Chen";
    });
    const writes = emulator.stats.writes;
    await store.withProgress(profile, store.snapshot);
    // Only the lock is written, not the profile.
    expect(emulator.stats.writes - writes).toBe(1);
    await expect(
      store.withProgress(profile, (data) => {
        data.preferences.name = "Changed";
        throw new Error("rejected");
      }),
    ).rejects.toThrow("rejected");
    expect(
      await store.withProgress(profile, (data) => data.preferences.name),
    ).toBe("Dr. Chen");
  });

  it("recovers when a crashed instance leaves its lock behind", async () => {
    const { store } = await instance();
    emulator.data.set(`cortana:lock:${profile}`, {
      value: "crashed-instance",
      expires: Date.now() + 300,
    });
    const started = Date.now();
    await store.withProgress(profile, (data) => {
      data.preferences.name = "Dr. Okafor";
    });
    expect(Date.now() - started).toBeGreaterThanOrEqual(250);
  });

  it("finds Redis credentials connected with a custom Vercel prefix", async () => {
    vi.stubEnv("KV_REST_API_URL", "");
    vi.stubEnv("KV_REST_API_TOKEN", "");
    vi.stubEnv("STORAGE_KV_REST_API_URL", emulator.url);
    vi.stubEnv("STORAGE_KV_REST_API_TOKEN", emulator.token);
    const { store } = await instance();
    await store.withProgress(profile, (data) => {
      data.preferences.name = "Dr. Ahmed";
    });
    expect(emulator.data.has(`cortana:profile:${profile}`)).toBe(true);
  });

  it("returns a retryable error when Redis is unreachable", async () => {
    vi.stubEnv("KV_REST_API_TOKEN", "wrong-token");
    const { store } = await instance();
    await expect(store.withProgress(profile, () => null)).rejects.toMatchObject(
      {
        status: 503,
        message: "Progress storage is unavailable. Please retry in a moment.",
      },
    );
  });
});

describe("Serverless configuration", () => {
  it("shares rate limits across instances until the window ends", async () => {
    const a = await instance(),
      b = await instance();
    await a.session.rateLimit("voice:test", 3, 300);
    await b.session.rateLimit("voice:test", 3, 300);
    await a.session.rateLimit("voice:test", 3, 300);
    await expect(
      b.session.rateLimit("voice:test", 3, 300),
    ).rejects.toMatchObject({ status: 429 });
    await wait(350);
    await expect(
      a.session.rateLimit("voice:test", 3, 300),
    ).resolves.toBeUndefined();
  });

  it("explains missing storage and session secret on Vercel instead of writing files", async () => {
    vi.stubEnv("KV_REST_API_URL", "");
    vi.stubEnv("KV_REST_API_TOKEN", "");
    const { store, session } = await instance();
    await expect(store.withProgress(profile, () => null)).rejects.toMatchObject(
      { status: 503, message: /Upstash Redis/ },
    );
    vi.stubEnv("CORTANA_SESSION_SECRET", "");
    await expect(session.profileSession(true)).rejects.toMatchObject({
      status: 503,
      message: /CORTANA_SESSION_SECRET/,
    });
    await expect(stat(dataDir)).rejects.toMatchObject({ code: "ENOENT" });
  });

  it("accepts HTTPS origins forwarded by the host and configured alternatives", async () => {
    const { session } = await instance();
    const request = (origin: string, headers: Record<string, string> = {}) =>
      new Request("http://0.0.0.0:3000/api/learning", {
        method: "POST",
        headers: { origin, host: "cortex.vercel.app", ...headers },
      });
    expect(() =>
      session.assertOrigin(
        request("https://cortex.vercel.app", { "x-forwarded-proto": "https" }),
      ),
    ).not.toThrow();
    expect(() =>
      session.assertOrigin(
        request("https://evil.example", { "x-forwarded-proto": "https" }),
      ),
    ).toThrow("must come from");
    vi.stubEnv(
      "CORTANA_APP_ORIGIN",
      "https://cortex.vercel.app, https://demo.example",
    );
    expect(() =>
      session.assertOrigin(request("https://demo.example")),
    ).not.toThrow();
    // A trailing slash is easy to paste into a dashboard and would otherwise
    // reject every request.
    vi.stubEnv("CORTANA_APP_ORIGIN", "https://demo.example/");
    expect(() =>
      session.assertOrigin(request("https://demo.example")),
    ).not.toThrow();
  });
});
