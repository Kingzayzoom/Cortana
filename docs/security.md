# Security model

What each caller must prove, what the server refuses to trust, and the gaps a production version would close. This is a prototype's model, written down so it can be reviewed, not a certification.

## Callers and credentials

| Caller                   | Proves itself with                                                             | Can touch                                 | Checked in                         |
| ------------------------ | ------------------------------------------------------------------------------ | ----------------------------------------- | ---------------------------------- |
| The page                 | HMAC-signed HttpOnly profile cookie, plus a matching `Origin` on writes        | Its own profile                           | `session.ts`, `http.ts`            |
| Browser voice agent      | Nothing of its own: its client tools run in the page and use the page's cookie | Whatever the page can                     | same                               |
| Phone agent (outbound)   | Shared Bearer secret **and** a signed `{profile, run, expiry}` session         | One run on one profile, for 45 minutes    | `phone/session.ts`                 |
| Phone agent (inbound)    | Shared Bearer secret and the guest marker                                      | Briefing, topics, one front desk message  | `api/phone/tools/[tool]`           |
| Vercel Cron              | `CRON_SECRET` as a Bearer token                                                | Regenerating email briefings              | `api/email-summary/cron`           |
| Google (OAuth callbacks) | PKCE verifier and state in a signed, short-lived cookie                        | Linking an account to the current profile | `auth.ts`, `email-summary/auth.ts` |

Anything that costs money (a voice session, a phone call) additionally needs the demo access code and explicit consent in the request body.

## What the server does not trust

- **The model.** It cannot grade, reward, schedule or choose an email recipient. Tool arguments are validated with strict Zod schemas (unknown fields rejected), and an ambiguous answer is sent back for clarification rather than guessed.
- **The page.** A stage change is checked against the saved run; a late or replayed event from an old connection is refused (`409`). Rewards are computed on the server and granted once per request id.
- **Content given to the model.** Scenario files, briefings, inbox snippets and source excerpts are labelled in every prompt as data that can't issue instructions. Uploaded scenarios are size-limited on streamed bytes (64 KB), schema-validated and rendered as text.
- **Providers.** ElevenLabs, Resend, Google and Gemini error bodies are inspected only to pick one of our own messages. They are never forwarded to the client or written to logs beyond a short status line.

## Data kept

| Data                  | Where                       | Notes                                                                                             |
| --------------------- | --------------------------- | ------------------------------------------------------------------------------------------------- |
| Learning profile      | Redis (files locally)       | Progress, attempts, signals. Expires after 90 days without a write.                               |
| Phone number          | Nowhere                     | Used for one API call. Only the conversation id is kept.                                          |
| Learner questions     | Nowhere                     | Classified into a fixed category, then discarded.                                                 |
| Answer request bodies | Profile, as SHA-256 digests | For idempotent retries without keeping free text.                                                 |
| Gmail tokens          | Supabase                    | AES-256-GCM. The key is derived from the Supabase service key, so rotating it forces a reconnect. |
| Inbox briefing        | Supabase                    | Sender, subject, snippet and the generated summary; replaced daily.                               |

## Rate limits

Fixed windows, shared across instances through Redis (in-process only without it).

| Action                  | Limit                                       |
| ----------------------- | ------------------------------------------- |
| Place a phone call      | 8 per profile per 10 min, 30 per hour total |
| Front desk message      | 3 per profile (or all guests) per 10 min    |
| Start browser voice     | 6 per profile per minute, 40 per hour total |
| Phone tool calls        | 60 per profile per minute, 120 for guests   |
| Round and Prime actions | 90 per profile per minute                   |

## Response hardening

Every JSON API response is `Cache-Control: no-store, private`. Every page sends `nosniff`, `X-Frame-Options: DENY`, a strict referrer policy and a Permissions-Policy that allows the microphone to this origin only (`next.config.ts`). `npm run check:secrets` scans the built client bundle for every configured server secret.

## Known gaps

These are deliberate for a demo and would change before real use.

- **No user authentication for costly actions.** The demo access code is one shared secret. A production version needs real accounts and per-user quotas.
- **Anonymous profiles are bearer cookies.** Whoever holds the cookie is the profile. Google sign-in binds a profile to an account, but it is optional.
- **Anyone who dials the number can send a front desk email.** It goes only to the configured address, is read back first, and is capped at three per ten minutes across all callers.
- **No Content-Security-Policy.** See the comment in `next.config.ts`.
- **Email briefing rate limits are global**, not per user, and the Gmail session cookie is signed with the Google client secret rather than a dedicated key.
- **Without Redis, rate limits are per process** and profiles are local files, which is only correct for a single long-lived server.
- **No HIPAA or clinical validation claim.** Every patient and briefing is synthetic.
