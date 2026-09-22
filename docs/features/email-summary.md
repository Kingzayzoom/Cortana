# Email briefing

`/email-summary`. An optional, self-contained feature: connect a Gmail inbox read-only, and each morning Samantha writes a short briefing of what needs attention. It shares no storage with learning profiles and can be left unconfigured.

## What it can see

- Scope `gmail.readonly` only. It never sends, labels, moves or deletes mail.
- Up to 30 inbox messages from the last 30 hours, excluding spam, trash, promotions, social, forums and mailing lists.
- Sender, subject, snippet and date. Message bodies are never fetched.

Gemini receives those four fields per message, with an instruction to treat them as untrusted data, since anyone can email the clinician. The result is validated against a schema before it is stored.

## Storage

Supabase, two tables (`supabase/migrations/20260919000000_email_summary.sql`), reachable only with the service role key; browser roles have no grants. OAuth tokens are encrypted with AES-256-GCM before storage (`lib/server/email-summary/store.ts`). A new briefing replaces the previous one.

## Setup

1. Apply the migration: `node --env-file=.env.local scripts/apply-email-summary-migration.mjs --apply`.
2. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`, `GEMINI_API_KEY` and `CRON_SECRET`.
3. Enable the Gmail API on the Google project and register `GOOGLE_REDIRECT_URI` (`<origin>/api/email-summary/callback`) as a redirect URI, alongside the sign-in callback if the same client serves both. Local testing needs its own `localhost` redirect URI.
4. On Vercel, `vercel.json` schedules `/api/email-summary/cron` at 13:00 UTC, which is morning Eastern.

Rotating the Supabase service key changes the token encryption key, so every inbox must reconnect.

## Voice email drafting

A separate panel on the same page drafts an email from a spoken request. Browsers with speech recognition transcribe locally; Firefox records up to 20 seconds and sends the clip to Gemini (`/api/email-summary/transcribe`), which is stated before recording. The draft comes from a local template (`lib/email-summary/mock-draft.ts`). It doesn't read Gmail, create a draft or send anything.
