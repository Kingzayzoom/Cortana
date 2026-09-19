# Cortana

A voice-first cardiology learning workspace: listen, think, respond, grow. Built from the supplied white dashboard reference, with a procedural glowing orb inspired by the supplied ShaderGradient palette.

The active application is at the repository root, using `src/app/`. The previous CortexAi implementation, including its Gemini backend, is preserved under `legacy/` and excluded from this application's build and lint checks.

## Run

```powershell
npm ci
npm run dev -- --port 3100
```

Open **http://localhost:3100**. Port 3000 was already occupied in the development workspace. No ElevenLabs credentials are needed for the full, explicitly labeled local text preview.

For live voice, preserve your existing `.env.local`, add the actual `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID`, then run `node scripts/prepare-local.mjs`. This creates local session security without exposing secrets. Configure the existing agent using [ElevenLabs setup](docs/elevenlabs-setup.md), [agent instructions](docs/agent-prompt.md), and [tool contracts](docs/tool-contracts.md). The presence of frontend tools alone does not configure the ElevenLabs account.

## What works

- Responsive reference-based dashboard and working Today, My Rounds, Evidence Library, Learning Profile, Topics, and Settings views.
- Official ElevenLabs UI orb foundation with a luminous blue/cyan/violet/pink sphere material, true input/output level adapters, reduced motion, hidden-tab rendering controls and an explicit fallback.
- One stable ElevenLabs React provider, `POST /api/elevenlabs/token`, microphone mute, final-event transcript, interruption callbacks and saved section recovery. Pause is available only in local text preview.
- Three briefing sections, one synthetic case, deterministic server grading for text/buttons/agent tools, stored citation drawers, scoped questions and completion.
- Persistent local-server progress, exactly-once completion XP, actual practice history and timezone-aware review/streak rules.
- Explicit configuration/error states and local preview without fake connected or listening claims.

## Validation

```powershell
npm run typecheck
npm run lint
npm test
npm run test:e2e
node scripts/accessibility-check.mjs
npm run build
```

Browser tests expect a dev server at port 3100. Override with `CORTANA_TEST_URL` if needed. The tests cover the complete local flow, origin/schema rejection, profile isolation, duplicate requests, honest missing configuration, navigation, desktop/mobile layout, animated WebGL frames and the synthetic audio harness at `/dev/orb`. That harness is unavailable in production.

For real voice, the API key needs **Write access for ElevenAgents / Conversational AI (`convai_write`)** to mint a token; Read access alone is insufficient. `node scripts/verify-live-voice.mjs --headed` exercises the actual SDK, WebRTC and host microphone without fake audio. After that base connection succeeds, review `node scripts/configure-agent.mjs` and apply the prepared learning setup with `node scripts/configure-agent.mjs --apply`. Account changes are backed up under `.cortana/`; the model and voice are preserved.

For a production build locally: `npm run build`, then `npm start -- --port 3100`. Host this prototype on a single Node process with persistent storage; replace the file adapter and in-process rate limiter before multi-node or ephemeral hosting.

## Handoff

- [Demo sequence](docs/demo-script.md)
- [Implementation choices and limitations](docs/implementation-notes.md)
- [Verification results](docs/verification.md)
- [Agent tool JSON](docs/elevenlabs-tools.json)
- [Versioned knowledge document](docs/round-knowledge.md)
- [Environment variable template](.env.example)
- [Upstream orb license](vendor/elevenlabs-ui-LICENSE.md)

Educational prototype · Synthetic cases only. No claims of clinical validation, accredited credit, HIPAA compliance, or patient-outcome improvement.
