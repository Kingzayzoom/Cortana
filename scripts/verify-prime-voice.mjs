// Drives a real Prime voice session in Chromium against a running server and
// checks each answer is graded by the server. Spends ElevenLabs minutes.
import { chromium, expect } from "@playwright/test";
import env from "@next/env";
import { mkdir, writeFile } from "node:fs/promises";
import { setting } from "./lib/settings.mjs";
env.loadEnvConfig(process.cwd());
const browser = await chromium.launch({
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});
const context = await browser.newContext({
  permissions: ["microphone"],
  baseURL: setting("TEST_URL") || "http://localhost:3100",
});
const page = await context.newPage();
page.setDefaultTimeout(15000);
const calls = [],
  errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", (r) => {
  if (r.url().includes("/api/prime/tools/"))
    calls.push({ tool: r.url().split("/").at(-1), status: r.status() });
});
const send = async (text) => {
  await page.getByLabel("Message Samantha Prime").fill(text);
  await page.getByRole("button", { name: "Send", exact: true }).click();
};
try {
  await page.goto((setting("TEST_URL") || "http://localhost:3100") + "/prime");
  await page
    .getByRole("button", { name: "Start with Samantha", exact: true })
    .click();
  await page
    .getByLabel("Demo access code", { exact: true })
    .fill(setting("DEMO_ACCESS_CODE"));
  await page.getByRole("button", { name: "Agree & start voice" }).click();
  await expect(page.getByLabel("Message Samantha Prime")).toBeEnabled({
    timeout: 40000,
  });
  await page.getByRole("button", { name: "Mute", exact: true }).click();
  console.log("Prime connected to ElevenLabs.");
  await send("Please begin my three-question Prime.");
  await expect
    .poll(
      () =>
        calls.some((c) => c.tool === "get_prime_session" && c.status === 200),
      { timeout: 45000 },
    )
    .toBe(true);
  for (let i = 0; i < 3; i++) {
    await expect(
      page.getByText("Question " + (i + 1) + " of 3", { exact: true }),
    ).toBeVisible({ timeout: 45000 });
    await send("My final answer is option A.");
    await expect(page.locator(".prime-feedback")).toBeVisible({
      timeout: 45000,
    });
    console.log("Authoritative Prime answer " + (i + 1) + " saved.");
    await send(
      i === 2
        ? "Please complete my Prime now."
        : "Please continue to the next Prime question.",
    );
  }
  await expect(page.getByText("PRIME COMPLETE", { exact: true })).toBeVisible({
    timeout: 45000,
  });
  const data = await page.request.get("/api/prime").then((r) => r.json());
  if (data.stats.questions !== 3) throw Error("Expected three saved answers.");
  if (!calls.some((c) => c.tool === "complete_prime" && c.status === 200))
    throw Error("Agent must use completion tool.");
  const report = {
    realElevenLabs: true,
    fixtureMicrophone: true,
    typedAnswers: true,
    questions: data.stats.questions,
    xp: data.session.xp,
    calls,
    errors,
  };
  await mkdir(".cortana/verification", { recursive: true });
  await writeFile(
    ".cortana/verification/prime-live.json",
    JSON.stringify(report, null, 2),
  );
  await page.screenshot({
    path: ".cortana/verification/prime-live.png",
    fullPage: true,
  });
  console.log(JSON.stringify(report, null, 2));
  await page.getByRole("button", { name: "End voice", exact: true }).click();
} catch (e) {
  console.log(JSON.stringify({ calls, errors }));
  throw e;
} finally {
  await browser.close();
}
