import { test, expect } from "./fixtures.js";

test.describe("the empty app", () => {
  test.beforeEach(async ({ app }) => {
    await app.open();
  });

  test("shows the current month and nothing spent", async ({ app }) => {
    await expect(app.monthTitle).toHaveText(await app.monthName());
    await expect(app.totalSpent).toHaveText("$0.00");
    await expect(app.expenseCount).toHaveText("0 expenses");
  });

  test("leaves out the average until something is recorded", async ({
    app,
  }) => {
    await expect(app.meta).toHaveCount(1);
  });

  test("invites a first expense or an import", async ({ app }) => {
    await expect(app.emptyMessage).toContainText("Nothing recorded yet.");
    await expect(app.emptyMessage).toContainText(
      "Tap + to add your first expense — or open settings to import a file you exported before.",
    );
    await expect(app.rows).toHaveCount(0);
    await expect(app.dayHeadings).toHaveCount(0);
  });

  test("shows no category chips", async ({ app }) => {
    await expect(app.legendChips).toHaveCount(0);
  });

  test("offers settings and a new expense button", async ({ app }) => {
    await expect(app.settingsButton).toBeVisible();
    await expect(app.newExpenseButton).toBeVisible();
    await expect(app.newExpenseButton).toHaveText("+");
    await expect(app.settings).toHaveCount(0);
  });

  test("opens no dialog and writes nothing until something happens", async ({
    app,
  }) => {
    await expect(app.sheet).toHaveCount(0);
    await expect(app.card).toHaveCount(0);
    await expect(app.saveNotice).toHaveCount(0);
    expect(await app.stored()).toBe(null);
  });

  test("keeps the new expense button reachable above a long list", async ({
    app,
    page,
  }) => {
    const today = await app.todayIso();
    await page.evaluate((today) => {
      const expenses = Array.from({ length: 40 }, (_, index) => ({
        id: index + 1,
        amount: 1,
        description: "Item " + index,
        date: today,
        categories: [],
      }));
      window.localStorage.setItem("expenses", JSON.stringify(expenses));
    }, today);
    await page.reload();
    await expect(app.rows).toHaveCount(40);
    await app.list.evaluate((list) => (list.scrollTop = list.scrollHeight));
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
    await app.dismissDialog();
    await expect(app.sheet).toHaveCount(0);
    expect(errors).toEqual([]);
  });
});
