import { chromium, expect } from "@playwright/test";
import nextEnv from "@next/env";
import { mkdir, readFile, writeFile } from "node:fs/promises";
nextEnv.loadEnvConfig(process.cwd());
const browser = await chromium.launch({
  args: [
    "--use-fake-device-for-media-stream",
    "--use-fake-ui-for-media-stream",
  ],
});
const context = await browser.newContext({ permissions: ["microphone"] });
const page = await context.newPage();
page.setDefaultTimeout(15000);
page.setDefaultNavigationTimeout(20000);
const errors = [],
  calls = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("response", async (response) => {
  if (response.url().includes("/api/context/tools/")) {
    const body = await response.json().catch(() => null);
    calls.push({
      tool: response.url().split("/").at(-1),
      status: response.status(),
      scenarioId: body?.scenarioId,
      available: body?.available,
    });
  }
});
try {
  await page.goto(
    (process.env.CORTANA_TEST_URL || "http://localhost:3102") + "/context",
  );
  await page
    .getByRole("button", { name: "Start briefing", exact: true })
    .click();
  await page
    .getByLabel("Demo access code", { exact: true })
    .fill(process.env.CORTANA_DEMO_ACCESS_CODE);
  await page.getByRole("button", { name: "Agree & start voice" }).click();
  await page.locator(".status-live").waitFor({ timeout: 40000 });
  console.log("Connected to ElevenLabs; checking live context tools.");
  await page
    .getByRole("button", { name: "Mute microphone", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Question about this round" })
    .fill("Please begin my synthetic context briefing.");
  await page
    .getByRole("button", { name: "Send question", exact: true })
    .click();
  await expect
    .poll(
      () =>
        calls.some((c) => c.tool === "get_context_summary" && c.status === 200),
      { timeout: 45000 },
    )
    .toBe(true);
  await expect(
    page.getByRole("log", { name: "Conversation between you and Cortana" }),
  ).toContainText(/Zabish|synthetic/i, { timeout: 45000 });
  const input = page.getByRole("textbox", {
    name: "Question about this round",
  });
  const answers = page.locator(".conversation-turn").filter({
    has: page.locator(".conversation-speaker", { hasText: /^Cortana$/ }),
  });
  const sequence = [];
  for (const step of [
    {
      file: "cardiology/01-hf-urgent-hypotension.json",
      question:
        "How urgently do they need me? Recheck the active scenario and report the supplied team request.",
      expected: /urgent|15 minutes|fifteen minutes/i,
    },
    {
      file: "cardiology/03-post-pci-stable.json",
      question:
        "I have activated a different scenario. What changed? Recheck the currently active scenario.",
      expected:
        /no (major |significant |new )?(overnight )?changes|stable overnight/i,
    },
    {
      file: "escalation/13-rapid-response.json",
      question:
        "I have activated a different scenario. How urgently am I needed? Recheck the currently active scenario.",
      expected: /immediate/i,
    },
  ]) {
    const scenario = JSON.parse(
      await readFile(`demo-data/context/${step.file}`, "utf8"),
    );
    const activated = await page.request.put(
      new URL("/api/context", page.url()).href,
      { data: scenario, headers: { origin: new URL(page.url()).origin } },
    );
    expect(activated.status()).toBe(200);
    const before = await answers.count();
    await input.fill(step.question);
    await page
      .getByRole("button", { name: "Send question", exact: true })
      .click();
    await expect
      .poll(
        async () => (await answers.allTextContents()).slice(before).join(" "),
        { timeout: 45000 },
      )
      .toMatch(step.expected);
    await expect
      .poll(
        () =>
          calls.some(
            (call) => call.scenarioId === scenario.id && call.status === 200,
          ),
        { timeout: 45000 },
      )
      .toBe(true);
    sequence.push({ scenarioId: scenario.id, passed: true });
  }
  await input.fill(
    "What is this synthetic patient's blood type? Answer only if the supplied scenario states it.",
  );
  await page
    .getByRole("button", { name: "Send question", exact: true })
    .click();
  await expect(
    page.getByRole("log", { name: "Conversation between you and Cortana" }),
  ).toContainText("The supplied scenario does not include that information.", {
    timeout: 45000,
  });
  await mkdir("test-results", { recursive: true });
  await page.screenshot({ path: "test-results/context-live-voice.png" });
  const report = {
    connected: true,
    fixtureMicrophone: true,
    realElevenLabs: true,
    contextTools: calls,
    missingFactFallback: true,
    scenarioSwitching: sequence,
    pageErrors: errors,
  };
  await writeFile(
    "test-results/context-live-voice.json",
    JSON.stringify(report, null, 2),
  );
  console.log(JSON.stringify(report, null, 2));
  await page.getByRole("button", { name: "End round", exact: true }).click();
} catch (error) {
  console.log(JSON.stringify({ contextTools: calls, pageErrors: errors }));
  throw error;
} finally {
  await browser.close();
}
