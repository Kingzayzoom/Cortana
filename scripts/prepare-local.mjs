// Fills .env.local with the secrets local development needs, keeping any value
// already set (under either the SAMANTHA_ or the older CORTANA_ name).
//   npm run setup:local
import { readFile, appendFile, mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import nextEnv from "@next/env";
import { setting } from "./lib/settings.mjs";
await mkdir(".cortana", { recursive: true });
nextEnv.loadEnvConfig(process.cwd());
let additions = "";
if (!setting("SESSION_SECRET")) {
  let secret;
  try {
    secret = await readFile(".cortana/.session-key", "utf8");
  } catch {
    secret = randomBytes(48).toString("hex");
  }
  additions += `\nSAMANTHA_SESSION_SECRET=${secret}\n`;
}
if (!setting("DEMO_ACCESS_CODE")) {
  const code = randomBytes(12).toString("hex");
  additions += `SAMANTHA_DEMO_ACCESS_CODE=${code}\n`;
  await writeFile(".cortana/demo-access-code.txt", code + "\n", {
    mode: 0o600,
  });
}
if (!setting("PHONE_TOOL_SECRET")) {
  // Shared secret the ElevenLabs phone agent sends back to this server's tools.
  additions += `SAMANTHA_PHONE_TOOL_SECRET=${randomBytes(24).toString("hex")}\n`;
}
if (additions) await appendFile(".env.local", additions, { mode: 0o600 });
console.log(
  "Local session security is configured. Demo access code: .cortana/demo-access-code.txt. Existing ElevenLabs values were preserved.",
);
