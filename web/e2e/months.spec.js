// Everything before the current month is a fold line: one row per month, opened
// by a tap and folded again by the next launch.
import { test, expect } from "./fixtures.js";

const FEBRUARY = "2026-02-12T12:00:00Z";

const expenses = [
  {
    id: 1,
    amount: 10,
    description: "Lunch",
    date: "2026-02-12",
    categories: ["food"],
  },
  {
    id: 2,
    amount: 31,
    description: "Phone bill",
    date: "2026-01-15",
    categories: ["bills"],
  },
  {
    id: 3,
    amount: 62,
    description: "Rent",
    date: "2026-01-02",
    categories: ["bills"],
  },
  {
    id: 4,
    amount: 5,
    description: "Christmas card",
    date: "2025-12-20",
    categories: [],
  },
];

test.describe("earlier months", () => {
  test.beforeEach(async ({ app }) => {
    await app.open({ now: FEBRUARY, expenses });
  });

  test("are one line each, newest first, under the open month", async ({
    app,
  }) => {
    await expect(app.foldLines.locator(".name")).toHaveText([
      "January 2026",
      "December 2025",
    ]);
    await expect(app.listedDescriptions).toHaveText(["Lunch"]);
  });

  test("carry the month's count and total", async ({ app }) => {
    await expect(app.foldHelp("January 2026")).toHaveText("2 expenses");
    await expect(app.foldTotal("January 2026")).toHaveText("$93.00");
    await expect(app.foldHelp("December 2025")).toHaveText("1 expense");
  });

  test("open in place when tapped", async ({ app }) => {
    await app.foldLine("January 2026").click();

    await expect(app.listedDescriptions).toHaveText([
      "Lunch",
      "Phone bill",
      "Rent",
    ]);
    await expect(app.listedDays).toHaveText([
      "Today",
      "15 January",
      "2 January",
    ]);
  });

  test("name their days outright rather than saying Today", async ({ app }) => {
    await app.foldLine("December 2025").click();

    await expect(app.listedDays).toHaveText(["Today", "20 December"]);
  });

  test("add an average a day once open", async ({ app }) => {
    await app.foldLine("January 2026").click();

    // $93.00 over the whole of January, not over the days so far.
    await expect(app.foldHelp("January 2026")).toHaveText(
      "2 expenses · $3.00 a day",
    );
  });

  test("close again when tapped a second time", async ({ app }) => {
    await app.foldLine("January 2026").click();
    await expect(app.rows).toHaveCount(3);

    await app.foldLine("January 2026").click();

    await expect(app.listedDescriptions).toHaveText(["Lunch"]);
    await expect(app.foldHelp("January 2026")).toHaveText("2 expenses");
  });

  test("open one month without opening the others", async ({ app }) => {
    await app.foldLine("January 2026").click();

    await expect(app.expenseItem("Christmas card")).toHaveCount(0);
  });

  test("leave the header on the current month while open", async ({ app }) => {
    await app.foldLine("January 2026").click();

    await expect(app.monthTitle).toHaveText("February 2026");
    await expect(app.totalSpent).toHaveText("$10.00");
  });

  test("are folded again after a reload", async ({ app, page }) => {
    await app.foldLine("January 2026").click();
    await expect(app.rows).toHaveCount(3);

    await page.reload();

    await expect(app.listedDescriptions).toHaveText(["Lunch"]);
  });

  test("can be edited while open, staying in their month", async ({ app }) => {
    await app.foldLine("January 2026").click();

    await app.openExpense("Rent");
    await app.fillForm({ amount: "70" });
    await app.submit();

    await expect(app.foldTotal("January 2026")).toHaveText("$101.00");
    await expect(app.totalSpent).toHaveText("$10.00");
  });

  test("appear as soon as the current month has none of their expenses", async ({
    app,
  }) => {
    await app.deleteExpense("Lunch");

    await expect(app.emptyMessage).toHaveCount(0);
    await expect(app.totalSpent).toHaveText("$0.00");
    await expect(app.foldLines).toHaveCount(2);
  });
});
