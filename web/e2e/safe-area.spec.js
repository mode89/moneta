// The app draws under the status and navigation bars, so every edge holds its
// own spacing plus the bar's inset. On a device Capacitor's SystemBars plugin
// sets the --safe-area-inset-* properties; these tests set them by hand, since
// no browser here has a notch. Whether the figures are right on hardware is a
// device-only question; that the CSS follows them is not.
import { test, expect } from "./fixtures.js";

const FEBRUARY = "2026-02-12T12:00:00Z";

function applyInsets(page, { top = "0px", bottom = "0px" } = {}) {
  return page.evaluate(
    ([top, bottom]) => {
      const style = document.documentElement.style;
      style.setProperty("--safe-area-inset-top", top);
      style.setProperty("--safe-area-inset-bottom", bottom);
    },
    [top, bottom],
  );
}

function styleOf(locator, property) {
  return locator.evaluate(
    (element, property) => getComputedStyle(element)[property],
    property,
  );
}

test.beforeEach(async ({ app }) => {
  await app.open({ now: FEBRUARY });
});

test("with no insets the app keeps its own spacing", async ({ app }) => {
  expect(await styleOf(app.header, "paddingTop")).toBe("24px");
  expect(await styleOf(app.list, "paddingBottom")).toBe("96px");
  expect(await styleOf(app.newExpenseButton, "bottom")).toBe("22px");
});

test("the status bar inset is added at the top", async ({ app, page }) => {
  await applyInsets(page, { top: "48px" });

  expect(await styleOf(app.header, "paddingTop")).toBe("72px");
  expect(await styleOf(app.settingsButton, "top")).toBe("68px");

  await app.openSettings();
  expect(await styleOf(app.settings.locator(".bar"), "paddingTop")).toBe(
    "72px",
  );
});

test("the navigation bar inset is added at the bottom", async ({
  app,
  page,
}) => {
  await applyInsets(page, { bottom: "24px" });

  expect(await styleOf(app.list, "paddingBottom")).toBe("120px");
  expect(await styleOf(app.newExpenseButton, "bottom")).toBe("46px");

  await app.openNewExpense();
  expect(await styleOf(app.sheet, "paddingBottom")).toBe("50px");
});
