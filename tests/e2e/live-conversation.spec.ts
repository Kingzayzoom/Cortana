import { expect, test } from "@playwright/test";

test("the dashboard transitions into and out of live conversation mode", async ({
  page,
}) => {
  await page.goto("/");

  const dashboard = page.locator("[data-conversation-mode]");
  await expect(dashboard).toHaveAttribute(
    "data-conversation-mode",
    "dashboard",
  );

  await page.getByRole("button", { name: "Start today’s round" }).click();
  await expect(dashboard).toHaveAttribute("data-conversation-mode", "live");
  await expect(
    page.getByRole("complementary", { name: "Live round intelligence" }),
  ).toBeVisible();
  await expect(page.locator(".dashboard-round-column")).toHaveAttribute(
    "aria-hidden",
    "true",
  );
  await expect(page.locator(".dashboard-lower-shell")).toHaveClass(
    /is-cleared/,
  );

  await page.getByRole("button", { name: "Close" }).click();
  await expect(dashboard).toHaveAttribute(
    "data-conversation-mode",
    "dashboard",
  );
  await expect(page.locator(".dashboard-round-column")).toBeVisible();
});

test("preview mode keeps progress, evidence, challenge controls, and both transcript roles together", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Explore in text mode" }).click();

  const livePanel = page.getByRole("complementary", {
    name: "Live round intelligence",
  });
  await expect(livePanel).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "In conversation." }),
  ).toBeVisible();
  await expect(livePanel.getByText("Step 1 of 5")).toBeVisible();
  await expect(
    livePanel.getByRole("heading", { name: "Who was studied" }),
  ).toBeVisible();
  await expect(page.getByTestId("orb")).toHaveAttribute(
    "data-motion-speed",
    "1.12",
  );

  await livePanel.getByText("Have a question before continuing?").click();
  await livePanel.getByRole("button", { name: "Who was studied?" }).click();

  const transcript = livePanel.getByRole("log", {
    name: "Conversation between you and Cortana",
  });
  await expect(transcript.getByText("You", { exact: true })).toBeVisible();
  await expect(
    transcript.getByText("Cortana · local preview", { exact: true }),
  ).toBeVisible();
  await expect(
    transcript.getByText("Who was studied?", { exact: true }),
  ).toBeVisible();

  await page.getByRole("button", { name: "End round" }).click();
  await expect(page.locator("[data-conversation-mode]")).toHaveAttribute(
    "data-conversation-mode",
    "dashboard",
  );
  await expect(
    page.getByRole("heading", { name: "Today’s Round" }),
  ).toBeVisible();
});

test("live conversation mode stays contained on mobile and respects reduced motion", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("button", { name: "Explore in text mode" }).click();

  const panel = page.locator(".live-intelligence-panel");
  await expect(panel).toBeVisible();
  const bounds = await panel.boundingBox();
  expect(bounds).not.toBeNull();
  expect(bounds!.x).toBeGreaterThanOrEqual(0);
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  const transitionDuration = await panel.evaluate((element) =>
    Number.parseFloat(getComputedStyle(element).transitionDuration),
  );
  expect(transitionDuration).toBeLessThanOrEqual(0.001);
});
