import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.route("**/api/bootstrap", async (route) => {
    const response = await route.fetch();
    await route.fulfill({
      response,
      json: { ...(await response.json()), voiceConfigured: true },
    });
  });
});

test("token denial is visible, requests no microphone, and retries once per click", async ({
  page,
}) => {
  let calls = 0;
  await page.route("**/api/elevenlabs/token", async (route) => {
    calls++;
    await route.fulfill({
      status: 403,
      json: {
        error:
          "The ElevenLabs API key needs Write access for ElevenAgents (convai_write). Update the key's permissions, then retry.",
      },
    });
  });
  await page.addInitScript(() => {
    Object.defineProperty(navigator.mediaDevices, "getUserMedia", {
      value: () => {
        throw new Error("UNEXPECTED MICROPHONE");
      },
    });
  });
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Start today’s round" }).click();
  await page.getByLabel("Demo access code").fill("test-code");
  await page.getByRole("button", { name: "Agree & start voice" }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.getByRole("alert")).toContainText("Write access");
  await expect(
    dialog.getByRole("button", { name: "Retry voice" }),
  ).toBeEnabled();
  await dialog.getByRole("button", { name: "Retry voice" }).click();
  await expect.poll(() => calls).toBe(2);
  await dialog.getByRole("button", { name: "Close", exact: true }).click();
  await expect(page.locator(".voice-status")).toHaveText(
    "Voice needs your attention.",
  );
  await expect(
    page.getByRole("button", { name: "Retry voice", exact: true }),
  ).toBeVisible();
  expect(errors).toEqual([]);
});

test("cancel during token request never creates a late conversation", async ({
  page,
}) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/elevenlabs/token", async (route) => {
    await gate;
    await route
      .fulfill({
        json: {
          token: "test-only-token-never-used",
          conversationId: "conv_late",
        },
      })
      .catch(() => {});
  });
  await page.goto("/");
  await page.getByRole("button", { name: "Start today’s round" }).click();
  await page.getByLabel("Demo access code").fill("test-code");
  const request = page.waitForRequest("**/api/elevenlabs/token");
  await page.getByRole("button", { name: "Agree & start voice" }).click();
  await request;
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Cancel connection" })
    .click();
  release();
  await expect(page.locator(".voice-status")).toHaveText("Ready when you are.");
  await expect(
    page.getByRole("button", { name: "Start today’s round" }),
  ).toBeEnabled();
  await expect(page.locator(".voice-status")).not.toHaveAttribute(
    "data-conversation-id",
  );
});
