import { defineConfig } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 8099);
const BASE_URL = "http://127.0.0.1:" + PORT;

// The app ships inside an Android WebView, so this is Chromium at a phone
// viewport. The timezone is pinned so that dated tests do not depend on the
// machine running them; Kolkata is east of UTC and off the hour, so it also
// breaks whole-hour assumptions. The unit tests cover the date helpers on both
// sides of the meridian.
const phone = {
  viewport: { width: 412, height: 915 },
  locale: "en-US",
  timezoneId: "Asia/Kolkata",
};

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
    { name: "phone", use: phone },
  ],
  webServer: {
    command: "node e2e/server.js " + PORT,
    url: BASE_URL,
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "pipe",
  },
});
