# Cortana

A voice-first clinical learning companion for physicians. Cortana delivers a shift briefing and a two-minute evidence round by phone or in the browser, and the server — never the model — decides what is correct.

Live at [cortana.health](https://cortana.health). Built at VT Hacks 2026.

> Educational prototype. Every patient, unit and briefing is synthetic. No clinical validation, accredited credit, HIPAA compliance, or patient-outcome claim.

## What it does

**It calls you.** Cortana rings a clinician with their morning briefing: the patient she would flag, what changed, who asked for review and by when. She answers questions from that briefing only, declines to advise on management, and can pass a message to the front desk when asked — reading it back for confirmation before sending. Dial the number yourself and she answers as a guest, with the briefing but no access to anyone's saved progress.

**It teaches.** A two-minute round on one real trial (DAPA-HF, NEJM 2019, and its JAMA diabetes subgroup): three briefing sections, a synthetic case, and a question graded against an answer key that never leaves the server. Ask something the sources do not establish and Cortana says so instead of inventing an answer.

**It remembers.** Practice history, XP awarded exactly once, streaks and review dates, all timezone-aware. Progress from a phone call appears in the browser, because both channels write to the same profile.

**It watches the call.** While Cortana is on the phone, the web page streams the transcript, labelled speaker by speaker, with a line whenever she acts — loading the briefing, grading an answer, sending a message.

## The rule behind the architecture

The model speaks. It never decides.

Grading, XP, streaks and review scheduling are computed on the server from stored state. The agent asks for a grade through a tool call and reads back what it is given. Scenario text, uploaded briefings and source excerpts are treated as data, never as instructions. An unclear spoken answer returns a request to clarify rather than a guess.

## Running it

```bash
npm ci
npm run dev -- --port 3100
```

Open http://localhost:3100. With no credentials at all, the full round runs in a clearly labelled text preview: no microphone, no network calls, no pretence of a live connection.

For live voice, copy `.env.example` to `.env.local`, add your ElevenLabs key and agent, then run `node scripts/prepare-local.mjs` to generate the session secret and demo access code. [ElevenLabs setup](docs/elevenlabs-setup.md) covers the agent side; [phone rounds](docs/phone-round.md) covers Twilio or a SIP carrier.

## Checks

```bash
npm run typecheck && npm run lint && npm run format:check
npm test          # 229 unit tests
npm run test:e2e  # 7 Playwright suites, expects a dev server on 3100
npm run test:a11y # WCAG scan of every view
```

CI runs all of these on every push and pull request.

## Layout

```
src/app/            routes and API endpoints
  api/phone/        outbound calls, agent tools, live status
  api/learning/     the round: stages, grading, completion
  api/prime/        daily three-question practice
  api/context/      uploaded synthetic scenarios
  api/email-summary/ optional Gmail morning briefing
src/lib/server/     session, storage, phone, email, auth — the authority
src/lib/content/    the round, the briefing library, spoken number forms
src/components/     views, the WebGL orb, voice controls
docs/               setup, agent prompts, tool contracts, verification
scripts/            agent configuration and verification tooling
tests/              unit tests, Playwright suites, fixtures
```

Storage is Upstash Redis in production and a local file adapter in development, behind one `withProgress` function that serialises each profile's read-modify-write with a distributed lock.

## Documentation

- [Architecture and request paths](docs/architecture.md)
- [Phone rounds](docs/phone-round.md) · [ElevenLabs setup](docs/elevenlabs-setup.md) · [tool contracts](docs/tool-contracts.md)
- [Browser agent prompt](docs/agent-prompt.md) · [phone agent prompt](docs/phone-agent-prompt.md)
- [Verification record](docs/verification.md) · [design](docs/design.md) · [product](docs/product.md)

## Name

"Cortana" is a Microsoft trademark for an AI assistant. A rename is planned before any non-demonstration use.
