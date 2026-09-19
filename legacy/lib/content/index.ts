import { heartFailureCase, heartFailureRound } from "./cardiology/heart-failure"
import { sources } from "./sources"
import type { ClinicalCase, Round, Source, Topic } from "./types"

export * from "./types"

const rounds: Record<string, Round> = {
  [heartFailureRound.id]: heartFailureRound,
}

const cases: Record<string, ClinicalCase> = {
  [heartFailureCase.id]: heartFailureCase,
}

// Hypertension and anticoagulation appear in the demo profile's sample history
// but have no round content yet.
export const topics: Topic[] = [
  { id: "heart-failure", name: "Heart Failure", specialty: "Cardiology", roundIds: [heartFailureRound.id] },
  { id: "hypertension", name: "Hypertension", specialty: "Cardiology", roundIds: [] },
  { id: "anticoagulation", name: "Anticoagulation", specialty: "Cardiology", roundIds: [] },
]

export function getRound(id: string): Round | undefined {
  return rounds[id]
}

export function listRounds(): Round[] {
  return Object.values(rounds)
}

export function getCase(id: string): ClinicalCase | undefined {
  return cases[id]
}

export function getSource(id: string): Source | undefined {
  return sources[id]
}

export function listSources(): Source[] {
  return Object.values(sources)
}

export function getTopic(id: string): Topic | undefined {
  return topics.find((t) => t.id === id)
}

export function roundsUsingSource(sourceId: string): Round[] {
  return listRounds().filter((r) => r.sourceIds.includes(sourceId))
}
