const { chromium } = require("playwright");
const { spawn } = require("child_process");
const http = require("http");

function waitPort(port, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const check = () => {
      const req = http.get(`http://localhost:${port}/`, (res) => {
        resolve();
      });
      req.on("error", () => {
        if (Date.now() - startTime > timeout) {
          reject(new Error("Timeout waiting for port"));
        } else {
          setTimeout(check, 500);
        }
      });
    };
    check();
  });
}

async function run() {
  console.log("Starting Next.js dev server...");
  const devServer = spawn("npx", ["next", "dev", "-p", "3002"], {
    stdio: "inherit",
    shell: true,
  });

  try {
    await waitPort(3002, 20000);
    console.log("Dev server is ready. Launching Playwright...");

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewportSize({ width: 1280, height: 960 });

    console.log("Navigating to http://localhost:3002/...");
    await page.goto("http://localhost:3002/", { waitUntil: "networkidle" });
    await page.waitForTimeout(2000);

    console.log("Capturing screenshot...");
    await page.screenshot({ path: "screenshot.png", fullPage: false });
    console.log("Screenshot captured successfully as screenshot.png");

    await browser.close();
  } catch (err) {
    console.error("Error during screenshot:", err);
  } finally {
    console.log("Stopping dev server...");
    devServer.kill("SIGTERM");
    process.exit(0);
  }
}

run();
