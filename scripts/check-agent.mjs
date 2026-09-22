// Read-only: prints the browser agent's live configuration and keeps a
// one-time backup in .cortana/. The API key is never printed.
import nextEnv from "@next/env";
import { mkdir, writeFile } from "node:fs/promises";
nextEnv.loadEnvConfig(process.cwd());
const key = process.env.ELEVENLABS_API_KEY,
  id = process.env.ELEVENLABS_AGENT_ID;
if (!key || !id) {
  console.log(JSON.stringify({ configured: false }));
  process.exit(0);
}
const response = await fetch(
  `https://api.elevenlabs.io/v1/convai/agents/${encodeURIComponent(id)}`,
  { headers: { "xi-api-key": key }, signal: AbortSignal.timeout(15000) },
);
if (!response.ok) {
  const detail = (await response.text())
    .replaceAll(key, "[REDACTED]")
    .replaceAll(id, "[AGENT]");
  console.log(
    JSON.stringify({
      reachable: false,
      status: response.status,
      detail: detail.slice(0, 1500),
    }),
  );
  process.exitCode = 1;
} else {
  const agent = await response.json();
  await mkdir(".cortana", { recursive: true });
  await writeFile(
    ".cortana/agent-config-backup.json",
    JSON.stringify(agent, null, 2),
    { mode: 0o600, flag: "wx" },
  ).catch((error) => {
    if (error.code !== "EEXIST") throw error;
  });
  const config = agent.conversation_config;
  console.log(
    JSON.stringify(
      {
        reachable: true,
        name: agent.name,
        model: config?.agent?.prompt?.llm,
        voiceConfigured: !!config?.tts?.voice_id,
        tools: config?.agent?.prompt?.tool_ids || config?.agent?.prompt?.tools,
        knowledgeBase: config?.agent?.prompt?.knowledge_base?.map((k) => ({
          id: k.id,
          name: k.name,
          type: k.type,
          usage_mode: k.usage_mode,
        })),
        firstMessage: config?.agent?.first_message,
        prompt: config?.agent?.prompt?.prompt,
        turn: config?.turn,
        conversation: config?.conversation,
        authEnabled: agent.platform_settings?.auth?.enable_auth,
        overrides: agent.platform_settings?.overrides,
      },
      null,
      2,
    ),
  );
}
