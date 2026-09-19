import { test, expect, type Page } from "@playwright/test";
import { randomUUID } from "node:crypto";
async function preview(page: Page) {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore in text mode" }).click();
  await expect(
    page.getByRole("heading", { name: "Who was studied" }),
  ).toBeVisible();
}
async function challenge(page: Page) {
  await preview(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Try the challenge" }).click();
  await expect(
    page.getByText("Synthetic learning case", { exact: true }),
  ).toBeVisible();
}
test("desktop layout, animated WebGL orb, navigation and no page errors", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Your daily clinical conversation." }),
  ).toBeVisible();
  await page.locator("canvas").waitFor();
  await page.waitForTimeout(1500);
  const before = await page.locator("canvas").screenshot();
  await page.waitForTimeout(1700);
  const after = await page.locator("canvas").screenshot();
  expect(Buffer.compare(before, after)).not.toBe(0);
  const drawn = await page.locator("canvas").evaluate((c) => {
    const gl = (c as HTMLCanvasElement).getContext("webgl2")!;
    return Boolean(gl.getParameter(gl.CURRENT_PROGRAM));
  });
  expect(drawn).toBe(true);
  await page.screenshot({
    path: "test-results/desktop-1440.png",
    fullPage: true,
  });
  for (const [name, title] of [
    ["My Rounds", "A little learning, on repeat."],
    ["Evidence Library", "Go straight to the source."],
    ["Learning Profile", "Your practice. Your pace."],
    ["Topics", "Start with the heart."],
    ["Settings", "A workspace that fits you."],
  ]) {
    await page.getByRole("link", { name, exact: true }).click();
    await expect(page.getByRole("heading", { name: title })).toBeVisible();
  }
  expect(errors).toEqual([]);
});
test("missing voice configuration is honest and never requests microphone", async ({
  page,
}) => {
  await page.route("**/api/bootstrap", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      json: { ...(await response.json()), voiceConfigured: false },
    });
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: () => {
        throw new Error("UNEXPECTED MICROPHONE REQUEST");
      },
    });
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Start today’s round" }).click();
  await expect(
    page.getByText("Voice connection not configured.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Open local preview" }).click();
  await expect(
    page.getByText("Local preview · microphone off", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Who was studied" }),
  ).toBeVisible();
});
test("complete round with clarification, evidence, unsupported question, reload and repeat", async ({
  page,
}) => {
  await challenge(page);
  await page
    .getByRole("textbox", { name: "Your answer", exact: true })
    .fill("maybe B or C");
  await page
    .getByRole("button", { name: "Submit answer", exact: true })
    .click();
  await expect(
    page.getByText("I won’t grade an unclear response.", { exact: false }),
  ).toBeVisible();
  await page
    .getByRole("button", {
      name: "B The trial included people with and without diabetes.",
    })
    .click();
  await expect(
    page.getByRole("heading", { name: "That’s the distinction." }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "See the evidence", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(
    page.getByRole("link", { name: "Read the original source" }),
  ).toHaveAttribute(
    "href",
    "https://jamanetwork.com/journals/jama/fullarticle/2763950",
  );
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await page
    .getByRole("button", { name: "Your questions", exact: true })
    .click();
  await page
    .getByRole("textbox", { name: "Question about this round" })
    .fill("Can you prescribe for my patient?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(
    page.getByText("The sources in this round do not establish that.", {
      exact: false,
    }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Complete round" }).click();
  await expect(
    page.getByRole("heading", { name: "A little more learned." }),
  ).toBeVisible();
  const first = await (await page.request.get("/api/bootstrap")).json();
  expect(first.xp).toBe(120);
  expect(first.attempts).toHaveLength(1);
  await page.screenshot({
    path: "test-results/completed-round.png",
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "A little more learned." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Practice again" }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Try the challenge" }).click();
  await page
    .getByRole("textbox", { name: "Your answer", exact: true })
    .fill("B");
  await page
    .getByRole("button", { name: "Submit answer", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Your questions", exact: true })
    .click();
  await page.getByRole("button", { name: "Complete round" }).click();
  await expect(
    page.getByRole("heading", { name: "A little more learned." }),
  ).toBeVisible();
  const final = await (await page.request.get("/api/bootstrap")).json();
  expect(final.xp).toBe(120);
  expect(final.completions).toHaveLength(1);
  expect(final.attempts).toHaveLength(2);
});
test("pause preserves section; supported questions do not advance it", async ({
  page,
}) => {
  await preview(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Pause round" }).click();
  await expect(page.getByText("Round paused — microphone off.")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Continue", exact: true }),
  ).toBeDisabled();
  await page.getByRole("button", { name: "Resume this section" }).click();
  await expect(
    page.getByRole("heading", { name: "What the study found" }),
  ).toBeVisible();
  await page.getByText("Have a question before continuing?").click();
  await page
    .getByRole("button", { name: "Who was studied?", exact: true })
    .click();
  await expect(page.locator(".question-reply")).toContainText("40% or less");
  await expect(
    page.getByRole("heading", { name: "What the study found" }),
  ).toBeVisible();
});
test("security, strict schemas, session isolation and duplicate submissions", async ({
  page,
  baseURL,
}) => {
  await challenge(page);
  const initial = await (await page.request.get("/api/bootstrap")).json();
  const runId = initial.run.id;
  const headers = { Origin: baseURL! };
  const body = {
    action: "answer",
    runId,
    roundId: "dapa-hf-01",
    questionId: "diabetes-eligibility",
    answer: "B",
    requestId: randomUUID(),
  };
  const noOrigin = await page.request.post("/api/learning", { data: body });
  expect(noOrigin.status()).toBe(403);
  const badOrigin = await page.request.post("/api/learning", {
    headers: { Origin: "https://evil.example" },
    data: body,
  });
  expect(badOrigin.status()).toBe(403);
  const injected = await page.request.post("/api/learning", {
    headers,
    data: { ...body, xp: 1000 },
  });
  expect(injected.status()).toBe(400);
  const unknown = await page.request.post("/api/learning", {
    headers,
    data: { ...body, questionId: "invented" },
  });
  expect(unknown.status()).toBe(400);
  const responses = await Promise.all([
    page.request.post("/api/learning", { headers, data: body }),
    page.request.post("/api/learning", { headers, data: body }),
  ]);
  for (const response of responses) expect(response.status()).toBe(200);
  const grade = await responses[0].json();
  expect(grade.attempts).toHaveLength(1);
  const conflicting = await page.request.post("/api/learning", {
    headers,
    data: { ...body, answer: "A" },
  });
  expect(conflicting.status()).toBe(409);
  await page.request.post("/api/learning", {
    headers,
    data: { action: "stage", runId, stageId: "questions" },
  });
  const completion = {
    action: "complete",
    runId,
    roundId: "dapa-hf-01",
    requestId: randomUUID(),
  };
  await Promise.all([
    page.request.post("/api/learning", { headers, data: completion }),
    page.request.post("/api/learning", { headers, data: completion }),
  ]);
  const saved = await (await page.request.get("/api/bootstrap")).json();
  expect(saved.xp).toBe(120);
  expect(saved.completions).toHaveLength(1);
  const other = await page.context().browser()!.newContext();
  const otherPage = await other.newPage();
  await otherPage.goto(baseURL!);
  await expect(
    otherPage.getByRole("button", { name: "Start today’s round" }),
  ).toBeEnabled();
  const otherProgress = await (
    await other.request.get(baseURL + "/api/bootstrap")
  ).json();
  expect(otherProgress.xp).toBe(0);
  const late = await other.request.post(baseURL + "/api/learning", {
    headers,
    data: completion,
  });
  expect(late.status()).toBe(409);
  await other.close();
});
test("evidence search, settings and reset", async ({ page }) => {
  await page.goto("/evidence");
  await page
    .getByRole("textbox", { name: "Search evidence" })
    .fill("not-a-source");
  await expect(
    page.getByRole("heading", { name: /No sources match/ }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Clear search" }).click();
  await expect(page.locator(".source-row")).toHaveCount(2);
  await page.getByRole("link", { name: "Settings", exact: true }).click();
  await page.getByLabel("Display name", { exact: true }).fill("Dr. Rivera");
  await page.getByRole("switch", { name: /Reduce motion/ }).check();
  await page.getByRole("button", { name: "Save preferences" }).click();
  await expect(
    page.getByText("Preferences saved", { exact: true }),
  ).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue(
    "Dr. Rivera",
  );
  await expect(
    page.getByRole("switch", { name: /Reduce motion/ }),
  ).toBeChecked();
  await page.getByRole("button", { name: "Reset demo data" }).click();
  await page.getByRole("button", { name: "Reset this profile" }).click();
  await expect(page.getByLabel("Display name", { exact: true })).toHaveValue(
    "Dr. Patel",
  );
});
for (const viewport of [
  { width: 1280, height: 800 },
  { width: 390, height: 844 },
  { width: 320, height: 740 },
]) {
  test(`layout and controls at ${viewport.width}×${viewport.height}`, async ({
    page,
  }) => {
    await page.setViewportSize(viewport);
    await page.goto("/");
    await expect(
      page.getByRole("button", { name: "Start today’s round" }),
    ).toBeEnabled();
    await page.locator("canvas").waitFor();
    await page.waitForTimeout(800);
    const bounds = await page
      .getByRole("button", { name: "Start today’s round" })
      .boundingBox();
    expect(bounds!.y + bounds!.height).toBeLessThan(viewport.height);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    await page.screenshot({
      path: `test-results/viewport-${viewport.width}.png`,
      fullPage: true,
    });
    if (viewport.width < 700) {
      await page.getByRole("button", { name: "Open navigation" }).click();
      await page.getByRole("link", { name: "Evidence Library" }).click();
      await expect(
        page.getByRole("heading", { name: "Go straight to the source." }),
      ).toBeVisible();
    }
  });
}
test("orb harness: silence, real adapter inputs, mute, reduced motion and teardown", async ({
  page,
}) => {
  await page.addInitScript(() => {
    const active = new Set<number>();
    const request = window.requestAnimationFrame.bind(window);
    const cancel = window.cancelAnimationFrame.bind(window);
    Object.assign(window, { cortanaTestFrames: active });
    window.requestAnimationFrame = (callback) => {
      const id = request((time) => {
        active.delete(id);
        callback(time);
      });
      active.add(id);
      return id;
    };
    window.cancelAnimationFrame = (id) => {
      active.delete(id);
      cancel(id);
    };
  });
  await page.goto("/dev/orb");
  const orb = page.getByTestId("orb");
  await expect(orb).toHaveAttribute("data-energy", "0.000");
  await page.getByRole("button", { name: "Soft input", exact: true }).click();
  await expect
    .poll(async () => Number(await orb.getAttribute("data-energy")))
    .toBeGreaterThan(0.1);
  await page.screenshot({ path: "test-results/orb-soft.png" });
  await page.getByRole("button", { name: "Strong input", exact: true }).click();
  await expect
    .poll(async () => Number(await orb.getAttribute("data-energy")))
    .toBeGreaterThan(0.8);
  await page.screenshot({ path: "test-results/orb-strong.png" });
  await page.getByLabel("Mute input", { exact: true }).check();
  await expect
    .poll(async () => Number(await orb.getAttribute("data-energy")))
    .toBeLessThan(0.015);
  await page
    .getByRole("button", { name: "Assistant output", exact: true })
    .click();
  await expect
    .poll(async () => Number(await orb.getAttribute("data-energy")))
    .toBeGreaterThan(0.75);
  await page.getByLabel("Reduced motion", { exact: true }).check();
  await expect
    .poll(() =>
      orb.evaluate((e) => getComputedStyle(e).getPropertyValue("--orb-scale")),
    )
    .toBe("1");
  await page.getByLabel("Force fallback", { exact: true }).check();
  await expect(page.getByText("Lightweight visualization")).toBeVisible();
  await expect(page.locator("canvas")).toHaveCount(0);
  await page.getByLabel("Force fallback", { exact: true }).uncheck();
  await page.getByLabel("Reduced motion", { exact: true }).uncheck();
  await page.locator("canvas").waitFor();
  await page.getByLabel("Mount renderer", { exact: true }).uncheck();
  await expect(page.locator("canvas")).toHaveCount(0);
  await expect(page.getByText("Renderer unmounted.")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (window as unknown as { cortanaTestFrames: Set<number> })
            .cortanaTestFrames.size,
      ),
    )
    .toBe(0);
});
test("reload preserves an incomplete section without activating the microphone", async ({
  page,
}) => {
  await preview(page);
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.reload();
  await expect(
    page.getByText("Round paused — microphone off.", { exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Resume this section" }).click();
  await expect(
    page.getByRole("heading", { name: "What the study found" }),
  ).toBeVisible();
});
