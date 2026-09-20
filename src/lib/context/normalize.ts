import { contextScenarioSchema, MAX_CONTEXT_BYTES } from "./schema";
import type { ContextScenario } from "./types";
export function normalizeScenario(input: unknown): ContextScenario {
  const scenario = contextScenarioSchema.parse(input);
  scenario.timeline.sort((a, b) => a.time.localeCompare(b.time));
  scenario.hospitalEvents.sort((a, b) => a.time.localeCompare(b.time));
  for (const item of [scenario.primaryCase, ...scenario.secondaryCases]) {
    item?.scheduledEvents.sort((a, b) => a.time.localeCompare(b.time));
  }
  return scenario;
}
export function parseScenarioJSON(text: string) {
  if (new TextEncoder().encode(text).byteLength > MAX_CONTEXT_BYTES)
    throw new Error("Scenario exceeds the 64 KB limit.");
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error("Invalid JSON. Check commas, quotes and brackets.");
  }
  return normalizeScenario(data);
}
export async function parseScenarioFile(file: File) {
  if (!file.name.toLowerCase().endsWith(".json"))
    throw new Error("Choose a .json file.");
  if (file.size > MAX_CONTEXT_BYTES)
    throw new Error("Scenario exceeds the 64 KB limit.");
  return parseScenarioJSON(await file.text());
}
