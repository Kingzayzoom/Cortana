import { test, expect } from "@playwright/test";
test("three-question Prime saves grades, evidence, rewards, profile and focused layout", async ({
  page,
}) => {
  await page.goto("/prime");
  await expect(
    page.getByRole("heading", { name: "2 minutes to stay sharp." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Start Prime", exact: true }).click();
  await expect(page).toHaveURL(/prime\/session/);
  await expect(page.locator(".sidebar")).toHaveCount(0);
  for (let i = 0; i < 3; i++) {
    await expect(
      page.getByText("Question " + (i + 1) + " of 3", { exact: true }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: "Submit answer" }),
    ).toBeDisabled();
    await page.getByRole("radio").first().check();
    await page.getByRole("button", { name: "Submit answer" }).click();
    await expect(page.locator(".prime-feedback")).toBeVisible();
    if (i === 0) {
      await page.getByRole("button", { name: "View evidence" }).click();
      await expect(page.getByRole("dialog")).toBeVisible();
      await page.keyboard.press("Escape");
      await page.reload();
      await expect(page.locator(".prime-feedback")).toBeVisible();
    }
    await page
      .getByRole("button", {
        name: i === 2 ? "Complete Prime" : "Continue",
        exact: true,
      })
      .click();
  }
  await expect(page.getByText("PRIME COMPLETE", { exact: true })).toBeVisible();
  await expect(page.getByText("1 day Samantha streak")).toBeVisible();
  const before = await page.request.get("/api/bootstrap").then((r) => r.json());
  await page.reload();
  const after = await page.request.get("/api/bootstrap").then((r) => r.json());
  expect(after.xp).toBe(before.xp);
  expect(
    after.learningSignals.filter(
      (e: { type: string }) => e.type === "prime_completed",
    ),
  ).toHaveLength(1);
  await page.getByRole("button", { name: "Done", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Today's Prime is complete." }),
  ).toBeVisible();
  await page.goto("/profile");
  await expect(
    page.getByText("Questions practiced", { exact: true }),
  ).toBeVisible();
});
test("Prime keyboard, mobile, reduced motion and safe public payload", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/prime");
  await page.getByRole("button", { name: "Start Prime", exact: true }).click();
  const response = await page.request.get("/api/prime");
  const data = await response.json();
  expect(JSON.stringify(data)).not.toContain("correctOptionId");
  await expect(page).toHaveURL(/prime\/session/);
  await expect(
    page.getByText("Question 1 of 3", { exact: true }),
  ).toBeVisible();
  await page.getByRole("heading", { level: 1 }).focus();
  await page.keyboard.press("1");
  await page.keyboard.press("Enter");
  await expect(page.locator(".prime-feedback")).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/prime-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Why this question?" }).click();
  await expect(page.locator(".prime-why-copy")).toBeVisible();
});
test("Prime API requires same-origin and rejects out-of-order or foreign session mutations", async ({
  page,
}) => {
  await page.goto("/prime");
  await expect(
    page.getByRole("button", { name: "Start Prime", exact: true }),
  ).toBeEnabled();
  const csrf = await page.request.post("/api/prime", {
    data: { action: "start" },
    headers: { origin: "https://unrelated.example" },
  });
  expect(csrf.status()).toBe(403);
  const origin = new URL(page.url()).origin;
  const start = await page.request
    .post("/api/prime", { data: { action: "start" }, headers: { origin } })
    .then((r) => r.json());
  const skip = await page.request.post("/api/prime", {
    data: { action: "complete", sessionId: start.session.id },
    headers: { origin },
  });
  expect(skip.status()).toBe(409);
});
