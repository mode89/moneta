import { test, expect } from "./fixtures.js";

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
    await app.open({ expenses: [groceries, coffee] });
  });

  test("opens the tapped expense, filled in", async ({ app }) => {
    await app.openExpense("Groceries");

    await expect(app.modalTitle).toHaveText("Edit Expense");
    await expect(app.submitButton).toHaveText("Update");
    await expect(app.amountInput).toHaveValue("12.5");
    await expect(app.descriptionInput).toHaveValue("Groceries");
    await expect(app.dateInput).toHaveValue("2026-02-12");
    await expect(app.categoriesInput).toHaveValue("food shopping");
    await expect(app.deleteButton).toBeVisible();
  });

  test("opens the other expense when that one is tapped", async ({ app }) => {
    await app.openExpense("Coffee");

    await expect(app.descriptionInput).toHaveValue("Coffee");
    await expect(app.amountInput).toHaveValue("3.25");
    await expect(app.categoriesInput).toHaveValue("");
  });

  test("saves the changes and keeps the id", async ({ app }) => {
    await app.openExpense("Groceries");

    await app.fillForm({
      amount: "20",
      description: "Big groceries",
      categories: "food",
    });
    await app.submit();

    await expect(app.modal).toHaveCount(0);
    await expect(app.listedDescriptions).toHaveText([
      "Coffee",
      "Big groceries",
    ]);
    await expect(app.amountOf("Big groceries")).toHaveText("-$20.00");
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

    await expect(app.amountOf("Groceries")).toHaveText("-$12.50");
    await expect(app.amountOf("Coffee")).toHaveText("-$4.00");
    await expect(app.dayTotal("2026-02-12")).toHaveText("$16.50");
  });

  test("moves the expense when its date changes", async ({ app }) => {
    await app.openExpense("Coffee");

    await app.fillForm({ date: "2026-02-10" });
    await app.submit();

    await expect(app.dayGroups).toHaveCount(2);
    await expect(app.expensesOf("2026-02-12")).toHaveCount(1);
    await expect(app.expensesOf("2026-02-10")).toHaveCount(1);
    await expect(app.dayTotal("2026-02-12")).toHaveText("$12.50");
    await expect(app.dayTotal("2026-02-10")).toHaveText("$3.25");
    await expect(app.listedDays).toHaveText(["2026-02-12", "2026-02-10"]);
  });

  test("can clear the categories", async ({ app }) => {
    await app.openExpense("Groceries");

    await app.fillForm({ categories: "  " });
    await app.submit();

    await expect(app.categoriesOf("Groceries")).toHaveCount(0);
    expect(await app.stored()).toEqual([
      expect.objectContaining({ id: 1, categories: [] }),
      coffee,
    ]);
  });

  test("Cancel keeps the expense as it was", async ({ app }) => {
    await app.openExpense("Groceries");
    await app.fillForm({ amount: "99", description: "Changed" });

    await app.cancelButton.click();

    await expect(app.modal).toHaveCount(0);
    await expect(app.expenseItem("Groceries")).toBeVisible();
    await expect(app.amountOf("Groceries")).toHaveText("-$12.50");
    // Nothing was saved, so storage still holds what was seeded.
    expect(await app.stored()).toEqual([groceries, coffee]);
  });

  test("the close button keeps the expense as it was", async ({ app }) => {
    await app.openExpense("Groceries");
    await app.fillForm({ amount: "99" });

    await app.closeButton.click();

    await expect(app.modal).toHaveCount(0);
    await expect(app.amountOf("Groceries")).toHaveText("-$12.50");
  });

  test("reopening after a cancel shows the stored values again", async ({
    app,
  }) => {
    await app.openExpense("Groceries");
    await app.fillForm({ amount: "99" });
    await app.cancelButton.click();

    await app.openExpense("Groceries");

    await expect(app.amountInput).toHaveValue("12.5");
  });

  test("tapping an amount reveals numbers instead of opening the dialog", async ({
    app,
  }) => {
    await app.amountOf("Groceries").click();

    await expect(app.modal).toHaveCount(0);
    await expect(app.amountOf("Groceries")).not.toHaveClass(/blur-text/);
  });
});

test.describe("deleting an expense", () => {
  test.beforeEach(async ({ app }) => {
    await app.open({ expenses: [groceries, coffee] });
  });

  test("asks before deleting", async ({ app, dialogs }) => {
    await app.openExpense("Groceries");

    await app.deleteButton.click();

    await dialogs.expectMessage("Are you sure?");
  });

  test("keeps the expense when the question is declined", async ({
    app,
    dialogs,
  }) => {
    await app.openExpense("Groceries");

    await app.deleteButton.click();

    await dialogs.expectMessage("Are you sure?");
    await expect(app.modal).toBeVisible();
    await expect(app.expenseItems).toHaveCount(2);
    expect(await app.stored()).toEqual([groceries, coffee]);
  });

  test("removes the expense when the question is accepted", async ({
    app,
    dialogs,
  }) => {
    dialogs.acceptAll();
    await app.openExpense("Groceries");

    await app.deleteButton.click();

    await expect(app.modal).toHaveCount(0);
    await expect(app.expenseItem("Groceries")).toHaveCount(0);
    await expect(app.expenseItems).toHaveCount(1);
    await expect(app.dayTotal("2026-02-12")).toHaveText("$3.25");
    expect(await app.stored()).toEqual([coffee]);
  });

  test("deleting the last expense empties the list", async ({
    app,
    dialogs,
  }) => {
    dialogs.acceptAll();

    for (const description of ["Groceries", "Coffee"]) {
      await app.openExpense(description);
      await app.deleteButton.click();
      await expect(app.modal).toHaveCount(0);
    }

    await expect(app.emptyMessage).toHaveText("No expenses yet");
    await expect(app.dayGroups).toHaveCount(0);
    expect(await app.stored()).toEqual([]);
  });

  // Reading the edited expense out of the store has to stay inside `untrack`:
  // otherwise deleting it re-runs the dialog expression with a stale id.
  test("deleting raises no error from the dialog", async ({
    app,
    page,
    dialogs,
  }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    dialogs.acceptAll();

    await app.openExpense("Groceries");
    await app.deleteButton.click();
    await expect(app.modal).toHaveCount(0);

    expect(errors).toEqual([]);
  });
});
