import { test, expect } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
test("actual preview events, replay safety, privacy, persistence and export", async ({
  page,
}) => {
  await page.goto("/");
  const post = (body: unknown) =>
    page.evaluate(async (body) => {
      const response = await fetch("/api/learning", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      return { status: response.status, data: await response.json() };
    }, body);
  await page.getByRole("button", { name: "Explore in text mode" }).click();
  const boot = await page.request.get("/api/bootstrap");
  const runId = (await boot.json()).run.id;
  const observation = {
    action: "observe",
    runId,
    eventId: randomUUID(),
    observation: { type: "question_asked", category: "study_population" },
  };
  await post(observation);
  await post(observation);
  const invalid = await post({
    ...observation,
    eventId: randomUUID(),
    observation: { ...observation.observation, text: "Jane Doe MRN 12345" },
  });
  expect(invalid.status).toBe(400);
  const fakeGrade = await post({
    ...observation,
    observation: { type: "challenge_resolved", correct: true },
  });
  expect(fakeGrade.status).toBe(400);
  const crossOrigin = await page.request.post("/api/learning", {
    data: observation,
    headers: { Origin: "https://untrusted.invalid" },
  });
  expect(crossOrigin.status()).toBe(403);
  await page.getByRole("button", { name: "View source", exact: true }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "The trial", exact: true }).click();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Try the challenge" }).click();
  const privateText = "Jane Example MRN 98765 might choose B or C";
  const unclear = await post({
    action: "answer",
    runId,
    roundId: "dapa-hf-01",
    questionId: "diabetes-eligibility",
    answer: privateText,
    requestId: randomUUID(),
  });
  expect(unclear.data.grade.verdict).toBe("clarify");
  const profileId = (await page.context().cookies())
    .find((cookie) => cookie.name === "samantha_session")!
    .value.split(".")[0];
  expect(profileId).toMatch(/^[0-9a-f-]{36}$/);
  const persisted = await readFile(
    path.join(process.cwd(), ".cortana", profileId + ".json"),
    "utf8",
  );
  expect(persisted).not.toContain(privateText);
  expect(persisted).not.toContain("98765");
  await page
    .getByRole("button", {
      name: "B The trial included people with and without diabetes.",
    })
    .click();
  await page
    .getByRole("button", { name: "Your questions", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Complete round", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Your learning signal", exact: true }),
  ).toBeVisible();
  const repeat = await post({
    action: "complete",
    runId,
    roundId: "dapa-hf-01",
    requestId: randomUUID(),
  });
  const events = repeat.data.learningSignals as { type: string }[];
  expect(events.filter((e) => e.type === "round_completed")).toHaveLength(1);
  expect(events.filter((e) => e.type === "challenge_resolved")).toHaveLength(1);
  expect(events.filter((e) => e.type === "question_asked")).toHaveLength(1);
  expect(events.filter((e) => e.type === "evidence_viewed")).toHaveLength(1);
  expect(events.filter((e) => e.type === "concept_reinforced")).toHaveLength(0);
  await page.reload();
  await page
    .getByRole("button", { name: "View learning signal", exact: true })
    .click();
  await expect(
    page.getByText("study population (1)", { exact: true }),
  ).toBeVisible();
  await page
    .getByText("Developer payload · proposed integration", { exact: true })
    .click();
  const downloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export learning signal JSON" })
    .click();
  const download = await downloadPromise;
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream!) chunks.push(chunk);
  const payload = JSON.parse(Buffer.concat(chunks).toString());
  expect(payload).toMatchObject({
    schemaVersion: "1.0",
    source: "samantha",
    learning: {
      practice: { attempted: 1, correct: 1 },
      reinforcementTopics: [],
    },
  });
  expect(JSON.stringify(payload)).not.toMatch(
    /Jane|12345|transcript|accessCode/,
  );
  await page.goto("/impiricus");
  await expect(
    page.getByRole("heading", { name: "Go beyond engagement." }),
  ).toBeVisible();
  await expect(page.getByText("Question asked", { exact: true })).toBeVisible();
  await page.screenshot({
    path: "test-results/learning-signal-bridge-desktop.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
  await expect
    .poll(() =>
      page.locator(".sidebar").evaluate((e) => e.getBoundingClientRect().right),
    )
    .toBeLessThanOrEqual(0);
  await page.screenshot({
    path: "test-results/learning-signal-bridge-mobile.png",
    fullPage: true,
  });
  const isolated = await page.context().browser()!.newContext();
  const isolatedSnapshot = await isolated.request.get(
    new URL("/api/bootstrap", page.url()).href,
  );
  expect((await isolatedSnapshot.json()).learningSignals).toEqual([]);
  await isolated.close();
});
test("new signal bridge has no invented history and reduced motion stops its loop", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/impiricus");
  await expect(
    page.getByText(
      "Start a round to see real activity here. No sample events are inserted.",
    ),
  ).toBeVisible();
  expect(
    await page
      .locator(".bridge-dot")
      .first()
      .evaluate((e) => getComputedStyle(e).animationName),
  ).toBe("none");
  await page.setViewportSize({ width: 320, height: 700 });
  await expect
    .poll(() =>
      page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    )
    .toBe(true);
});
