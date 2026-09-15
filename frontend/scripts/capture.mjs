import { chromium } from "@playwright/test";
import { mkdir } from "node:fs/promises";

await mkdir("../docs/screenshots", { recursive: true });
const browser = await chromium.launch();
try {
  const page = await browser.newPage({
    viewport: { width: 1440, height: 1000 },
  });
  await page.goto("http://127.0.0.1:5173/login");
  await page.screenshot({
    path: "../docs/screenshots/login.png",
    fullPage: true,
  });
  await page.getByLabel("Work email").fill("ananya.rao@northstar.example");
  await page.getByLabel("Password").fill("Strong-Capture-Password-2026");
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.getByRole("heading", { name: "Product overview" }).waitFor();
  await page.waitForTimeout(1500);
  await page.waitForFunction(() => !document.querySelector(".skeleton"));
  await page.mouse.move(1, 1);
  await page.screenshot({
    path: "../docs/screenshots/workspace.png",
    fullPage: true,
  });
  await page.getByRole("link", { name: /New investigation/ }).click();
  await page.getByRole("button", { name: "Run investigation" }).click();
  await page.getByRole("heading", { name: "Evidence review" }).waitFor();
  await page.waitForTimeout(150);
  await page.mouse.move(1, 1);
  await page.screenshot({
    path: "../docs/screenshots/investigation.png",
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload();
  await page.getByRole("heading", { name: "Evidence review" }).waitFor();
  await page.screenshot({
    path: "../docs/screenshots/mobile.png",
    fullPage: true,
  });
  const overflow = await page.evaluate(() => ({
    width: document.documentElement.scrollWidth,
    viewport: innerWidth,
    elements: [...document.querySelectorAll("*")]
      .map((element) => {
        const box = element.getBoundingClientRect();
        return {
          tag: element.tagName,
          className: element.className,
          left: box.left,
          right: box.right,
          width: box.width,
        };
      })
      .filter((item) => item.right > innerWidth + 1 || item.left < -1)
      .slice(0, 12),
  }));
  if (overflow.width > overflow.viewport)
    throw new Error(`Mobile overflow: ${JSON.stringify(overflow)}`);
  console.log(
    "Desktop and mobile screenshots saved; no mobile horizontal overflow.",
  );
} finally {
  await browser.close();
}
