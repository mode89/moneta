// How the sheet itself behaves: real typing rather than `fill`, the dim that is
// the only way out of it, and the keys a phone keyboard sends.
import { test, expect } from "./fixtures.js";

const groceries = {
  id: 1,
  amount: 12.5,
  description: "Groceries",
  date: "2026-02-12",
  categories: ["food"],
};

test.describe("the expense sheet", () => {
  test.beforeEach(async ({ app }) => {
    await app.open({ now: "2026-02-12T12:00:00Z", expenses: [groceries] });
  });

  test("takes what is typed key by key", async ({ app }) => {
    await app.openNewExpense();

    await app.amountInput.pressSequentially("7.25");
    await app.descriptionInput.pressSequentially("Cinema");
    await app.nameCategory("fun");
    await app.submit();

    await expect(app.sheet).toHaveCount(0);
    await expect(app.amountOf("Cinema")).toHaveText("7.25");
    await expect(app.categoriesOf("Cinema")).toHaveText("fun");
  });

  test("ignores letters typed into the amount", async ({ app, dialogs }) => {
    await app.openNewExpense();

    await app.amountInput.pressSequentially("abc");
    await app.descriptionInput.fill("Cinema");
    await app.submit();

    await expect(app.amountInput).toHaveValue("");
    await dialogs.expectMessage("Invalid amount.");
  });

  test("edits an existing value rather than replacing it", async ({ app }) => {
    await app.openExpense("Groceries");

    await app.descriptionInput.press("End");
    await app.descriptionInput.pressSequentially(" and wine");
    await app.submit();

    await expect(app.expenseItem("Groceries and wine")).toBeVisible();
  });

  test("does not reload the page when Enter is pressed", async ({
    app,
    page,
  }) => {
    await page.evaluate(() => (window.__stillHere = true));
    await app.openNewExpense();

    await app.descriptionInput.fill("Cinema");
    await app.descriptionInput.press("Enter");

    await expect(app.sheet).toBeVisible();
    expect(await page.evaluate(() => window.__stillHere)).toBe(true);
  });

  test("covers the page with a dim", async ({ app }) => {
    await app.openNewExpense();

    await expect(app.scrim).toBeVisible();
    await expect(app.scrim).toHaveCSS(
      "background-color",
      "rgba(47, 42, 42, 0.42)",
    );
  });

  test("closes when the dim is tapped, without opening anything else", async ({
    app,
  }) => {
    await app.openNewExpense();

    await app.dismissDialog();

    await expect(app.sheet).toHaveCount(0);
    await expect(app.scrim).toHaveCount(0);
  });

  test("ignores Escape, which a phone does not send", async ({ app, page }) => {
    await app.openNewExpense();

    await page.keyboard.press("Escape");

    await expect(app.sheet).toBeVisible();
  });

  test("opens one sheet at a time", async ({ app }) => {
    await app.openExpense("Groceries");

    await expect(app.sheet).toHaveCount(1);
    await expect(app.sheetTitle).toHaveText("Edit expense");
  });

  test("offers deletion only when editing", async ({ app }) => {
    await app.openNewExpense();
    await expect(app.deleteButton).toHaveCount(0);

    await app.dismissDialog();
    await app.openExpense("Groceries");

    await expect(app.deleteButton).toHaveText("Delete");
  });

  test("fits a narrow phone screen", async ({ app, page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await app.openNewExpense();

    for (const input of [app.amountInput, app.descriptionInput, app.dateInput])
      await expect(input).toBeInViewport();
    await expect(app.submitButton).toBeInViewport();
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth <=
          document.documentElement.clientWidth,
      ),
    ).toBe(true);
  });
});
