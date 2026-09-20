# Agent tools and server authority

Register all seven tools as **Client** tools. Set **Wait for response / expects_response = true** for every tool and a 20-second timeout. The names and parameter schemas must exactly match `src/lib/validation/contracts.ts`. The JSON file `docs/elevenlabs-tools.json` contains the corresponding provider tool configurations.

| Name                | Parameters                                                                                           | Result and authority                                                        |
| ------------------- | ---------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------- |
| `get_round_context` | `roundId: "dapa-hf-01"`                                                                              | Curated content, citations and checkpoint                                   |
| `show_stage`        | `stageId`: briefing, challenge or questions; optional `sectionId`: population, finding or limitation | Server validates ordered transitions and saves the checkpoint               |
| `show_case`         | `caseId: "hf-case-01"`                                                                               | Opens the stored synthetic case after the final briefing                    |
| `show_evidence`     | `sourceIds`: one or two of dapa-hf and dapa-diabetes                                                 | Opens stored evidence; accepts no arbitrary content                         |
| `submit_answer`     | Fixed roundId and questionId; actual answer (the app supplies the UUID)                              | Server grades and persists                                                  |
| `complete_round`    | Fixed roundId (the app supplies the UUID)                                                            | Server requires an answered case and questions stage; only server awards XP |
| `get_next_review`   | Empty object                                                                                         | Actual saved review date and reason                                         |

The provider export includes the names, fields, requiredness and accepted ID enums. ElevenLabs requires parameter descriptions and does not accept `additionalProperties`, string length/format or item-count constraints in the same form as Zod's full JSON schema. The runtime uses the original strict Zod schemas for all of those checks.

The four operations concerning lesson/progress do not trust the model to supply grades, XP, user IDs, or answer keys. Client tools are the transport bridge into the authenticated application backend. These are not direct anonymous provider webhooks. The signed HttpOnly app cookie identifies the demo profile; neither profile IDs nor scores can be chosen in a tool payload.

Transitions: `ready → briefing(population → finding → limitation) → challenge → feedback → questions → completed`. Repeating the current stage is allowed; skipping ahead or rewinding through late events is rejected. Interruptions leave the current section checkpoint unchanged. Live Pause is hidden; reconnect starts the saved section again. Text preview retains checkpoint pause.

Strict Zod schemas reject extra fields and unknown content IDs. The backend checks run IDs to reject stale events, stores request fingerprints to reject reuse with different payloads, returns the existing grade for a duplicate answer within a run, and grants completion XP once per content round. First completion earns 100 XP; a correct first graded attempt adds 20 XP. Later reviews add practice history without additional completion rewards.

Configure the agent's client events for user transcripts, agent responses/corrections, audio, interruption, VAD, and tool events. The installed SDK delivers final message-level `onMessage` records separately from internal tentative output; only the former populate the transcript. The model must invoke submit_answer for spoken grading. Browser buttons and text input reach the same backend function.

References: [Client tools](https://elevenlabs.io/docs/eleven-agents/customization/tools/client-tools), [Create tool API](https://elevenlabs.io/docs/eleven-agents/api-reference/tools/create), [React SDK](https://elevenlabs.io/docs/eleven-agents/libraries/react).

The model never generates idempotency UUIDs. The voice controller creates and reuses a UUID for each run, operation and validated semantic payload, then sends it to the strict server API. This fixes observed invalid model-generated UUIDs while preserving authoritative grading and duplicate-reward protection.
