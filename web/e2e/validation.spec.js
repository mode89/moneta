// The sheet rejects an expense with an `alert` and stays open. The same
// `expenseError` check guards the import path, so the wording is shared.
import { test, expect } from "./fixtures.js";

test.describe("rejecting an invalid expense", () => {
  test.beforeEach(async ({ app }) => {
    await app.open();
    await app.openNewExpense();
  });

  const rejects = (name, fields, message) =>
    test(name, async ({ app, dialogs }) => {
      await app.fillForm(fields);

      await app.submit();

      await dialogs.expectMessage(message);
      await expect(app.sheet).toBeVisible();
      await expect(app.rows).toHaveCount(0);
      expect(await app.stored()).toBe(null);
    });

  rejects("a missing amount", { description: "Groceries" }, "Invalid amount.");

  rejects(
    "a zero amount",
    { amount: "0", description: "Groceries" },
    "Invalid amount.",
  );

  rejects(
    "a negative amount",
    { amount: "-5", description: "Groceries" },
    "Invalid amount.",
  );

  rejects(
    "a missing description",
    { amount: "12.50" },
    "Description cannot be empty.",
  );

  rejects(
    "a description of only spaces",
    { amount: "12.50", description: "   " },
    "Description cannot be empty.",
  );

  rejects(
    "a cleared date",
    { amount: "12.50", description: "Groceries", date: "" },
    "Invalid date.",
  );

  test("a date in the future", async ({ app, dialogs }) => {
    await app.fillForm({
      amount: "12.50",
      description: "Groceries",
      date: await app.isoDaysFromToday(1),
    });

    await app.submit();

    await dialogs.expectMessage("Date cannot be in the future.");
    await expect(app.sheet).toBeVisible();
    expect(await app.stored()).toBe(null);
  });

  test("accepts today, the edge of the future", async ({ app, dialogs }) => {
    await app.fillForm({
      amount: "12.50",
      description: "Groceries",
      date: await app.todayIso(),
    });

    await app.submit();

    await expect(app.sheet).toHaveCount(0);
    await expect(app.expenseItem("Groceries")).toBeVisible();
    expect(dialogs.messages).toEqual([]);
  });

  test("reports the amount first when several fields are wrong", async ({
    app,
    dialogs,
  }) => {
    await app.fillForm({ amount: "0", description: "", date: "" });

    await app.submit();

    await dialogs.expectMessage("Invalid amount.");
    expect(dialogs.messages).toEqual(["Invalid amount."]);
  });

  test("keeps what was typed so it can be corrected", async ({
    app,
    dialogs,
  }) => {
    await app.fillForm({
      amount: "0",
      description: "Groceries",
      categories: "food",
    });
    await app.submit();
    await dialogs.expectMessage("Invalid amount.");

    await app.amountInput.fill("12.50");
    await app.submit();

    await expect(app.sheet).toHaveCount(0);
    await expect(app.amountOf("Groceries")).toHaveText("12.50");
    await expect(app.categoriesOf("Groceries")).toHaveText("food");
  });
});

test.describe("rejecting an invalid edit", () => {
  const groceries = {
    id: 1,
    amount: 12.5,
    description: "Groceries",
    date: "2026-02-12",
    categories: ["food"],
  };

  test("leaves the stored expense alone", async ({ app, dialogs }) => {
    await app.open({ now: "2026-02-12T12:00:00Z", expenses: [groceries] });
    await app.openExpense("Groceries");

    await app.fillForm({ amount: "" });
    await app.submit();

    await dialogs.expectMessage("Invalid amount.");
    await expect(app.sheet).toBeVisible();
    await expect(app.amountOf("Groceries")).toHaveText("12.50");
    // Nothing was saved, so storage still holds what was seeded.
    expect(await app.stored()).toEqual([groceries]);
  });
});
