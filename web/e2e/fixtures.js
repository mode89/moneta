// Shared test fixtures: a page object over the app's markup, a dialog recorder
// (the app talks to the user through `alert` and `confirm`), and helpers for
// seeding `localStorage` and for the Android bridge.
//
// The app carries no test hooks, so locators are built from the roles, labels
// and Bootstrap classes `main.js` actually renders. Anything that needs to be
// in place before the module runs — stored expenses, a fixed clock, the
// `Android` object — is installed by `app.open()` before it navigates.
import { test as base, expect } from "@playwright/test";

export { expect };

export const STORAGE_KEY = "expenses";

// Records every `alert`/`confirm` the page raises. Playwright dismisses
// dialogs itself when nothing is listening, and a dismissed `confirm` is a
// "no", so a test that means to confirm has to say so with `acceptAll()`.
export class Dialogs {
  constructor(page) {
    this.messages = [];
    this.accepting = false;
    page.on("dialog", async (dialog) => {
      this.messages.push(dialog.message());
      await (this.accepting ? dialog.accept() : dialog.dismiss());
    });
  }

  acceptAll() {
    this.accepting = true;
  }

  clear() {
    this.messages.length = 0;
  }

  get last() {
    return this.messages.at(-1);
  }

  async expectMessage(message) {
    await expect
      .poll(() => this.messages, { message: "expected dialog " + message })
      .toContain(message);
  }

  async expectNone() {
    // Nothing to wait for, so give a stray dialog a moment to arrive.
    await expect.poll(() => this.messages).toEqual([]);
  }
}

export class MonetaApp {
  constructor(page) {
    this.page = page;

    this.summaryCard = page.locator(".card.mb-4");
    this.monthTitle = this.summaryCard.locator(".card-title");
    this.totalSpentRow = this.summaryCard.locator(".card-text");
    // `Amount` renders the blurrable span, one level inside the coloured one.
    this.totalSpent = this.totalSpentRow.locator("span > span");

    this.expenseCard = page.locator(".card.mt-4");
    this.emptyMessage = this.expenseCard.locator("li.text-muted");
    this.importButton = page.getByTitle("Import Expenses");
    this.exportButton = page.getByTitle("Export Expenses");
    this.dayGroups = this.expenseCard.locator("li.bg-light.p-0");
    this.dayHeadings = this.expenseCard.locator("li.bg-light > strong");
    this.expenseItems = this.expenseCard.locator("li.list-group-item.d-flex");
    this.newExpenseButton = page.locator("button.fixed-bottom-right");

    this.modal = page.locator(".modal");
    this.modalTitle = this.modal.locator(".modal-title");
    this.amountInput = page.locator("#expense-amount");
    this.descriptionInput = page.locator("#expense-description");
    this.dateInput = page.locator("#expense-date");
    this.categoriesInput = page.locator("#expense-categories");
    this.closeButton = this.modal.locator(".btn-close");
    this.cancelButton = this.modal.getByRole("button", { name: "Cancel" });
    this.deleteButton = this.modal.getByRole("button", { name: "Delete" });
    this.submitButton = this.modal.locator("button.btn-primary");

    this.saveNotice = page.locator(".bubble");
    this.version = page.locator(".version");
  }

  // `expenses` are seeded in stored form (`date` as YYYY-MM-DD); `now` fixes
  // the clock; `android` installs a recording stand-in for the WebView bridge.
  async open({ expenses, now, android = false } = {}) {
    if (now) {
      this.fixedTime = new Date(now).getTime();
      await this.page.clock.setFixedTime(now);
    }
    // The script runs on every navigation, so it seeds only an empty device:
    // a reload has to show what the app itself stored.
    if (expenses)
      await this.page.addInitScript(
        ([key, json]) => {
          if (window.localStorage.getItem(key) === null)
            window.localStorage.setItem(key, json);
        },
        [STORAGE_KEY, JSON.stringify(expenses)],
      );
    if (android) await installAndroidBridge(this.page);
    await this.page.goto("/");
    await expect(this.expenseCard).toBeVisible();
  }

  // --- reading the page -----------------------------------------------

  dayGroup(isoDate) {
    return this.dayGroups.filter({ hasText: isoDate });
  }

  dayTotal(isoDate) {
    return this.dayGroup(isoDate).locator("strong > span > span");
  }

  expensesOf(isoDate) {
    return this.dayGroup(isoDate).locator("li.list-group-item.d-flex");
  }

  expenseItem(description) {
    return this.expenseItems.filter({ hasText: description });
  }

  amountOf(description) {
    return this.expenseItem(description).locator("span.text-danger > span");
  }

  categoriesOf(description) {
    return this.expenseItem(description).locator(".text-info");
  }

  // The descriptions in the order they are rendered, days and all.
  async listedDescriptions() {
    return this.expenseItems.locator("div > span").allInnerTexts();
  }

  async listedDays() {
    return this.expenseCard
      .locator("li.bg-light > strong > span:first-child")
      .allInnerTexts();
  }

  // --- driving the page -----------------------------------------------

  async openNewExpense() {
    await this.newExpenseButton.click();
    await expect(this.modal).toBeVisible();
  }

  async openExpense(description) {
    await this.expenseItem(description).locator("div").first().click();
    await expect(this.modal).toBeVisible();
  }

  async fillForm({ amount, description, date, categories }) {
    if (amount !== undefined) await this.amountInput.fill(amount);
    if (description !== undefined)
      await this.descriptionInput.fill(description);
    if (date !== undefined) await this.dateInput.fill(date);
    if (categories !== undefined) await this.categoriesInput.fill(categories);
  }

  async submit() {
    await this.submitButton.click();
  }

  // Fills the new-expense dialog and saves it, leaving the dialog closed.
  async addExpense(fields) {
    await this.openNewExpense();
    await this.fillForm(fields);
    await this.submit();
    await expect(this.modal).toBeHidden();
  }

  // --- storage ---------------------------------------------------------

  async storedJson() {
    return this.page.evaluate(
      (key) => window.localStorage.getItem(key),
      STORAGE_KEY,
    );
  }

  async stored() {
    const json = await this.storedJson();
    return json === null ? null : JSON.parse(json);
  }

  // --- the clock -------------------------------------------------------

  // Moves a fixed clock forward. Ids are creation timestamps, so a test that
  // adds several expenses under a stopped clock would mint one id for all of
  // them, and they would then be edited and deleted together.
  async tick(milliseconds = 1000) {
    if (this.fixedTime === undefined)
      throw new Error("tick() needs the clock fixed by open({ now })");
    this.fixedTime += milliseconds;
    await this.page.clock.setFixedTime(new Date(this.fixedTime));
  }

  // The browser's today, in the context's timezone rather than Node's.
  async todayIso() {
    return this.page.evaluate(() => {
      const date = new Date();
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return date.getFullYear() + "-" + month + "-" + day;
    });
  }

  async isoDaysFromToday(days) {
    return this.page.evaluate((days) => {
      const date = new Date();
      date.setDate(date.getDate() + days);
      const month = String(date.getMonth() + 1).padStart(2, "0");
      const day = String(date.getDate()).padStart(2, "0");
      return date.getFullYear() + "-" + month + "-" + day;
    }, days);
  }

  async monthName() {
    return this.page.evaluate(() =>
      new Date().toLocaleString("default", { month: "long" }),
    );
  }
}

// A stand-in for the object `MainActivity` injects, recording what the app
// asks of it. `Android.pickFile` takes a callback the host calls back with the
// file's text; `respondToPickFile` plays the host's part.
export async function installAndroidBridge(page) {
  await page.addInitScript(() => {
    window.__android = { createFile: [], pickFile: 0 };
    window.Android = {
      createFile(filename, content) {
        window.__android.createFile.push({ filename, content });
      },
      pickFile(callback) {
        window.__android.pickFile += 1;
        window.__androidPickFileCallback = callback;
      },
    };
  });
}

export function androidCalls(page) {
  return page.evaluate(() => window.__android);
}

export async function respondToPickFile(page, json) {
  await page.evaluate((json) => window.__androidPickFileCallback(json), json);
}

// Hands a file to the import flow. The `<input type=file>` is created and
// clicked from script, so Playwright's file chooser has nothing to attach to;
// the file is planted on the input and the change event dispatched instead.
// A `content` of null plays the user backing out of the file picker.
export async function importFile(app, { name = "moneta.json", content } = {}) {
  await app.page.evaluate(
    ([name, content]) => {
      const nativeClick = HTMLInputElement.prototype.click;
      HTMLInputElement.prototype.click = function () {
        if (this.type !== "file") return nativeClick.call(this);
        HTMLInputElement.prototype.click = nativeClick;
        if (content !== null) {
          const transfer = new DataTransfer();
          transfer.items.add(
            new File([content], name, { type: "application/json" }),
          );
          this.files = transfer.files;
        }
        this.dispatchEvent(new Event("change"));
      };
    },
    [name, content ?? null],
  );
  await app.importButton.click();
}

// The text of a file the page offered for download.
export async function downloadedText(download) {
  const stream = await download.createReadStream();
  const chunks = [];
  for await (const chunk of stream) chunks.push(chunk);
  return Buffer.concat(chunks).toString("utf8");
}

export const test = base.extend({
  app: async ({ page }, use) => {
    await use(new MonetaApp(page));
  },
  dialogs: async ({ page }, use) => {
    await use(new Dialogs(page));
  },
});
