// Importing discards whatever is on the device, so every failure path has to
// leave the existing expenses alone.
import { test, expect, importFile } from "./fixtures.js";

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
    await app.open({ now: "2026-02-12T12:00:00Z", expenses: existing });
  });

  test("replaces the expenses on the device", async ({ app, dialogs }) => {
    await importFile(app, { content: json(imported) });

    await expect(app.expenseItems).toHaveCount(2);
    await expect(app.expenseItem("Groceries")).toHaveCount(0);
    await expect(app.expenseItem("Bus")).toBeVisible();
    await expect(app.amountOf("Lunch")).toHaveText("-$7.50");
    await expect(app.categoriesOf("Bus")).toHaveText("travel");
    expect(dialogs.messages).toEqual([]);
  });

  test("groups and totals what it imported", async ({ app }) => {
    await importFile(app, { content: json(imported) });

    expect(await app.listedDays()).toEqual(["2026-02-12", "2026-02-11"]);
    await expect(app.dayTotal("2026-02-12")).toHaveText("$7.50");
    await expect(app.dayTotal("2026-02-11")).toHaveText("$5.00");
    await expect(app.totalSpent).toHaveText("$12.50");
  });

  test("saves the imported expenses", async ({ app }) => {
    await importFile(app, { content: json(imported) });

    await expect(app.saveNotice).toHaveText("Saved");
    expect(await app.stored()).toEqual(imported);
  });

  test("survives a reload", async ({ app, page }) => {
    await importFile(app, { content: json(imported) });
    await expect(app.expenseItems).toHaveCount(2);

    await page.reload();

    await expect(app.expenseItems).toHaveCount(2);
    await expect(app.expenseItem("Bus")).toBeVisible();
  });

  test("sorts the categories it reads", async ({ app }) => {
    await importFile(app, {
      content: json([
        { ...imported[0], categories: ["travel", "bus", "commute"] },
      ]),
    });

    await expect(app.categoriesOf("Bus")).toHaveText("bus, commute, travel");
    expect(await app.stored()).toEqual([
      expect.objectContaining({ categories: ["bus", "commute", "travel"] }),
    ]);
  });

  test("accepts an expense stored without categories", async ({ app }) => {
    await importFile(app, {
      content: json([{ id: 10, amount: 5, description: "Bus", date: "2026-02-11" }]),
    });

    await expect(app.expenseItem("Bus")).toBeVisible();
    await expect(app.categoriesOf("Bus")).toHaveCount(0);
  });

  test("an empty file clears the list", async ({ app }) => {
    await importFile(app, { content: "[]" });

    await expect(app.emptyMessage).toBeVisible();
    await expect(app.totalSpent).toHaveText("$0.00");
    expect(await app.stored()).toEqual([]);
  });

  test("backing out of the file picker changes nothing", async ({
    app,
    dialogs,
  }) => {
    await importFile(app, { content: null });

    await expect(app.expenseItem("Groceries")).toBeVisible();
    expect(dialogs.messages).toEqual([]);
    expect(await app.stored()).toEqual(existing);
  });

  test.describe("a file it cannot use", () => {
    const rejects = (name, content, message) =>
      test(name, async ({ app, dialogs }) => {
        await importFile(app, { content });

        await dialogs.expectMessage(message);
        await expect(app.expenseItems).toHaveCount(1);
        await expect(app.expenseItem("Groceries")).toBeVisible();
        expect(await app.stored()).toEqual(existing);
      });

    rejects(
      "is not JSON at all",
      "this is not json",
      "Failed to import expenses: Unexpected token 'h', \"this is not json\" is not valid JSON",
    );

    rejects(
      "is JSON but not a list",
      json({ id: 1 }),
      "Failed to import expenses: JSON.parse(...).map is not a function",
    );

    rejects(
      "holds an expense with no id",
      json([{ amount: 5, description: "Bus", date: "2026-02-11" }]),
      "File contains errors.",
    );

    rejects(
      "holds an expense with no amount",
      json([{ id: 10, description: "Bus", date: "2026-02-11" }]),
      "File contains errors.",
    );

    rejects(
      "holds an expense with a blank description",
      json([{ id: 10, amount: 5, description: "  ", date: "2026-02-11" }]),
      "File contains errors.",
    );

    rejects(
      "holds an expense with an unreadable date",
      json([{ id: 10, amount: 5, description: "Bus", date: "not a date" }]),
      "File contains errors.",
    );

    rejects(
      "holds an expense dated in the future",
      json([{ id: 10, amount: 5, description: "Bus", date: "2026-02-13" }]),
      "File contains errors.",
    );

    test("rejects the whole file for one bad expense", async ({
      app,
      dialogs,
    }) => {
      await importFile(app, {
        content: json([imported[0], { ...imported[1], amount: -1 }]),
      });

      await dialogs.expectMessage("File contains errors.");
      await expect(app.expenseItem("Bus")).toHaveCount(0);
      await expect(app.expenseItem("Groceries")).toBeVisible();
    });

    test("logs what was wrong with each expense", async ({ app }) => {
      const logged = [];
      app.page.on("console", (message) => {
        if (message.type() === "error") logged.push(message.text());
      });

      await importFile(app, {
        content: json([
          { ...imported[0], amount: 0 },
          { ...imported[1], description: "" },
        ]),
      });

      await expect
        .poll(() => logged)
        .toEqual(["Invalid amount.", "Description cannot be empty."]);
    });
  });
});
