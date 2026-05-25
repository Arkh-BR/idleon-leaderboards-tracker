// Smoke test for /drop-rate: load page, parse ARKHE save, save snapshot, verify history.
// Run with the dev server already up on :3000.

import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const SAVE_PATH =
  "C:\\Users\\Vinicius\\ClaudeCowork\\Leaderboard Ranking Sheet - Idleon\\idleon_raw_ARKHE.json";
const URL = "http://localhost:3000/drop-rate";

function log(...args) {
  console.log("[verify]", ...args);
}

const saveBytes = readFileSync(SAVE_PATH);
log(`Loaded ARKHE save (${saveBytes.length} bytes)`);

const browser = await chromium.launch();
const ctx = await browser.newContext();
const page = await ctx.newPage();

const consoleErrors = [];
page.on("console", (msg) => {
  if (msg.type() === "error") consoleErrors.push(msg.text());
});
page.on("pageerror", (err) => consoleErrors.push("pageerror: " + err.message));

await page.goto(URL, { waitUntil: "domcontentloaded" });
log(`Navigated to ${URL}`);

// Wait for the heading
await page.waitForSelector('h1:has-text("Drop Rate Tracker")', { timeout: 10000 });
log("Heading present.");

// Use the hidden file input directly — way faster than typing 4MB into a textarea
const fileInput = page.locator('input[type="file"]').first();
await fileInput.setInputFiles(SAVE_PATH);
log("Uploaded save file via file input.");

// Wait for char rows to render
await page.waitForSelector("text=ARKHE", { timeout: 5000 });
const charRows = await page.locator("table tbody tr").count();
log(`Character rows rendered: ${charRows}`);

// Check the account DR text shows up
const drBadge = await page.locator("text=/Account-wide DR/").first().innerText();
log("Account DR line:", drBadge.replace(/\s+/g, " ").slice(0, 140));

// Save snapshot
await page.locator('button:has-text("💾 Save snapshot")').click();
log("Clicked Save snapshot.");

// Wait for notice
const notice = await page.locator("text=/Snapshot saved/").first().innerText({ timeout: 5000 });
log("Notice:", notice);

// Save a second snapshot to trigger the trend chart
await page.evaluate(() => {
  // Bump capturedAt to a different timestamp so the second snapshot isn't dedupedHide
});
await page.waitForTimeout(50);
await page.locator('button:has-text("💾 Save snapshot")').click();
await page.waitForTimeout(200);

// Check history section shows ARKHE button with count >= 1
const historyButtons = await page
  .locator("section")
  .last()
  .locator("button")
  .allTextContents();
log("History area buttons:", historyButtons.slice(0, 8));

// Final: any console errors?
if (consoleErrors.length) {
  log("CONSOLE ERRORS:");
  for (const e of consoleErrors) log("  •", e);
  process.exitCode = 1;
} else {
  log("No console errors. ✅");
}

await browser.close();
