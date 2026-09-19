"use client"

import { useSyncExternalStore } from "react"

import {
  completeRound as completeRoundRule,
  localDate,
  recordAttempt as recordAttemptRule,
  type Progress,
} from "@/lib/learning/progress"

import { createSampleProgress } from "./seed"

// Browser-local progress for the demo profile. Swap this module for a
// Supabase-backed store later; the rules in lib/learning/progress.ts stay.
const STORAGE_KEY = "cortana.progress.v1"

let cache: Progress | null = null
const listeners = new Set<() => void>()

function load(): Progress {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as Progress
      if (parsed?.version === 1) return parsed
    }
  } catch {
    // Storage blocked or corrupt: fall through to fresh sample history.
  }
  const seeded = createSampleProgress(localDate())
  persist(seeded)
  return seeded
}

function persist(p: Progress) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(p))
  } catch {
    // Private mode or quota: keep working from memory.
  }
}

function set(p: Progress) {
  cache = p
  persist(p)
  listeners.forEach((l) => l())
}

function getSnapshot(): Progress {
  cache ??= load()
  return cache
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  const onStorage = (e: StorageEvent) => {
    if (e.key !== STORAGE_KEY) return
    cache = null
    listener()
  }
  window.addEventListener("storage", onStorage)
  return () => {
    listeners.delete(listener)
    window.removeEventListener("storage", onStorage)
  }
}

/** Current progress, or null during server render and hydration. */
export function useProgress(): Progress | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null)
}

export const progressStore = {
  get: getSnapshot,

  recordAttempt(input: Parameters<typeof recordAttemptRule>[1]) {
    set(recordAttemptRule(getSnapshot(), input))
  },

  completeRound(input: Parameters<typeof completeRoundRule>[1]) {
    const { progress, summary } = completeRoundRule(getSnapshot(), input)
    set(progress)
    return summary
  },

  resetToSample() {
    set(createSampleProgress(localDate()))
  },
}
