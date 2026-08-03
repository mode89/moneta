import { test, expect } from "./fixtures.js";

const expense = (overrides) => ({
  id: 1,
  amount: 10,
  description: "Lunch",
  date: "2026-02-12",
  categories: [],
  ...overrides,
});

test.describe("the expense list", () => {
  test("groups expenses by day, newest day first", async ({ app }) => {
    await app.open({
      expenses: [
        expense({ id: 1, description: "Older", date: "2026-02-10" }),
        expense({ id: 2, description: "Newest", date: "2026-02-14" }),
        expense({ id: 3, description: "Middle", date: "2026-02-12" }),
      ],
    });

    await expect(app.dayGroups).toHaveCount(3);
    await expect(app.listedDays).toHaveText([
      "2026-02-14",
      "2026-02-12",
      "2026-02-10",
    ]);
    await expect(app.listedDescriptions).toHaveText([
      "Newest",
      "Middle",
      "Older",
    ]);
  });

  test("lists a day's expenses newest first, by id", async ({ app }) => {
    await app.open({
      expenses: [
        expense({ id: 100, description: "First" }),
        expense({ id: 300, description: "Third" }),
        expense({ id: 200, description: "Second" }),
      ],
    });

    await expect(app.expensesOf("2026-02-12")).toHaveCount(3);
    await expect(app.listedDescriptions).toHaveText([
      "Third",
      "Second",
      "First",
    ]);
  });

  test("totals each day separately", async ({ app }) => {
    await app.open({
      expenses: [
        expense({ id: 1, amount: 10, date: "2026-02-12" }),
        expense({ id: 2, amount: 2.5, date: "2026-02-12" }),
        expense({ id: 3, amount: 7.25, date: "2026-02-10" }),
      ],
    });

    await expect(app.dayTotal("2026-02-12")).toHaveText("$12.50");
    await expect(app.dayTotal("2026-02-10")).toHaveText("$7.25");
  });

  test("shows each expense as a negative amount", async ({ app }) => {
    await app.open({ expenses: [expense({ amount: 4.5 })] });

    await expect(app.amountOf("Lunch")).toHaveText("-$4.50");
  });

  test("joins categories with commas, in sorted order", async ({ app }) => {
    await app.open({
      expenses: [expense({ categories: ["shopping", "food", "treats"] })],
    });

    await expect(app.categoriesOf("Lunch")).toHaveText("food, shopping, treats");
  });

  test("renders an expense stored without categories", async ({ app }) => {
    await app.open({
      expenses: [
        { id: 1, amount: 10, description: "Lunch", date: "2026-02-12" },
      ],
    });

    await expect(app.expenseItem("Lunch")).toBeVisible();
    await expect(app.categoriesOf("Lunch")).toHaveCount(0);
  });

  test("keeps the same day together across a month boundary", async ({
    app,
  }) => {
    await app.open({
      expenses: [
        expense({ id: 1, description: "Last month", date: "2026-01-31" }),
        expense({ id: 2, description: "This month", date: "2026-02-01" }),
      ],
    });

    await expect(app.listedDays).toHaveText(["2026-02-01", "2026-01-31"]);
  });

  test("survives a long history", async ({ app }) => {
    const expenses = Array.from({ length: 60 }, (_, index) =>
      expense({
        id: index + 1,
        amount: 1,
        description: "Item " + index,
        date: "2026-02-" + String((index % 28) + 1).padStart(2, "0"),
      }),
    );

    await app.open({ expenses });

    await expect(app.expenseItems).toHaveCount(60);
    await expect(app.dayGroups).toHaveCount(28);
  });

  test("drops the empty message as soon as an expense exists", async ({
    app,
  }) => {
    await app.open();
    await expect(app.emptyMessage).toBeVisible();

    await app.addExpense({ amount: "1", description: "Coffee" });

    await expect(app.emptyMessage).toHaveCount(0);
  });
});
