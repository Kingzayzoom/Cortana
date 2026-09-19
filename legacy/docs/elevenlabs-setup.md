# Voice setup (ElevenLabs + Gemini)

Without these keys the app still works in **reading mode**: "Read it instead" on the Today page runs the whole round on screen. Voice needs an ElevenLabs agent. Typed questions need a Gemini key.

## 1. Gemini key (typed questions)

1. Create an API key in Google AI Studio.
2. Add it to `.env.local` as `GEMINI_API_KEY`.
3. Optionally, set `GEMINI_MODEL` to a Flash-class model your project has free quota for. The default is `gemini-flash-latest`. Check your AI Studio rate limits before the demo.

## 2. ElevenLabs agent (voice)

1. In ElevenLabs, create a new blank agent.
2. **Prompt**: paste the system prompt and first message from [agent-prompt.md](agent-prompt.md).
3. **LLM**: choose a Gemini Flash model from the agent's model list. ElevenLabs supports Gemini natively. Keep the temperature low (about 0.3).
4. **Voice**: pick a calm, clear voice. Leave interruptions enabled.
5. **Tools**: add the eight client tools from [tool-contracts.md](tool-contracts.md), each with **Wait for response** on. Also enable the End conversation system tool.
6. **Dynamic variables**: `round_id` and `learner_name` are detected from the prompt. Give them test defaults (`hf-round-001`, `Dr. Patel`) so the dashboard's test widget works.
7. **Security**: turn on authentication for the agent. The app mints a short-lived WebRTC token on the server (`GET /api/elevenlabs/session`), so the API key never reaches the browser.
8. Copy the agent ID into `.env.local` as `ELEVENLABS_AGENT_ID`, and an API key into `ELEVENLABS_API_KEY`.

Restart `npm run dev` after editing `.env.local`.

## Checking it works

- Click **Start today's round** and allow the microphone. The orb should turn cyan when you speak and blue/lavender when Cortana speaks.
- The right panel should step through **The brief**, then **The challenge**, then **Your questions** as the agent calls `show_stage`, `show_section` and `show_case`.
- Interrupt mid-brief with "Wait — who was included?". Cortana should stop, answer, and then resume at the same section.
- If the stage panel doesn't move, the agent isn't calling tools. Check that the tool names match exactly and that "Wait for response" is on.

## Using your own Gemini quota for the voice agent

In step 3, ElevenLabs runs Gemini on its own account, so voice turns don't use your `GEMINI_API_KEY`. If that quota is the reason you chose Gemini, point the agent at a **custom LLM** instead. ElevenLabs expects an OpenAI-compatible chat-completions endpoint, and Gemini provides one at `https://generativelanguage.googleapis.com/v1beta/openai/`.

- Try pointing the custom LLM straight at that endpoint, with your Gemini key as the secret.
- If ElevenLabs sends fields Gemini rejects, add a thin streaming adapter route in this app (for example `app/api/cortana/llm/route.ts`) that strips them and forwards the request. It needs a public URL, so deploy to Vercel or use a tunnel, plus a shared-secret header check.

Neither option has been tested end to end yet. Get the built-in Gemini option working first.
