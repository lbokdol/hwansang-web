import { chromium } from "playwright";

const OUT = process.env.SHOT_DIR || ".";
const URL = process.env.SHOT_URL || "http://localhost:4174/hwansang/";

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/01-title.png` });

await page.keyboard.press("Enter"); // -> hub
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/02-hub.png` });

await page.keyboard.press("KeyD"); // -> codex
await page.waitForTimeout(250);
await page.screenshot({ path: `${OUT}/03-codex.png` });
await page.keyboard.press("Escape"); // back to hub
await page.waitForTimeout(150);

await page.keyboard.press("KeyS"); // start run
await page.waitForTimeout(500);
await page.screenshot({ path: `${OUT}/04-run.png` });

for (const k of ["ArrowRight", "ArrowRight", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowUp", "ArrowRight"]) {
  await page.keyboard.press(k);
  await page.waitForTimeout(90);
}
await page.screenshot({ path: `${OUT}/05-run-moved.png` });

console.log("ERRORS:" + JSON.stringify(errors, null, 2));
await browser.close();
