// Creates the agent that answers calls TO the Samantha number.
//   node scripts/configure-inbound-agent.mjs --url=https://your-app.vercel.app [--apply]
//
// Outbound calls name their agent explicitly, so they keep using Samantha Phone.
// Inbound has no caller profile, and ElevenLabs refuses a conversation whose
// tools reference a dynamic variable nobody supplied: these tools carry a fixed
// guest value instead, and the server only serves read-only briefing data for it.
import nextEnv from "@next/env";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { setting } from "./lib/settings.mjs";
import { elevenlabs, publicUrl as deployedUrl } from "./lib/elevenlabs.mjs";
nextEnv.loadEnvConfig(process.cwd());
const api = elevenlabs(process.env.ELEVENLABS_API_KEY);
const toolSecret = setting("PHONE_TOOL_SECRET");
const numberId = process.env.ELEVENLABS_PHONE_NUMBER_ID;
const publicUrl = deployedUrl();
const apply = process.argv.includes("--apply");
if (!toolSecret) throw new Error("SAMANTHA_PHONE_TOOL_SECRET is required.");
if (!/^https:\/\/[^/]+$/.test(publicUrl))
  throw new Error("Pass --url=https://your-app.vercel.app");

const GUEST = "guest-inbound-caller";
const tool = (name, description, properties = {}, required = []) => ({
  tool_config: {
    type: "webhook",
    name,
    description,
    response_timeout_secs: 20,
    api_schema: {
      url: `${publicUrl}/api/phone/tools/${name}`,
      method: "POST",
      request_headers: { Authorization: `Bearer ${toolSecret}` },
      request_body_schema: {
        type: "object",
        // A constant, not a dynamic variable: an inbound caller supplies none.
        properties: {
          session: { type: "string", constant_value: GUEST },
          ...properties,
        },
        required: ["session", ...required],
      },
    },
  },
});
const definitions = [
  tool(
    "get_shift_briefing",
    "Get the simulated shift briefing to read to the caller. Call this first and speak only what it returns.",
  ),
  tool(
    "get_topics",
    "List the learning topics that have a round behind them. Never offer a topic marked unavailable.",
  ),
  tool(
    "email_front_desk",
    "Send the caller's confirmed message to the preset hospital front desk. Read the message back and get a clear yes before calling this.",
    {
      reason: {
        type: "string",
        enum: ["running_late", "emergency", "other"],
        description: "Why the message is being sent.",
      },
      message: {
        type: "string",
        description:
          "What to tell the front desk, in the caller's own words. One or two sentences.",
      },
      etaMinutes: {
        type: "number",
        description: "Minutes until the caller expects to arrive, if given.",
      },
      confirmed: {
        type: "boolean",
        description:
          "True only after reading the message back and hearing clear consent to send it.",
      },
    },
    ["reason", "message", "confirmed"],
  ),
];

const promptFile = await readFile("voice-agents/inbound/prompt.md", "utf8");
const prompt = promptFile.match(/```text\r?\n([\s\S]*?)```/)?.[1]?.trim();
if (!prompt) throw new Error("Inbound agent prompt text block is missing.");

const state = await readFile(".cortana/inbound-agent.json", "utf8")
  .then(JSON.parse)
  .catch(() => ({ agentId: null, tools: {} }));
const phone = numberId ? await api(`phone-numbers/${numberId}`) : null;
const voice = process.env.ELEVENLABS_PHONE_AGENT_ID
  ? (await api(`agents/${process.env.ELEVENLABS_PHONE_AGENT_ID}`))
      .conversation_config
  : null;

console.log(
  JSON.stringify(
    {
      mode: apply ? "apply" : "review",
      publicUrl,
      willCreateAgent: !state.agentId,
      tools: definitions.map((d) => d.tool_config.name),
      number: phone?.phone_number ?? null,
      numberCurrentlyAnswers: phone?.assigned_agent?.agent_name ?? null,
    },
    null,
    2,
  ),
);
if (!apply) {
  console.log(
    "\nApply with --apply to create the agent and point the number at it.",
  );
  process.exit(0);
}

await mkdir(".cortana", { recursive: true });
const save = () =>
  writeFile(".cortana/inbound-agent.json", JSON.stringify(state, null, 2), {
    mode: 0o600,
  });
const toolIds = [];
for (const definition of definitions) {
  const name = definition.tool_config.name;
  const id = state.tools[name]
    ? (await api(`tools/${state.tools[name]}`, "PATCH", definition),
      state.tools[name])
    : (await api("tools", "POST", definition)).id;
  state.tools[name] = id;
  toolIds.push(id);
  await save();
}
const config = {
  name: "Samantha Inbound",
  conversation_config: {
    agent: {
      first_message: "Hi, it's Samantha here with your morning briefing.",
      language: "en",
      prompt: {
        prompt,
        llm: voice?.agent?.prompt?.llm ?? "gemini-2.0-flash",
        tool_ids: toolIds,
      },
    },
    conversation: { max_duration_seconds: 420 },
    turn: { turn_timeout: 15, merge_with_default_ignore_terms: true },
    ...(voice?.tts?.voice_id ? { tts: { voice_id: voice.tts.voice_id } } : {}),
  },
};
if (state.agentId)
  await api(`agents/${encodeURIComponent(state.agentId)}`, "PATCH", config);
else {
  state.agentId = (await api("agents/create", "POST", config)).agent_id;
  await save();
}
// Point the number's incoming calls at this agent. Outbound is unaffected:
// those requests name Samantha Phone explicitly.
if (numberId)
  await api(`phone-numbers/${numberId}`, "PATCH", { agent_id: state.agentId });
const after = numberId ? await api(`phone-numbers/${numberId}`) : null;
console.log(
  JSON.stringify(
    {
      applied: true,
      inboundAgentId: state.agentId,
      numberAnswersWith: after?.assigned_agent?.agent_name ?? null,
    },
    null,
    2,
  ),
);
