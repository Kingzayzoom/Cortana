// Read-only readiness check for phone rounds.
//   node scripts/check-phone-setup.mjs --url=https://your-app.vercel.app
// Nothing is created or changed; secrets are never printed.
import nextEnv from "@next/env";
import { setting } from "./settings.mjs";
nextEnv.loadEnvConfig(process.cwd());
const url = (
  process.argv.find((a) => a.startsWith("--url="))?.slice(6) ||
  setting("PUBLIC_URL") ||
  ""
).replace(/\/$/, "");
const apiKey = process.env.ELEVENLABS_API_KEY;
const toolSecret = setting("PHONE_TOOL_SECRET");
const lines = [];
const report = (ok, label, hint = "") =>
  lines.push(
    `${ok ? "OK  " : "TODO"}  ${label}${hint ? `\n        ${hint}` : ""}`,
  );

report(Boolean(apiKey), "ELEVENLABS_API_KEY is set locally");
report(
  Boolean(toolSecret && toolSecret.length >= 32),
  "SAMANTHA_PHONE_TOOL_SECRET is set locally",
  toolSecret ? "" : "Run: node scripts/prepare-local.mjs",
);

if (apiKey) {
  const api = (path) =>
    fetch(`https://api.elevenlabs.io/v1/convai/${path}`, {
      headers: { "xi-api-key": apiKey },
      signal: AbortSignal.timeout(20000),
    }).then((r) => r.json().catch(() => null));
  const numbers = await api("phone-numbers");
  const list = Array.isArray(numbers) ? numbers : [];
  report(
    list.length > 0,
    `Twilio number imported into ElevenLabs (${list.length} found)`,
    list.length
      ? list
          .map(
            (n) =>
              `${n.phone_number} -> ELEVENLABS_PHONE_NUMBER_ID=${n.phone_number_id}`,
          )
          .join("\n        ")
      : "ElevenLabs dashboard -> Phone Numbers -> Import from Twilio",
  );
  const agents = (await api("agents?page_size=30"))?.agents ?? [];
  const phoneAgent = agents.find((a) => a.name === "Samantha Phone");
  report(
    Boolean(phoneAgent),
    "Phone agent exists in ElevenLabs",
    phoneAgent
      ? `ELEVENLABS_PHONE_AGENT_ID=${phoneAgent.agent_id}`
      : "Run: node scripts/configure-phone-agent.mjs --url=<public origin> --apply",
  );
}

if (!url) {
  report(
    false,
    "Public site URL known",
    "Pass --url=https://your-app.vercel.app",
  );
} else {
  const headers = { "content-type": "application/json" };
  if (setting("VERCEL_BYPASS"))
    headers["x-vercel-protection-bypass"] = setting("VERCEL_BYPASS");
  const probe = async (secret) =>
    fetch(`${url}/api/phone/tools/get_round_context`, {
      method: "POST",
      headers: secret
        ? { ...headers, authorization: `Bearer ${secret}` }
        : headers,
      body: JSON.stringify({ session: "not-a-real-session" }),
      redirect: "manual",
      signal: AbortSignal.timeout(20000),
    })
      .then(async (r) => ({
        status: r.status,
        text: (await r.text()).slice(0, 300),
      }))
      .catch((error) => ({ status: 0, text: String(error.message) }));
  const open = await probe(null);
  const blocked =
    /vercel_auth|sso-api|Authentication Required/i.test(open.text) ||
    [301, 302, 307].includes(open.status);
  report(
    !blocked,
    "ElevenLabs can reach the site without a login",
    blocked
      ? "Vercel -> Settings -> Deployment Protection: allow production, or set SAMANTHA_VERCEL_BYPASS to an Automation Bypass secret"
      : "",
  );
  if (!blocked) {
    report(
      open.status === 401 && /not authorized/i.test(open.text),
      "Tool endpoint is live and rejects unsigned requests",
      open.status === 404 ? "Deploy the latest main branch first." : "",
    );
    if (toolSecret) {
      const authorised = await probe(toolSecret);
      report(
        authorised.status === 401 &&
          /not recognized|expired/i.test(authorised.text),
        "The deployed SAMANTHA_PHONE_TOOL_SECRET matches this machine's",
        /not authorized/i.test(authorised.text)
          ? "Set the same SAMANTHA_PHONE_TOOL_SECRET in Vercel and redeploy."
          : "",
      );
    }
  }
}
console.log(lines.join("\n"));
console.log(
  lines.some((l) => l.startsWith("TODO"))
    ? "\nFinish the TODO items above, then rerun this check."
    : "\nPhone rounds are ready. Place a test call from /phone.",
);
