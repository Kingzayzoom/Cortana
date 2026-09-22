import type { EmailSummaryStatus } from "@/lib/email-summary/types";
import { RequestError } from "./errors";
import { connectedAccount } from "./email-summary/auth";
import { generateSummary } from "./email-summary/gemini";
import { latestSummary, listConnections } from "./email-summary/store";

const schedule = "Daily morning Eastern";

export async function emailSummaryStatus(): Promise<EmailSummaryStatus> {
  const connection = await connectedAccount();
  if (!connection)
    return {
      connected: false,
      emailAddress: null,
      summary: null,
      schedule,
    };
  return {
    connected: true,
    emailAddress: connection.email_address,
    summary: await latestSummary(connection.id),
    schedule,
  };
}

export async function generateOwnSummary() {
  const connection = await connectedAccount();
  if (!connection)
    throw new RequestError(
      "Connect Gmail before refreshing the briefing.",
      401,
    );
  await generateSummary(connection);
  return emailSummaryStatus();
}

export async function generateDailySummaries() {
  const connections = await listConnections();
  let generated = 0,
    skipped = 0,
    failed = 0;
  for (let index = 0; index < connections.length; index += 3) {
    const batch = connections.slice(index, index + 3);
    const results = await Promise.allSettled(
      batch.map((connection) => generateSummary(connection, true)),
    );
    for (const result of results) {
      if (result.status === "rejected") failed++;
      else if (result.value) generated++;
      else skipped++;
    }
  }
  return { generated, skipped, failed };
}
