// The list shows the current month, newest day first. Earlier months are fold
// lines, covered in months.spec.js.
import { test, expect, dayLabel } from "./fixtures.js";

const FEBRUARY = "2026-02-12T12:00:00Z";
const TODAY = "2026-02-12";

const expense = (overrides) => ({
  id: 1,
  amount: 10,
  description: "Lunch",
  date: TODAY,
  categories: [],
  ...overrides,
});

const label = (isoDate) => dayLabel(isoDate, TODAY);

test.describe("the expense list", () => {
  test("groups expenses by day, newest day first", async ({ app }) => {
    await app.open({
      now: FEBRUARY,
      expenses: [
        expense({ id: 1, description: "Older", date: "2026-02-08" }),
        expense({ id: 2, description: "Newest", date: TODAY }),
        expense({ id: 3, description: "Middle", date: "2026-02-11" }),
      ],
    });

    await expect(app.dayHeadings).toHaveCount(3);
    await expect(app.listedDays).toHaveText([
      "Today",
      "Yesterday",
      "8 February",
    ]);
    await expect(app.listedDescriptions).toHaveText([
      "Newest",
      "Middle",
      "Older",
    ]);
  });

  test("lists a day's expenses newest first, by id", async ({ app }) => {
    await app.open({
      now: FEBRUARY,
      expenses: [
        expense({ id: 100, description: "First" }),
        expense({ id: 300, description: "Third" }),
        expense({ id: 200, description: "Second" }),
      ],
    });

    await expect(app.dayHeadings).toHaveCount(1);
    await expect(app.listedDescriptions).toHaveText([
      "Third",
      "Second",
      "First",
    ]);
  });

  test("totals each day separately", async ({ app }) => {
    await app.open({
      now: FEBRUARY,
      expenses: [
        expense({ id: 1, amount: 10, date: TODAY }),
        expense({ id: 2, amount: 2.5, date: TODAY }),
        expense({ id: 3, amount: 7.25, date: "2026-02-10" }),
      ],
    });

    await expect(app.dayTotal("Today")).toHaveText("$12.50");
    await expect(app.dayTotal(label("2026-02-10"))).toHaveText("$7.25");
  });

  test("writes a row's amount plainly, under the day's dollars", async ({
    app,
  }) => {
    await app.open({ now: FEBRUARY, expenses: [expense({ amount: 1234.5 })] });

    await expect(app.amountOf("Lunch")).toHaveText("1,234.50");
  });

  test("joins categories with a middle dot, in sorted order", async ({
    app,
  }) => {
    await app.open({
      now: FEBRUARY,
      expenses: [expense({ categories: ["shopping", "food", "treats"] })],
    });

    await expect(app.categoriesOf("Lunch")).toHaveText(
      "food · shopping · treats",
    );
  });

  test("colours a row's dot by its first category", async ({ app }) => {
    await app.open({
      now: FEBRUARY,
      expenses: [
        expense({ id: 1, description: "Lunch", categories: ["food"] }),
        expense({ id: 2, description: "Dinner", categories: ["food", "out"] }),
        expense({ id: 3, description: "Bus", categories: ["travel"] }),
      ],
    });

    const colourOf = (description) =>
      app.dotOf(description).evaluate((dot) => getComputedStyle(dot).backgroundColor);

    expect(await colourOf("Dinner")).toBe(await colourOf("Lunch"));
    expect(await colourOf("Bus")).not.toBe(await colourOf("Lunch"));
  });

  test("leaves an uncategorised row's dot unfilled", async ({ app }) => {
    await app.open({
      now: FEBRUARY,
      expenses: [expense({ categories: [] })],
    });

    await expect(app.dotOf("Lunch")).toHaveClass("dot uncategorised");
    await expect(app.categoriesOf("Lunch")).toHaveCount(0);
  });

  test("renders an expense stored without categories", async ({ app }) => {
    await app.open({
      now: FEBRUARY,
      expenses: [{ id: 1, amount: 10, description: "Lunch", date: TODAY }],
    });

    await expect(app.expenseItem("Lunch")).toBeVisible();
    await expect(app.categoriesOf("Lunch")).toHaveCount(0);
  });

  test("survives a long history", async ({ app }) => {
    const expenses = Array.from({ length: 24 }, (_, index) =>
      expense({
        id: index + 1,
        amount: 1,
        description: "Item " + index,
        date: "2026-02-" + String((index % 12) + 1).padStart(2, "0"),
      }),
    );

    await app.open({ now: FEBRUARY, expenses });

    await expect(app.rows).toHaveCount(24);
    await expect(app.dayHeadings).toHaveCount(12);
  });

  test("drops the empty message as soon as an expense exists", async ({
    app,
  }) => {
    await app.open({ now: FEBRUARY });
    await expect(app.emptyMessage).toBeVisible();

    await app.addExpense({ amount: "1", description: "Coffee" });

    await expect(app.emptyMessage).toHaveCount(0);
  });
});
