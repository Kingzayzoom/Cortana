# Cortana learning signals

Cortana adds observable educational activity after engagement: concepts explored, question categories, evidence opened, deterministic practice outcomes and transparent reinforcement. It does not measure competency, mastery, intelligence, clinical proficiency or patient outcomes.

## Implementation

| Module                                          | Responsibility                                                                                           |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| src/lib/learning-signals/types.ts               | Strict Zod event union and client-observation allowlist                                                  |
| events.ts                                       | Server timestamps, known content IDs and unique concept lists                                            |
| server.ts                                       | Creates signals in the existing atomic progress transaction beside authoritative grades                  |
| storage.ts                                      | LearningSignalRepository: append/listForRound/listForTopic/listForSession; existing profile JSON adapter |
| adapter.ts                                      | Deterministic question classification; raw text discarded                                                |
| reducer.ts / selectors.ts                       | Real counts, concept activity, elapsed time and reinforcement priorities                                 |
| src/lib/adaptive-learning/selectNextRound.ts    | Deterministic choice from supported content                                                              |
| src/lib/impiricus/buildLearningSignalPayload.ts | Validated schema 1.0 JSON export, without network calls                                                  |

The existing persistence backend is preserved: local JSON files, or the upstream Upstash Redis adapter on Vercel. Learning signals are written in the same profile transaction in either path. No new database or browser-local replacement was introduced. Old profiles retain progress, with missing signal history treated as empty. Historical questions or interruptions are never fabricated from old completion records.

## Event rules

- round_started: text preview begins or the real SDK connects; once per educational run.
- briefing_section_viewed: a section becomes the active checkpoint, once per section per run.
- briefing_completed: valid transition from the final section to the challenge.
- briefing_interrupted: SDK onInterruption during briefing; duplicate SDK IDs ignored. Disconnects do not count.
- question_asked: question-form input or a recognized final spoken question, classified into a fixed enum.
- evidence_viewed: valid drawer open or tab change. Repeated calls while that source remains open do not count again.
- challenge_attempted / challenge_resolved: deterministic server grading transaction for an unambiguous A/B/C choice; one authoritative result per run.
- concept_reinforced: a correct response follows a previously unresolved miss on a tagged concept.
- round_completed: authoritative completion transaction, once per run even with different request IDs.

A deliberate new practice run creates new activity. Completion XP remains once per content round. Reload and reconnect preserve the educational run. Ambiguous answers receive clarification but no attempt/resolution signal. Unsupported safety/mechanism questions do not invent concept IDs.

Evidence browsing before a round starts is not counted as round activity. A deliberate reopening counts as a new interaction. Without a provider tool-call ID, an identical tool request after a drawer closes cannot be distinguished from a new requested opening.

## Transparent reinforcement

Each unresolved incorrect response adds 3. Each explicit clarification adds 2. Evidence after a miss adds 1 once per unresolved cycle. Multiple questions about a concept add 1 once per cycle. Priority 0–2: no suggestion; 3–4: consider reviewing; 5+: review next. A correct response after an unresolved miss records reinforcement and clears the earlier reasons.

The UI shows reasons and rules. Priority is an internal ordering rule, never an ability score. NEW means no activity; EXPLORED means interaction without resolved practice; PRACTICED means a resolved response exists; REINFORCED requires the prior-miss rule.

Next-round order: priority at least 5, unresolved misses, seven-day overdue practice, unseen supported content, optional repeat. The catalog currently contains only DAPA-HF. First-time recommendations explicitly identify a demo selection without personal history.

## Proposed Impiricus bridge

/impiricus separates illustrative engagement signals from actual current-session Cortana events. Product descriptions cite [Impiricus's public product page](https://impiricus.com/our-products), checked September 19, 2026. ION supplies intelligence for next actions; Pulse provides personalized resources via an opted-in SMS network; Spark triggers engagement journeys; Ascend connects HCPs to representatives and resources. Cortana supplements those roles.

The export contains schemaVersion, source, eventType, timestamp, round metadata, known concept IDs, categorized question counts, source IDs, attempted/correct practice counts and reinforcement topics. It excludes names, session/provider identifiers, cookies, credentials, raw answers and transcripts. The proposed schema is not an agreed Impiricus contract. Download is local; no Impiricus API, private data, partnership or endorsement is claimed.

## Limits

Question classification is heuristic and affected by phrasing and speech recognition. Browser observations are interaction metadata, not verified comprehension or tamper-proof assessment. Elapsed duration includes pauses and time away. The file fallback requires a single persistent Node process; Vercel retains shared Redis persistence and rate limiting. The P1 Medical Affairs aggregate and P2 extra specialties are deferred; P0 uses only actual activity and the existing source bundle.
