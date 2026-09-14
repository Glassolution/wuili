import { chromium } from "playwright";

const browser = await chromium.launch({
  headless: false,
  args: ["--remote-debugging-port=9222"],
});
const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await context.newPage();
await page.goto("http://localhost:8080/login");
console.log("READY");
// Keep process alive; browser stays open for reconnection over CDP.
await new Promise(() => {});
