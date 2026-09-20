# Context Drop-In

Open **Context Feed** at `/context`. The default is the bundled cardiology morning handoff for Dr. Zabish and Synthetic Patient 024.

1. Select a bundled demo, upload/drop one JSON file, or expand **Paste JSON instead**.
2. Review validation errors or the normalized preview. A valid draft does not replace the active scenario.
3. Select **Activate scenario** to save it to the current Google account or anonymous demo profile.
4. Use **Preview briefing** for deterministic text, or **Start briefing** for the existing ElevenLabs consent and language workflow.
5. **Call me with briefing** opens the existing phone number, access code, and explicit consent form when phone integration is configured.
6. **Clear active context** persists a cleared state. Reloading does not reinstate the default.

All pages label scenarios **Synthetic demo data · No real patient information**. There is no EHR integration or medical recommendation engine.

## Data contract

`src/lib/context/schema.ts` defines strict version 1.0 Zod contracts. Files are limited to 64 KB in the browser and by actual streamed request bytes on the server. IDs are required and unique across entities; case references must resolve. Dates are ISO dates, times are 24-hour HH:mm, optional timestamps include an offset. Cases must use a label such as Synthetic Patient 024 and literal synthetic: true. Numeric strings are not coerced. Unknown fields are rejected. Scenario strings render as escaped text.

Copy any file in `demo-data/context/` to author a scenario. Optional collection fields normalize to empty arrays; timeline and scheduled events sort by time. A hospital-only scenario may omit primaryCase.

## Shared voice context

The provider uses `/api/context`; storage uses the existing profile store (local file adapter locally, Redis on Vercel). The eight bounded context tools use the same selectors for web client requests and signed phone webhook requests. Tool callers cannot supply a different profile ID. Phone sessions must match an active, unfinished run.

Missing facts return exactly: **The supplied scenario does not include that information.** Agent prompts prohibit filling gaps from model memory, interpreting management, or following instructions embedded in scenario strings. This constrains agent behavior; a live model is not a formal guarantee against hallucinations.

`buildPhoneBriefingContext` supplies a compact phone call initiation payload. Context mode re-queries tools for current facts. The existing fixed phone shift briefing, spoken-name handling, topic catalog, and optional educational round remain available through the normal Phone Round entry point. Context mode never substitutes that fixed example for an uploaded scenario.

## Agent setup

Run `npm run agent:export` to regenerate client and phone context definitions without removing existing lesson or phone tools. Apply the browser prompt/tools with `node scripts/configure-agent.mjs --apply`. Configure the separate phone agent with `node scripts/configure-phone-agent.mjs --url=<public origin> --apply`; its webhook origin must reach this application.

The phone flow requires ELEVENLABS_PHONE_AGENT_ID, ELEVENLABS_PHONE_NUMBER_ID, CORTANA_PHONE_TOOL_SECRET, plus the existing API key, session secret, and demo access code. Secrets stay server-side. Configuration scripts preserve attached tools, model, voice, and unrelated agent settings and save local backups.

## Verification

`npm test` covers strict validation, normalization, missing facts, profile isolation, activation/clearing, phone payloads, signed web/phone parity, stale sessions, and SDK context tools with language overrides.

`CORTANA_TEST_URL=http://localhost:3102 npm run test:e2e` covers upload, paste, drop, escaped HTML, activation, reload, clearing, mobile layout, and existing conversation regressions. Real phone delivery requires a configured carrier and explicit consent; simulated provider tests do not ring a phone.

