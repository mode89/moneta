// Android's back button closes one overlay at a time, innermost first, and
// leaves the app only when nothing is open. The button exists on the device
// alone, so these tests drive the plugin event the WebView would deliver.
import {
  test,
  expect,
  nativeCalls,
  pressBackButton,
  chooseFileToImport,
} from "./fixtures.js";

const FEBRUARY = "2026-02-12T12:00:00Z";

const stored = [
  {
    id: 1,
    amount: 12.5,
    description: "Groceries",
    date: "2026-02-12",
    categories: ["food"],
  },
];

test.beforeEach(async ({ app }) => {
  await app.open({ now: FEBRUARY, expenses: stored, native: true });
});

test("back closes the add sheet and keeps the app", async ({ app, page }) => {
  await app.openNewExpense();

  await pressBackButton(page);

  await expect(app.sheet).toHaveCount(0);
  await expect(app.header).toBeVisible();
  expect(await nativeCalls(page)).toEqual([]);
});

test("back closes the edit sheet without saving", async ({ app, page }) => {
  await app.openExpense("Groceries");
  await app.fillForm({ amount: "99" });

  await pressBackButton(page);

  await expect(app.sheet).toHaveCount(0);
  await expect(app.amountOf("Groceries")).toHaveText("12.50");
});

test("back closes settings", async ({ app, page }) => {
  await app.openSettings();

  await pressBackButton(page);

  await expect(app.settings).toHaveCount(0);
});

test("back refuses the delete confirmation and leaves the sheet open", async ({
  app,
  page,
}) => {
  await app.openExpense("Groceries");
  await app.deleteButton.click();
  await expect(app.card).toBeVisible();

  await pressBackButton(page);

  await expect(app.card).toHaveCount(0);
  await expect(app.sheet).toBeVisible();
  await expect(app.expenseItem("Groceries")).toBeVisible();
});

test("back refuses the import confirmation and keeps settings open", async ({
  app,
  page,
}) => {
  await chooseFileToImport(app, { content: JSON.stringify([]) });
  await expect(app.card).toBeVisible();

  await pressBackButton(page);

  await expect(app.card).toHaveCount(0);
  await expect(app.settings).toBeVisible();
  await expect(app.expenseItem("Groceries")).toBeVisible();
});

test("back leaves the app when nothing is open", async ({ page }) => {
  await pressBackButton(page);

  await expect
    .poll(() => nativeCalls(page))
    .toEqual([{ plugin: "App", method: "exitApp" }]);
});

// A closing overlay is still on screen while it slides away, so a second press
// in that moment is still aimed at it and must not close the app.
test("back twice in a moment closes the sheet without leaving", async ({
  app,
  page,
}) => {
  await app.openNewExpense();

  await pressBackButton(page);
  await pressBackButton(page);

  await expect(app.sheet).toHaveCount(0);
  expect(await nativeCalls(page)).toEqual([]);
});

test("back leaves the app once the sheet has gone", async ({ app, page }) => {
  await app.openNewExpense();
  await pressBackButton(page);
  await app.settled();

  await pressBackButton(page);

  await expect
    .poll(() => nativeCalls(page))
    .toEqual([{ plugin: "App", method: "exitApp" }]);
});
