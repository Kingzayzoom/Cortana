# ElevenLabs setup

## Local application

1. Run `npm ci`.
2. Copy `.env.example` to `.env.local` only if that file does not already exist. Preserve any teammate's configuration.
3. Set `ELEVENLABS_API_KEY` to the actual secret beginning with `sk_`, not a key ID. Set `ELEVENLABS_AGENT_ID` to the existing agent ID. Enable **Write access for ElevenAgents / Conversational AI (`convai_write`)** on that key; an agent read can succeed while token creation still fails without this permission.
4. Run `node scripts/prepare-local.mjs`. This adds a random demo access code and cookie signing secret without changing the provider fields. The code is saved in the ignored `.cortana/demo-access-code.txt` file for the demonstrator. Restart Next after changing configuration.
5. Run `npm run dev -- --port 3100` and open http://localhost:3100.
6. Run `node scripts/check-agent.mjs` for a read-only account/configuration check. The API key is never printed. Successful reads back up the existing agent configuration under ignored `.cortana/`.

## Configure the existing agent

First verify a base real voice session with `node scripts/verify-live-voice.mjs`. Then run `node scripts/configure-agent.mjs` to review the change and `node scripts/configure-agent.mjs --apply` to attach the prepared tools, learning prompt, dynamic variables and compact knowledge document. The script saves the prior configuration and exact patch under `.cortana/`, remembers created tool IDs for retries, and preserves the existing model and voice. Rehearse the full round after applying; configuration alone does not prove model tool use.

Use the existing agent model and voice; no additional language or speech provider is required. Confirm its model can invoke tools. Review the original agent configuration before changing it, and preserve unrelated teammate settings.

- Apply `agent-prompt.md` to its clinical learning behavior.
- Register and attach the seven Client tool definitions in `elevenlabs-tools.json`. Set all tools to wait for a result. Names are case-sensitive.
- Enable user interruptions in conversation flow. Limit the demonstration session to approximately 5 minutes to allow questions while limiting usage.
- Configure dynamic variables `round_id`, `section_id`, and `lesson_stage` with defaults `dapa-hf-01`, `population`, `briefing`. The browser passes the actual saved checkpoint at start.
- Use `docs/round-knowledge.md` as the compact knowledge document. Its generated contents come from the same TypeScript content bundle used by the app. Always keep this small document available to the agent (Prompt usage mode), or index it and verify retrieval if using RAG. Source retrieval is not proof of clinical correctness.
- Restrict answers to this bundle and retain the unsupported-question response. Do not enable browser-selected prompt, voice, or agent overrides.
- For a private agent, enable the appropriate authentication policy. The app uses a backend-minted WebRTC conversation token, not a signed WebSocket URL.
- Check provider retention settings. Cortana stores no raw microphone audio, but this does not imply that ElevenLabs stores none.

## Variables

All of these stay server-side:

| Variable                   | Purpose                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------ |
| `ELEVENLABS_API_KEY`       | Secret key that can access the selected agent and mint conversation tokens           |
| `ELEVENLABS_AGENT_ID`      | Single permitted agent                                                               |
| `CORTANA_DEMO_ACCESS_CODE` | Private code, at least 12 characters, required before a paid voice session           |
| `CORTANA_SESSION_SECRET`   | At least 32 random characters; signs demo-profile cookies                            |
| `CORTANA_DATA_DIR`         | Optional local persistent storage path; default `.cortana/`                          |
| `CORTANA_APP_ORIGIN`       | Optional exact external origin for a reverse proxy, e.g. `https://your-demo.example` |

No `NEXT_PUBLIC_` secret variables are used. `POST /api/elevenlabs/token` accepts `{ accessCode, runId, consent: true }` and returns `{ token, conversationId }`. The backend performs the provider GET; the browser never sees the server API key. Success and error responses are non-cacheable. The API validates app-session cookies, request origin, access code, run ID and consent. It limits starts to six per profile per minute and forty globally per hour in this single Node process. Those controls are suitable for a private prototype, not a replacement for deployed user authentication and distributed rate limiting.

## Verify a real conversation

Click Start → enter the private demo code → Agree & start voice → allow microphone access. Speak, watch input-driven motion, hear the assistant, and watch output-driven motion. Interrupt with “Who was included in that study?”, then ask to continue. Confirm the checkpoint is preserved. Mute and check that the input is actually disabled while output can still animate. Live Pause is hidden. The text preview can still pause. After a disconnect, Retry requests a fresh token and resumes the saved section. End and confirm the browser microphone indicator clears. Reconnect and test repeated clicks.

Do not call the integration verified until the account-side tools/grounding and an actual audio session pass this sequence. Missing or rejected credentials do not turn local preview into a live session.

Official references: [React SDK](https://elevenlabs.io/docs/eleven-agents/libraries/react), [WebRTC token](https://elevenlabs.io/docs/eleven-agents/api-reference/conversations/get-webrtc-token), [Conversation flow](https://elevenlabs.io/docs/eleven-agents/customization/conversation-flow), [Knowledge-base RAG](https://elevenlabs.io/docs/eleven-agents/customization/knowledge-base/rag), [API authentication](https://elevenlabs.io/docs/api-reference/authentication).
