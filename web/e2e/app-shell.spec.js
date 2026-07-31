import { test, expect } from "./fixtures.js";
import { VERSION } from "./server.js";

test.describe("the empty app", () => {
  test.beforeEach(async ({ app }) => {
    await app.open();
  });

  test("shows the current month and nothing spent", async ({ app }) => {
    await expect(app.monthTitle).toHaveText(await app.monthName());
    await expect(app.totalSpentRow).toContainText("Total Spent:");
    await expect(app.totalSpent).toHaveText("$0.00");
  });

  test("says there are no expenses yet", async ({ app }) => {
    await expect(app.emptyMessage).toHaveText("No expenses yet");
    await expect(app.expenseItems).toHaveCount(0);
    await expect(app.dayGroups).toHaveCount(0);
  });

  test("offers import, export and a new expense button", async ({ app }) => {
    await expect(app.expenseCard.getByRole("heading")).toHaveText("Expenses");
    await expect(app.importButton).toBeVisible();
    await expect(app.exportButton).toBeVisible();
    await expect(app.newExpenseButton).toBeVisible();
    await expect(app.newExpenseButton).toHaveText("+");
  });

  test("shows the build version", async ({ app }) => {
    await expect(app.version).toHaveText("Version: " + VERSION);
  });

  test("opens no dialog and writes nothing until something happens", async ({
    app,
  }) => {
    await expect(app.modal).toHaveCount(0);
    await expect(app.saveNotice).toHaveCount(0);
    expect(await app.stored()).toBe(null);
  });

  test("keeps the new expense button reachable above a long list", async ({
    app,
    page,
  }) => {
    await page.evaluate(() => {
      const expenses = Array.from({ length: 40 }, (_, index) => ({
        id: index + 1,
        amount: 1,
        description: "Item " + index,
        date: "2026-02-12",
        categories: [],
      }));
      window.localStorage.setItem("expenses", JSON.stringify(expenses));
    });
    await page.reload();
    await expect(app.expenseItems).toHaveCount(40);
    await page.mouse.wheel(0, 4000);
    await expect(app.newExpenseButton).toBeInViewport();
  });

  test("lays out without sideways scrolling on a narrow screen", async ({
    app,
    page,
  }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await app.addExpense({
      amount: "1234.56",
      description: "A description long enough to test wrapping on a phone",
      categories: "one two three four five six",
    });

    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
    await expect(app.newExpenseButton).toBeInViewport();
  });

  test("loads without console errors", async ({ page, app }) => {
    const errors = [];
    page.on("pageerror", (error) => errors.push(String(error)));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await app.open();
    await app.openNewExpense();
    await app.cancelButton.click();
    expect(errors).toEqual([]);
  });
});
