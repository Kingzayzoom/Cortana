import { chromium } from "@playwright/test";
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
page.on("console", (m) => console.log(m.type(), m.text()));
page.on("pageerror", (error) => console.log("PAGE ERROR", error.message));
await page.goto("http://localhost:3100");
await page.locator("canvas").waitFor();
await page.waitForTimeout(4000);
await page.screenshot({ path: "test-results/playwright-orb.png" });
console.log(
  await page.locator("canvas").evaluate((c) => {
    const gl = c.getContext("webgl2");
    return {
      program: !!gl.getParameter(gl.CURRENT_PROGRAM),
      errors: gl.getError(),
      lost: gl.isContextLost(),
    };
  }),
);
await browser.close();
