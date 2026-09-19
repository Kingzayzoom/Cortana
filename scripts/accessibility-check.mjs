import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const issues = [];
for (const route of [
  "/",
  "/evidence",
  "/rounds",
  "/profile",
  "/topics",
  "/settings",
]) {
  await page.goto(`http://localhost:3100${route}`);
  await page.locator(".header-greeting").waitFor();
  const report = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  issues.push(
    ...report.violations.map((v) => ({
      route,
      id: v.id,
      impact: v.impact,
      elements: v.nodes.map((n) => ({
        target: n.target,
        summary: n.failureSummary,
      })),
    })),
  );
}
console.log(JSON.stringify(issues, null, 2));
await browser.close();
if (issues.length) process.exitCode = 1;
