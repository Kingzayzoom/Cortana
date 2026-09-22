// Apply only after the base real voice connection passes verification.
// Reuses the selected agent and its model/voice. Existing unrelated settings survive.
import nextEnv from "@next/env";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { elevenlabs, isNotFound } from "./lib/elevenlabs.mjs";
nextEnv.loadEnvConfig(process.cwd());
const agentId = process.env.ELEVENLABS_AGENT_ID;
if (!agentId) throw new Error("ELEVENLABS_AGENT_ID is not set.");
const api = elevenlabs(process.env.ELEVENLABS_API_KEY, { timeoutMs: 20_000 });
// True when a document or tool still exists. Ones deleted in the dashboard stay
// referenced by the agent, and ElevenLabs then rejects the whole update.
const exists = (path) =>
  api(path).then(
    () => true,
    (error) => {
      if (isNotFound(error)) return false;
      throw error;
    },
  );
const apply = process.argv.includes("--apply");
const definitions = JSON.parse(
  await readFile("voice-agents/browser/tools.json", "utf8"),
);
const promptFile = await readFile("voice-agents/browser/prompt.md", "utf8");
const prompt = promptFile.match(/```text\r?\n([\s\S]*?)```/)?.[1]?.trim();
if (!prompt) throw new Error("Agent prompt text block is missing.");
// The provider echoes tool schemas back with its own defaults added and the
// keys reordered, so compare what the contract actually says.
function normalize(value) {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== "object") return value;
  // null, "", false and empty collections are the provider's "unset" values.
  const empty = (entry) =>
    entry === null ||
    entry === "" ||
    entry === false ||
    (Array.isArray(entry) && entry.length === 0) ||
    (entry &&
      typeof entry === "object" &&
      !Array.isArray(entry) &&
      Object.keys(entry).length === 0);
  return Object.fromEntries(
    Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => [key, normalize(entry)])
      .filter(([, entry]) => !empty(entry)),
  );
}
const sameContract = (a, b) =>
  JSON.stringify(normalize(a)) === JSON.stringify(normalize(b));

const agent = await api(`agents/${encodeURIComponent(agentId)}`);
await mkdir(".cortana", { recursive: true });
const backupPath = `.cortana/agent-before-integration-${Date.now()}.json`;
await writeFile(backupPath, JSON.stringify(agent, null, 2), {
  flag: "wx",
  mode: 0o600,
});
const existingPrompt = agent.conversation_config.agent.prompt;
const plan = {
  mode: apply ? "apply" : "review",
  agentName: agent.name,
  preservedModel: existingPrompt.llm,
  preservedVoice: Boolean(agent.conversation_config.tts.voice_id),
  tools: definitions.map((definition) => definition.tool_config.name),
  knowledge: "Samantha DAPA-HF 2026-09-19.1",
  backupPath,
};
console.log(JSON.stringify(plan, null, 2));
if (apply) {
  const statePath = ".cortana/agent-integration-state.json";
  const saved = await readFile(statePath, "utf8")
    .then(JSON.parse)
    .catch(() => ({ agentId, tools: {}, knowledge: null }));
  if (saved.agentId !== agentId)
    throw new Error(
      "Saved integration state belongs to a different agent. Review it before continuing.",
    );
  const save = () =>
    writeFile(statePath, JSON.stringify(saved, null, 2), { mode: 0o600 });
  const ids = new Set(existingPrompt.tool_ids ?? []);
  for (const definition of definitions) {
    const name = definition.tool_config.name;
    // Preserve existing tools. Reuse a matching attached tool only after checking its contract.
    let found = saved.tools[name];
    // These IDs were created by this integration, so update their exported contracts.
    if (found)
      // A tool deleted in the ElevenLabs dashboard is recreated below.
      await api(`tools/${found}`, "PATCH", definition).catch((error) => {
        if (!isNotFound(error)) throw error;
        ids.delete(found);
        found = undefined;
      });
    if (!found) {
      for (const id of existingPrompt.tool_ids ?? []) {
        const attached = await api(`tools/${id}`);
        if (attached.tool_config.name === name) {
          if (
            !sameContract(
              attached.tool_config.parameters,
              definition.tool_config.parameters,
            )
          )
            throw new Error(
              `Existing ${name} tool has a different schema. Review it before changing this shared tool.`,
            );
          found = id;
          break;
        }
      }
    }
    if (!found) found = (await api("tools", "POST", definition)).id;
    if (!found) throw new Error(`No tool ID returned for ${name}.`);
    saved.tools[name] = found;
    ids.add(found);
    await save();
  }
  if (
    saved.knowledge &&
    !(await exists(`knowledge-base/${encodeURIComponent(saved.knowledge.id)}`))
  )
    saved.knowledge = null;
  if (!saved.knowledge) {
    saved.knowledge = await api("knowledge-base/text", "POST", {
      name: plan.knowledge,
      text: await readFile("voice-agents/browser/knowledge.md", "utf8"),
    });
    await save();
  }
  const knowledge = [];
  for (const item of existingPrompt.knowledge_base ?? [])
    if (await exists(`knowledge-base/${encodeURIComponent(item.id)}`))
      knowledge.push(item);
  const patch = {
    conversation_config: {
      agent: {
        first_message:
          "Hello, I’m Samantha, your AI learning companion. Let’s take a moment with your briefing.",
        disable_first_message_interruptions: false,
        dynamic_variables: {
          dynamic_variable_placeholders: {
            context_mode: "round",
            ...agent.conversation_config.agent.dynamic_variables
              ?.dynamic_variable_placeholders,
            round_id: "dapa-hf-01",
            section_id: "population",
            lesson_stage: "briefing",
          },
        },
        prompt: {
          prompt,
          tool_ids: [...ids],
          knowledge_base: [
            ...knowledge.filter((item) => item.id !== saved.knowledge.id),
            {
              type: "text",
              id: saved.knowledge.id,
              name: saved.knowledge.name,
              usage_mode: "prompt",
            },
          ],
        },
      },
      conversation: {
        max_duration_seconds: 300,
        client_events: [
          ...new Set([
            ...agent.conversation_config.conversation.client_events,
            "audio",
            "interruption",
            "user_transcript",
            "agent_response",
            "agent_response_correction",
            "vad_score",
            "client_tool_call",
            "agent_tool_request",
            "agent_tool_response",
          ]),
        ],
      },
    },
  };
  await writeFile(
    ".cortana/agent-integration-patch.json",
    JSON.stringify(patch, null, 2),
    { mode: 0o600 },
  );
  await api(`agents/${encodeURIComponent(agentId)}`, "PATCH", patch);
  const verified = await api(`agents/${encodeURIComponent(agentId)}`);
  if (
    verified.conversation_config.agent.prompt.llm !== existingPrompt.llm ||
    verified.conversation_config.tts.voice_id !==
      agent.conversation_config.tts.voice_id
  )
    throw new Error(
      "The provider changed the model or voice unexpectedly; inspect the backup.",
    );
  console.log(
    JSON.stringify({
      applied: true,
      attachedTools: verified.conversation_config.agent.prompt.tool_ids.length,
      knowledgeDocuments:
        verified.conversation_config.agent.prompt.knowledge_base.length,
      modelAndVoicePreserved: true,
    }),
  );
}
