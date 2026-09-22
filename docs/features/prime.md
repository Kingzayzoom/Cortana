# Prime

`/prime`. Three short questions a day on the DAPA-HF evidence, answered by tapping, by browser voice, or on a call (`/prime/phone`).

## Content

Twelve authored questions in `lib/prime/questions/bank.ts`, across three concepts: trial population, primary endpoint and evidence limitations. Every explanation cites a source id. The bank is imported only by server modules; the page receives questions without `correctOptionId` or explanations until an answer is graded.

## Selection and review

`lib/prime/generator.ts` builds the day's set, in priority order:

1. concepts that need reinforcement after a miss,
2. reviews that are due,
3. concepts not yet practised,
4. continued practice.

It prefers three different concepts and avoids questions from the last two sessions when there is an alternative. An unstarted set follows the current Context Feed education triggers; once started, it stays fixed for the day, even across midnight.

After a correct answer the next review is 2, then 5, then 10 days out. A miss schedules reinforcement for the next session with a different question.

## Grading and rewards

`lib/prime/grading.ts` accepts a letter, a number, the full option text or a simple phrase ("I'd go with B"). Anything ambiguous asks for clarification and records no attempt. The first answer to each question is the one that counts; retries return the saved result.

Completion awards 50 XP, plus 10 per correct first answer and 10 per concept reinforced, once. Prime shares the profile's practice days and streak with the evidence round.

## Voice

The browser agent calls the five Prime tools (`get_prime_session`, `submit_prime_answer`, `get_prime_feedback`, `advance_prime`, `complete_prime`) as client tools; the phone agent calls them as webhooks. Both land in `runPrimeTool` in `lib/prime/server.ts`. Each result carries a standing instruction not to reveal correctness before `submit_prime_answer` returns, because the model otherwise tends to.

## Tests

`tests/prime.test.ts` covers selection, review intervals, ambiguous answers, first-answer persistence, concurrent duplicates, reward idempotency and midnight. `tests/e2e/prime.spec.ts` runs the full set in a browser.
