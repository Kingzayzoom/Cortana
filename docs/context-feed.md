# Context Drop-In

Open **Context Feed** at `/context`. The default is the bundled urgent-hypotension context for Dr. Zabish and Synthetic Patient 024.

1. Browse the 15 scenario cards using category, physician-urgency, and local text filters. Demo favorites appear first. Select **Preview**, or upload/drop one JSON file or expand **Paste JSON instead**.
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


## Bundled library

The library contains six cardiology scenarios, five operations scenarios and four escalation scenarios under `demo-data/context/{cardiology,operations,escalation}/`. Fixtures are deterministic, version-controlled JSON. `src/lib/context/catalog.ts` derives card/search metadata from validated fixtures; it does not duplicate clinical facts. Search covers title, specialty, tags, unit, summary, category and urgency labels. Three favorites appear first: urgent hypotension, morning shift and rapid-response activation.

**Reset demo context** activates the default catalog entry through the same profile persistence layer. Clearing still stays cleared until an explicit activation/reset. Previewing and dismissing a scenario never changes the active scenario. Existing saved scenarios remain intact until explicitly replaced.

The schema remains version 1.0. Backward-compatible optional additions are `physicianUrgency` (scenario, case and consult), `hospitalStatus`, consult `unit`, and `metadata.category`. These were necessary to represent supplied team requests and hospital status without inferring them from measurements. Older uploads remain accepted, with missing urgency reported as not supplied. All bundled cases contain explicit urgency; operations scenarios deliberately contain no urgent or immediate requests.

Web and phone summaries include the supplied urgency, hospital status, timeline, secondary cases and consults. Requests are never promoted to completed actions. No component, prompt or tool branches on a scenario ID; the only curated ID list controls demo-favorite ordering and the default selection.

### Judging sequence

1. Preview and activate **Heart failure / Urgent hypotension**. Ask ?What changed??, ?How urgently do they need me?? and ?What else is happening in the hospital?? The fixture supplies 118/72 to 88/56, the care-team request within 15 minutes, and the scheduled morning huddle.
2. Activate **Post-PCI observation / Stable**. Ask ?What changed?? It records no major overnight changes and routine morning review.
3. Activate **Rapid-response activation**. Ask ?How urgently am I needed?? The scenario explicitly requests immediate physician review following its recorded rapid-response activation.
4. Ask ?What is their blood type?? No bundled fixture supplies blood type. The grounding fallback remains exactly: ?The supplied scenario does not include that information.?

`tests/context-catalog.test.ts` discovers every bundled JSON file and validates schema, uniqueness, references, timestamps, synthetic labels, summary/phone construction, filters and favorite ordering. Phone route tests exercise all 15 through the real route handlers with a mocked outbound carrier. Browser tests cover filtering, preview, activation, switching, reset, persistence, keyboard focus and mobile layout. `scripts/verify-context-voice.mjs` checks the real web voice provider; no phone call is placed by automated tests.
