import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import nextEnv from "@next/env";
nextEnv.loadEnvConfig(process.cwd());
const names = [
  "ELEVENLABS_API_KEY",
  "CORTANA_SESSION_SECRET",
  "CORTANA_DEMO_ACCESS_CODE",
];
const secrets = names
  .map((name) => [name, process.env[name]])
  .filter(([, value]) => value?.length >= 12);
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
