// The authority for the evidence round: grading, streaks, rewards and review
// scheduling. Server-only. The answer key is in this file, so no client module
// may import it (the page receives a Grade, never the key).
import { randomUUID } from "node:crypto";
import { round, CONTENT_VERSION, ROUND_ID } from "../content/round";
import type { Grade, Progress } from "./types";

/**
 * Grades one spoken or typed answer. Anything that does not name exactly one
 * option returns "clarify" and is never recorded as an attempt.
 */
export function gradeAnswer(answer: string): Grade {
  const clean = answer
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, "");
  const option = round.case.options.find(
    (o) => o.text.toLowerCase().replace(/\.$/, "") === clean,
  );
  const choice =
    option?.id ??
    /^(?:(?:option|answer|choice)\s+)?([abc])$/.exec(clean)?.[1]?.toUpperCase();
  if (!choice)
    return {
      verdict: "clarify",
      explanation:
        "Please choose A, B, or C, or say the full answer. I won’t grade an unclear response.",
      takeaway: "",
      sourceIds: [],
    };
  return {
    verdict: choice === "B" ? "correct" : "incorrect",
    answerId: choice,
    explanation:
      "DAPA-HF enrolled participants with and without diabetes. The subgroup analysis supports benefit on the composite outcome in both groups; it does not extend the finding to all ejection fractions.",
    takeaway: "Match a study’s conclusions to its actual population.",
    sourceIds: ["dapa-diabetes"],
  };
}
/** Saves a definite grade on the active run and moves it on to feedback. */
export function recordGrade(progress: Progress, grade: Grade) {
  if (!progress.run || grade.verdict === "clarify" || !grade.answerId)
    throw new Error("Only a definite grade on an active run is recorded.");
  progress.run.grade = grade;
  progress.run.stage = "feedback";
  progress.attempts.push({
    id: randomUUID(),
    roundId: ROUND_ID,
    version: CONTENT_VERSION,
    answerId: grade.answerId,
    correct: grade.verdict === "correct",
    at: new Date().toISOString(),
  });
}

/** A calendar date (YYYY-MM-DD) in the learner's own time zone. */
export function localDate(at: Date, timezone: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}
export function shiftDay(date: string, delta: number) {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
/** Consecutive practice days ending today, or yesterday if today is not done yet. */
export function streak(days: string[], today: string) {
  const unique = new Set(days);
  let cursor = unique.has(today) ? today : shiftDay(today, -1);
  let result = 0;
  while (unique.has(cursor)) {
    result++;
    cursor = shiftDay(cursor, -1);
  }
  return result;
}
/**
 * Finishes the round: first completion earns 100 XP (+20 if the first attempt
 * was right), and the review is scheduled for tomorrow after a miss or in a
 * week after a correct answer. Safe to call twice.
 */
export function completeProgress(progress: Progress, now: Date) {
  if (!progress.run?.grade || progress.run.grade.verdict === "clarify")
    throw new Error("Answer the challenge before completing this round.");
  if (progress.run.completed) return;
  const date = localDate(now, progress.preferences.timezone);
  if (!progress.completions.some((c) => c.roundId === ROUND_ID)) {
    const first = progress.attempts.find((a) => a.roundId === ROUND_ID);
    progress.completions.push({
      roundId: ROUND_ID,
      at: now.toISOString(),
      date,
      xp: 100 + (first?.correct ? 20 : 0),
      version: CONTENT_VERSION,
    });
  }
  if (!progress.practiceDays.includes(date)) progress.practiceDays.push(date);
  const missed = progress.run.grade.verdict === "incorrect";
  progress.review = {
    date: shiftDay(date, missed ? 1 : 7),
    reason: missed
      ? "Revisit the population question you missed in your latest practice."
      : "Revisit this topic in seven days to reinforce your learning.",
  };
  progress.run.stage = "completed";
  progress.run.completed = true;
}
