// Extended browser smoke: walk every scene, capture screenshots, collect
// console/page errors, and verify settings persistence across reload.
import { chromium } from "playwright";

const OUT = process.env.SHOT_DIR || ".";
const URL = process.env.SHOT_URL || "http://localhost:4174/";

// SHOT_CHROMIUM lets CI/containers point at a preinstalled browser instead of
// downloading one (e.g. /opt/pw-browsers/chromium).
const browser = await chromium.launch(
  process.env.SHOT_CHROMIUM ? { executablePath: process.env.SHOT_CHROMIUM } : {},
);
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on("console", (m) => {
  if (m.type() === "error") errors.push(m.text());
});
page.on("pageerror", (e) => errors.push("PAGEERROR: " + e.message));

const key = async (k, ms = 160) => {
  await page.keyboard.press(k);
  await page.waitForTimeout(ms);
};
const shot = (name) => page.screenshot({ path: `${OUT}/${name}.png` });

await page.goto(URL, { waitUntil: "networkidle" });
await page.waitForTimeout(500);
await shot("01-title");

await key("KeyO", 300); // title → settings
await shot("02-settings-from-title");
await key("ArrowDown");
await key("ArrowLeft"); // tweak a volume slider
await key("ArrowLeft");
await shot("03-settings-adjusted");
await key("Escape", 300);

await key("Enter", 400); // → hub
await shot("04-hub");

await key("KeyC", 350); // → soul select (화신)
await shot("05-soul-select");
await key("ArrowRight");
await shot("06-soul-select-browse");
await key("Escape", 300);

await key("KeyD", 350); // → codex (명부록/공과록/업경대)
await shot("07-codex");
await key("Tab", 250);
await shot("08-codex-page2");
await key("Tab", 250);
await shot("09-codex-page3");
await key("Escape", 300);

await key("KeyF", 350); // → daily (명부 고시)
await shot("10-daily");
await key("Escape", 300);

await key("KeyS", 350); // → vow scene (출발 준비)
await shot("11-vows");
await key("ArrowDown");
await key("Space", 200); // toggle a vow
await shot("12-vow-toggled");
await key("Enter", 700); // start the run
await shot("13-run-start");

// wander + interact
for (const k of ["ArrowRight", "ArrowRight", "ArrowDown", "ArrowDown", "ArrowLeft", "ArrowUp", "ArrowRight", "ArrowDown", "ArrowRight", "ArrowRight"]) {
  await key(k, 110);
}
await shot("14-run-moved");
await key("Period", 150); // wait action
await key("Digit1", 200); // use talisman slot 1 if held
await shot("15-run-actions");

// settings persistence across reload
const stored = await page.evaluate(() => localStorage.getItem("hwansang_meta_v1") ?? Object.keys(localStorage).map((k) => `${k}`).join(","));
await page.reload({ waitUntil: "networkidle" });
await page.waitForTimeout(400);
await shot("16-after-reload");

// mobile viewport: touch controls visible?
const mob = await browser.newPage({ viewport: { width: 420, height: 860 }, hasTouch: true, isMobile: true });
mob.on("pageerror", (e) => errors.push("MOBILE PAGEERROR: " + e.message));
await mob.goto(URL, { waitUntil: "networkidle" });
await mob.waitForTimeout(500);
await mob.screenshot({ path: `${OUT}/17-mobile-title.png` });
await mob.tap("canvas").catch(() => {});
await mob.waitForTimeout(400);
await mob.screenshot({ path: `${OUT}/18-mobile-hub.png` });

console.log("localStorage sample:", (stored ?? "").slice(0, 120));
console.log("ERRORS:" + JSON.stringify(errors, null, 2));
await browser.close();
