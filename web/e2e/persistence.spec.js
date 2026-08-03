// Expenses live in `localStorage` on the device; there is no server. What is
// stored is a compatibility boundary, so these tests read the raw JSON.
import { test, expect } from "./fixtures.js";

const FEBRUARY = "2026-02-12T12:00:00Z";

const stored = [
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
];

test.describe("keeping expenses on the device", () => {
  test("shows what was stored before", async ({ app }) => {
    await app.open({ now: FEBRUARY, expenses: stored });

    await expect(app.rows).toHaveCount(2);
    await expect(app.amountOf("Groceries")).toHaveText("12.50");
    await expect(app.dayHeadings).toHaveCount(2);
  });

  test("an added expense survives a reload", async ({ app, page }) => {
    await app.open({ now: FEBRUARY });
    await app.addExpense({
      amount: "8",
      description: "Dinner",
      categories: "food out",
    });

    await page.reload();

    await expect(app.expenseItem("Dinner")).toBeVisible();
    await expect(app.amountOf("Dinner")).toHaveText("8.00");
    await expect(app.categoriesOf("Dinner")).toHaveText("food · out");
    await expect(app.dayHeading("Today")).toBeVisible();
  });

  test("an edit survives a reload", async ({ app, page }) => {
    await app.open({ now: FEBRUARY, expenses: stored });
    await app.openExpense("Coffee");
    await app.fillForm({ amount: "4.75", description: "Tea" });
    await app.submit();

    await page.reload();

    await expect(app.expenseItem("Tea")).toBeVisible();
    await expect(app.amountOf("Tea")).toHaveText("4.75");
    await expect(app.expenseItem("Coffee")).toHaveCount(0);
  });

  test("a deletion survives a reload", async ({ app, page }) => {
    await app.open({ now: FEBRUARY, expenses: stored });
    await app.deleteExpense("Groceries");

    await page.reload();

    await expect(app.rows).toHaveCount(1);
    await expect(app.expenseItem("Groceries")).toHaveCount(0);
  });

  test("stores the date as the calendar day the user picked", async ({
    app,
  }) => {
    await app.open({ now: FEBRUARY });

    await app.addExpense({
      amount: "5",
      description: "Bus",
      date: "2026-02-12",
    });

    // Read as UTC midnight this would slip a day west of the meridian.
    expect(await app.stored()).toEqual([
      expect.objectContaining({ date: "2026-02-12" }),
    ]);
    await expect(app.dayHeading("Today")).toBeVisible();
    await app.openExpense("Bus");
    await expect(app.dateInput).toHaveValue("2026-02-12");
  });

  test("writes under the `expenses` key, nothing else", async ({
    app,
    page,
  }) => {
    await app.open({ now: FEBRUARY });
    await app.addExpense({ amount: "5", description: "Bus" });

    expect(await page.evaluate(() => Object.keys(window.localStorage))).toEqual(
      ["expenses"],
    );
  });

  test("keeps no record of what was revealed, filtered or unfolded", async ({
    app,
    page,
  }) => {
    await app.open({
      now: FEBRUARY,
      expenses: [...stored, { ...stored[0], id: 3, date: "2026-01-05" }],
    });

    await app.totalSpentRow.click();
    await app.legendChip("food").click();
    await app.foldLine("January 2026").click();

    expect(await page.evaluate(() => Object.keys(window.localStorage))).toEqual(
      ["expenses"],
    );
  });

  test("starts empty on a device that has never saved", async ({ app }) => {
    await app.open();

    await expect(app.emptyMessage).toBeVisible();
    expect(await app.stored()).toBe(null);
  });
});

test.describe("the Saved notice", () => {
  test("appears on a save and fades after three seconds", async ({ app }) => {
    await app.open({ now: FEBRUARY });

    await app.addExpense({ amount: "5", description: "Bus" });

    await expect(app.saveNotice).toHaveText("Saved");
    await expect(app.saveNotice).toHaveAttribute("role", "status");
    await expect(app.saveNotice).toHaveCount(0, { timeout: 6000 });
  });

  test("a second save restarts the three seconds", async ({ app }) => {
    await app.open({ now: FEBRUARY });
    await app.addExpense({ amount: "5", description: "Bus" });
    await expect(app.saveNotice).toBeVisible();

    await app.page.waitForTimeout(2000);
    await app.addExpense({ amount: "6", description: "Train" });

    // The first timer would have fired by now; the second keeps it up.
    await app.page.waitForTimeout(1500);
    await expect(app.saveNotice).toHaveText("Saved");
    await expect(app.saveNotice).toHaveCount(0, { timeout: 6000 });
  });

  test("stays away when nothing is saved", async ({ app }) => {
    await app.open({ now: FEBRUARY, expenses: stored });

    await app.openExpense("Coffee");
    await app.dismissDialog();

    await expect(app.saveNotice).toHaveCount(0);
  });
});
