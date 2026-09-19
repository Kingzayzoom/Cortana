import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";
await mkdir("test-results", { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (error) => errors.push(error.message));
for (const width of [1440, 768, 390, 320]) {
  await page.setViewportSize({ width, height: 900 });
  for (const route of ["/", "/impiricus"]) {
    await page.goto(
      (process.env.CORTANA_TEST_URL || "http://localhost:3102") + route,
    );
    await page.locator(".header-greeting").waitFor();
    await page.waitForTimeout(1200);
    const overflow = await page.evaluate(() =>
      Array.from(document.querySelectorAll("main *"))
        .filter((e) => e.getBoundingClientRect().right > innerWidth + 1)
        .map((e) => ({
          tag: e.tagName,
          class: e.className,
          right: e.getBoundingClientRect().right,
        })),
    );
    console.log(JSON.stringify({ width, route, overflow }));
    await page.screenshot({
      path: `test-results/learning-${route === "/" ? "home" : "bridge"}-${width}.png`,
      fullPage: true,
    });
  }
}
console.log(JSON.stringify({ errors }));
await browser.close();
if (errors.length) process.exitCode = 1;
