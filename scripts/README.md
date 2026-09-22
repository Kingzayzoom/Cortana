# Scripts

Operational tooling. None of it is imported by the app. Each script loads `.env.local`, prints JSON or a checklist, and never prints a secret.

## Setup

| Script                              | Does                                                                                                               |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `prepare-local.mjs`                 | Generates the session secret, demo access code and phone tool secret into `.env.local`, keeping values already set |
| `apply-email-summary-migration.mjs` | Applies the Supabase migration for the email briefing (`--check` or `--apply`)                                     |

## ElevenLabs agents

All three review by default and change nothing until `--apply`. See [voice-agents/](../voice-agents/README.md).

| Script                        | Does                                                                                                             |
| ----------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `export-agent.ts`             | `npm run agent:export`: regenerates tool definitions and the knowledge document from the Zod schemas and content |
| `configure-agent.mjs`         | Applies the browser agent's prompt, client tools and knowledge document                                          |
| `configure-phone-agent.mjs`   | Creates or updates **Samantha Phone** (outbound calls)                                                           |
| `configure-inbound-agent.mjs` | Creates or updates **Samantha Inbound** and points the number at it                                              |
| `check-agent.mjs`             | Read-only: prints the browser agent's live configuration                                                         |
| `check-phone-setup.mjs`       | Read-only: walks the phone checklist, including whether the deployed tools answer                                |

## Verification

| Script                     | Does                                                                                                                 |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------- |
| `check-client-secrets.mjs` | `npm run check:secrets`: scans the built client bundle for every configured server secret                            |
| `accessibility-check.mjs`  | `npm run test:a11y`: axe WCAG 2.1 AA scan of every view                                                              |
| `production-smoke.mjs`     | Against `next start` on port 3101: page renders, a round starts, `/dev/orb` is 404; refreshes the README screenshots |
| `verify-live-voice.mjs`    | Drives a real browser voice session end to end (needs a microphone, or `--fixture-audio`)                            |
| `verify-context-voice.mjs` | Same, for a Context Feed briefing                                                                                    |
| `verify-prime-voice.mjs`   | Same, for a Prime session                                                                                            |

The `verify-*` scripts spend real ElevenLabs minutes. Unit and Playwright suites never do.

## `lib/`

- `settings.mjs` — reads `SAMANTHA_*` with the `CORTANA_*` fallback, like `src/lib/server/env.ts`.
- `elevenlabs.mjs` — the small API client the configure scripts share.
