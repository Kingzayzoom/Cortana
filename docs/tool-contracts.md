# Agent tools

Every tool an agent can call, and what the server does with it. The Zod schemas in `src/lib` are the source of truth; the ElevenLabs definitions in `voice-agents/` are generated from them (`npm run agent:export`). ElevenLabs accepts only a subset of JSON Schema (no `additionalProperties`, no length or format limits), so the exported definitions are looser than what the server enforces.

All tools wait for a response, with a 20-second timeout.

## Evidence round

Browser: client tools, relayed to `POST /api/learning` with the page's cookie. Phone: webhooks to `/api/phone/tools/:tool`.

| Tool                | Arguments                                      | Server behaviour                                                        |
| ------------------- | ---------------------------------------------- | ----------------------------------------------------------------------- |
| `get_round_context` | `roundId`                                      | Sections, the synthetic case, sources and the saved checkpoint          |
| `show_stage`        | `stageId`, optional `sectionId` (browser only) | Moves the checkpoint forward one step; skipping or rewinding is refused |
| `show_case`         | `caseId` (browser only)                        | Opens the case after the final section                                  |
| `show_evidence`     | one or two `sourceIds` (browser only)          | Opens stored sources; accepts no free content                           |
| `submit_answer`     | the learner's words as `answer`                | Grades against the stored key; "clarify" if no single option is named   |
| `complete_round`    | `roundId`                                      | Requires a graded answer; awards XP once and schedules the review       |
| `get_next_review`   | none (browser only)                            | The saved review date and reason                                        |

The model never supplies a request id, profile id, grade or XP. For browser tools the voice controller attaches a request id and reuses it on retry.

Stage order: `briefing (population → finding → limitation) → challenge → feedback → questions → completed`. Repeating the current stage is allowed, so a reconnect can replay it.

## Phone only

| Tool                 | Arguments                                                     | Server behaviour                                                           |
| -------------------- | ------------------------------------------------------------- | -------------------------------------------------------------------------- |
| `get_shift_briefing` | none                                                          | One briefing from the library, fixed for the call, with numbers pre-spoken |
| `get_topics`         | none                                                          | Which topics have a round; the agent offers only those                     |
| `email_front_desk`   | `reason`, `message`, optional `etaMinutes`, `confirmed: true` | Sends one email to the configured address; 3 per 10 minutes                |

These three are the only tools an inbound (guest) call can use.

## Context Feed

`get_context_summary`, `get_shift_context`, `get_primary_case`, `get_recent_changes`, `get_case_section`, `get_scheduled_events`, `get_hospital_timeline`, `get_education_triggers`. Read-only queries against the profile's active scenario (`lib/context/tools.ts`). Optional `caseId`; `get_case_section` also takes a `section`. Missing facts return a fixed sentence rather than an empty result.

## Prime

`get_prime_session`, `submit_prime_answer`, `get_prime_feedback`, `advance_prime`, `complete_prime` (`lib/prime/tools.ts`). Every call after the first names the `sessionId`, and a call for a session other than today's is refused. See [features/prime.md](features/prime.md).
