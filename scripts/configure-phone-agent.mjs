// Creates (or updates) the ElevenLabs phone agent that calls learners.
// Review with `node scripts/configure-phone-agent.mjs`, apply with --apply.
// The browser agent is never modified; its model and voice are copied.
import nextEnv from "@next/env";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { setting } from "./settings.mjs";
nextEnv.loadEnvConfig(process.cwd());
const apiKey = process.env.ELEVENLABS_API_KEY;
const toolSecret = setting("PHONE_TOOL_SECRET");
const publicUrl = (
  process.argv.find((a) => a.startsWith("--url="))?.slice(6) ||
  setting("PUBLIC_URL") ||
  ""
).replace(/\/$/, "");
const apply = process.argv.includes("--apply");
if (!apiKey) throw new Error("ELEVENLABS_API_KEY is not set.");
if (!toolSecret || toolSecret.length < 32)
  throw new Error(
    "SAMANTHA_PHONE_TOOL_SECRET is missing or too short. Run: node scripts/prepare-local.mjs",
  );
if (!/^https:\/\/[^/]+$/.test(publicUrl))
  throw new Error(
    "Pass the deployed site's public origin, e.g. --url=https://your-app.vercel.app (ElevenLabs must reach it without a login).",
  );

async function api(path, method = "GET", body) {
  const response = await fetch(`https://api.elevenlabs.io/v1/convai/${path}`, {
    method,
    headers: { "xi-api-key": apiKey, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30000),
  });
  if (!response.ok) {
    const failure = await response.json().catch(() => null);
    // Validation locations only; never headers, raw bodies or secret values.
    if (response.status === 422 && Array.isArray(failure?.detail))
      console.log(
        JSON.stringify({
          validation: failure.detail.map(({ loc, msg, type }) => ({
            loc,
            msg: String(msg).replaceAll(apiKey, "[REDACTED]"),
            type,
          })),
        }),
      );
    throw new Error(
      `ElevenLabs ${method} ${path} failed (${response.status}). No credentials were logged.`,
    );
  }
  return response.json();
}

const promptFile = await readFile("docs/phone-agent-prompt.md", "utf8");
const prompt = promptFile.match(/```text\r?\n([\s\S]*?)```/)?.[1]?.trim();
if (!prompt) throw new Error("Phone agent prompt text block is missing.");
const definitions = JSON.parse(
  (await readFile("docs/phone-tools.json", "utf8"))
    .replaceAll("__PUBLIC_URL__", publicUrl)
    .replaceAll("__TOOL_SECRET__", toolSecret),
);
// Optional: lets the tools through Vercel's deployment protection when the
// project keeps it switched on (Settings -> Deployment Protection -> Automation Bypass).
const bypass = setting("VERCEL_BYPASS");
if (bypass)
  for (const definition of definitions)
    definition.tool_config.api_schema.request_headers[
      "x-vercel-protection-bypass"
    ] = bypass;

// Copy the existing agent's model and voice so both channels sound the same.
let llm = "gemini-2.0-flash",
  voiceId;
if (process.env.ELEVENLABS_AGENT_ID) {
  const web = await api(
    `agents/${encodeURIComponent(process.env.ELEVENLABS_AGENT_ID)}`,
  );
  llm = web.conversation_config.agent.prompt.llm ?? llm;
  voiceId = web.conversation_config.tts?.voice_id;
}
const numbers = await api("phone-numbers").catch(() => []);
await mkdir(".cortana", { recursive: true });
const statePath = ".cortana/phone-agent.json";
const saved = await readFile(statePath, "utf8")
  .then(JSON.parse)
  .catch(() => ({
    agentId: process.env.ELEVENLABS_PHONE_AGENT_ID || null,
    tools: {},
  }));
const existingAgent = saved.agentId
  ? await api(`agents/${encodeURIComponent(saved.agentId)}`)
  : null;
if (existingAgent) {
  await writeFile(
    `.cortana/phone-agent-before-integration-${Date.now()}.json`,
    JSON.stringify(existingAgent, null, 2),
    { mode: 0o600, flag: "wx" },
  );
  llm = existingAgent.conversation_config.agent.prompt.llm ?? llm;
  voiceId = existingAgent.conversation_config.tts?.voice_id ?? voiceId;
}

console.log(
  JSON.stringify(
    {
      mode: apply ? "apply" : "review",
      publicUrl,
      willCreateAgent: !saved.agentId,
      existingPhoneAgent: saved.agentId ?? null,
      copiedModel: llm,
      copiedVoice: Boolean(voiceId),
      tools: definitions.map((d) => d.tool_config.name),
      toolUrls: definitions.map((d) => d.tool_config.api_schema.url),
      importedPhoneNumbers: (Array.isArray(numbers) ? numbers : []).map(
        (n) => ({
          id: n.phone_number_id,
          number: n.phone_number,
          label: n.label,
          assignedAgent: n.assigned_agent?.agent_id ?? null,
        }),
      ),
    },
    null,
    2,
  ),
);
if (!apply) {
  console.log(
    "\nReview above, then apply with: node scripts/configure-phone-agent.mjs --url=<public origin> --apply",
  );
  process.exit(0);
}

const save = () =>
  writeFile(statePath, JSON.stringify(saved, null, 2), { mode: 0o600 });
const toolIds = new Set(
  existingAgent?.conversation_config.agent.prompt.tool_ids ?? [],
);
for (const definition of definitions) {
  const name = definition.tool_config.name;
  const existing = saved.tools[name];
  const id = existing
    ? (await api(`tools/${existing}`, "PATCH", definition), existing)
    : (await api("tools", "POST", definition)).id;
  if (!id) throw new Error(`No tool ID returned for ${name}.`);
  saved.tools[name] = id;
  toolIds.add(id);
  await save();
}

const config = {
  name: "Samantha Phone",
  conversation_config: {
    agent: {
      // No dynamic variable here: an inbound caller supplies none, and
      // ElevenLabs refuses the conversation if the first message needs one.
      // The agent greets by name in its next breath, once the briefing loads.
      first_message: "Hi, it's Samantha here with your morning briefing.",
      language: existingAgent?.conversation_config.agent.language ?? "en",
      prompt: {
        prompt,
        llm,
        tool_ids: [...toolIds],
        built_in_tools: {
          ...existingAgent?.conversation_config.agent.prompt.built_in_tools,
          // Lets the agent hold its tongue when asked to pause, instead of
          // filling the silence or ending the call.
          skip_turn: {
            name: "skip_turn",
            description:
              "Stay silent for this turn. Use while the clinician has asked you to wait, until they say to resume.",
            params: { system_tool_type: "skip_turn" },
          },
        },
      },
      dynamic_variables: {
        dynamic_variable_placeholders: {
          ...existingAgent?.conversation_config.agent.dynamic_variables
            ?.dynamic_variable_placeholders,
          context_mode: "round",
          context_briefing: "",
          learner_name: "Doctor",
          round_id: "dapa-hf-01",
          streak_days: "0",
          returning_learner: "no",
          // Inbound callers have no signed session; this value tells the
          // server they are a guest, and keeps the tools satisfied.
          phone_session: "guest-inbound-caller",
        },
      },
    },
    conversation: { max_duration_seconds: 420 },
    turn: {
      ...existingAgent?.conversation_config.turn,
      // Seven seconds of quiet was enough to make it talk over a thinking
      // clinician, and far too short to honour a pause.
      turn_timeout: 15,
      // Demos happen in loud rooms. Eager yielding meant a cough or a nearby
      // conversation stopped it mid-sentence, so it holds the floor normally
      // and the clinician steers in the gaps between short turns instead.
      turn_eagerness: "normal",
      // Backchannels like "mm-hmm" and "okay" should not count as interruptions.
      merge_with_default_ignore_terms: true,
    },
    asr: {
      ...existingAgent?.conversation_config.asr,
      // Short commands are the easiest words to mishear on a phone line.
      keywords: [
        "pause",
        "resume",
        "hold on",
        "wait",
        "stop",
        "continue",
        "front desk",
        "running late",
      ],
    },
    ...(voiceId ? { tts: { voice_id: voiceId } } : {}),
  },
};
if (saved.agentId) {
  await api(`agents/${encodeURIComponent(saved.agentId)}`, "PATCH", config);
} else {
  saved.agentId = (await api("agents/create", "POST", config)).agent_id;
  await save();
}
const verified = await api(`agents/${encodeURIComponent(saved.agentId)}`);
console.log(
  JSON.stringify(
    {
      applied: true,
      phoneAgentId: saved.agentId,
      attachedTools: verified.conversation_config.agent.prompt.tool_ids?.length,
      next: [
        `Set ELEVENLABS_PHONE_AGENT_ID=${saved.agentId} on the server and in Vercel.`,
        "Set ELEVENLABS_PHONE_NUMBER_ID to an imported Twilio number id listed above.",
        "Set SAMANTHA_PHONE_TOOL_SECRET in Vercel to the same value used here.",
      ],
    },
    null,
    2,
  ),
);
