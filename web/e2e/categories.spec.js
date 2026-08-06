// Categories are chosen from chips in the sheet: every category the user has
// used, most recently spent on first, plus a `+ new` chip that becomes a text
// field in place.
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

  test("offers every category used so far and a way to add one", async ({
    app,
  }) => {
    await app.openNewExpense();

    await expect(app.categoryChips).toHaveText([
      /food/,
      /shopping/,
      /travel/,
      "+ new",
    ]);
  });

  test("offers the most recently spent on category first", async ({ app }) => {
    await app.openExpense("Groceries");
    await app.fillForm({ date: "2026-02-10" });
    await app.submit();

    await app.openNewExpense();

    await expect(app.categoryChips).toHaveText([
      /travel/,
      /food/,
      /shopping/,
      "+ new",
    ]);
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
