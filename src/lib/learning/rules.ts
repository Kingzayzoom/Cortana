import { round, CONTENT_VERSION, ROUND_ID } from "../content/round";
import type { Grade, Progress } from "./types";

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
