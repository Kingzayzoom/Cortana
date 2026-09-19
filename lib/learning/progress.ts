import type { OptionId } from "@/lib/content/types"

import type { CompletionSummary, Confidence } from "./types"

// Pure progress rules: XP, streaks and review scheduling. Storage lives in
// lib/progress/store.ts so these can move to a database unchanged.

export type Attempt = {
  id: string
  roundId: string
  questionId: string
  topicId: string
  answer: OptionId
  isCorrect: boolean
  confidence: Confidence | null
  answeredOn: string
  answeredAt: string
  sample?: true
}

export type Completion = {
  id: string
  roundId: string
  topicId: string
  completedOn: string
  xpEarned: number
  sample?: true
}

export type Progress = {
  version: 1
  xp: number
  streak: { current: number; longest: number; lastCompletedOn: string | null }
  attempts: Attempt[]
  completions: Completion[]
}

export const XP_RULES = { roundComplete: 100, correctAnswer: 20 } as const

/** Days until the next review after N consecutive correct answers. */
const REVIEW_INTERVALS = [1, 3, 8, 21] as const

// ---- Local dates (YYYY-MM-DD, compared as strings) ----

const pad = (n: number) => String(n).padStart(2, "0")

export function localDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

function parts(date: string) {
  const [y, m, d] = date.split("-").map(Number)
  return { y, m, d }
}

export function addDays(date: string, n: number): string {
  const { y, m, d } = parts(date)
  return localDate(new Date(y, m - 1, d + n))
}

export function daysBetween(from: string, to: string): number {
  const a = parts(from)
  const b = parts(to)
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000)
}

// ---- Recording ----

export function emptyProgress(): Progress {
  return { version: 1, xp: 0, streak: { current: 0, longest: 0, lastCompletedOn: null }, attempts: [], completions: [] }
}

/** Only the first attempt at a question per round per day counts. */
export function recordAttempt(
  p: Progress,
  input: Omit<Attempt, "id" | "answeredOn" | "answeredAt" | "sample">,
  now: Date = new Date(),
): Progress {
  const answeredOn = localDate(now)
  const id = `${input.roundId}:${input.questionId}:${answeredOn}`
  if (p.attempts.some((a) => a.id === id)) return p
  return { ...p, attempts: [...p.attempts, { ...input, id, answeredOn, answeredAt: now.toISOString() }] }
}

function breakdownFor(p: Progress, roundId: string, day: string) {
  const attempt = p.attempts.find((a) => a.roundId === roundId && a.answeredOn === day)
  const breakdown: CompletionSummary["breakdown"] = [{ label: "Round complete", xp: XP_RULES.roundComplete }]
  if (attempt?.isCorrect) breakdown.push({ label: "Correct answer", xp: XP_RULES.correctAnswer })
  return breakdown
}

/** Idempotent: completing the same round twice on one day awards nothing new. */
export function completeRound(
  p: Progress,
  input: { roundId: string; topicId: string },
  now: Date = new Date(),
): { progress: Progress; summary: CompletionSummary } {
  const today = localDate(now)
  const existing = p.completions.find((c) => c.roundId === input.roundId && c.completedOn === today)
  const breakdown = breakdownFor(p, input.roundId, today)

  if (existing) {
    return {
      progress: p,
      summary: {
        roundId: input.roundId,
        xpEarned: existing.xpEarned,
        breakdown,
        totalXp: p.xp,
        streak: { current: p.streak.current, longest: p.streak.longest, extended: false },
        alreadyCompleted: true,
      },
    }
  }

  const xpEarned = breakdown.reduce((sum, b) => sum + b.xp, 0)
  const last = p.streak.lastCompletedOn
  const current = last === today ? p.streak.current : last === addDays(today, -1) ? p.streak.current + 1 : 1
  const longest = Math.max(p.streak.longest, current)

  const progress: Progress = {
    ...p,
    xp: p.xp + xpEarned,
    streak: { current, longest, lastCompletedOn: today },
    completions: [
      ...p.completions,
      { id: `${input.roundId}:${today}`, roundId: input.roundId, topicId: input.topicId, completedOn: today, xpEarned },
    ],
  }

  return {
    progress,
    summary: {
      roundId: input.roundId,
      xpEarned,
      breakdown,
      totalXp: progress.xp,
      streak: { current, longest, extended: current > currentStreak(p, today) },
      alreadyCompleted: false,
    },
  }
}

/** The stored streak only counts while the last completion was today or yesterday. */
export function currentStreak(p: Progress, today: string = localDate()): number {
  const last = p.streak.lastCompletedOn
  return last === today || last === addDays(today, -1) ? p.streak.current : 0
}

// ---- Derived stats ----

export type TopicStats = {
  topicId: string
  correct: number
  total: number
  lastAttempt: Attempt | null
  lastSeenOn: string | null
  dueOn: string | null
  status: "not-started" | "due" | "scheduled"
  /** True when every record behind these stats is seeded sample history. */
  sample: boolean
}

export function topicStats(p: Progress, topicId: string, today: string = localDate()): TopicStats {
  const attempts = p.attempts
    .filter((a) => a.topicId === topicId)
    .sort((a, b) => a.answeredAt.localeCompare(b.answeredAt))
  const completions = p.completions.filter((c) => c.topicId === topicId)

  if (attempts.length === 0 && completions.length === 0) {
    return { topicId, correct: 0, total: 0, lastAttempt: null, lastSeenOn: null, dueOn: null, status: "not-started", sample: false }
  }

  const lastAttempt = attempts.at(-1) ?? null
  const seenDates = [...attempts.map((a) => a.answeredOn), ...completions.map((c) => c.completedOn)].sort()
  const lastSeenOn = seenDates.at(-1) ?? null

  let consecutiveCorrect = 0
  for (let i = attempts.length - 1; i >= 0 && attempts[i].isCorrect; i--) consecutiveCorrect++

  let dueOn: string | null = null
  if (lastAttempt && !lastAttempt.isCorrect) {
    dueOn = lastAttempt.answeredOn
  } else if (lastSeenOn) {
    const step = Math.min(Math.max(consecutiveCorrect, 1), REVIEW_INTERVALS.length) - 1
    dueOn = addDays(lastSeenOn, REVIEW_INTERVALS[step])
  }

  return {
    topicId,
    correct: attempts.filter((a) => a.isCorrect).length,
    total: attempts.length,
    lastAttempt,
    lastSeenOn,
    dueOn,
    status: dueOn && dueOn <= today ? "due" : "scheduled",
    sample: [...attempts, ...completions].every((r) => r.sample),
  }
}
