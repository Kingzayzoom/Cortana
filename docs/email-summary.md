# Gmail morning briefing

This optional feature is available only on `/email-summary`. The morning
briefing requests only `https://www.googleapis.com/auth/gmail.readonly`.
Cortana never sends, modifies, labels, archives, moves, or deletes Gmail messages.

## Setup

1. Apply `supabase/migrations/20260919000000_email_summary.sql` to the Supabase
   project. The two tables use service-role access only; browser roles have no
   grants or RLS policies. Only the latest briefing is retained per connection.
2. Set `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
   `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_REDIRECT_URI`,
   `GEMINI_API_KEY`, and `CRON_SECRET` in `.env.local` for local development.
   Keep the service key, Google secret, Gemini key, and cron secret server-side.
3. Enable the Gmail API for the Google OAuth project. Register the exact
   `GOOGLE_REDIRECT_URI` as a Web application authorized redirect URI. For the
   custom domain in this project it is
   `https://www.cortana.health/api/email-summary/callback`.
   If this OAuth client also serves the app's existing Google sign-in, keep its
   existing `/api/auth/google/callback` redirect registered as well.
4. Set the same runtime variables in the deployed environment. The added
   `vercel.json` calls `/api/email-summary/cron` at 13:00 UTC daily. Vercel
   supplies `Authorization: Bearer <CRON_SECRET>` when that variable is set in
   its project settings. This is morning in Eastern time, with the actual
   invocation time depending on the hosting plan.

The manual refresh button calls the same server-side generation logic. Gmail
returns up to 30 recent inbox messages. The server reads metadata and snippets
only, rejects spam, trash, social, promotions, forums, and list mail, and uses
at most the last 30 hours. Gemini receives only sender, subject, snippet, and
date. Supabase stores those fields and the final JSON briefing; a new briefing
replaces the previous one. OAuth tokens are encrypted before storage. Rotating
the Supabase service key invalidates that encryption and requires reconnecting
Gmail.

For local OAuth testing, Google needs a separate localhost redirect URI and
`.env.local` must point to that exact local callback while testing locally.

## Mock voice email drafts

The drafting panel asks for a message with browser speech synthesis. Browsers
with built-in speech recognition transcribe directly. Firefox records up to 20
seconds and sends that clip to Gemini for transcription using the existing
`GEMINI_API_KEY`; Cortana does not store the audio. The page states this before
recording. A typing fallback remains available if microphone access is denied
or unavailable. A small local template creates an editable sample subject and
body from the request. Draft generation does not read Gmail, create a Gmail
draft, or send anything. It can be used without connecting Gmail.
