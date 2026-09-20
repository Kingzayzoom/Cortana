import { test, expect } from "@playwright/test";

test("catalog filters, favorites, previews and persistent scenario switching", async ({
  page,
}) => {
  await page.goto("/context");
  const library = page.getByRole("region", { name: "Choose the context." });
  const cards = library.getByRole("article");
  await expect(cards).toHaveCount(15);
  await expect(cards.nth(0)).toHaveAttribute(
    "aria-label",
    "Heart failure / Urgent hypotension",
  );
  await expect(cards.nth(1)).toHaveAttribute(
    "aria-label",
    "Morning shift overview",
  );
  await expect(cards.nth(2)).toHaveAttribute(
    "aria-label",
    "Rapid-response activation",
  );
  await library
    .getByRole("button", { name: "Operations", exact: true })
    .click();
  await expect(cards).toHaveCount(5);
  await library.getByLabel("Physician urgency").selectOption("urgent");
  await expect(cards).toHaveCount(0);
  await library.getByRole("button", { name: "Clear filters" }).click();
  await library
    .getByRole("searchbox", { name: "Search scenarios" })
    .fill("stable");
  await expect(cards).toHaveCount(3);
  await library.getByRole("searchbox").fill("");
  await library.getByLabel("Physician urgency").selectOption("immediate");
  await expect(cards).toHaveCount(1);
  await library.getByLabel("Physician urgency").selectOption("all");
  for (const [title, id, urgency] of [
    [
      "Heart failure / Urgent hypotension",
      "01-hf-urgent-hypotension",
      "urgent",
    ],
    ["Post-PCI observation / Stable", "03-post-pci-stable", "routine"],
    ["Rapid-response activation", "13-rapid-response", "immediate"],
  ]) {
    await library
      .getByRole("article", { name: title, exact: true })
      .getByRole("button", { name: "Preview", exact: true })
      .click();
    const dialog = page.getByRole("dialog", { name: "Scenario summary" });
    await expect(dialog).toContainText("No real patient information");
    await expect(dialog).toContainText("Dr. Zabish");
    await expect(dialog).toContainText("Hospital status");
    await dialog
      .getByRole("button", { name: "Activate scenario", exact: true })
      .click();
    await expect(dialog).toBeHidden();
    await expect(
      page.getByLabel("Active context", { exact: true }),
    ).toContainText(title);
    const response = await page.request.post(
      "/api/context/tools/get_context_summary",
      { data: {}, headers: { origin: new URL(page.url()).origin } },
    );
    const facts = await response.json();
    expect(facts.scenarioId).toBe(id);
    expect(facts.data.physicianUrgency.level).toBe(urgency);
  }
  await page.reload();
  await expect(
    page.getByLabel("Active context", { exact: true }),
  ).toContainText("Rapid-response activation");
  await page.getByRole("button", { name: "Reset demo context" }).click();
  await expect(
    page.getByLabel("Active context", { exact: true }),
  ).toContainText("Heart failure / Urgent hypotension");
});

test("mobile preview is keyboard-accessible and does not activate on dismissal", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/context");
  await expect(
    page.getByLabel("Active context", { exact: true }),
  ).toContainText("Heart failure / Urgent hypotension");
  const active = await page
    .getByLabel("Active context", { exact: true })
    .innerText();
  const card = page.getByRole("article", {
    name: "Morning shift overview",
    exact: true,
  });
  await card.getByRole("button", { name: "Preview", exact: true }).click();
  const dialog = page.getByRole("dialog", { name: "Scenario summary" });
  await expect(dialog).toContainText("Synthetic Patient 042");
  await expect(dialog).toContainText("Synthetic Patient 043");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(
    card.getByRole("button", { name: "Preview", exact: true }),
  ).toBeFocused();
  expect(
    await page.getByLabel("Active context", { exact: true }).innerText(),
  ).toBe(active);
});
