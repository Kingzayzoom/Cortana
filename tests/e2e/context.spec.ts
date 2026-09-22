import { test, expect } from "@playwright/test";
import { readFileSync } from "node:fs";
const morning = JSON.parse(
  readFileSync(
    "demo-data/context/cardiology/01-hf-urgent-hypotension.json",
    "utf8",
  ),
);
test("select, preview, activate, reload and clear a shared scenario", async ({
  page,
}) => {
  await page.goto("/context");
  await expect(
    page.getByRole("heading", { name: "What changed?" }),
  ).toBeVisible();
  await expect(page.getByText(/118\/72.*88\/56 mmHg/).first()).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Call me with briefing" }),
  ).toBeDisabled();
  await page
    .getByRole("article", { name: "Chest pain consult", exact: true })
    .getByRole("button", { name: "Preview", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toContainText("Synthetic Patient 031");
  await page
    .getByRole("dialog")
    .getByRole("button", { name: "Activate scenario", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("activated");
  await page
    .getByRole("article", { name: "Chest pain consult", exact: true })
    .getByRole("button", { name: "Preview", exact: true })
    .click();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("status")).toContainText("Valid Samantha");
  await page.getByRole("button", { name: "Preview briefing" }).click();
  await expect(page.getByRole("dialog")).toContainText("Synthetic Patient 031");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Activate scenario" }).click();
  await expect(page.getByRole("status")).toContainText("activated");
  await page.reload();
  await expect(page.getByLabel("Active context")).toContainText(
    "Chest pain consult",
  );
  const facts = await page.request.post("/api/context/tools/get_primary_case", {
    headers: { origin: new URL(page.url()).origin },
    data: {},
  });
  expect((await facts.json()).data.displayName).toBe("Synthetic Patient 031");
  await page.getByRole("button", { name: "Clear active context" }).click();
  await expect(page.getByLabel("Active context")).toContainText(
    "No active scenario",
  );
  await page.reload();
  await expect(
    page.getByRole("button", { name: "Start briefing" }),
  ).toBeDisabled();
  const empty = await page.request.post(
    "/api/context/tools/get_context_summary",
    { data: {}, headers: { origin: new URL(page.url()).origin } },
  );
  expect((await empty.json()).message).toBe(
    "The supplied scenario does not include that information.",
  );
});
test("paste errors and upload HTML remain plain data", async ({ page }) => {
  await page.goto("/context");
  await page.getByText("Paste JSON instead", { exact: true }).click();
  await page
    .getByLabel("Scenario JSON", { exact: true })
    .fill('{"synthetic":false}');
  await page.getByRole("button", { name: "Validate JSON" }).click();
  await expect(page.locator(".inline-error[role=alert]")).toContainText(
    "synthetic",
  );
  await expect(
    page.getByRole("button", { name: "Activate scenario" }),
  ).toBeDisabled();
  const upload = {
    ...morning,
    description: '<img src=x onerror="window.contextExecuted=true">',
  };
  await page.getByLabel("Upload JSON scenario", { exact: true }).setInputFiles({
    name: "scenario.json",
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify(upload)),
  });
  await expect(page.getByRole("status")).toContainText("Valid Samantha");
  await expect(
    page.getByText(upload.description, { exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(() => Object.hasOwn(window, "contextExecuted")),
  ).toBe(false);
  expect(await page.locator('img[src="x"]').count()).toBe(0);
  await page.getByRole("button", { name: "Activate scenario" }).click();
  await expect(page.getByRole("status")).toContainText("activated");
  await page.getByText("Paste JSON instead", { exact: true }).click();
  // The uploaded scenario can also be pasted and validated.
  await page.getByText("Paste JSON instead", { exact: true }).click();
  await page
    .getByLabel("Scenario JSON", { exact: true })
    .fill(JSON.stringify(morning));
  await page.getByRole("button", { name: "Validate JSON" }).click();
  await expect(page.getByRole("status")).toContainText("Valid Samantha");
});
test("drop JSON on mobile and start briefing without losing language selection", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/context");
  const transfer = await page.evaluateHandle((s) => {
    const data = new DataTransfer();
    data.items.add(
      new File([JSON.stringify(s)], "demo.json", { type: "application/json" }),
    );
    return data;
  }, morning);
  await page
    .locator(".context-dropzone")
    .dispatchEvent("drop", { dataTransfer: transfer });
  await expect(page.getByRole("status")).toContainText("Valid Samantha");
  await page.getByRole("button", { name: "Activate scenario" }).click();
  await expect(page.getByRole("status")).toContainText("activated");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await page.screenshot({
    path: "test-results/context-mobile.png",
    fullPage: true,
  });
  await page.getByRole("button", { name: "Start briefing" }).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(
    page.getByRole("combobox", { name: "Voice language", exact: true }),
  ).toBeVisible();
});
