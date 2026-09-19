# Tool contracts

Every tool is an ElevenLabs **client tool**, so it runs in the browser. Client tools work on `localhost` with no public webhook URL, and the ones that need the server (grading) call the Next.js API themselves. Correctness is still decided on the server, and the answer key never reaches the browser.

Handlers live in `components/today/round-experience.tsx`, and parameters are validated with Zod in `lib/validation/tools.ts`. **Tool and parameter names must match exactly.**

Configure each tool in the agent's tool settings as a client tool, with **Wait for response** turned on. Every tool returns a string: either JSON, or text starting with `error:` that explains what to do instead.

| Tool | Parameters | What it does |
| --- | --- | --- |
| `get_round_context` | `round_id` (string, optional) | Returns the round's briefing sections, case (question and options), sources, and a `checkpoint` (stage, current section, whether the answer is graded). Contains no answer key. |
| `show_stage` | `stage` (string, required): `briefing`, `challenge` or `questions` | Moves the round forward. `questions` is refused until an answer is graded. Stages never move backward. |
| `show_section` | `section_id` (string, required): `study`, `finding` or `limitation` | Highlights a brief section on screen and checkpoints it, so the round resumes there after an interruption. Returns that section's points. |
| `show_case` | `case_id` (string, required): `hf-case-001` | Animates the synthetic case card in and returns its content. |
| `show_evidence` | `source_ids` (string, required): comma-separated, e.g. `src-dapa-hf` | Opens the evidence drawer without interrupting the call. Unknown ids are rejected. |
| `submit_answer` | `answer` (string, required): A–D; `confidence` (string, optional): `guessing`, `somewhat` or `very` | Sends the answer to `POST /api/rounds/[roundId]/answer` for grading against the stored key. Records the attempt. Returns correctness, the correct option, rationale and source ids. Idempotent: once graded, it returns the same result. |
| `complete_round` | `round_id` (string, optional) | Awards XP, updates the streak and returns the summary plus the next review. Refused before an answer is graded. Idempotent per day. |
| `get_next_review` | none | Returns the recommended next topic and a plain-language reason. |

## Parameter descriptions to paste

These descriptions tell the LLM how to fill each parameter.

- **round_id**: "The round id from the system prompt, e.g. hf-round-001."
- **stage**: "One of: briefing, challenge, questions."
- **section_id**: "The section_id from get_round_context's briefing_sections, in order."
- **case_id**: "The case_id from get_round_context's case."
- **source_ids**: "Comma-separated source_id values from get_round_context's sources."
- **answer**: "The learner's chosen option letter: A, B, C or D."
- **confidence**: "Only if the learner stated it: guessing, somewhat or very."

## Also enable

- The **End conversation** (`end_call`) system tool, so the agent can hang up after step 7 of the prompt.
- **Interruptions**, which are on by default. They're the core of the demo.

## How the app handles input that doesn't come through a tool

- **Clicked or typed answers.** The app grades these directly through the same API, then sends `My answer is X.` into the conversation. The agent's `submit_answer` call gets the cached grade and explains it aloud. Either way there's one grading path.
- **Typed questions while voice is connected.** These go into the conversation as user messages.
- **Typed questions with voice off.** These go to `POST /api/rounds/[roundId]/ask`, where Gemini answers from the round's evidence only.
