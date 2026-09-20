# Email Summary changes

This document is the handoff for the optional Email Summary feature at
`/email-summary`. The live briefing connects to Gmail with read-only access.
The separate voice drafting demo creates editable sample text on the page; it
does not create a Gmail draft or send email. There is no Outlook integration.
The clinical learning flow and main dashboard behavior were not changed.

## What changed

| Area | Implementation |
| --- | --- |
| Navigation and page | Added an Email Summary navigation item and the `/email-summary` view. Feature UI and styles are scoped to this page. |
| Gmail connection | Added server-side Google OAuth start and callback routes. New authorization requests only `https://www.googleapis.com/auth/gmail.readonly`. A signed, HTTP-only cookie identifies the connected account. |
| Briefing | Reads at most 30 recent inbox messages, uses metadata and short snippets rather than message bodies or attachments, and excludes spam, trash, promotions, social, forums, and list/newsletter mail. Messages older than 30 hours are ignored. Gemini returns a structured JSON briefing with action items and priority notes. |
| Storage | Added Supabase `email_connections` and `email_summaries` tables. Gmail tokens are encrypted server-side before storage. The latest summary and its minimal source metadata are saved per connection; a new briefing replaces the previous one. Browser roles have no access to these tables. |
| Daily run | Added a protected cron route and `vercel.json` schedule at 13:00 UTC daily (8:00 EST or 9:00 EDT). The page also has a manual **Refresh now** button. |
| Mock drafting | Added local templates for a running-late message, a follow-up, and a general message. Users can edit the subject and body or copy the sample. No drafting route writes to Gmail. The demo works without a Gmail connection. |
| Voice input | Browsers with Web Speech recognition use that browser API. Firefox uses a short microphone recording sent to Gemini for transcription, then passes the text to the local mock draft generator. Cortana does not store the audio. Typing remains available. |

The main files are `src/components/email-summary/`,
`src/lib/server/email-summary/`, `src/lib/email-summary/`,
`src/app/api/email-summary/`, `supabase/migrations/20260919000000_email_summary.sql`,
and `vercel.json`. The existing navigation and catch-all page only gained an
Email Summary entry. `docs/email-summary.md` has additional implementation notes.

## Setup after pulling

1. From the `Cortana` directory, run `npm ci`. Copy `.env.example` to
   `.env.local` if a local file does not already exist. `.env.local` is ignored
   by Git and must be populated separately on each machine. Never commit keys,
   tokens, or a filled-in environment file.
2. Add the feature variables below to `.env.local`. The existing
   `.env.example` already names `GOOGLE_CLIENT_ID` and
   `GOOGLE_CLIENT_SECRET`, but it does not yet list the other Email Summary
   variables. Obtain real values from the team; do not substitute guessed
   values or reuse a different project's credentials.

   | Variable | Purpose |
   | --- | --- |
   | `SUPABASE_URL` | URL of the Supabase project containing the email tables. |
   | `SUPABASE_ANON_KEY` | Included in the requested environment setup; the current email server routes use the service role key instead. |
   | `SUPABASE_SERVICE_ROLE_KEY` | Server-side database access and encryption-key derivation for saved Gmail tokens. Keep private and consistent across instances. |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google OAuth Web application credentials. The same client may also serve existing Google sign-in. |
   | `GOOGLE_REDIRECT_URI` | Exact Email Summary callback registered in Google Cloud for the current origin. |
   | `GEMINI_API_KEY` | Server-side briefing generation and Firefox voice transcription. |
   | `CRON_SECRET` | At least 32 characters; authorizes the daily cron endpoint. Required where the scheduled job runs. |
   | `SUPABASE_PROJECT_REF`, `SUPABASE_ACCESS_TOKEN` | Needed only to apply or check the SQL migration through the Supabase Management API. They are not runtime variables for the feature. |

   If `CORTANA_APP_ORIGIN` is already set, ensure it includes the origin used
   in the browser; the manual refresh and Firefox transcription routes check
   the request origin. Set the corresponding runtime variables in the hosting
   environment as well. Keep all secrets server-side; do not use `NEXT_PUBLIC_`.
3. Apply `supabase/migrations/20260919000000_email_summary.sql` to any new
   Supabase project. The migration can be run in the Supabase SQL Editor or
   with the repository script. The script checks that `SUPABASE_PROJECT_REF`
   matches `SUPABASE_URL` before sending SQL:

   ```sh
   node --env-file=.env.local scripts/apply-email-summary-migration.mjs --check
   node --env-file=.env.local scripts/apply-email-summary-migration.mjs --apply
   ```

   The service role key alone cannot create the tables. A project that already
   has both tables does not need the migration applied again.
4. In the Google Cloud project for `GOOGLE_CLIENT_ID`, enable the Gmail API and
   register the exact Email Summary callback as an **Authorized redirect URI**.
   For local development on port 3000, use
   `http://localhost:3000/api/email-summary/callback` in `.env.local` and in
   Google Cloud. For the custom production domain, use
   `https://www.cortana.health/api/email-summary/callback` in production and
   in Google Cloud. Keep the application's existing Google sign-in callback
   registered too. The OAuth app audience must allow the accounts that will
   connect Gmail.
5. Configure the deployed environment and scheduler. `vercel.json` invokes
   `/api/email-summary/cron` daily; the route requires
   `Authorization: Bearer <CRON_SECRET>`. On Vercel, set `CRON_SECRET` in the
   project settings so its cron request includes that header
   ([Vercel documentation](https://vercel.com/docs/cron-jobs/manage-cron-jobs)).
   On another host, schedule the same authenticated GET request. The manual
   refresh works independently of the scheduler.

## Quick verification

Run `npm run dev`, open `/email-summary`, and connect a Gmail account. Confirm
Google shows the read-only Gmail permission, the callback returns to the page,
and **Refresh now** creates a briefing. The mock draft panel should work with
or without Gmail connected. In Firefox, tap the Cortana icon, allow microphone
access, wait for **Listening**, speak, then tap again; review the editable
sample. The page explains that Firefox sends the short recording to Gemini for
transcription. No audio is stored by Cortana, and no email is created or sent.

Relevant checks:

```sh
npm test -- tests/email-summary.test.ts tests/email-summary-voice.test.tsx tests/email-summary-transcribe.test.ts
npm run typecheck
npx eslint src/components/email-summary src/lib/email-summary src/lib/server/email-summary src/app/api/email-summary tests/email-summary.test.ts tests/email-summary-voice.test.tsx tests/email-summary-transcribe.test.ts
```

The three Email Summary test files passed (10 tests) in the last verification,
along with TypeScript and scoped ESLint checks. The tests mock the Gemini
response and browser microphone, so a real Gmail connection and Firefox
microphone still need the manual check above in each environment.

## Operational notes

- Gmail access in this implementation is read-only. It does not send, modify,
  delete, archive, move, or label messages. Disconnecting Gmail removes the
  saved connection and its briefing through the database relationship.
- The mock draft does not call Gmail or save anything to Supabase. Firefox
  audio is sent to Gemini solely to get text for that local sample draft.
  [Browser-native speech recognition](https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition)
  may also use the browser vendor's service; it should not be assumed to run
  entirely on the device.
- Changing `SUPABASE_SERVICE_ROLE_KEY` changes the derived token encryption
  key. Existing Gmail connections then need to be reconnected.
- Accounts that authorized an earlier Gmail drafting prototype may still have
  an old Google `gmail.compose` grant. This code neither requests nor uses it.
  Removing that prior grant requires revoking Cortana's Google access and then
  reconnecting Gmail read-only, which temporarily interrupts the live briefing.
