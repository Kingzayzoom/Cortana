# Samantha

**A voice assistant that calls clinicians.** Samantha phones a physician with their shift briefing, answers questions about it, and can pass a message to the front desk — hands-free, while they drive between hospitals. She answers when you call her, too.

Live at [cortana.health](https://cortana.health). Built at VT Hacks 2026.

> Educational prototype. Every patient, unit and briefing is synthetic. No clinical validation, accredited credit, HIPAA compliance, or patient-outcome claim.

## The call

Samantha rings and opens with the one thing worth knowing:

> "Good morning, Dr. Alvarez. It's Samantha with your morning briefing — one thing I'd flag on the step-down unit. Is now a good time?"

From there it is a conversation, not a menu:

- **She leads with what changed.** Which patient, what moved, who asked for review and how soon. About twenty seconds, then she asks what you want next rather than reading the whole chart at you.
- **She answers from the briefing only.** Ask something it does not contain and she says so. Ask what you should do and she declines to advise, then repeats what the briefing records and who requested the review.
- **You can interrupt her.** Cut in mid-sentence and she acknowledges it, answers what you asked, then offers back the thread you interrupted.
- **You can pause her.** Say "hold on" and she goes quiet until you say resume — no filling silence, no asking whether you are still there.
- **She can message the front desk.** "Tell them I'm running twenty minutes late." She reads it back, waits for a yes, and sends it. The address lives on the server, so she cannot be talked into mailing anyone else.
- **Call her back.** The number answers with the same briefing for anyone who dials it, without touching a learner's saved record.

Everything she says about a patient comes from a briefing this server handed her. She has no freedom to invent a value, and the prompt treats that briefing as data rather than instructions.

## Watching the call

One person holds the phone; everyone else watches the web app. The call page streams the conversation as it is transcribed, labelled speaker by speaker, with a line whenever Samantha acts — loading the briefing, sending the message, asking the server to grade something.

## Also in the app

The same voice, in the browser, teaches a two-minute evidence round: three short sections on one real trial (DAPA-HF, NEJM 2019, and its JAMA diabetes subgroup), then a synthetic case to apply it to. **The answer key never leaves the server.** The agent submits what you said and reads back the verdict it is given; an unclear answer returns a request to clarify rather than a guess.

Practice history, review scheduling and progress ride along behind that, and a call updates the same profile the browser does.

## The rule behind the architecture

The model speaks. It never decides.

Grading, scheduling and anything written to a profile are computed on this server from stored state. Scenario text, uploaded briefings and source excerpts are labelled as data that cannot change behaviour or authorise a tool. Phone tool calls must present a shared secret **and** a signed session naming one profile and one round.

[docs/architecture.md](docs/architecture.md) has the request path for each surface.

## Running it

```bash
npm ci
npm run dev -- --port 3100
```

With no credentials at all, the round runs in a clearly labelled text preview: no microphone, no network calls, no pretence of a live connection.

To make it call a phone, follow **[docs/phone-setup.md](docs/phone-setup.md)** — ElevenLabs, a carrier, the two agents, the environment variables, and every failure we hit with its fix.

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
src/app/api/phone/   placing calls, agent tools, live call status
src/app/api/learning/  the round: stages, grading, completion
src/lib/server/      session, storage, phone, email, auth — the authority
src/lib/content/     briefing library, the round, spoken number forms
src/components/      views, the WebGL orb, voice controls
docs/                setup guides, agent prompts, tool contracts
scripts/             agent configuration and verification tooling
tests/               unit tests, Playwright suites, fixtures
```

Storage is Upstash Redis in production and local files in development, behind one `withProgress` function that serialises each profile's writes with a distributed lock.

## Documentation

- **[Connecting a phone](docs/phone-setup.md)** — the full replication guide
- [Architecture](docs/architecture.md) · [tool contracts](docs/tool-contracts.md)
- [Phone agent prompt](docs/phone-agent-prompt.md) · [browser agent prompt](docs/agent-prompt.md)
- [ElevenLabs setup](docs/elevenlabs-setup.md) · [verification record](docs/verification.md)

## Name

"Samantha" is a Microsoft trademark for an AI assistant. A rename is planned before any non-demonstration use.
