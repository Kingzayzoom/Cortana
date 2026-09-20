import { expect, test } from "@playwright/test";

test("language selection stays with the voice controls throughout a round", async ({
  page,
}) => {
  await page.goto("/");
  const language = page.getByRole("combobox", {
    name: "Voice language",
    exact: true,
  });
  await expect(language).toBeVisible();
  await language.selectOption("es");
  await page.getByRole("button", { name: "Explore in text mode" }).click();
  await expect(language).toBeVisible();
  await expect(language).toHaveValue("es");
  await page.getByRole("button", { name: "Pause round" }).click();
  await expect(language).toBeVisible();
  await expect(language).toHaveValue("es");
  await page.getByRole("button", { name: "End round", exact: true }).click();
  await expect(language).toBeVisible();
  await expect(language).toHaveValue("es");
});

test("start reveals only the conversation surface, cancel restores the dashboard", async ({
  page,
}) => {
  await page.goto("/");
  const dashboard = page.locator("[data-conversation-mode]");
  await expect(dashboard).toHaveAttribute(
    "data-conversation-mode",
    "dashboard",
  );
  await expect(
    page.getByRole("complementary", { name: "Live conversation", exact: true }),
  ).toBeHidden();
  await page.getByRole("button", { name: /Start today/ }).click();
  await expect(dashboard).toHaveAttribute("data-conversation-mode", "live");
  await expect(
    page.locator(".live-progress, .live-focus, .live-lesson-slot"),
  ).toHaveCount(0);
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(dashboard).toHaveAttribute(
    "data-conversation-mode",
    "dashboard",
  );
  await expect(
    page.getByRole("heading", { name: /Today.s Round/ }),
  ).toBeVisible();
});

test("continuous transcript, inline challenge, evidence overlay and completion", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Explore in text mode" }).click();
  const panel = page.getByRole("complementary", {
    name: "Live conversation",
    exact: true,
  });
  const log = panel.getByRole("log");
  await expect(log).toContainText("Researchers compared");
  await expect(page.getByTestId("orb")).toHaveAttribute(
    "data-motion-speed",
    "1.12",
  );
  const bounds = await panel.boundingBox();
  expect(bounds!.y + bounds!.height).toBeLessThanOrEqual(900);
  await page.screenshot({
    path: "test-results/transcript-desktop-verified.png",
  });
  await page
    .getByRole("textbox", { name: "Question about this round" })
    .fill("Was diabetes required?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(
    log.getByText("Was diabetes required?", { exact: true }),
  ).toHaveCount(1);
  await page.getByRole("button", { name: "View source" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.getByRole("button", { name: "Close", exact: true }).click();
  await expect(log).toContainText("Was diabetes required?");
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Continue", exact: true }).click();
  await page.getByRole("button", { name: "Try the challenge" }).click();
  const challenge = log.getByRole("region", {
    name: "Synthetic clinical challenge",
  });
  await expect(challenge).toBeVisible();
  await challenge.getByRole("button", { name: /^B / }).click();
  await expect(
    page.getByRole("button", { name: "Your questions" }),
  ).toBeVisible();
  await expect(challenge).toBeVisible();
  await page.screenshot({ path: "test-results/transcript-challenge.png" });
  await page.getByRole("button", { name: "Your questions" }).click();
  await page.getByRole("button", { name: "Complete round" }).click();
  await expect(
    page.getByText("Round complete. Your practice is saved.", { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Your learning summary." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Return to dashboard" }).click();
  await expect(page.locator("[data-conversation-mode]")).toHaveAttribute(
    "data-conversation-mode",
    "dashboard",
  );
  expect(errors).toEqual([]);
});

for (const width of [390, 768, 1280]) {
  test(`conversation fits ${width}px and respects reduced motion`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    await page.goto("/");
    await page.getByRole("button", { name: "Explore in text mode" }).click();
    const panel = page.locator(".live-intelligence-panel");
    await expect(panel).toBeVisible();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    expect(
      await panel.evaluate((node) =>
        parseFloat(getComputedStyle(node).transitionDuration),
      ),
    ).toBeLessThanOrEqual(0.001);
    await page.screenshot({
      path: `test-results/transcript-${width}.png`,
      fullPage: true,
    });
  });
}
