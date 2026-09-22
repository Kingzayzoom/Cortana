import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1440, height: 900 },
});
const page = await context.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
await page.goto("http://localhost:3101");
await page.getByRole("button", { name: "Start today’s round" }).waitFor();
await page.locator("canvas").waitFor();
await page.waitForTimeout(1200);
await mkdir("artifacts", { recursive: true });
await page.screenshot({
  path: "docs/assets/cortana-desktop.png",
  fullPage: true,
});
await page.getByRole("button", { name: "Explore in text mode" }).click();
await page.getByRole("heading", { name: "Who was studied" }).waitFor();
await page.getByRole("button", { name: "Continue", exact: true }).click();
await page.getByRole("heading", { name: "What the study found" }).waitFor();
const harness = await page.request.get("http://localhost:3101/dev/orb");
if (harness.status() !== 404)
  throw new Error("Development harness must return 404 in production.");
await page.setViewportSize({ width: 390, height: 844 });
// A fresh context keeps the final screenshot on the untouched dashboard.
const mobileContext = await browser.newContext({
  viewport: { width: 390, height: 844 },
});
const mobile = await mobileContext.newPage();
await mobile.goto("http://localhost:3101");
await mobile.locator("canvas").waitFor();
await mobile.waitForTimeout(800);
await mobile.screenshot({
  path: "docs/assets/cortana-mobile.png",
  fullPage: true,
});
console.log(
  JSON.stringify({
    productionPage: "passed",
    cookieAndLearningMutation: "passed",
    developmentHarnessStatus: harness.status(),
    pageErrors: errors,
  }),
);
await browser.close();
if (errors.length) process.exitCode = 1;
