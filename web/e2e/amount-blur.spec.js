// Amounts are blurred until the user reveals them, and every amount on the
// page shares the one `showNumbers` signal.
import { test, expect } from "./fixtures.js";

const blurred = async (locator) => expect(locator).toHaveClass("blur-text");
const revealed = async (locator) => expect(locator).toHaveClass("");

const expenses = [
  {
    id: 1,
    amount: 12.5,
    description: "Groceries",
    date: "2026-02-12",
    categories: [],
  },
  {
    id: 2,
    amount: 3.25,
    description: "Coffee",
    date: "2026-02-10",
    categories: [],
  },
];

test.describe("revealing amounts", () => {
  test.beforeEach(async ({ app }) => {
    await app.open({ now: "2026-02-12T12:00:00Z", expenses });
  });

  test("starts with every amount blurred", async ({ app }) => {
    await blurred(app.totalSpent);
    await blurred(app.dayTotal("2026-02-12"));
    await blurred(app.dayTotal("2026-02-10"));
    await blurred(app.amountOf("Groceries"));
    await blurred(app.amountOf("Coffee"));
  });

  test("the monthly total toggles them all", async ({ app }) => {
    await app.totalSpentRow.click();

    await revealed(app.totalSpent);
    await revealed(app.dayTotal("2026-02-12"));
    await revealed(app.amountOf("Groceries"));

    await app.totalSpentRow.click();

    await blurred(app.totalSpent);
    await blurred(app.amountOf("Groceries"));
  });

  test("a day heading toggles them all", async ({ app }) => {
    await app.dayGroup("2026-02-10").locator("strong").click();

    await revealed(app.totalSpent);
    await revealed(app.dayTotal("2026-02-12"));
    await revealed(app.amountOf("Coffee"));
  });

  test("an expense's amount toggles them without opening the dialog", async ({
    app,
  }) => {
    await app.amountOf("Groceries").click();

    await expect(app.modal).toHaveCount(0);
    await revealed(app.totalSpent);
    await revealed(app.amountOf("Coffee"));

    await app.amountOf("Groceries").click();

    await expect(app.modal).toHaveCount(0);
    await blurred(app.totalSpent);
  });

  test("tapping the rest of the row opens the dialog instead", async ({
    app,
  }) => {
    await app.expenseItem("Groceries").locator("div").first().click();

    await expect(app.modal).toBeVisible();
    await expect(app.descriptionInput).toHaveValue("Groceries");
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
