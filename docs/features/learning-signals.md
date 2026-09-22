# Learning signals

Structured events that record what a learner did in a round: which concepts they explored, what kinds of questions they asked, which evidence they opened, and how they did in practice. They describe activity. They don't measure competence, mastery or clinical ability, and the UI never presents them that way.

## Modules

| Module                                            | Responsibility                                                         |
| ------------------------------------------------- | ---------------------------------------------------------------------- |
| `lib/learning-signals/types.ts`                   | The event union, and the narrow set of observations the page may send  |
| `lib/learning-signals/events.ts`                  | Builds an event with a server timestamp and known concept ids          |
| `lib/learning-signals/server.ts`                  | `signalWriter`: writes events inside the same transaction as the grade |
| `lib/learning-signals/storage.ts`                 | Append-only list on the profile, with per-session de-duplication       |
| `lib/learning-signals/adapter.ts`                 | Classifies a question into a category; the text is then discarded      |
| `lib/learning-signals/reducer.ts`, `selectors.ts` | Concept status, reinforcement priority, session summary                |
| `lib/adaptive-learning/selectNextRound.ts`        | Picks the next round from the reducer's priorities                     |
| `lib/impiricus/buildLearningSignalPayload.ts`     | The export shape (a local download; nothing is sent anywhere)          |

## Events

| Event                                       | Written when                                                                |
| ------------------------------------------- | --------------------------------------------------------------------------- |
| `round_started`                             | The text preview begins or the voice SDK connects; once per run             |
| `briefing_section_viewed`                   | A section becomes the checkpoint; once per section per run                  |
| `briefing_completed`                        | The run moves from the last section to the challenge                        |
| `briefing_interrupted`                      | The SDK reports a barge-in during the briefing (a disconnect doesn't count) |
| `question_asked`                            | A typed or final spoken question; stored as a category only                 |
| `evidence_viewed`                           | A source is opened in the evidence drawer                                   |
| `challenge_attempted`, `challenge_resolved` | The server grades a definite A, B or C; once per run                        |
| `concept_reinforced`                        | A correct answer follows an unresolved miss on the same concept             |
| `round_completed`                           | The server records completion; once per run                                 |
| `prime_*`                                   | The Prime equivalents, written by `lib/prime/server.ts`                     |

The page can send only four observations (voice connected, a barge-in, a question category, an evidence view), each built from closed enums. Grades, completion and concept ids are always decided on the server.

## Reinforcement priority

Per concept, reset when a later correct answer resolves a miss:

| Signal                                  | Adds |
| --------------------------------------- | ---- |
| Each unresolved incorrect answer        | 3    |
| Each explicit request for clarification | 2    |
| Opening evidence after a miss           | 1    |
| More than one question on the concept   | 1    |

0–2 suggests nothing, 3–4 suggests reviewing, 5 or more marks it **review next**. The UI shows the reasons behind a status, not the number. `selectNextRound` orders: priority 5+, unresolved misses, practice overdue by seven days, unseen content, then a repeat.

## Export

`/impiricus` shows the current session's signals next to the payload `buildLearningSignalPayload` would produce: schema version, round, concept ids, question categories with counts, sources viewed, attempted and correct counts. It excludes names, ids, cookies, raw answers and transcripts. The export is a local JSON download; there is no Impiricus integration or agreed contract behind it.

## Limits

Question classification is keyword-based and depends on phrasing and speech recognition. Observations come from the learner's own browser, so they are interaction records, not tamper-proof assessment.
