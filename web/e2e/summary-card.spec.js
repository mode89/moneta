// The summary card totals the current calendar month, so these tests pin the
// clock. Noon UTC keeps both timezone projects on the same calendar day.
import { test, expect } from "./fixtures.js";

const FEBRUARY = "2026-02-12T12:00:00Z";

const expense = (overrides) => ({
  id: 1,
  amount: 10,
  description: "Lunch",
  date: "2026-02-12",
  categories: [],
  ...overrides,
});

test.describe("the monthly summary", () => {
  test("names the current month", async ({ app }) => {
    await app.open({ now: FEBRUARY });

    await expect(app.monthTitle).toHaveText("February");
  });

  test("totals only this month's expenses", async ({ app }) => {
    await app.open({
      now: FEBRUARY,
      expenses: [
        expense({ id: 1, amount: 10, date: "2026-02-01" }),
        expense({ id: 2, amount: 2.5, date: "2026-02-12" }),
        expense({ id: 3, amount: 100, date: "2026-01-31" }),
        expense({ id: 4, amount: 100, date: "2025-02-12" }),
      ],
    });

    await expect(app.totalSpent).toHaveText("$12.50");
  });

  test("counts the first and last day of the month", async ({ app }) => {
    await app.open({
      now: FEBRUARY,
      expenses: [
        expense({ id: 1, amount: 1, date: "2026-02-01" }),
        expense({ id: 2, amount: 2, date: "2026-02-28" }),
      ],
    });

    await expect(app.totalSpent).toHaveText("$3.00");
  });

  test("shows nothing spent when the month is empty", async ({ app }) => {
    await app.open({
      now: FEBRUARY,
      expenses: [expense({ amount: 100, date: "2026-01-15" })],
    });

    await expect(app.totalSpent).toHaveText("$0.00");
    await expect(app.expenseItems).toHaveCount(1);
  });

  test("grows as expenses are added and shrinks as they go", async ({
    app,
    dialogs,
  }) => {
    await app.open({ now: FEBRUARY, expenses: [expense({ amount: 10 })] });
    await expect(app.totalSpent).toHaveText("$10.00");

    await app.addExpense({
      amount: "5",
      description: "Coffee",
      date: "2026-02-12",
    });
    await expect(app.totalSpent).toHaveText("$15.00");

    dialogs.acceptAll();
    await app.openExpense("Coffee");
    await app.deleteButton.click();

    await expect(app.totalSpent).toHaveText("$10.00");
  });

  test("follows an expense edited out of this month", async ({ app }) => {
    await app.open({ now: FEBRUARY, expenses: [expense({ amount: 10 })] });

    await app.openExpense("Lunch");
    await app.fillForm({ date: "2026-01-12" });
    await app.submit();

    await expect(app.totalSpent).toHaveText("$0.00");
    await expect(app.expenseItem("Lunch")).toBeVisible();
  });
});
