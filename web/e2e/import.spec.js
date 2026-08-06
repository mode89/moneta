// Importing discards whatever is on the device, so it asks first and every
// failure path leaves the existing expenses alone.
import { test, expect, importFile, chooseFileToImport } from "./fixtures.js";

const FEBRUARY = "2026-02-12T12:00:00Z";

const existing = [
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
  {
    id: 11,
    amount: 7.5,
    description: "Lunch",
    date: "2026-02-12",
    categories: [],
  },
];

const json = (value) => JSON.stringify(value, null, 2);

test.describe("importing expenses", () => {
  test.beforeEach(async ({ app }) => {
    await app.open({ now: FEBRUARY, expenses: existing });
  });

  test("asks before replacing anything, naming the file", async ({ app }) => {
    await chooseFileToImport(app, {
      name: "moneta-2026-02-12.json",
      content: json(imported),
    });

    await expect(app.cardTitle).toHaveText("Import this file?");
    await expect(app.cardBody).toHaveText(
      "moneta-2026-02-12.json holds 2 expenses. Importing removes the 1 expense on this device and cannot be undone.",
    );
    await expect(app.cancelButton).toHaveText("Keep mine");
    await expect(app.confirmButton).toHaveText("Import");
    expect(await app.stored()).toEqual(existing);
  });

  test("keeps what is on the device when the question is refused", async ({
    app,
  }) => {
    await chooseFileToImport(app, { content: json(imported) });

    await app.cancelButton.click();
    await app.closeSettings();

    await expect(app.expenseItem("Groceries")).toBeVisible();
    await expect(app.expenseItem("Bus")).toHaveCount(0);
    expect(await app.stored()).toEqual(existing);
  });

  test("keeps what is on the device when the dim is tapped", async ({
    app,
  }) => {
    await chooseFileToImport(app, { content: json(imported) });

    await app.dismissDialog();

    await expect(app.card).toHaveCount(0);
    await expect(app.settings).toBeVisible();
    expect(await app.stored()).toEqual(existing);
  });

  test("replaces the expenses on the device once accepted", async ({
    app,
    dialogs,
  }) => {
    await importFile(app, { content: json(imported) });

    await expect(app.rows).toHaveCount(2);
    await expect(app.expenseItem("Groceries")).toHaveCount(0);
    await expect(app.expenseItem("Bus")).toBeVisible();
    await expect(app.amountOf("Lunch")).toHaveText("7.50");
    await expect(app.categoriesOf("Bus")).toHaveText("travel");
    expect(dialogs.messages).toEqual([]);
  });

  test("returns to the list, grouped and totalled", async ({ app }) => {
    await importFile(app, { content: json(imported) });

    await expect(app.settings).toHaveCount(0);
    await expect(app.listedDays).toHaveText(["Today", "Yesterday"]);
    await expect(app.dayTotal("Today")).toHaveText("$7.50");
    await expect(app.dayTotal("Yesterday")).toHaveText("$5.00");
    await expect(app.totalSpent).toHaveText("$12.50");
  });

  test("saves the imported expenses", async ({ app }) => {
    await importFile(app, { content: json(imported) });

    await expect(app.saveNotice).toHaveText("Saved");
    expect(await app.stored()).toEqual(imported);
  });

  test("survives a reload", async ({ app, page }) => {
    await importFile(app, { content: json(imported) });
    await expect(app.rows).toHaveCount(2);

    await page.reload();

    await expect(app.rows).toHaveCount(2);
    await expect(app.expenseItem("Bus")).toBeVisible();
  });

  test("sorts the categories it reads", async ({ app }) => {
    await importFile(app, {
      content: json([
        { ...imported[0], categories: ["travel", "bus", "commute"] },
      ]),
    });

    await expect(app.categoriesOf("Bus")).toHaveText("bus · commute · travel");
    expect(await app.stored()).toEqual([
      expect.objectContaining({ categories: ["bus", "commute", "travel"] }),
    ]);
  });

  test("accepts an expense stored without categories", async ({ app }) => {
    await importFile(app, {
      content: json([
        { id: 10, amount: 5, description: "Bus", date: "2026-02-11" },
      ]),
    });

    await expect(app.expenseItem("Bus")).toBeVisible();
    await expect(app.categoriesOf("Bus")).toHaveCount(0);
  });

  test("an empty file clears the list", async ({ app }) => {
    await chooseFileToImport(app, { content: "[]" });

    await expect(app.cardBody).toContainText("moneta.json holds 0 expenses.");
    await app.confirmButton.click();

    await expect(app.emptyMessage).toBeVisible();
    await expect(app.totalSpent).toHaveText("$0.00");
    expect(await app.stored()).toEqual([]);
  });

  test("says what an import into an empty device replaces", async ({ app }) => {
    await importFile(app, { content: "[]" });

    await chooseFileToImport(app, { content: json(imported) });

    await expect(app.cardBody).toHaveText(
      "moneta.json holds 2 expenses. Importing replaces everything on this device and cannot be undone.",
    );
  });

  test("backing out of the file picker changes nothing", async ({
    app,
    dialogs,
  }) => {
    await chooseFileToImport(app, { content: null });

    await expect(app.card).toHaveCount(0);
    expect(dialogs.messages).toEqual([]);
    expect(await app.stored()).toEqual(existing);
  });

  test.describe("a file it cannot use", () => {
    const rejectsOnSight = (name, content, message) =>
      test(name, async ({ app, dialogs }) => {
        await chooseFileToImport(app, { content });

        await dialogs.expectMessage(message);
        await expect(app.card).toHaveCount(0);
        expect(await app.stored()).toEqual(existing);
      });

    rejectsOnSight(
      "is not JSON at all",
      "this is not json",
      "Failed to import expenses: Unexpected token 'h', \"this is not json\" is not valid JSON",
    );

    rejectsOnSight(
      "is JSON but not a list",
      json({ id: 1 }),
      "Failed to import expenses: It holds no list of expenses.",
    );

    const rejectsOnImport = (name, content) =>
      test(name, async ({ app, dialogs }) => {
        await chooseFileToImport(app, { content });
        await expect(app.card).toBeVisible();

        await app.confirmButton.click();

        await dialogs.expectMessage("File contains errors.");
        await expect(app.expenseItem("Groceries")).toBeVisible();
        expect(await app.stored()).toEqual(existing);
      });

    rejectsOnImport(
      "holds an expense with no id",
      json([{ amount: 5, description: "Bus", date: "2026-02-11" }]),
    );

    rejectsOnImport(
      "holds an expense with no amount",
      json([{ id: 10, description: "Bus", date: "2026-02-11" }]),
    );

    rejectsOnImport(
      "holds an expense with a blank description",
      json([{ id: 10, amount: 5, description: "  ", date: "2026-02-11" }]),
    );

    rejectsOnImport(
      "holds an expense with an unreadable date",
      json([{ id: 10, amount: 5, description: "Bus", date: "not a date" }]),
    );

    rejectsOnImport(
      "holds an expense dated in the future",
      json([{ id: 10, amount: 5, description: "Bus", date: "2026-02-13" }]),
    );

    rejectsOnImport(
      "holds one bad expense among good ones",
      json([imported[0], { ...imported[1], amount: -1 }]),
    );

    test("logs what was wrong with each expense", async ({ app }) => {
      const logged = [];
      app.page.on("console", (message) => {
        if (message.type() === "error") logged.push(message.text());
      });

      await chooseFileToImport(app, {
        content: json([
          { ...imported[0], amount: 0 },
          { ...imported[1], description: "" },
        ]),
      });
      await app.confirmButton.click();

      await expect
        .poll(() => logged)
        .toEqual(["Invalid amount.", "Description cannot be empty."]);
    });
  });
});
