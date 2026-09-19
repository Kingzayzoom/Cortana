# Phone rounds

Cortana can call a learner and run the same two-minute round by phone. The lesson, the grading and the XP come from this server, exactly as in the browser. A phone has no browser, so the phone agent reaches the server through webhook tools instead of client tools.

```
Browser (/phone)  ──POST /api/phone/call──►  Cortana server  ──outbound call──►  ElevenLabs + Twilio  ──rings──►  learner
                                                   ▲                                    │
                                                   └───── webhook tools ────────────────┘
                                          get_round_context · submit_answer · complete_round
```

Each call carries a signed `phone_session` value that names one profile and one run, expires after 45 minutes, and is sent only inside tool requests. Every tool request must also carry `CORTANA_PHONE_TOOL_SECRET`. The learner's phone number is never stored; only the ElevenLabs conversation ID is.

## Setup

1. **Twilio:** buy a voice-capable phone number (a trial account includes one).
2. **ElevenLabs:** open **Phone Numbers → Import from Twilio** and enter the number with your Twilio Account SID and Auth Token. ElevenLabs holds those credentials; this app never sees them.
3. **Secrets:** run `node scripts/prepare-local.mjs` to add `CORTANA_PHONE_TOOL_SECRET` to `.env.local` if it isn't there.
4. **Public site:** the tools' URLs must be reachable by ElevenLabs without a login, so use the project's production domain. If Vercel Authentication is on, the agent receives a login page instead of the lesson: either allow production traffic under **Settings → Deployment Protection**, or create an **Automation Bypass** secret there and set `CORTANA_VERCEL_BYPASS` before configuring the agent, which adds the bypass header to every tool request.
5. **Create the phone agent:**

   ```bash
   node scripts/configure-phone-agent.mjs --url=https://your-app.vercel.app
   node scripts/configure-phone-agent.mjs --url=https://your-app.vercel.app --apply
   ```

   The first command only reviews and lists imported numbers. The second creates the "Cortana Phone" agent and its three webhook tools, copying the existing browser agent's model and voice. It never edits the browser agent, and it stores the created IDs in `.cortana/phone-agent.json` so repeat runs update instead of duplicating.

6. **Server settings:** set `ELEVENLABS_PHONE_AGENT_ID` and `ELEVENLABS_PHONE_NUMBER_ID` (both printed by the script) and `CORTANA_PHONE_TOOL_SECRET` in Vercel, then redeploy. Until all three are set, the `/phone` page says phone rounds are not configured and no call is attempted.
7. **Check the setup** at any point, without changing anything:

   ```bash
   node scripts/check-phone-setup.mjs --url=https://your-app.vercel.app
   ```

   It reports the imported numbers and their IDs, whether the phone agent exists, whether ElevenLabs can reach the site, and whether the deployed tool secret matches this machine's.

8. **Try it:** open `/phone`, enter a number in international format (`+15715550123`), the demo access code, and both confirmations.

## Trial accounts

A Twilio trial can only call numbers verified under **Verified Caller IDs**, and it plays a short trial notice before connecting, which the person has to acknowledge. Verify every phone you plan to call during a demo ahead of time, or upgrade the account to remove both limits.

## Limits and safety

- 3 calls per profile per 10 minutes, 12 per hour for the whole server.
- The call form requires the demo access code, an AI-voice disclosure, and a confirmation that the person answering agreed to the call.
- A tool request with a bad secret, a forged or expired session, or a session for a finished run is rejected; the agent is told to report the failure rather than pretend it worked.
- Spoken answers such as "I'd go with B" are matched to an option on the server. Anything naming two options, or none, comes back as a request to clarify: the model never picks for the learner.

## When something goes wrong

| Symptom                                                            | Cause                                                                                              |
| ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------- |
| "Phone rounds are not configured on this server."                  | One of the three phone settings is missing in the environment, or the deploy predates them         |
| "Twilio is on a trial account and can only call verified numbers." | Verify the number in Twilio, or upgrade                                                            |
| The agent says it could not load the round                         | Tool URL unreachable, wrong `CORTANA_PHONE_TOOL_SECRET`, or deployment protection is on the domain |
| "That round is no longer active."                                  | Another round was started after the call began; start a new call                                   |
| The call connects but nothing is saved                             | The agent's tools point at a different deployment than the one being watched                       |
