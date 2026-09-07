const { chromium } = require("playwright");

async function run() {
  console.log("Launching Playwright to connect to localhost:3001...");
  try {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();

    // Set standard desktop viewport
    await page.setViewportSize({ width: 1280, height: 1020 });

    console.log("Navigating to http://localhost:3001/...");
    await page.goto("http://localhost:3001/", { 
      waitUntil: "networkidle", 
      timeout: 10000 
    });
    
    // Wait for fonts & animations
    await page.waitForTimeout(2000);

    console.log("Capturing screenshot of the hero section...");
    await page.screenshot({ path: "screenshot.png", fullPage: false });
    console.log("Screenshot saved successfully as screenshot.png");

    await browser.close();
  } catch (err) {
    console.error("Failed to capture screenshot:", err);
  }
}

run();
