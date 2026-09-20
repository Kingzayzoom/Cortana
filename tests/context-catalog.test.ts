import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  scenarioCatalog,
  filterScenarioCatalog,
  getBundledScenario,
} from "../src/lib/context/catalog";
import {
  parseScenarioJSON,
  normalizeScenario,
} from "../src/lib/context/normalize";
import {
  buildPhoneBriefingContext,
  CONTEXT_FALLBACK,
  previewBriefing,
} from "../src/lib/context/selectors";
import { contextToolNames, queryContext } from "../src/lib/context/tools";

const root = "demo-data/context";
const files = readdirSync(root, { recursive: true })
  .filter((f) => String(f).endsWith(".json"))
  .map(String);
describe("Bundled scenario catalog", () => {
  it("contains exactly 15 JSON fixtures, indexed once each", () => {
    expect(files).toHaveLength(15);
    expect(scenarioCatalog).toHaveLength(15);
    expect(new Set(scenarioCatalog.map((s) => s.id)).size).toBe(15);
    expect(files.map((f) => f.replaceAll("\\", "/")).sort()).toEqual(
      scenarioCatalog.map((s) => s.filename).sort(),
    );
  });
  it.each(files)(
    "validates IDs, references, synthetic labels, times and urgency in %s",
    (file) => {
      const s = parseScenarioJSON(readFileSync(`${root}/${file}`, "utf8"));
      expect(s.synthetic).toBe(true);
      expect(s.physicianUrgency).toBeDefined();
      expect(s.hospitalStatus).toBeDefined();
      const cases = [s.primaryCase!, ...s.secondaryCases];
      for (const c of cases) {
        expect(c.synthetic).toBe(true);
        expect(c.displayName).toMatch(/^Synthetic Patient \d+$/);
        expect(c.physicianUrgency).toBeDefined();
      }
      const catalog = scenarioCatalog.find((item) => item.id === s.id)!;
      expect(catalog.urgency).toBe(s.physicianUrgency!.level);
      expect(catalog.category).toBe(s.metadata.category);
      const briefing = buildPhoneBriefingContext(s)!;
      expect(briefing.physicianUrgency).toEqual(s.physicianUrgency);
      expect(briefing.secondaryCases).toHaveLength(s.secondaryCases.length);
      expect(briefing.consults).toEqual(s.consults);
      expect(briefing.hospitalStatus).toEqual(s.hospitalStatus);
      expect(previewBriefing(s)).toContain(
        s.physicianUrgency!.requestedArrival,
      );
      for (const name of contextToolNames) {
        const result = queryContext(
          s,
          name,
          name === "get_case_section"
            ? { caseId: s.primaryCase!.id, section: "status" }
            : {},
        );
        expect(result.scenarioId).toBe(s.id);
        expect(result.synthetic).toBe(true);
        expect(result.grounding).toContain(CONTEXT_FALLBACK);
        if (name === "get_context_summary")
          expect(result.data).toEqual(briefing);
      }
      // No fixture supplies blood type; no generic tool fabricates it.
      expect(JSON.stringify(s).toLowerCase()).not.toContain("blood type");
      expect(
        queryContext(s, "get_case_section", {
          caseId: "absent",
          section: "history",
        }),
      ).toMatchObject({
        available: false,
        data: null,
        message: CONTEXT_FALLBACK,
      });
    },
  );
  it("keeps legacy version-1 uploads compatible", () => {
    for (const filename of readdirSync("tests/fixtures/context-v1")) {
      const s = parseScenarioJSON(
        readFileSync(`tests/fixtures/context-v1/${filename}`, "utf8"),
      );
      expect(s.schemaVersion).toBe("1.0");
      expect(s.physicianUrgency).toBeUndefined();
      expect(buildPhoneBriefingContext(s)?.physicianUrgency).toBeNull();
    }
  });
  it("rejects invalid urgency, IDs, times and references in the added fields", () => {
    const s = getBundledScenario("13-rapid-response")!;
    expect(() =>
      normalizeScenario({
        ...s,
        physicianUrgency: { ...s.physicianUrgency, level: "critical" },
      }),
    ).toThrow();
    const bad = structuredClone(s);
    bad.hospitalStatus!.events[0].id = s.id;
    expect(() => normalizeScenario(bad)).toThrow(/Duplicate ID/);
    bad.hospitalStatus!.events[0].id = "new-event";
    bad.hospitalStatus!.events[0].time = "25:10";
    expect(() => normalizeScenario(bad)).toThrow(/HH:mm/);
    bad.hospitalStatus!.events[0].time = "06:52";
    bad.timeline[0].caseId = "missing";
    expect(() => normalizeScenario(bad)).toThrow(/Unknown case ID/);
  });
  it("orders favorites first deterministically", () => {
    expect(scenarioCatalog.slice(0, 3).map((s) => s.id)).toEqual([
      "01-hf-urgent-hypotension",
      "07-morning-shift",
      "13-rapid-response",
    ]);
    expect(scenarioCatalog.filter((s) => s.favorite)).toHaveLength(3);
  });
  it("filters locally by category, urgency and every search field", () => {
    expect(filterScenarioCatalog({ category: "cardiology" })).toHaveLength(6);
    expect(filterScenarioCatalog({ category: "operations" })).toHaveLength(5);
    expect(filterScenarioCatalog({ category: "escalation" })).toHaveLength(4);
    for (const urgency of [
      "routine",
      "review_soon",
      "urgent",
      "immediate",
    ] as const) {
      const items = filterScenarioCatalog({ urgency });
      expect(items.length).toBeGreaterThan(0);
      expect(items.every((s) => s.urgency === urgency)).toBe(true);
    }
    for (const search of [
      "heart failure",
      "urgent",
      "consult",
      "shift",
      "stable",
      "Cardiac Step-Down",
      "cardiology",
      "transport",
    ])
      expect(filterScenarioCatalog({ search }).length).toBeGreaterThan(0);
    expect(
      filterScenarioCatalog({ category: "operations", urgency: "urgent" }),
    ).toEqual([]);
    expect(
      filterScenarioCatalog({
        search: "  RAPID   response ",
        urgency: "immediate",
      }).map((s) => s.id),
    ).toEqual(["13-rapid-response"]);
    expect(getBundledScenario("unknown")).toBeNull();
  });
  it("preserves the contrasting judging sequence and request-only transfer", () => {
    const urgent = getBundledScenario("01-hf-urgent-hypotension")!;
    const stable = getBundledScenario("03-post-pci-stable")!;
    const rapid = getBundledScenario("13-rapid-response")!;
    expect(urgent.primaryCase!.changes[0]).toMatchObject({
      previous: "118/72",
      current: "88/56",
    });
    expect(
      stable.primaryCase!.changes.every((c) => c.direction === "stable"),
    ).toBe(true);
    expect(stable.physicianUrgency!.level).toBe("routine");
    expect(rapid.physicianUrgency!.level).toBe("immediate");
    expect(previewBriefing(rapid)).toContain(
      "The scenario records a rapid-response activation and requests immediate physician review.",
    );
    const transfer = getBundledScenario("14-icu-transfer-request")!;
    expect(transfer.consults[0].status).toBe("requested");
    expect(transfer.primaryCase!.currentStatus.summary).toContain(
      "Transfer has not been documented as completed",
    );
  });
});
