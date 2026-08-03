import { test, expect } from "./fixtures.js";

test.describe("adding an expense", () => {
  test.beforeEach(async ({ app }) => {
    await app.open();
  });

  test("opens a blank sheet dated today", async ({ app }) => {
    await app.openNewExpense();

    await expect(app.sheetTitle).toHaveText("Add an expense");
    await expect(app.submitButton).toHaveText("Save expense");
    await expect(app.amountInput).toHaveValue("");
    await expect(app.descriptionInput).toHaveValue("");
    await expect(app.dateInput).toHaveValue(await app.todayIso());
    await expect(app.categoryChips.filter({ hasText: "✕" })).toHaveCount(0);
    // Only the edit sheet offers deletion.
    await expect(app.deleteButton).toHaveCount(0);
  });

  test("labels its fields", async ({ app, page }) => {
    await app.openNewExpense();

    await expect(page.getByLabel("Amount")).toHaveAttribute("type", "number");
    await expect(page.getByLabel("Description")).toHaveAttribute(
      "type",
      "text",
    );
    await expect(page.getByLabel("Date")).toHaveAttribute("type", "date");
    await expect(app.amountInput).toHaveAttribute("placeholder", "0.00");
    await expect(app.amountInput).toHaveAttribute("step", "0.01");
  });

  test("lists the saved expense under today", async ({ app }) => {
    await app.addExpense({
      amount: "12.50",
      description: "Groceries",
      categories: "food",
    });

    await expect(app.emptyMessage).toHaveCount(0);
    await expect(app.rows).toHaveCount(1);
    await expect(app.dayHeading("Today")).toBeVisible();
    await expect(app.expenseItem("Groceries")).toBeVisible();
    await expect(app.amountOf("Groceries")).toHaveText("12.50");
    await expect(app.categoriesOf("Groceries")).toHaveText("food");
  });

  test("adds the amount to the day and month totals", async ({ app }) => {
    await app.addExpense({ amount: "12.50", description: "Groceries" });

    await expect(app.dayTotal("Today")).toHaveText("$12.50");
    await expect(app.totalSpent).toHaveText("$12.50");
    await expect(app.expenseCount).toHaveText("1 expense");
  });

  test("stores the expense in the JSON shape the device holds", async ({
    app,
  }) => {
    const today = await app.todayIso();

    await app.addExpense({
      amount: "12.50",
      description: "Groceries",
      categories: "food shopping",
    });

    expect(await app.stored()).toEqual([
      {
        id: expect.any(Number),
        amount: 12.5,
        description: "Groceries",
        date: today,
        categories: ["food", "shopping"],
      },
    ]);
    // Written the way `serializeExpenses` writes it: indented, dates as text.
    expect(await app.storedJson()).toContain('\n  {\n    "id"');
  });

  test("shows the Saved notice", async ({ app }) => {
    await app.addExpense({ amount: "1", description: "Coffee" });

    await expect(app.saveNotice).toHaveText("Saved");
  });

  test("trims the description", async ({ app }) => {
    await app.addExpense({ amount: "3", description: "   Coffee   " });

    await expect(app.expenseItem("Coffee")).toBeVisible();
    expect(await app.stored()).toEqual([
      expect.objectContaining({ description: "Coffee" }),
    ]);
  });

  test("shows no category line when none were chosen", async ({ app }) => {
    await app.addExpense({ amount: "3", description: "Coffee" });

    await expect(app.categoriesOf("Coffee")).toHaveCount(0);
    expect(await app.stored()).toEqual([
      expect.objectContaining({ categories: [] }),
    ]);
  });

  test("accepts a past date and heads the list with that day", async ({
    app,
  }) => {
    const yesterday = await app.isoDaysFromToday(-1);

    await app.addExpense({
      amount: "5",
      description: "Bus",
      date: yesterday,
    });

    await expect(app.dayHeading("Yesterday")).toBeVisible();
    expect(await app.stored()).toEqual([
      expect.objectContaining({ date: yesterday }),
    ]);
  });

  test("keeps fractional amounts to the cent", async ({ app }) => {
    await app.addExpense({ amount: "0.05", description: "Sweet" });

    await expect(app.amountOf("Sweet")).toHaveText("0.05");
    await expect(app.totalSpent).toHaveText("$0.05");
  });

  test("opens blank again after a save", async ({ app }) => {
    await app.addExpense({
      amount: "12.50",
      description: "Groceries",
      categories: "food",
    });

    await app.openNewExpense();

    await expect(app.amountInput).toHaveValue("");
    await expect(app.descriptionInput).toHaveValue("");
    await expect(app.categoryChips.filter({ hasText: "✕" })).toHaveCount(0);
    await expect(app.dateInput).toHaveValue(await app.todayIso());
  });

  test("tapping the dim discards the expense", async ({ app }) => {
    await app.openNewExpense();
    await app.fillForm({ amount: "12.50", description: "Groceries" });

    await app.dismissDialog();

    await expect(app.sheet).toHaveCount(0);
    await expect(app.emptyMessage).toBeVisible();
    expect(await app.stored()).toBe(null);
  });

  test("adds a second expense to the same day", async ({ app }) => {
    await app.addExpense({ amount: "10", description: "Lunch" });
    await app.addExpense({ amount: "2.25", description: "Coffee" });

    await expect(app.dayHeadings).toHaveCount(1);
    await expect(app.rows).toHaveCount(2);
    await expect(app.dayTotal("Today")).toHaveText("$12.25");
    await expect(app.totalSpent).toHaveText("$12.25");
    // Ids are creation timestamps and a day lists the newest first.
    await expect(app.listedDescriptions).toHaveText(["Coffee", "Lunch"]);
  });
});
