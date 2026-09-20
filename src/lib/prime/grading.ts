import { questions } from "./questions/bank";
import type { PrimeQuestion } from "./types";
import { RequestError } from "../server/errors";
export function normalizePrimeAnswer(
  answer: string,
  q: PrimeQuestion,
): string | null {
  const text = answer
    .trim()
    .toLowerCase()
    .replace(/[.!?]+$/g, "");
  const full = q.options.find(
    (o) => o.text.toLowerCase().replace(/[.!?]+$/g, "") === text,
  );
  if (full) return full.id;
  const match =
    /^(?:(?:my (?:final )?answer is|i choose|i pick|i think|i'd go with)\s+)?(?:(?:option|answer|choice)\s+)?([abc123])$/.exec(
      text,
    );
  if (!match) return null;
  const id =
    ({ 1: "A", 2: "B", 3: "C" } as Record<string, string>)[match[1]] ??
    match[1].toUpperCase();
  return q.options.some((o) => o.id === id) ? id : null;
}
export function gradePrimeAnswer(questionId: string, selectedOptionId: string) {
  const q = questions.find((q) => q.id === questionId);
  if (!q) throw new RequestError("Unknown Prime question.", 404);
  if (!q.options.some((o) => o.id === selectedOptionId))
    throw new RequestError("Choose one of the supplied options.");
  return {
    correct: selectedOptionId === q.correctOptionId,
    selectedOptionId,
    correctOptionId: q.correctOptionId,
    explanation: q.explanation,
    sourceIds: q.sourceIds,
  };
}
