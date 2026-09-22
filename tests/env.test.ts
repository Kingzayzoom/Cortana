import { afterEach, describe, expect, it, vi } from "vitest";
import { setting } from "@/lib/server/env";

describe("setting", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("prefers the SAMANTHA_ name", () => {
    vi.stubEnv("SAMANTHA_APP_ORIGIN", "https://new.example");
    vi.stubEnv("CORTANA_APP_ORIGIN", "https://old.example");
    expect(setting("APP_ORIGIN")).toBe("https://new.example");
  });

  it("still reads deployments configured before the rename", () => {
    vi.stubEnv("SAMANTHA_APP_ORIGIN", "");
    vi.stubEnv("CORTANA_APP_ORIGIN", "https://old.example");
    expect(setting("APP_ORIGIN")).toBe("https://old.example");
  });
});
