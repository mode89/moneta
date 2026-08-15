// Categories are chosen from chips in the sheet: a `+ new` chip that becomes a
// text field in place, and then every category the user has used, the one
// carrying the most expenses first. The chips wrap into a block three lines
// tall that scrolls.
import { test, expect } from "./fixtures.js";

const FEBRUARY = "2026-02-12T12:00:00Z";

const expenses = [
  {
    id: 1,
    amount: 12.5,
    description: "Groceries",
    date: "2026-02-12",
    categories: ["food", "shopping"],
  },
  {
    id: 2,
    amount: 5,
    description: "Bus",
    date: "2026-02-11",
    categories: ["travel"],
  },
];

test.describe("choosing categories", () => {
  test.beforeEach(async ({ app }) => {
    await app.open({ now: FEBRUARY, expenses });
  });

  // `+ new` leads: it is the one chip that must never be scrolled to, and the
  // list below it moves as the counts change.
  test("offers a way to add one, then every category used so far", async ({
    app,
  }) => {
    await app.openNewExpense();

    await expect(app.categoryChips).toHaveText([
      "+ new",
      /food/,
      /shopping/,
      /travel/,
    ]);
  });

  test("offers the category carrying the most expenses first", async ({
    app,
  }) => {
    await app.addExpense({
      amount: "4",
      description: "Bus again",
      categories: "travel",
    });

    await app.openNewExpense();

    await expect(app.categoryChips).toHaveText([
      "+ new",
      /travel/,
      /food/,
      /shopping/,
    ]);
  });

  // Recency alone reshuffled the whole row on every save. Counting moves a
  // category only when it overtakes another, so the chips stay put.
  test("leaves the order alone when a repeat changes no ranking", async ({
    app,
  }) => {
    await app.addExpense({
      amount: "4",
      description: "Bus again",
      categories: "travel",
    });
    await app.addExpense({
      amount: "4",
      description: "Bus once more",
      categories: "travel",
    });
    await app.openNewExpense();
    const before = await app.categoryChips.allTextContents();
    await app.dismissDialog();
    await expect(app.sheet).toHaveCount(0);

    await app.addExpense({
      amount: "7",
      description: "More groceries",
      categories: "food",
    });

    await app.openNewExpense();
    await expect(app.categoryChips).toHaveText(before);
  });

  test("marks the ones the edited expense carries", async ({ app }) => {
    await app.openExpense("Groceries");

    await expect(app.categoryChip("food")).toContainText("✕");
    await expect(app.categoryChip("travel")).not.toContainText("✕");
  });

  test("selects and deselects on a tap", async ({ app }) => {
    await app.openNewExpense();

    await app.categoryChip("travel").click();
    await expect(app.categoryChip("travel")).toContainText("✕");

    await app.categoryChip("travel").click();
    await expect(app.categoryChip("travel")).not.toContainText("✕");
  });

  test("saves what is selected, in sorted order", async ({ app }) => {
    await app.openNewExpense();
    await app.fillForm({ amount: "9", description: "Taxi" });

    await app.categoryChip("travel").click();
    await app.categoryChip("food").click();
    await app.submit();

    await expect(app.categoriesOf("Taxi")).toHaveText("food · travel");
    expect(await app.stored()).toContainEqual(
      expect.objectContaining({ categories: ["food", "travel"] }),
    );
  });

  test("clears a category by deselecting its chip", async ({ app }) => {
    await app.openExpense("Groceries");

    await app.categoryChip("food").click();
    await app.categoryChip("shopping").click();
    await app.submit();

    await expect(app.categoriesOf("Groceries")).toHaveCount(0);
    expect(await app.stored()).toContainEqual(
      expect.objectContaining({ id: 1, categories: [] }),
    );
  });

  test("turns `+ new` into a field and commits on a space", async ({ app }) => {
    await app.openNewExpense();
    await app.fillForm({ amount: "9", description: "Cinema" });

    await app.newCategoryChip.click();
    await expect(app.chipField).toBeFocused();
    await app.chipField.pressSequentially("fun");
    await app.chipField.press(" ");

    await expect(app.chipField).toHaveCount(0);
    await expect(app.categoryChip("fun")).toContainText("✕");
    await expect(app.newCategoryChip).toBeVisible();

    await app.submit();
    await expect(app.categoriesOf("Cinema")).toHaveText("fun");
  });

  test("lower-cases what was typed", async ({ app }) => {
    await app.openNewExpense();
    await app.fillForm({ amount: "9", description: "Cinema" });

    await app.newCategoryChip.click();
    await app.chipField.pressSequentially("FUN");
    await app.chipField.press("Enter");

    await expect(app.categoryChip("fun")).toContainText("✕");
  });

  test("keeps every keystroke of a name", async ({ app }) => {
    await app.openNewExpense();

    await app.newCategoryChip.click();
    await app.chipField.pressSequentially("groceries");

    await expect(app.chipField).toHaveValue("groceries");
  });

  test("commits the name when the field loses focus", async ({ app }) => {
    await app.openNewExpense();
    await app.fillForm({ amount: "9", description: "Cinema" });

    await app.newCategoryChip.click();
    await app.chipField.pressSequentially("fun");
    await app.descriptionInput.click();

    await expect(app.chipField).toHaveCount(0);
    await expect(app.categoryChip("fun")).toContainText("✕");
  });

  // Committing the draft rebuilds the chip row. Done as the chip is pressed,
  // it moved the button out from under the finger and the tap was lost.
  test("takes a chip tapped while the field holds a name", async ({ app }) => {
    await app.openNewExpense();

    await app.newCategoryChip.click();
    await app.chipField.pressSequentially("fun");
    await app.categoryChip("travel").click();

    await expect(app.categoryChip("travel")).toContainText("✕");
  });

  // A phone keyboard commits a name on the space bar, but a paste can put a
  // whole line in the field at once.
  test("takes every name a pasted line holds", async ({ app }) => {
    await app.openNewExpense();

    await app.newCategoryChip.click();
    await app.chipField.fill("zoo apple");
    await app.descriptionInput.click();

    await expect(app.categoryChip("zoo")).toContainText("✕");
    await expect(app.categoryChip("apple")).toContainText("✕");
  });

  test("selects an existing category rather than repeating it", async ({
    app,
  }) => {
    await app.openNewExpense();
    const chips = await app.categoryChips.count();

    await app.newCategoryChip.click();
    await app.chipField.pressSequentially("food");
    await app.chipField.press(" ");

    await expect(app.categoryChips).toHaveCount(chips);
    await expect(app.categoryChip("food")).toContainText("✕");
  });

  test("closes the field again on a backspace in an empty one", async ({
    app,
  }) => {
    await app.openNewExpense();

    await app.newCategoryChip.click();
    await app.chipField.press("Backspace");

    await expect(app.chipField).toHaveCount(0);
    await expect(app.newCategoryChip).toBeVisible();
  });

  test("keeps a new category offered on the next expense", async ({ app }) => {
    await app.addExpense({
      amount: "9",
      description: "Cinema",
      categories: "fun",
    });

    await app.openNewExpense();

    await expect(app.categoryChip("fun")).toBeVisible();
    await expect(app.categoryChip("fun")).not.toContainText("✕");
  });
});

// The chips wrap into a block rather than run off the right edge in one line.
// The block stops at three lines and the top of a fourth, so a list with more
// in it always shows a sliced line: a clip landing between two lines would
// look like the end of the list.
test.describe("the shape of the chip block", () => {
  const manyCategories = Array.from({ length: 20 }, (each, index) => ({
    id: index + 1,
    amount: 5,
    description: "Expense " + (index + 1),
    date: "2026-02-12",
    categories: ["category" + String(index + 1).padStart(2, "0")],
  }));

  test("wraps the chips onto several lines", async ({ app }) => {
    await app.open({ now: FEBRUARY, expenses: manyCategories });
    await app.openNewExpense();

    const lines = new Set(await app.categoryChipTops());
    expect(lines.size).toBeGreaterThan(1);
  });

  // Every chip is one line tall. Wrapped lines stretch to fill their box
  // unless told not to, which draws the chips as tall ovals.
  test("draws every chip at one line's height", async ({ app }) => {
    await app.open({ now: FEBRUARY, expenses: manyCategories });
    await app.openNewExpense();

    const heights = new Set(await app.categoryChipHeights());
    expect(heights.size).toBe(1);
    expect([...heights][0]).toBeLessThan(40);
  });

  test("clips a long list mid-chip, and scrolls to the rest", async ({
    app,
  }) => {
    await app.open({ now: FEBRUARY, expenses: manyCategories });
    await app.openNewExpense();

    const { clientHeight, scrollHeight } = await app.categoryBlockScroll();
    expect(scrollHeight).toBeGreaterThan(clientHeight);
    // Three lines and their gaps would end at 111px; the clip sits inside the
    // fourth line, so part of a chip is always in view.
    expect(clientHeight).toBeGreaterThan(111);
    expect(clientHeight).toBeLessThan(144);
  });

  test("leaves no empty room when the chips fit", async ({ app }) => {
    await app.open({ now: FEBRUARY, expenses });
    await app.openNewExpense();

    const { clientHeight, scrollHeight } = await app.categoryBlockScroll();
    expect(clientHeight).toBe(scrollHeight);
    expect(clientHeight).toBeLessThan(60);
  });

  // The block opens at the top, so the one chip that must never be hunted for
  // is on screen however long the list behind it is.
  test("shows `+ new` on opening, however many categories there are", async ({
    app,
  }) => {
    await app.open({ now: FEBRUARY, expenses: manyCategories });
    await app.openNewExpense();

    await expect(app.newCategoryChip).toBeInViewport();
    expect(await app.categoryBlockScroll()).toMatchObject({ scrollTop: 0 });
  });

  // Committing a name rebuilds the block. A category no expense carries yet
  // sorts ahead of the counted ones, so the chip that was just named is at the
  // top rather than below the clip, where the rebuild would have hidden it.
  test("shows a newly named category without scrolling", async ({ app }) => {
    await app.open({ now: FEBRUARY, expenses: manyCategories });
    await app.openNewExpense();

    await app.nameCategory("cycling");

    await expect(app.categoryChip("cycling")).toBeInViewport();
    await expect(app.categoryChip("cycling")).toContainText("✕");
  });
});
