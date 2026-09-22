# Architecture

One rule shapes everything here: **the model speaks, the server decides.** Grades, XP, streaks and review dates are computed on this server from stored state. The voice agent asks through a tool call and reads back what it is told.

## The three surfaces

| Surface           | Who talks to whom                              | Tools                                                           |
| ----------------- | ---------------------------------------------- | --------------------------------------------------------------- |
| **Browser**       | ElevenLabs agent over WebRTC, in the page      | Client tools, executed in the browser, which also move the UI   |
| **Outbound call** | ElevenLabs calls the learner through a carrier | Webhook tools, called straight into this server                 |
| **Inbound call**  | Someone dials the number                       | The same webhook tools, with a guest marker and no write access |

A phone has no browser, so the phone agent cannot use client tools. That single fact explains why there are two agents and two tool sets.

## A browser round

```
page ──POST /api/learning────────────► stage rules, grading, XP  ──► Redis
  │                                                                  │
  └── ElevenLabs agent ── client tool ── show_stage/submit_answer ────┘
           (WebRTC, token minted by POST /api/elevenlabs/token)
```

The browser never sees the answer key. `POST /api/elevenlabs/token` mints a short-lived conversation token server-side so the API key stays out of the client bundle, which `scripts/check-client-secrets.mjs` verifies.

## An outbound call

```
/phone ──POST /api/phone/call──► creates a run, signs a session
                                 │
                                 └──► ElevenLabs ──► carrier ──► learner's phone
                                                                    │
 server ◄── POST /api/phone/tools/:tool ◄── agent ◄─────────────────┘
        (shared secret + signed session)
```

Every tool request carries two credentials:

1. **A shared secret** in the `Authorization` header, proving the request came from the configured agent rather than the open internet.
2. **A signed session** naming exactly one profile and one run, valid 45 minutes, generated when the call is placed. It is an HMAC over `{profile, run, expiry}` with the server's session secret, so it cannot be forged or repointed at another learner.

The learner's phone number is never stored. Only the ElevenLabs conversation ID is kept, which is what lets the page follow the call.

## An inbound call

A caller who dials the number has no profile, so no session can be signed for them. Their agent's tools carry a constant guest value instead. The server serves the briefing and the round from it, and refuses anything that would write to a learner's record: completion, XP, Prime and the context feed. Grading still runs on the server; it simply is not saved.

## Storage

`withProgress(profileId, operation)` is the only way progress is read or written.

- **Production:** Upstash Redis. Each profile is one JSON document.
- **Development:** a local file per profile under `.cortana/`.
- **Concurrency:** an in-process queue serialises one server's operations; a Redis lock covers several serverless instances at once. Without that lock, 6 of 12 concurrent writes are lost — there is a test that proves it.
- **Idempotency:** answer and completion requests carry a request ID with a stored fingerprint, so a retry returns the original result instead of grading twice or awarding XP twice.

Vercel gives serverless functions a read-only file system and no shared memory, so without Redis the deployment fails loudly with an explicit message rather than silently losing progress.

## Treating model input as data

Anything that reaches the model from outside — source excerpts, uploaded scenarios, briefing text — is labelled in the prompt as data that can never change behaviour or authorise a tool. The agent has fixed refusal lines for questions the sources do not answer, and for requests for management advice. Spoken answers are normalised to an option only when exactly one is named; "maybe B or C" returns a request to clarify rather than a guess.

## Where to look

| To understand            | Read                                                         |
| ------------------------ | ------------------------------------------------------------ |
| The authority rule       | `src/lib/learning/rules.ts`, `src/app/api/learning/route.ts` |
| Phone security model     | `src/lib/server/phone.ts` (session signing, guest boundary)  |
| Storage and concurrency  | `src/lib/server/store.ts`, `tests/vercel-storage.test.ts`    |
| What the agents are told | `docs/agent-prompt.md`, `docs/phone-agent-prompt.md`         |
| Tool contracts           | `docs/tool-contracts.md`, `docs/phone-tools.json`            |
