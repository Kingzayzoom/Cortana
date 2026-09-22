import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ profile: "" }));
vi.mock("next/headers", () => ({ cookies: vi.fn() }));
vi.mock("../src/lib/server/session", async (original) => ({
  ...(await original<typeof import("../src/lib/server/session")>()),
  profileSession: vi.fn(async () => state.profile),
}));

import { POST } from "../src/app/api/learning/route";

const learn = (body: unknown) =>
  POST(
    new Request("http://localhost:3100/api/learning", {
      method: "POST",
      headers: {
        origin: "http://localhost:3100",
        host: "localhost:3100",
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    }),
  );

beforeEach(async () => {
  vi.stubEnv("SAMANTHA_SESSION_SECRET", "s".repeat(48));
  vi.stubEnv("SAMANTHA_DATA_DIR", await mkdtemp(path.join(tmpdir(), "learn-")));
  state.profile = crypto.randomUUID();
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/learning", () => {
  it("returns the profile as it is after the action, not before", async () => {
    const begun = await (await learn({ action: "begin" })).json();
    expect(begun.run).toMatchObject({ stage: "briefing", section: 0 });

    const moved = await (
      await learn({
        action: "stage",
        runId: begun.run.id,
        stageId: "briefing",
        sectionId: "finding",
      })
    ).json();
    expect(moved.run.section).toBe(1);
  });

  it("refuses a request from another origin", async () => {
    const response = await POST(
      new Request("http://localhost:3100/api/learning", {
        method: "POST",
        headers: { origin: "https://evil.example", host: "localhost:3100" },
        body: JSON.stringify({ action: "begin" }),
      }),
    );
    expect(response.status).toBe(403);
    expect(response.headers.get("cache-control")).toBe("no-store, private");
  });
});
