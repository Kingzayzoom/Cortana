# Browser voice setup

Connecting the in-page voice round to an ElevenLabs agent. For phone calls, see [phone-setup.md](phone-setup.md).

## 1. Credentials

1. Create an ElevenLabs API key with **ElevenAgents write access** (`convai_write`). A key without it can read an agent but can't mint a conversation token, and that only shows up when someone presses Start.
2. In `.env.local` (copy `.env.example`; don't overwrite a teammate's):

   ```bash
   ELEVENLABS_API_KEY=sk_...        # the secret, not the key id
   ELEVENLABS_AGENT_ID=agent_...
   ```

3. `node scripts/prepare-local.mjs` adds the session secret and a demo access code (also saved to `.cortana/demo-access-code.txt`). Restart the dev server after changing configuration.
4. `node scripts/check-agent.mjs` confirms the key can read the agent. It prints the agent's configuration, never the key.

## 2. Configure the agent

```bash
npm run agent:export                      # regenerate tools and knowledge from the code
node scripts/configure-agent.mjs          # review the change
node scripts/configure-agent.mjs --apply  # apply it
```

This sets the prompt from `voice-agents/browser/prompt.md`, attaches the 20 client tools and the knowledge document, and adds the dynamic variables the page passes at start (`round_id`, `section_id`, `lesson_stage`, `context_mode`). The agent's model and voice are left as they are. The previous configuration is backed up under `.cortana/`.

Also check, in the ElevenLabs dashboard:

- **Authentication** is on for the agent. The app connects with a server-minted WebRTC token, so a public agent isn't needed.
- **Overrides** from the client are off. The page never needs to change the prompt, voice or first message.
- **Data retention** suits your use. Samantha stores no audio; that says nothing about what ElevenLabs keeps.

## 3. Verify with a real conversation

Configuration alone doesn't prove the model uses its tools. With `npm run dev -- --port 3100`:

1. Start the round, enter the demo code, consent, allow the microphone.
2. Interrupt the briefing with "Who was included in that study?", then ask it to continue. The checkpoint should hold.
3. Answer the case; the grade must come from the server (the tool call shows in the transcript).
4. Mute: input stops, output continues. End: the browser's microphone indicator clears. Start again: a new token, resuming the saved section.

`node scripts/verify-live-voice.mjs --headed` drives the same sequence in a real browser.

## How the token works

`POST /api/elevenlabs/token` takes `{ accessCode, runId, consent: true }` and returns `{ token, conversationId }`. The server checks the cookie, origin, access code and that `runId` is the profile's current run, then fetches a single-use token from ElevenLabs. The API key never reaches the browser. Limits: 6 starts per profile per minute and 40 per hour overall.
