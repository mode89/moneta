// The chips under the header are the only filter: one category at a time,
// narrowing the header, the list and the fold lines.
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
    amount: 20,
    description: "Dinner",
    date: "2026-02-11",
    categories: ["food", "out"],
  },
  {
    id: 3,
    amount: 5,
    description: "Bus",
    date: "2026-02-11",
    categories: ["travel"],
  },
  {
    id: 4,
    amount: 8,
    description: "Groceries",
    date: "2026-01-20",
    categories: ["food"],
  },
  {
    id: 5,
    amount: 62,
    description: "Rent",
    date: "2026-01-02",
    categories: ["bills"],
  },
];

test.describe("filtering by category", () => {
  test.beforeEach(async ({ app }) => {
    await app.open({ now: FEBRUARY, expenses });
  });

  test("offers this month's categories, biggest spend first", async ({
    app,
  }) => {
    await expect(app.legendChips).toHaveText([/food/, /out/, /travel/]);
  });

  test("shows each category's total for the month, to the dollar", async ({
    app,
  }) => {
    await expect(app.legendChip("food")).toContainText("$30");
    await expect(app.legendChip("travel")).toContainText("$5");
  });

  test("narrows the list to the chosen category", async ({ app }) => {
    await app.legendChip("food").click();

    await expect(app.legendChip("food")).toHaveClass(/on/);
    await expect(app.listedDescriptions).toHaveText(["Lunch", "Dinner"]);
  });

  test("narrows the header total, count and average", async ({ app }) => {
    await app.legendChip("food").click();

    await expect(app.totalSpent).toHaveText("$30.00");
    await expect(app.expenseCount).toHaveText("2 expenses");
    // $30.00 over the twelve days of February so far.
    await expect(app.averagePerDay).toHaveText("$2.50");
  });

  test("narrows a day to its matching expenses and total", async ({ app }) => {
    await app.legendChip("travel").click();

    await expect(app.listedDays).toHaveText(["Yesterday"]);
    await expect(app.dayTotal("Yesterday")).toHaveText("$5.00");
  });

  test("narrows the fold lines of earlier months", async ({ app }) => {
    await app.legendChip("food").click();

    await expect(app.foldHelp("January 2026")).toHaveText("1 in food");
    await expect(app.foldTotal("January 2026")).toHaveText("$8.00");
  });

  test("hides a month with nothing in the chosen category", async ({ app }) => {
    await app.legendChip("travel").click();

    await expect(app.foldLines).toHaveCount(0);
  });

  test("keeps the filter when an earlier month is opened", async ({ app }) => {
    await app.legendChip("food").click();

    await app.foldLine("January 2026").click();

    await expect(app.listedDescriptions).toHaveText([
      "Lunch",
      "Dinner",
      "Groceries",
    ]);
    await expect(app.expenseItem("Rent")).toHaveCount(0);
  });

  test("switches to another category, one filter at a time", async ({
    app,
  }) => {
    await app.legendChip("food").click();
    await app.legendChip("travel").click();

    await expect(app.legendChip("food")).not.toHaveClass(/on/);
    await expect(app.listedDescriptions).toHaveText(["Bus"]);
  });

  test("clears when the chosen chip is tapped again", async ({ app }) => {
    await app.legendChip("food").click();
    await app.legendChip("food").click();

    await expect(app.legendChip("food")).not.toHaveClass(/on/);
    await expect(app.listedDescriptions).toHaveText(["Lunch", "Bus", "Dinner"]);
    await expect(app.totalSpent).toHaveText("$35.00");
  });

  test("leaves the chips themselves showing the whole month", async ({
    app,
  }) => {
    await app.legendChip("food").click();

    await expect(app.legendChips).toHaveText([/food/, /out/, /travel/]);
    await expect(app.legendChip("travel")).toContainText("$5");
  });

  test("offers no chip for a category used only in an earlier month", async ({
    app,
  }) => {
    await expect(app.legendChip("bills")).toHaveCount(0);
  });

  // The chip is the only way to clear a filter, so a filter that outlived its
  // chip left the list empty with nothing to tap.
  test("clears itself when its last expense this month goes", async ({
    app,
  }) => {
    await app.legendChip("travel").click();
    await expect(app.listedDescriptions).toHaveText(["Bus"]);

    await app.deleteExpense("Bus");

    await expect(app.legendChip("travel")).toHaveCount(0);
    await expect(app.listedDescriptions).toHaveText(["Lunch", "Dinner"]);
  });

  test("stays cleared when the category is used again", async ({ app }) => {
    await app.legendChip("travel").click();
    await app.deleteExpense("Bus");

    await app.addExpense({
      amount: "4",
      description: "Tram",
      categories: "travel",
    });

    await expect(app.legendChip("travel")).not.toHaveClass(/on/);
    await expect(app.listedDescriptions).toHaveText([
      "Tram",
      "Lunch",
      "Dinner",
    ]);
  });

  test("is forgotten after a reload", async ({ app, page }) => {
    await app.legendChip("food").click();
    await expect(app.rows).toHaveCount(2);

    await page.reload();

    await expect(app.legendChip("food")).not.toHaveClass(/on/);
    await expect(app.rows).toHaveCount(3);
  });
});

// What carries no category is a chip like the rest, so the chips account for
// the whole month rather than for the tagged part of it.
const untagged = [
  {
    id: 1,
    amount: 30,
    description: "Lunch",
    date: "2026-02-12",
    categories: [],
  },
  {
    id: 2,
    amount: 20,
    description: "Dinner",
    date: "2026-02-11",
    categories: ["food"],
  },
  {
    id: 3,
    amount: 5,
    description: "Pharmacy",
    date: "2026-02-11",
    categories: [],
  },
  {
    id: 4,
    amount: 40,
    description: "Bus pass",
    date: "2026-02-10",
    categories: ["travel"],
  },
  {
    id: 5,
    amount: 8,
    description: "Stamps",
    date: "2026-01-20",
    categories: [],
  },
];

test.describe("filtering by no category", () => {
  test.beforeEach(async ({ app }) => {
    await app.open({ now: FEBRUARY, expenses: untagged });
  });

  test("offers a chip for it, ranked by size among the rest", async ({
    app,
  }) => {
    await expect(app.legendChips).toHaveText([
      /travel/,
      /uncategorised/,
      /food/,
    ]);
    await expect(app.legendChip("uncategorised")).toContainText("$35");
  });

  test("draws its dot as a ring, the same one an untagged row wears", async ({
    app,
  }) => {
    const ring = (locator) =>
      locator.evaluate((dot) => getComputedStyle(dot).boxShadow);

    // --muted, the ring both the chip and the row draw
    expect(await ring(app.legendDot("uncategorised"))).toContain(
      "rgb(147, 121, 106)",
    );
    expect(await ring(app.legendDot("uncategorised"))).toEqual(
      await ring(app.dotOf("Lunch")),
    );
    await expect(app.legendDot("uncategorised")).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0)",
    );
  });

  test("turns that ring to paper once the chip is selected", async ({
    app,
  }) => {
    await app.legendChip("uncategorised").click();

    // --paper, since --muted all but vanishes into the selected chip's ink
    await expect(app.legendDot("uncategorised")).toHaveCSS(
      "box-shadow",
      "rgb(251, 247, 241) 0px 0px 0px 1px inset",
    );
  });

  test("narrows the list and the header to what carries no category", async ({
    app,
  }) => {
    await app.legendChip("uncategorised").click();

    await expect(app.legendChip("uncategorised")).toHaveClass(/on/);
    await expect(app.listedDescriptions).toHaveText(["Lunch", "Pharmacy"]);
    await expect(app.totalSpent).toHaveText("$35.00");
    await expect(app.expenseCount).toHaveText("2 expenses");
  });

  test("names an earlier month's fold line without a preposition", async ({
    app,
  }) => {
    await app.legendChip("uncategorised").click();

    await expect(app.foldHelp("January 2026")).toHaveText("1 uncategorised");
    await expect(app.foldTotal("January 2026")).toHaveText("$8.00");
  });

  test("clears itself when the last untagged expense this month goes", async ({
    app,
  }) => {
    await app.legendChip("uncategorised").click();

    await app.deleteExpense("Lunch");
    await app.deleteExpense("Pharmacy");

    await expect(app.legendChip("uncategorised")).toHaveCount(0);
    await expect(app.listedDescriptions).toHaveText(["Dinner", "Bus pass"]);
  });

  test("takes in an expense stripped of its categories", async ({ app }) => {
    await expect(app.legendChip("food")).toContainText("$20");

    await app.openExpense("Dinner");
    await app.fillForm({ categories: "" });
    await app.submit();

    await expect(app.legendChip("food")).toHaveCount(0);
    await expect(app.legendChip("uncategorised")).toContainText("$55");
  });
});
