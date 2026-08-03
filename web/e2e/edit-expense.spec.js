import { test, expect } from "./fixtures.js";

const FEBRUARY = "2026-02-12T12:00:00Z";

// Seeded expenses carry explicit ids; ids minted by the UI are timestamps.
const groceries = {
  id: 1,
  amount: 12.5,
  description: "Groceries",
  date: "2026-02-12",
  categories: ["food", "shopping"],
};
const coffee = {
  id: 2,
  amount: 3.25,
  description: "Coffee",
  date: "2026-02-12",
  categories: [],
};

test.describe("editing an expense", () => {
  test.beforeEach(async ({ app }) => {
    await app.open({ now: FEBRUARY, expenses: [groceries, coffee] });
  });

  test("opens the tapped expense, filled in", async ({ app }) => {
    await app.openExpense("Groceries");

    await expect(app.sheetTitle).toHaveText("Edit expense");
    await expect(app.submitButton).toHaveText("Save changes");
    await expect(app.amountInput).toHaveValue("12.5");
    await expect(app.descriptionInput).toHaveValue("Groceries");
    await expect(app.dateInput).toHaveValue("2026-02-12");
    await expect(app.categoryChip("food")).toContainText("✕");
    await expect(app.categoryChip("shopping")).toContainText("✕");
    await expect(app.deleteButton).toBeVisible();
  });

  test("opens the other expense when that one is tapped", async ({ app }) => {
    await app.openExpense("Coffee");

    await expect(app.descriptionInput).toHaveValue("Coffee");
    await expect(app.amountInput).toHaveValue("3.25");
    await expect(app.categoryChips.filter({ hasText: "✕" })).toHaveCount(0);
  });

  test("saves the changes and keeps the id", async ({ app }) => {
    await app.openExpense("Groceries");

    await app.fillForm({
      amount: "20",
      description: "Big groceries",
      categories: "food",
    });
    await app.submit();

    await expect(app.sheet).toHaveCount(0);
    await expect(app.listedDescriptions).toHaveText([
      "Coffee",
      "Big groceries",
    ]);
    await expect(app.amountOf("Big groceries")).toHaveText("20.00");
    await expect(app.categoriesOf("Big groceries")).toHaveText("food");
    expect(await app.stored()).toEqual([
      {
        id: 1,
        amount: 20,
        description: "Big groceries",
        date: "2026-02-12",
        categories: ["food"],
      },
      coffee,
    ]);
  });

  test("leaves the other expenses untouched", async ({ app }) => {
    await app.openExpense("Coffee");
    await app.fillForm({ amount: "4" });
    await app.submit();

    await expect(app.amountOf("Groceries")).toHaveText("12.50");
    await expect(app.amountOf("Coffee")).toHaveText("4.00");
    await expect(app.dayTotal("Today")).toHaveText("$16.50");
  });

  test("moves the expense when its date changes", async ({ app }) => {
    await app.openExpense("Coffee");

    await app.fillForm({ date: "2026-02-10" });
    await app.submit();

    await expect(app.dayHeadings).toHaveCount(2);
    await expect(app.dayTotal("Today")).toHaveText("$12.50");
    await expect(app.dayTotal("10 February")).toHaveText("$3.25");
    await expect(app.listedDays).toHaveText(["Today", "10 February"]);
  });

  test("tapping the dim keeps the expense as it was", async ({ app }) => {
    await app.openExpense("Groceries");
    await app.fillForm({ amount: "99", description: "Changed" });

    await app.dismissDialog();

    await expect(app.sheet).toHaveCount(0);
    await expect(app.expenseItem("Groceries")).toBeVisible();
    await expect(app.amountOf("Groceries")).toHaveText("12.50");
    // Nothing was saved, so storage still holds what was seeded.
    expect(await app.stored()).toEqual([groceries, coffee]);
  });

  test("reopening after a discard shows the stored values again", async ({
    app,
  }) => {
    await app.openExpense("Groceries");
    await app.fillForm({ amount: "99" });
    await app.dismissDialog();

    await app.openExpense("Groceries");

    await expect(app.amountInput).toHaveValue("12.5");
  });

  test("tapping an amount reveals numbers instead of opening the sheet", async ({
    app,
  }) => {
    await app.amountOf("Groceries").click();

    await expect(app.sheet).toHaveCount(0);
    await expect(app.amountOf("Groceries")).not.toHaveClass(/blur-text/);
  });
});

test.describe("deleting an expense", () => {
  test.beforeEach(async ({ app }) => {
    await app.open({ now: FEBRUARY, expenses: [groceries, coffee] });
  });

  test("asks first, naming the expense", async ({ app }) => {
    await app.openExpense("Groceries");

    await app.deleteButton.click();

    await expect(app.sheet).toHaveCount(0);
    await expect(app.cardTitle).toHaveText("Delete this expense?");
    await expect(app.cardBody).toHaveText(
      "Groceries, $12.50 on 12 February. This cannot be undone.",
    );
    await expect(app.cancelButton).toHaveText("Keep");
    await expect(app.confirmButton).toHaveText("Delete");
  });

  test("keeps the expense when the question is refused", async ({ app }) => {
    await app.openExpense("Groceries");
    await app.deleteButton.click();

    await app.cancelButton.click();

    await expect(app.card).toHaveCount(0);
    await expect(app.rows).toHaveCount(2);
    expect(await app.stored()).toEqual([groceries, coffee]);
  });

  test("keeps the expense when the dim is tapped", async ({ app }) => {
    await app.openExpense("Groceries");
    await app.deleteButton.click();

    await app.dismissDialog();

    await expect(app.card).toHaveCount(0);
    await expect(app.expenseItem("Groceries")).toBeVisible();
    expect(await app.stored()).toEqual([groceries, coffee]);
  });

  test("removes the expense when the question is accepted", async ({ app }) => {
    await app.deleteExpense("Groceries");

    await expect(app.expenseItem("Groceries")).toHaveCount(0);
    await expect(app.rows).toHaveCount(1);
    await expect(app.dayTotal("Today")).toHaveText("$3.25");
    expect(await app.stored()).toEqual([coffee]);
  });

  test("deleting the last expense empties the list", async ({ app }) => {
    await app.deleteExpense("Groceries");
    await app.deleteExpense("Coffee");

    await expect(app.emptyMessage).toBeVisible();
    await expect(app.dayHeadings).toHaveCount(0);
    expect(await app.stored()).toEqual([]);
  });

  // Reading the edited expense out of the store has to stay inside `untrack`:
  // otherwise deleting it re-runs the sheet expression with a stale id.
  test("deleting raises no error from the sheet", async ({ app, page }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));

    await app.deleteExpense("Groceries");

    expect(errors).toEqual([]);
  });
});
