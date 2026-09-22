/* eslint-disable @typescript-eslint/no-explicit-any -- Intentionally malformed schema inputs. */
import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { demoScenarios, defaultScenario } from "../src/lib/context/demo";
import {
  normalizeScenario,
  parseScenarioJSON,
  parseScenarioFile,
} from "../src/lib/context/normalize";
import { queryContext, contextToolNames } from "../src/lib/context/tools";
import {
  buildPhoneBriefingContext,
  previewBriefing,
  CONTEXT_FALLBACK,
} from "../src/lib/context/selectors";
import {
  readActiveScenario,
  setActiveScenario,
} from "../src/lib/context/store";
import { MAX_CONTEXT_BYTES } from "../src/lib/context/schema";
beforeEach(async () => {
  vi.stubEnv(
    "SAMANTHA_DATA_DIR",
    await mkdtemp(path.join(tmpdir(), "context-")),
  );
});
afterEach(() => vi.unstubAllEnvs());
describe("Synthetic context contracts", () => {
  it("accepts all bundled scenarios and normalizes schedules without changing input", () => {
    for (const s of demoScenarios)
      expect(normalizeScenario(s).synthetic).toBe(true);
    const input = structuredClone(defaultScenario);
    input.timeline.reverse();
    expect(normalizeScenario(input).timeline[0].time).toBe("06:10");
    expect(input.timeline[0].time).toBe("06:50");
  });
  it("rejects invalid JSON", () =>
    expect(() => parseScenarioJSON("{broken")).toThrow("Invalid JSON"));
  it.each(["synthetic", "primaryCase.synthetic"])(
    "rejects false %s",
    (field) => {
      const input = structuredClone(defaultScenario) as any;
      if (field === "synthetic") input.synthetic = false;
      else input.primaryCase.synthetic = false;
      expect(() => normalizeScenario(input)).toThrow();
    },
  );
  it.each(["clinician", "id"])("rejects missing %s", (field) => {
    const input = structuredClone(defaultScenario) as any;
    delete input[field];
    expect(() => normalizeScenario(input)).toThrow();
  });
  it("rejects missing nested IDs, real case names, unknown fields and numeric coercion", () => {
    for (const edit of [
      (s: any) => delete s.primaryCase.id,
      (s: any) => (s.primaryCase.displayName = "John Smith"),
      (s: any) => (s.primaryCase.demographics.age = "67"),
      (s: any) => (s.extra = "ignored?"),
    ]) {
      const s = structuredClone(defaultScenario);
      edit(s);
      expect(() => normalizeScenario(s)).toThrow();
    }
  });
  it("rejects malformed timeline and duplicate IDs", () => {
    const s = structuredClone(defaultScenario);
    s.timeline[0].time = "25:99";
    expect(() => normalizeScenario(s)).toThrow();
    s.timeline[0].time = "06:10";
    s.timeline[0].id = s.id;
    expect(() => normalizeScenario(s)).toThrow(/Duplicate ID/);
  });
  it("rejects invalid case references", () => {
    const s = structuredClone(defaultScenario);
    s.timeline[0].caseId = "missing";
    expect(() => normalizeScenario(s)).toThrow(/Unknown case ID/);
  });
  it("treats uploaded HTML as data", () => {
    const s = structuredClone(defaultScenario);
    s.description = '<img src=x onerror="alert(1)">';
    expect(parseScenarioJSON(JSON.stringify(s)).description).toBe(
      s.description,
    );
  });
  it("rejects large files before reading them and enforces UTF-8 byte limits", async () => {
    const text = vi.fn();
    await expect(
      parseScenarioFile({
        name: "large.json",
        size: MAX_CONTEXT_BYTES + 1,
        text,
      } as unknown as File),
    ).rejects.toThrow("64 KB");
    expect(text).not.toHaveBeenCalled();
    expect(() => parseScenarioJSON("é".repeat(MAX_CONTEXT_BYTES))).toThrow(
      "64 KB",
    );
    await expect(
      parseScenarioFile(new File(["{}"], "file.html")),
    ).rejects.toThrow(".json");
  });
});
describe("Bounded web/phone facts", () => {
  it("returns only the requested case section", () => {
    const response = queryContext(defaultScenario, "get_case_section", {
      caseId: defaultScenario.primaryCase!.id,
      section: "labs",
    });
    expect(response.data).toEqual(defaultScenario.primaryCase!.labs);
    expect(JSON.stringify(response.data)).not.toContain("history");
  });
  it("rejects unknown tools, sections, and excess arguments", () => {
    expect(() =>
      queryContext(defaultScenario, "get_case_section", {
        caseId: "patient-024",
        section: "treatments",
      }),
    ).toThrow();
    expect(() =>
      queryContext(defaultScenario, "delete_everything", {}),
    ).toThrow();
    expect(() =>
      queryContext(defaultScenario, "get_primary_case", { profileId: "other" }),
    ).toThrow();
  });
  it("returns the exact grounding fallback for an unknown case or missing data", () => {
    expect(
      queryContext(defaultScenario, "get_recent_changes", {
        caseId: "unknown",
      }),
    ).toMatchObject({
      available: false,
      message: CONTEXT_FALLBACK,
      data: null,
    });
    for (const name of contextToolNames)
      expect(
        queryContext(
          null,
          name,
          name === "get_case_section"
            ? { caseId: "patient-024", section: "labs" }
            : {},
        ),
      ).toMatchObject({ available: false, message: CONTEXT_FALLBACK });
  });
  it("builds a bounded phone briefing from supplied values", () => {
    const b = buildPhoneBriefingContext(defaultScenario)!;
    expect(b.clinicianName).toBe("Dr. Zabish");
    expect(b.recentChanges[0]).toMatchObject({
      previous: "118/72",
      current: "88/56",
    });
    expect(b.schedule[0].time).toBe("07:30");
    expect(Object.keys(b)).toEqual([
      "scenarioId",
      "notice",
      "grounding",
      "physicianUrgency",
      "hospitalStatus",
      "hospitalEvents",
      "timeline",
      "secondaryCases",
      "consults",
      "clinicianName",
      "shiftSummary",
      "primaryCaseSummary",
      "recentChanges",
      "schedule",
      "reviewItems",
      "educationTriggers",
    ]);
    expect(previewBriefing(defaultScenario)).toContain("07:30");
    expect(buildPhoneBriefingContext(null)).toBeNull();
    expect(previewBriefing(null)).toBe(CONTEXT_FALLBACK);
  });
  it("switches and clears context persistently without leaking between profiles", async () => {
    expect((await readActiveScenario("context-a"))?.id).toBe(
      defaultScenario.id,
    );
    await setActiveScenario("context-a", demoScenarios[1]);
    expect((await readActiveScenario("context-a"))?.id).toBe(
      demoScenarios[1].id,
    );
    expect((await readActiveScenario("context-b"))?.id).toBe(
      defaultScenario.id,
    );
    await setActiveScenario("context-a", null);
    expect(await readActiveScenario("context-a")).toBeNull();
    expect(
      queryContext(
        await readActiveScenario("context-a"),
        "get_context_summary",
        {},
      ).message,
    ).toBe(CONTEXT_FALLBACK);
  });
});
