// Inside the app the WebView injects an `Android` object and import/export go
// through it instead of through the browser's download and file picker. The
// object is absent in a plain browser, so both branches have to keep working.
import { test, expect, androidCalls, respondToPickFile } from "./fixtures.js";

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

const imported = [
  {
    id: 10,
    amount: 5,
    description: "Bus",
    date: "2026-02-11",
    categories: ["travel"],
  },
];

test.describe("with the Android bridge present", () => {
  test.beforeEach(async ({ app }) => {
    await app.open({ now: FEBRUARY, expenses: stored, android: true });
    await app.openSettings();
  });

  test("export hands the file to the host, not to the browser", async ({
    app,
    page,
  }) => {
    let downloads = 0;
    page.on("download", () => (downloads += 1));

    await app.exportRow.click();

    const { createFile } = await androidCalls(page);
    expect(createFile).toHaveLength(1);
    expect(createFile[0].filename).toBe("moneta-2026-02-12.json");
    expect(JSON.parse(createFile[0].content)).toEqual(stored);
    expect(downloads).toBe(0);
    await expect(page.locator("a[download]")).toHaveCount(0);
  });

  test("import asks the host for a file", async ({ app, page }) => {
    await app.importRow.click();

    await expect.poll(async () => (await androidCalls(page)).pickFile).toBe(1);
    // No browser file input is created on this branch.
    await expect(page.locator("input[type=file]")).toHaveCount(0);
  });

  test("the file the host returns is confirmed before it replaces anything", async ({
    app,
    page,
  }) => {
    await app.importRow.click();
    await expect.poll(async () => (await androidCalls(page)).pickFile).toBe(1);

    await respondToPickFile(page, JSON.stringify(imported));

    // The host hands over text, not a name, so the card says "This file".
    await expect(app.cardBody).toHaveText(
      "This file holds 1 expense. Importing removes the 1 expense on this device and cannot be undone.",
    );
    expect(await app.stored()).toEqual(stored);
  });

  test("the file the host returns replaces the expenses once accepted", async ({
    app,
    page,
    dialogs,
  }) => {
    await app.importRow.click();
    await expect.poll(async () => (await androidCalls(page)).pickFile).toBe(1);
    await respondToPickFile(page, JSON.stringify(imported));

    await app.confirmButton.click();

    await expect(app.expenseItem("Bus")).toBeVisible();
    await expect(app.expenseItem("Groceries")).toHaveCount(0);
    await expect(app.categoriesOf("Bus")).toHaveText("travel");
    await expect(app.saveNotice).toHaveText("Saved");
    expect(await app.stored()).toEqual(imported);
    expect(dialogs.messages).toEqual([]);
  });

  test("a file the host returns that cannot be read is refused", async ({
    app,
    page,
    dialogs,
  }) => {
    await app.importRow.click();
    await expect.poll(async () => (await androidCalls(page)).pickFile).toBe(1);

    await respondToPickFile(page, "not json");

    await dialogs.expectMessage(
      "Failed to import expenses: Unexpected token 'o', \"not json\" is not valid JSON",
    );
    await expect(app.card).toHaveCount(0);
    expect(await app.stored()).toEqual(stored);
  });

  test("an invalid expense from the host is refused", async ({
    app,
    page,
    dialogs,
  }) => {
    await app.importRow.click();
    await expect.poll(async () => (await androidCalls(page)).pickFile).toBe(1);
    await respondToPickFile(
      page,
      JSON.stringify([{ ...imported[0], id: null }]),
    );

    await app.confirmButton.click();

    await dialogs.expectMessage("File contains errors.");
    await expect(app.expenseItem("Groceries")).toBeVisible();
    expect(await app.stored()).toEqual(stored);
  });

  test("everything else still works", async ({ app }) => {
    await app.closeSettings();

    await app.addExpense({
      amount: "5",
      description: "Bus",
      date: "2026-02-12",
    });

    await expect(app.expenseItem("Bus")).toBeVisible();
    await expect(app.totalSpent).toHaveText("$17.50");
  });
});

test.describe("without the Android bridge", () => {
  test("export falls back to a browser download", async ({ app, page }) => {
    await app.open({ now: FEBRUARY, expenses: stored });
    await app.openSettings();

    const download = page.waitForEvent("download");
    await app.exportRow.click();

    expect((await download).suggestedFilename()).toBe("moneta-2026-02-12.json");
    expect(await page.evaluate(() => "Android" in window)).toBe(false);
  });
});
