# Cortana

**Clinical learning that talks back.** Cortana is a daily two-minute clinical round for healthcare professionals, built around three steps:

1. **The brief:** a short spoken summary of curated evidence. You can interrupt it at any time.
2. **The challenge:** apply that evidence to a synthetic case.
3. **Your questions:** ask anything, and get answers grounded only in the round's sources.

Correct answers are decided by code, never by the model. Progress feeds a Learning Pulse, a streak and a rule-based "up next" recommendation.

The work is split across three pieces:

| Piece | Role |
| --- | --- |
| **ElevenLabs** | The voice layer: microphone, turn-taking, interruptions and speech, over WebRTC |
| **Gemini** | The reasoning layer: the voice agent's LLM, plus grounded answers to typed questions |
| **Cortana (this app)** | Lesson state, the evidence bundle, grading, progress and the UI |

> **Prototype.** The medical content in `lib/content/` is based on real sources (DAPA-HF, NEJM 2019; the 2022 AHA/ACC/HFSA guideline) but is marked *pending clinician review*. Verify every figure before any clinical or public use. Cases are synthetic, and this is not clinical advice.

## Quick start

```bash
npm install
cp .env.example .env.local   # optional: add keys (see below)
npm run dev                  # http://localhost:3000
```

With **no keys at all**, choose **Read it instead** to run the whole round on screen: brief, case, grading, evidence and completion.

| Feature | Needs |
| --- | --- |
| Voice rounds (the orb, interruptions) | `ELEVENLABS_API_KEY` and `ELEVENLABS_AGENT_ID`, plus the agent set up per [docs/elevenlabs-setup.md](docs/elevenlabs-setup.md) |
| Typed questions with voice off | `GEMINI_API_KEY` |

## Scripts

| Command | Does |
| --- | --- |
| `npm run dev` | Dev server |
| `npm run build` / `npm start` | Production build and server |
| `npm test` | Unit tests for grading, the lesson state machine, XP, streaks and review rules |
| `npm run lint` | ESLint |
| `npm run typecheck` | Generates Next route types, then runs `tsc` |

## How it fits together

```
Browser (Next.js + React)
 ├─ Orb ← real mic/speaker levels (getInputVolume / getOutputVolume)
 ├─ Lesson state machine  (ready → briefing → challenge → feedback → questions → completed)
 ├─ Client tools ◄──────────── ElevenLabs agent (WebRTC) ── LLM: Gemini
 │    show_stage · show_section · show_case · show_evidence
 │    get_round_context · submit_answer · complete_round · get_next_review
 └─ Progress (localStorage for now)
        │
Server routes
 ├─ GET  /api/elevenlabs/session        mints a WebRTC conversation token
 ├─ POST /api/rounds/[roundId]/answer   deterministic grading (answer key is server-only)
 └─ POST /api/rounds/[roundId]/ask      Gemini, grounded in the round's evidence only
```

Some deliberate design choices:

- **Three separate state machines.** Connection, voice and lesson state are tracked independently. "Someone is speaking" says nothing about where the round is.
- **One grading path.** Voice, clicks and typed answers all go to the same API. The model only explains the result.
- **Citations can't be invented.** Source ids from Gemini or the agent are checked against the round's evidence bundle before anything reaches the screen.
- **Checkpointed brief.** `show_section` records where the brief is, so after an interruption it resumes at the same section instead of restarting.
- **No fake mastery scores.** The UI shows real practice results ("2 / 3 correct") and a reason for each review recommendation.

## Project layout

```
app/                    pages (Today, My Rounds, Evidence, Profile) and API routes
components/
  today/                round-experience.tsx: the core loop and the ElevenLabs tools
  voice/                orb wrapper, voice controls, transcript
  learning/             brief, case, feedback, evidence drawer, questions, completion
  dashboard/            Today's Round, Learning Pulse, streak, up next
  ui/orb.tsx            official ElevenLabs UI Orb (vendored, not linted)
lib/
  content/              rounds, cases, sources; answer-keys.ts is server-only
  learning/             lesson reducer, grading, progress/XP/streaks, review rules
  gemini/ elevenlabs/   server-only API clients
  voice/                voice state and audio-level hook
  progress/             localStorage store and sample history
docs/                   agent prompt, tool contracts, setup, demo script
tests/                  vitest unit tests
```

## Notes

- **Name.** "Cortana" is also Microsoft's assistant name and trademark. The name lives in one constant (`APP_NAME` in `lib/config.ts`), so renaming (for example to "Cortex") is a one-line change.
- **Dev StrictMode is off** (`next.config.ts`). React StrictMode's dev double-mount blanks the orb's WebGL canvas. Production isn't affected.
- **Persistence** is browser-local for the demo profile. `lib/learning/progress.ts` contains pure rules, so swapping `lib/progress/store.ts` for a Supabase-backed store later doesn't change the logic.

## Next steps

Confidence-aware review is already in: a confident miss is flagged as a possible misconception. Stretch goals, in order: teach-back grading with Gemini structured output, more rounds and topics, a hands-free mode, Supabase persistence and auth, a custom-LLM bridge so voice runs on your own Gemini quota, and multimodal chart explanations.
