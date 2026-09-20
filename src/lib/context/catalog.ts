import { demoScenarios } from "./demo";
import type { ContextScenario } from "./types";

export type ScenarioCategory = "cardiology" | "operations" | "escalation";
export type ScenarioUrgency = NonNullable<
  ContextScenario["physicianUrgency"]
>["level"];
export const categoryLabels = {
  cardiology: "Cardiology",
  operations: "Operations",
  escalation: "Escalation",
} as const;
export const urgencyLabels = {
  routine: "Routine",
  review_soon: "Review soon",
  urgent: "Urgent",
  immediate: "Immediate",
} as const;
export type ScenarioCatalogItem = {
  id: string;
  title: string;
  category: ScenarioCategory;
  specialty: string;
  urgency: ScenarioUrgency;
  summary: string;
  filename: string;
  tags: string[];
  unit: string;
  favorite: boolean;
};
const favorites = new Set([
  "01-hf-urgent-hypotension",
  "07-morning-shift",
  "13-rapid-response",
]);

// Metadata is projected from the validated fixtures; clinical facts stay in JSON.
export const scenarioCatalog: ScenarioCatalogItem[] = demoScenarios
  .map((s) => {
    if (!s.metadata.category || !s.physicianUrgency)
      throw new Error(`Bundled scenario ${s.id} is missing catalog metadata.`);
    return {
      id: s.id,
      title: s.title,
      category: s.metadata.category,
      specialty: s.clinician.specialty,
      urgency: s.physicianUrgency.level,
      summary: s.description,
      filename: `${s.metadata.category}/${s.id}.json`,
      tags: s.metadata.tags,
      unit: s.facility.unit,
      favorite: favorites.has(s.id),
    };
  })
  .sort(
    (a, b) =>
      Number(b.favorite) - Number(a.favorite) || a.id.localeCompare(b.id),
  );

export function filterScenarioCatalog({
  search = "",
  category = "all",
  urgency = "all",
}: {
  search?: string;
  category?: ScenarioCategory | "all";
  urgency?: ScenarioUrgency | "all";
} = {}) {
  const words = search.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
  return scenarioCatalog.filter((s) => {
    const searchable = [
      s.title,
      s.specialty,
      s.unit,
      s.summary,
      ...s.tags,
      categoryLabels[s.category],
      urgencyLabels[s.urgency],
    ]
      .join(" ")
      .toLocaleLowerCase();
    return (
      (category === "all" || s.category === category) &&
      (urgency === "all" || s.urgency === urgency) &&
      words.every((word) => searchable.includes(word))
    );
  });
}
export function getBundledScenario(id: string) {
  return scenarioCatalog.some((item) => item.id === id)
    ? (demoScenarios.find((s) => s.id === id) ?? null)
    : null;
}
export const defaultCatalogScenario = scenarioCatalog.find(
  (s) => s.id === "01-hf-urgent-hypotension",
)!;
