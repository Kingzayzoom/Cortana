import { round } from "../../content/round";

// People answer a phone in sentences ("I'd go with B"), while the grader expects
// one option. Pull out a single option when the speech names exactly one, and
// leave anything ambiguous untouched so the server still asks them to clarify.
export function spokenOption(answer: string) {
  const text = answer.toLowerCase().replace(/[.,!?;:]/g, " ");
  const words = text.trim().split(/\s+/).filter(Boolean);
  const found = new Set<string>();
  for (const option of round.case.options)
    if (
      text.includes(
        option.text
          .toLowerCase()
          .replace(/[.,!?;:]/g, " ")
          .trim(),
      )
    )
      found.add(option.id);
  for (const [, letter] of text.matchAll(
    /\b(?:option|answer|choice|letter)\s+([abc])\b/g,
  ))
    found.add(letter.toUpperCase());
  // "b" and "c" are not English words; a lone "a" usually is, so only trust it
  // in a very short reply.
  for (const [, letter] of text.matchAll(/\b([bc])\b/g))
    found.add(letter.toUpperCase());
  if (words.length <= 3 && /\ba\b/.test(text)) found.add("A");
  const ordinals: Record<string, string> = {
    first: "A",
    second: "B",
    third: "C",
  };
  // "the second one" picks an option; "between the first and the second" does not.
  const choosing =
    words.length <= 4 ||
    /\b(one|option|answer|choice|pick|choose)\b|\bgo with\b/.test(text);
  if (choosing)
    for (const [, word] of text.matchAll(/\b(first|second|third)\b/g))
      found.add(ordinals[word]);
  return found.size === 1 ? [...found][0] : answer;
}
