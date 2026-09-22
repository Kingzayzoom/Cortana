// Scans the built browser bundle (.next/static) for the values of every server
// secret configured in this environment. Run after `npm run build`.
//   npm run check:secrets
// A hit means a server-only value reached client code. Values are never printed.
import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
import { setting } from "./lib/settings.mjs";
nextEnv.loadEnvConfig(process.cwd());

const secrets = [
  ...[
    "ELEVENLABS_API_KEY",
    "RESEND_API_KEY",
    "GOOGLE_CLIENT_SECRET",
    "SUPABASE_SERVICE_ROLE_KEY",
    "GEMINI_API_KEY",
    "CRON_SECRET",
  ].map((name) => [name, process.env[name]]),
  ...["SESSION_SECRET", "DEMO_ACCESS_CODE", "PHONE_TOOL_SECRET"].map((name) => [
    `SAMANTHA_${name}`,
    setting(name),
  ]),
  // Short values would match by coincidence; every real secret is longer.
].filter(([, value]) => value?.length >= 12);

async function files(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  return (
    await Promise.all(
      entries.map((entry) =>
        entry.isDirectory()
          ? files(path.join(directory, entry.name))
          : [path.join(directory, entry.name)],
      ),
    )
  ).flat();
}

let count = 0;
const leaks = [];
for (const file of await files(".next/static")) {
  if (!/\.(js|json|map|html)$/.test(file)) continue;
  count++;
  const content = await readFile(file, "utf8");
  for (const [name, value] of secrets)
    if (content.includes(value)) leaks.push({ file, variable: name });
}
console.log(
  JSON.stringify({
    scannedClientAssets: count,
    checkedVariables: secrets.map(([name]) => name),
    leaks,
  }),
);
if (leaks.length) process.exitCode = 1;
