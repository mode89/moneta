// Exporting in a plain browser hands the file to the download machinery; the
// native branch is covered in capacitor-bridge.spec.js.
import { test, expect, downloadedText, exportFile } from "./fixtures.js";

const FEBRUARY = "2026-02-12T12:00:00Z";

const expenses = [
  {
    id: 1,
    amount: 12.5,
    description: "Groceries",
    date: "2026-02-12",
    categories: ["food", "shopping"],
  },
  {
    id: 2,
    amount: 3.25,
    description: "Coffee",
    date: "2026-02-10",
    categories: [],
  },
];

test.describe("exporting expenses", () => {
  test("downloads a file named for today", async ({ app }) => {
    await app.open({ now: FEBRUARY, expenses });

    const download = await exportFile(app);

    expect(download.suggestedFilename()).toBe("moneta-2026-02-12.json");
  });

  test("writes the stored JSON shape", async ({ app }) => {
    await app.open({ now: FEBRUARY, expenses });

    const contents = await downloadedText(await exportFile(app));

    expect(JSON.parse(contents)).toEqual(expenses);
    // `serializeExpenses` indents with two spaces, and dates stay text.
    expect(contents).toContain('\n  {\n    "id": 1,');
    expect(contents).toContain('"date": "2026-02-12"');
  });

  test("exports what is on screen, edits included", async ({ app }) => {
    await app.open({ now: FEBRUARY, expenses });
    await app.openExpense("Coffee");
    await app.fillForm({ amount: "4", categories: "drinks" });
    await app.submit();
    await expect(app.sheet).toHaveCount(0);

    const contents = await downloadedText(await exportFile(app));

    expect(JSON.parse(contents)).toEqual([
      expenses[0],
      { ...expenses[1], amount: 4, categories: ["drinks"] },
    ]);
    expect(contents).toBe(await app.storedJson());
  });

  test("exports an empty list as an empty array", async ({ app }) => {
    await app.open({ now: FEBRUARY });

    const contents = await downloadedText(await exportFile(app));

    expect(JSON.parse(contents)).toEqual([]);
  });

  test("changes nothing on the page", async ({ app, dialogs }) => {
    await app.open({ now: FEBRUARY, expenses });

    await exportFile(app);
    await app.closeSettings();

    await expect(app.rows).toHaveCount(2);
    await expect(app.sheet).toHaveCount(0);
    await expect(app.saveNotice).toHaveCount(0);
    expect(dialogs.messages).toEqual([]);
  });

  test("leaves no stray link in the document", async ({ app, page }) => {
    await app.open({ now: FEBRUARY, expenses });

    await exportFile(app);

    await expect(page.locator("a[download]")).toHaveCount(0);
  });
});
