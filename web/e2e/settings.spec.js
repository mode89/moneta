// Settings is a full screen behind the gear, holding only what is used a few
// times a year: export, import and the build version.
import { test, expect } from "./fixtures.js";
import { VERSION } from "./server.js";

const FEBRUARY = "2026-02-12T12:00:00Z";

const expenses = [
  {
    id: 1,
    amount: 12.5,
    description: "Groceries",
    date: "2026-02-12",
    categories: ["food"],
  },
];

test.describe("the settings screen", () => {
  test.beforeEach(async ({ app }) => {
    await app.open({ now: FEBRUARY, expenses });
  });

  test("opens from the gear and covers the whole app", async ({ app }) => {
    await app.openSettings();

    await expect(app.settings.getByRole("heading")).toHaveText("Settings");
    const cover = await app.settings.boundingBox();
    const shell = await app.app.boundingBox();
    expect(cover).toEqual(shell);
  });

  test("offers export and import, and says what import does", async ({
    app,
  }) => {
    await app.openSettings();

    await expect(app.exportRow).toContainText(
      "Save a JSON file you can keep or move",
    );
    await expect(app.importRow).toContainText("Replaces everything on this device");
  });

  test("shows the build version", async ({ app }) => {
    await app.openSettings();

    await expect(app.version).toHaveText("Version " + VERSION);
  });

  test("holds nothing else", async ({ app }) => {
    await app.openSettings();

    await expect(app.settings.locator(".set-row")).toHaveCount(2);
  });

  test("closes with the ✕ in the corner, leaving the list as it was", async ({
    app,
  }) => {
    await app.openSettings();

    await app.closeSettings();

    await expect(app.expenseItem("Groceries")).toBeVisible();
    await expect(app.totalSpent).toHaveText("$12.50");
  });

  test("saves nothing by being opened", async ({ app }) => {
    await app.openSettings();
    await app.closeSettings();

    await expect(app.saveNotice).toHaveCount(0);
    expect(await app.stored()).toEqual(expenses);
  });
});
