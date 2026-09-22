# Source map

Where each piece lives, by layer. [docs/architecture.md](../docs/architecture.md) has the diagrams and the request flows.

Dependencies point down the table: pages use providers, providers call routes, routes call the domain, the domain uses the server infrastructure. Nothing in `lib/` imports from `app/` or `components/`.

## Presentation — `app/` and `components/`

| Path                         | What it is                                                                         |
| ---------------------------- | ---------------------------------------------------------------------------------- |
| `app/[[...view]]/page.tsx`   | One catch-all page that maps each path (`/`, `/phone`, `/context`, …) to a view    |
| `app/layout.tsx`             | Root layout; mounts the providers once so a voice session survives navigation      |
| `app/globals.css`, `styles/` | Plain CSS in cascade order, one file per area                                      |
| `components/layout/`         | App shell (sidebar, top bar) and Google account controls                           |
| `components/phone/`          | The call page: place a call, then watch its live transcript                        |
| `components/voice/`          | Voice controls, consent dialog, live transcript, and the WebGL orb                 |
| `components/learning/`       | The evidence round panel, evidence drawer, progress pages, settings, signal bridge |
| `components/context/`        | Context Feed: scenario library, upload and preview, briefing view                  |
| `components/prime/`          | Prime: the daily three-question practice set                                       |
| `components/email-summary/`  | Gmail morning briefing and the voice email drafting demo                           |
| `components/ui/`             | Primitives: button, dialog, and the vendored ElevenLabs orb shader                 |

## Client state — `lib/*/provider.tsx`

React contexts that own the page's copy of server state and talk to the API. They hold no authority: every change is a request the server can refuse.

| Provider                    | Owns                                                                             |
| --------------------------- | -------------------------------------------------------------------------------- |
| `lib/learning/provider.tsx` | The profile snapshot, the current round, and the text preview                    |
| `lib/voice/provider.tsx`    | The ElevenLabs browser session: connection, transcript, client tools, reconnects |
| `lib/context/provider.tsx`  | The active Context Feed scenario                                                 |
| `lib/prime/provider.tsx`    | Today's Prime set                                                                |

## HTTP boundary — `app/api/`

Thin handlers: check the caller, validate the body, call the domain, return JSON. Shared guards are in `lib/server/http.ts`.

| Route                             | Caller                 | Purpose                                                 |
| --------------------------------- | ---------------------- | ------------------------------------------------------- |
| `bootstrap`                       | page                   | Issue or read the profile cookie, return the snapshot   |
| `learning`                        | page, browser agent    | Every step of the evidence round                        |
| `elevenlabs/token`                | page                   | Mint a WebRTC token for the browser agent               |
| `phone/call`                      | page                   | Place an outbound call                                  |
| `phone/status`                    | page                   | Poll a call's live transcript                           |
| `phone/tools/[tool]`              | phone agents (webhook) | Every tool the phone agents can call                    |
| `context`, `context/tools/[tool]` | page, browser agent    | Active scenario; read-only scenario queries             |
| `prime`, `prime/tools/[tool]`     | page, browser agent    | Daily practice set                                      |
| `auth/google/*`, `auth/signout`   | page (navigation)      | Google sign-in                                          |
| `email-summary/*`                 | page, Vercel Cron      | Gmail connection, morning briefing, voice transcription |

## Domain — `lib/`

Decisions live here. Functions take a profile record inside a `withProgress` transaction and change it, or throw a `RequestError` the user can read.

| Path                          | Responsibility                                                                               |
| ----------------------------- | -------------------------------------------------------------------------------------------- |
| `lib/learning/`               | The evidence round: stage machine (`actions.ts`), grading, streaks, rewards (`rules.ts`)     |
| `lib/content/`                | Authored content: the round and its sources, the phone briefing library, spoken number forms |
| `lib/context/`                | Context Feed scenarios: schema, bundled library, selectors, the agent's query tools          |
| `lib/prime/`                  | Prime: question bank, daily selection, spaced review, grading                                |
| `lib/learning-signals/`       | Structured activity events, the reducer that turns them into concept status                  |
| `lib/adaptive-learning/`      | Picks the next round from those signals                                                      |
| `lib/impiricus/`              | Builds the exportable learning-signal payload (local download, no network)                   |
| `lib/validation/contracts.ts` | Zod schemas for `/api/learning` and the browser agent's tools                                |
| `lib/voice/`                  | Browser-side voice helpers: transcript merging, audio levels, error text, languages          |
| `lib/email-summary/`          | Types and the local email-draft template (no server code)                                    |

## Server infrastructure — `lib/server/`

Everything that touches a secret, a store or a provider. Server-only.

| Path             | Responsibility                                                                                 |
| ---------------- | ---------------------------------------------------------------------------------------------- |
| `store.ts`       | `withProgress`: the only way a profile is read or written (Redis in production, files locally) |
| `redis.ts`       | Upstash client, key namespacing, provider-error mapping                                        |
| `session.ts`     | Profile cookie, HMAC signing                                                                   |
| `http.ts`        | Origin check, rate limits, body parsing, JSON and error responses                              |
| `env.ts`         | Reads `SAMANTHA_*` settings with the `CORTANA_*` fallback                                      |
| `errors.ts`      | `RequestError`: a failure whose message is safe to show                                        |
| `auth.ts`        | Google sign-in (PKCE, ID token verification)                                                   |
| `elevenlabs.ts`  | Browser voice token                                                                            |
| `phone/`         | Phone session signing, outbound calls, the phone agents' tools, spoken-answer parsing          |
| `front-desk.ts`  | The one email a call can send                                                                  |
| `email-summary/` | Gmail OAuth, inbox fetch, Gemini summary, encrypted token storage in Supabase                  |
