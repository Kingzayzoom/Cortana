import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const mode = process.argv[2];
if (!["--check", "--apply"].includes(mode)) {
  console.error(
    "Usage: node --env-file=.env.local scripts/apply-email-summary-migration.mjs --check|--apply",
  );
  process.exit(2);
}

const { SUPABASE_URL, SUPABASE_PROJECT_REF, SUPABASE_ACCESS_TOKEN } =
  process.env;
if (!SUPABASE_URL || !SUPABASE_PROJECT_REF || !SUPABASE_ACCESS_TOKEN)
  throw new Error(
    "Supabase URL, project ref, and Management API access token are required.",
  );
const projectHost = new URL(SUPABASE_URL).hostname;
if (
  !projectHost.endsWith(".supabase.co") ||
  projectHost.split(".")[0] !== SUPABASE_PROJECT_REF
)
  throw new Error(
    "Supabase project ref does not match SUPABASE_URL. No SQL was sent.",
  );

const endpoint = `https://api.supabase.com/v1/projects/${encodeURIComponent(SUPABASE_PROJECT_REF)}/database/query`;
async function query(sql, readOnly) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${SUPABASE_ACCESS_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query: sql, read_only: readOnly }),
    signal: AbortSignal.timeout(30_000),
  });
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    console.error(`Management API status: ${response.status}`);
    console.error(
      `Management API error: ${String(data?.message ?? data?.error ?? "unknown").slice(0, 500)}`,
    );
    process.exit(1);
  }
  return data;
}

async function check() {
  const result = await query(
    "select to_regclass('public.email_connections') is not null as connections, to_regclass('public.email_summaries') is not null as summaries;",
    true,
  );
  const row = Array.isArray(result) ? result[0] : null;
  console.log(`email_connections_exists=${row?.connections === true}`);
  console.log(`email_summaries_exists=${row?.summaries === true}`);
  return row?.connections === true && row?.summaries === true;
}

if (mode === "--apply") {
  const migration = new URL(
    "../supabase/migrations/20260919000000_email_summary.sql",
    import.meta.url,
  );
  await query(await readFile(fileURLToPath(migration), "utf8"), false);
  console.log("email_summary_migration_applied=true");
}
if (!(await check())) process.exitCode = 1;
