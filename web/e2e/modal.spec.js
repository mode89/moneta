// How the dialog itself behaves: real typing rather than `fill`, the backdrop,
// and the keys a phone keyboard sends.
import { test, expect } from "./fixtures.js";

const groceries = {
  id: 1,
  amount: 12.5,
  description: "Groceries",
  date: "2026-02-12",
  categories: ["food"],
};

test.describe("the expense dialog", () => {
  test.beforeEach(async ({ app }) => {
    await app.open({ now: "2026-02-12T12:00:00Z", expenses: [groceries] });
  });

  test("takes what is typed key by key", async ({ app }) => {
    await app.openNewExpense();

    await app.amountInput.pressSequentially("7.25");
    await app.descriptionInput.pressSequentially("Cinema");
    await app.categoriesInput.pressSequentially("fun");
    await app.submit();

    await expect(app.modal).toHaveCount(0);
    await expect(app.amountOf("Cinema")).toHaveText("-$7.25");
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

    await expect(app.modal).toBeVisible();
    expect(await page.evaluate(() => window.__stillHere)).toBe(true);
  });

  test("covers the page with a dimmed backdrop", async ({ app }) => {
    await app.openNewExpense();

    await expect(app.modal).toHaveCSS("display", "block");
    await expect(app.modal).toHaveCSS(
      "background-color",
      "rgba(0, 0, 0, 0.5)",
    );
  });

  test("keeps the list out of reach behind the backdrop", async ({
    app,
    page,
  }) => {
    await app.openNewExpense();

    // Where the expense row sits, but the dialog is in front of it.
    await page.mouse.click(200, 400);

    await expect(app.modal).toBeVisible();
    await expect(app.modalTitle).toHaveText("New Expense");
  });

  test("stays open until Cancel, the close button or a save", async ({
    app,
    page,
  }) => {
    await app.openNewExpense();

    await page.keyboard.press("Escape");
    await expect(app.modal).toBeVisible();

    await app.cancelButton.click();
    await expect(app.modal).toHaveCount(0);
  });

  test("opens one dialog at a time", async ({ app, page }) => {
    await app.openExpense("Groceries");

    await expect(page.locator(".modal")).toHaveCount(1);
    await expect(app.modalTitle).toHaveText("Edit Expense");
  });

  test("fits a narrow phone screen", async ({ app, page }) => {
    await page.setViewportSize({ width: 320, height: 640 });
    await app.openNewExpense();

    for (const input of [
      app.amountInput,
      app.descriptionInput,
      app.dateInput,
      app.categoriesInput,
    ])
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
