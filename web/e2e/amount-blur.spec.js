// Amounts are blurred until the user reveals them, and every amount on the
// page shares the one `showNumbers` signal.
import { test, expect } from "./fixtures.js";

const FEBRUARY = "2026-02-12T12:00:00Z";

const blurred = async (locator) => expect(locator).toHaveClass("blur-text");
const revealed = async (locator) => expect(locator).toHaveClass("");

const expenses = [
  {
    id: 1,
    amount: 12.5,
    description: "Groceries",
    date: "2026-02-12",
    categories: ["food"],
  },
  {
    id: 2,
    amount: 3.25,
    description: "Coffee",
    date: "2026-02-10",
    categories: [],
  },
  {
    id: 3,
    amount: 40,
    description: "Rent",
    date: "2026-01-02",
    categories: [],
  },
];

test.describe("revealing amounts", () => {
  test.beforeEach(async ({ app }) => {
    await app.open({ now: FEBRUARY, expenses });
  });

  test("starts with every amount blurred", async ({ app }) => {
    await blurred(app.totalSpent);
    await blurred(app.averagePerDay);
    await blurred(app.legendChip("food").locator("span"));
    await blurred(app.dayTotal("Today"));
    await blurred(app.dayTotal("10 February"));
    await blurred(app.amountOf("Groceries"));
    await blurred(app.foldTotal("January 2026"));
  });

  test("the monthly total toggles them all", async ({ app }) => {
    await app.totalSpentRow.click();

    await revealed(app.totalSpent);
    await revealed(app.dayTotal("Today"));
    await revealed(app.amountOf("Groceries"));
    await revealed(app.foldTotal("January 2026"));

    await app.totalSpentRow.click();

    await blurred(app.totalSpent);
    await blurred(app.amountOf("Groceries"));
  });

  test("a day heading toggles them all", async ({ app }) => {
    await app.dayHeading("10 February").click();

    await revealed(app.totalSpent);
    await revealed(app.dayTotal("Today"));
    await revealed(app.amountOf("Coffee"));
  });

  test("an expense's amount toggles them without opening the sheet", async ({
    app,
  }) => {
    await app.amountOf("Groceries").click();

    await expect(app.sheet).toHaveCount(0);
    await revealed(app.totalSpent);
    await revealed(app.amountOf("Coffee"));

    await app.amountOf("Groceries").click();

    await expect(app.sheet).toHaveCount(0);
    await blurred(app.totalSpent);
  });

  test("tapping the rest of the row opens the sheet instead", async ({
    app,
  }) => {
    await app.openExpense("Groceries");

    await expect(app.descriptionInput).toHaveValue("Groceries");
    await blurred(app.totalSpent);
  });

  test("an expense revealed in an older month follows the rest", async ({
    app,
  }) => {
    await app.foldLine("January 2026").click();
    await app.totalSpentRow.click();

    await revealed(app.amountOf("Rent"));
  });

  test("a newly added expense joins the revealed state", async ({ app }) => {
    await app.totalSpentRow.click();

    await app.addExpense({
      amount: "1",
      description: "Sweet",
      date: "2026-02-12",
    });

    await revealed(app.amountOf("Sweet"));
  });

  test("amounts are blurred again after a reload", async ({ app, page }) => {
    await app.totalSpentRow.click();
    await revealed(app.totalSpent);

    await page.reload();

    await blurred(app.totalSpent);
  });
});
