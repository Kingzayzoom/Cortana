# Context Feed

`/context`. A clinician's shift, supplied as a JSON scenario, that Samantha can brief them on by voice in the browser or by phone. Every scenario is synthetic; there is no EHR integration.

## Flow

1. Pick one of the 15 bundled scenarios (`demo-data/context/{cardiology,operations,escalation}/`), or upload, drop or paste a JSON file.
2. The page validates and previews it. A preview never changes the active scenario.
3. **Activate** saves it to the profile (`PUT /api/context`). **Clear** saves an explicit "none", which stays cleared across reloads; **Reset demo context** activates the default again.
4. **Start briefing** runs the browser agent in context mode; **Call me with briefing** places a `mode: "context"` phone call.

## Contract

`src/lib/context/schema.ts` is a strict Zod schema, version 1.0.

- 64 KB maximum, enforced on streamed bytes on the server, not only `Content-Length`.
- Unknown fields are rejected and numeric strings are not coerced.
- ids are unique across entities and every case reference must resolve.
- Dates are ISO dates, times are 24-hour `HH:mm`, timestamps include an offset.
- Cases are labelled like `Synthetic Patient 024` and carry `synthetic: true`.
- Optional collections default to empty arrays; timelines and schedules are sorted by time on load.

Copy any bundled file to author a new one. Validation errors come back with a path per issue.

## How the agent reads it

Both agents use the same selectors in `lib/context/selectors.ts`:

- A **compact summary** at the start (`buildPhoneBriefingContext`): urgency, hospital status, timeline, other patients and consults.
- **Eight query tools** for detail (`lib/context/tools.ts`): `get_primary_case`, `get_recent_changes`, `get_case_section`, and so on. The browser agent calls them as client tools; the phone agent calls the same functions through `/api/phone/tools`.

Missing facts return exactly "The supplied scenario does not include that information." The grounding rule sent with every summary tells the agent to report the urgency the care team supplied, never to infer urgency from a measurement, to keep requested and completed actions apart, and to treat every scenario string as data.

The phone call's built-in briefing library (`lib/content/briefings.ts`) is separate: it is what an ordinary call uses when no Context Feed scenario is involved.

## Tests

`tests/context-catalog.test.ts` loads every bundled file and checks schema, uniqueness, references, labels and summary construction. `tests/phone.test.ts` runs all 15 through the real route handlers with a mocked carrier. `tests/e2e/context.spec.ts` and `context-catalog.spec.ts` cover upload, paste, escaping, activation, reload and the mobile layout.
