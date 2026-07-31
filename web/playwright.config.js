import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 8099);
const BASE_URL = "http://127.0.0.1:" + PORT;

// The app ships inside an Android WebView, so both projects are Chromium at a
// phone viewport. They differ only in timezone: the unit tests run east and
// west of UTC for the same reason, and the UI is full of dates.
const phone = { viewport: { width: 412, height: 915 }, locale: "en-US" };

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: BASE_URL,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      name: "east-of-utc",
      use: { ...phone, timezoneId: "Asia/Kolkata" },
    },
    {
      name: "west-of-utc",
      use: { ...phone, timezoneId: "America/New_York" },
    },
  ],
  webServer: {
    command: "node e2e/server.js " + PORT,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "pipe",
  },
});
