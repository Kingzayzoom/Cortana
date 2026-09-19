import { readFile, appendFile, mkdir, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import nextEnv from "@next/env";
await mkdir(".cortana", { recursive: true });
nextEnv.loadEnvConfig(process.cwd());
let additions = "";
if (!process.env.CORTANA_SESSION_SECRET) {
  let secret;
  try {
    secret = await readFile(".cortana/.session-key", "utf8");
  } catch {
    secret = randomBytes(48).toString("hex");
  }
  additions += `\nCORTANA_SESSION_SECRET=${secret}\n`;
}
if (!process.env.CORTANA_DEMO_ACCESS_CODE) {
  const code = randomBytes(12).toString("hex");
  additions += `CORTANA_DEMO_ACCESS_CODE=${code}\n`;
  await writeFile(".cortana/demo-access-code.txt", code + "\n", {
    mode: 0o600,
  });
}
if (additions) await appendFile(".env.local", additions, { mode: 0o600 });
console.log(
  "Local session security is configured. Demo access code: .cortana/demo-access-code.txt. Existing ElevenLabs values were preserved.",
);
