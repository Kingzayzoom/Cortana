# Verification record

Verified September 19, 2026 in the supplied Windows workspace. The active Git checkout is `.cortana/publish-checkout`; the updated development app runs at http://localhost:3102.

| Check                                     | Result                                                                               |
| ----------------------------------------- | ------------------------------------------------------------------------------------ |
| Baseline unit suite before implementation | 64 passed                                                                            |
| Final unit suite                          | 94 passed across 7 files                                                             |
| Full Playwright suite                     | 15 passed, including all 13 existing scenarios and 2 new signal scenarios            |
| Typecheck                                 | Passed                                                                               |
| ESLint                                    | Passed without warnings                                                              |
| Production build                          | Passed                                                                               |
| Accessibility                             | No detected WCAG 2 A/AA or 2.1 AA violations across all 7 main views                 |
| Responsive inspection                     | 1440, 1280, 768, 390 and 320 px; no settled horizontal overflow                      |
| Production smoke                          | Page render, signed-cookie progress mutation, no page errors; /dev/orb returns 404   |
| Client secret scan                        | 19 client assets; no configured API key, signing secret or private access code found |
| Focused security review                   | Completed; see security-review-learning-signals.md                                   |
| Legacy preservation                       | No changes under legacy/                                                             |

## Learning signal verification

The upstream Vercel/Redis commits through bc7c707 were incorporated before publication. The merged suite includes the nine upstream storage/deployment tests and a new test proving that learning signals and fingerprint privacy migration survive across independent server instances. Redis is tested with the repository emulator; no production database claim is made. Both the local-file and shared Redis paths preserve the existing backend.

Tests cover schema validation, unknown categories/concepts, structured event creation, deterministic grading signals, previous-miss reinforcement, transparent priorities, first-correct-not-reinforced, completion idempotence, evidence-open deduplication, elapsed duration, session isolation, replay across reload/reconnect, typed-message echoes, SDK interruption versus disconnect, empty history, supported-catalog selection and export shape.

The browser suite completes a real text-preview round, reloads it, replays completion, exports JSON and inspects /impiricus. It submits fictional PHI-like text as an ambiguous answer and checks that the persisted profile contains neither that text nor the marker. Cross-origin and forged-grade observations are rejected. A second profile sees no signal history.

A browser-discovered regression was corrected: the combined briefing concepts needed deduplication before strict validation. The corrected boundary has a unit regression test. Mobile viewport assertions wait for responsive navigation to settle; screenshots were re-captured after that transition.

## Real ElevenLabs verification

Full Chromium with actual host microphone permissions, the real SDK and no fake-media flags:

- Base live connection received the configured agent's greeting and remote audio. Independent orb input/output peaks were 0.584 and 0.381.
- Mute disabled live input tracks. End released all live microphone tracks and active peer connections. Reconnect created a distinct conversation with one live microphone and one active peer.
- Final full-round rehearsal submitted the population question through the live SDK: “Who was studied in this trial? Please show me the supporting source.”
- The agent answered, opened the source, progressed the briefing, showed the synthetic case and retrieved the deterministic correct grade for B.
- The agent's complete_round tool saved completion, 120 first-completion XP and the seven-day review.
- Saved activity contained one question_asked/study_population event, evidence views, an actual SDK briefing_interrupted event, section events, one challenge_attempted, one challenge_resolved and one round_completed. No concept_reinforced event was falsely generated for that first correct answer.
- No page errors were recorded. Teardown and reconnect passed after the full round.

This rehearsal used typed controls in a real voice session. The SDK interruption event occurred during typed interaction. It does not establish a deliberate human-spoken barge-in; that remains a short manual microphone rehearsal. The hosted model may wait between sections, so Continue remains available. The verifier now checks completion through Node-side polling and reports whether completion came from the agent tool or the existing UI control; the final run used the agent tool.

## Live versus conceptual

ElevenLabs voice, audio-reactive orb, server grading, evidence drawer, event persistence, learning metrics, reinforcement rules and local supported-round recommendation are working.

Impiricus is a proposed integration: factual public product roles, actual Samantha activity visualization and a locally downloaded schema 1.0 payload. There is no production Impiricus connection, private data, agreed external contract or partnership claim.

Snapshots: docs/assets/samantha-desktop.png, docs/assets/samantha-mobile.png, docs/assets/learning-signal-bridge-desktop.png and docs/assets/learning-signal-bridge-mobile.png. The bridge screenshots contain actual automated preview interactions, not inserted sample metrics; their short duration reflects the speed of that test.
