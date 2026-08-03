// Shared test fixtures: a page object over the app's markup, a dialog recorder
// (the app still talks to the user through `alert` when a file or a form is
// wrong), and helpers for seeding `localStorage` and for the Android bridge.
//
// The app carries no test hooks, so locators are built from the roles, labels
// and class names `main.js` actually renders. Anything that needs to be in
// place before the module runs — stored expenses, a fixed clock, the `Android`
// object — is installed by `app.open()` before it navigates.
import { test as base, expect } from "@playwright/test";

export { expect };

export const STORAGE_KEY = "expenses";

// Records every `alert`/`confirm` the page raises. Playwright dismisses
// dialogs itself when nothing is listening, so a test that means to accept one
// has to say so with `acceptAll()`.
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

const MONTHS = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

// The heading the app writes over a day: Today and Yesterday only for those
// two days of the current month, and `12 February` everywhere else.
export function dayLabel(isoDate, todayIso = null) {
  if (isoDate === todayIso) return "Today";
  if (todayIso && isoDate === shiftIsoDate(todayIso, -1)) return "Yesterday";
  const [, month, day] = isoDate.split("-").map(Number);
  return day + " " + MONTHS[month - 1];
}

export function monthLabel(isoDate) {
  const [year, month] = isoDate.split("-").map(Number);
  return MONTHS[month - 1] + " " + year;
}

export function shiftIsoDate(isoDate, days) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day + days);
  return (
    date.getFullYear() +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getDate()).padStart(2, "0")
  );
}

export class MonetaApp {
  constructor(page) {
    this.page = page;
    this.app = page.locator(".app");

    // header
    this.header = page.locator(".head");
    this.monthTitle = this.header.locator(".month");
    this.totalSpentRow = this.header.locator(".total");
    this.totalSpent = this.totalSpentRow.locator("span");
    this.meta = this.header.locator(".meta > span");
    this.expenseCount = this.meta.first();
    this.averagePerDay = this.meta.nth(1).locator("b > span");
    this.settingsButton = page.getByLabel("Settings");

    // the category chips under the header
    this.legendChips = page.locator(".legend .chip");

    // the list: day headings, rows, and one fold line per earlier month
    this.list = page.locator(".app > .scroll");
    this.emptyMessage = this.list.locator(".empty");
    this.dayHeadings = this.list.locator(".day");
    this.listedDays = this.dayHeadings.locator("> span:first-child");
    this.rows = this.list.locator(".row");
    this.listedDescriptions = this.rows.locator(".desc");
    this.foldLines = this.list.locator(".fold");
    this.newExpenseButton = page.getByLabel("Add an expense");

    // the add/edit sheet
    // The last dim on the page belongs to the dialog on top: while the sheet
    // animates away its dim is still there, under the confirmation's.
    this.scrim = page.locator(".scrim").last();
    this.sheet = page.locator(".sheet");
    this.sheetTitle = this.sheet.locator("h3");
    this.amountInput = page.locator("#expense-amount");
    this.descriptionInput = page.locator("#expense-description");
    this.dateInput = page.locator("#expense-date");
    this.categoryChips = this.sheet.locator(".chiprow .chip");
    this.newCategoryChip = this.categoryChips.filter({ hasText: "+ new" });
    this.chipField = this.sheet.locator(".chip-field");
    this.submitButton = this.sheet.locator(".save");
    this.deleteButton = this.sheet.locator(".ghost");

    // the delete and import confirmations
    this.card = page.locator(".card");
    this.cardTitle = this.card.locator("h3");
    this.cardBody = this.card.locator("p");
    this.confirmButton = this.card.locator(".save");
    this.cancelButton = this.card.locator(".ghost");

    // settings
    this.settings = page.locator(".cover");
    this.closeSettingsButton = page.getByLabel("Close settings");
    this.exportRow = this.settings.locator(".set-row").filter({
      hasText: "Export expenses",
    });
    this.importRow = this.settings.locator(".set-row").filter({
      hasText: "Import expenses",
    });
    this.version = this.settings.locator(".version");

    this.saveNotice = page.locator(".notice");
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
    // index.html fetches its typefaces from Google. `goto` waits for the `load`
    // event, which waits for that stylesheet, so a stalled request out on the
    // public internet times the navigation out. Answering it here keeps the
    // suite off the network; the app renders in the fallback faces, which no
    // assertion depends on. An empty response, not an abort, since an aborted
    // request is a console error and one spec allows none.
    await this.page.route(/fonts\.(googleapis|gstatic)\.com/, (route) =>
      route.fulfill({ status: 200, contentType: "text/css", body: "" }),
    );
    await this.page.goto("/");
    await expect(this.header).toBeVisible();
  }

  // --- reading the page -----------------------------------------------

  dayHeading(label) {
    return this.dayHeadings.filter({ hasText: label });
  }

  dayTotal(label) {
    return this.dayHeading(label).locator(".sum span");
  }

  // A row is found by its description, not by anything else it carries.
  expenseItem(description) {
    return this.rows.filter({
      has: this.page.locator(".desc", { hasText: description }),
    });
  }

  amountOf(description) {
    return this.expenseItem(description).locator(".amt span");
  }

  categoriesOf(description) {
    return this.expenseItem(description).locator(".cats");
  }

  dotOf(description) {
    return this.expenseItem(description).locator("i.dot");
  }

  legendChip(name) {
    return this.legendChips.filter({ hasText: name });
  }

  categoryChip(name) {
    return this.categoryChips.filter({ hasText: name });
  }

  foldLine(month) {
    return this.foldLines.filter({ hasText: month });
  }

  foldTotal(month) {
    return this.foldLine(month).locator(".sum span");
  }

  foldHelp(month) {
    return this.foldLine(month).locator(".help");
  }

  // --- driving the page -----------------------------------------------

  async openNewExpense() {
    await this.newExpenseButton.click();
    await expect(this.sheet).toBeVisible();
  }

  async openExpense(description) {
    await this.expenseItem(description).locator(".desc").click();
    await expect(this.sheet).toBeVisible();
  }

  // The dim is the only way to close the sheet. Its centre is behind the sheet
  // itself, so the click lands near the top-left corner.
  async dismissDialog() {
    await this.scrim.click({ position: { x: 40, y: 40 } });
  }

  async fillForm({ amount, description, date, categories }) {
    if (amount !== undefined) await this.amountInput.fill(amount);
    if (description !== undefined)
      await this.descriptionInput.fill(description);
    if (date !== undefined) await this.dateInput.fill(date);
    if (categories !== undefined) await this.setCategories(categories);
  }

  // Leaves exactly the named categories selected, naming any the user has
  // never used before through the `+ new` chip.
  async setCategories(text) {
    const wanted =
      text.trim() === "" ? [] : text.trim().toLowerCase().split(/\s+/);
    const selected = this.categoryChips.filter({ hasText: "✕" });
    for (let count = await selected.count(); count > 0; count -= 1)
      await selected.first().click();
    for (const name of wanted) {
      const chip = this.categoryChip(name);
      if ((await chip.count()) > 0) await chip.click();
      else await this.nameCategory(name);
    }
  }

  // Types a category into the field the `+ new` chip turns into; a space
  // commits it.
  async nameCategory(name) {
    await this.newCategoryChip.click();
    await this.chipField.pressSequentially(name);
    await this.chipField.press(" ");
    await expect(this.chipField).toHaveCount(0);
  }

  async submit() {
    await this.submitButton.click();
  }

  // Fills the new-expense sheet and saves it, leaving the sheet closed.
  async addExpense(fields) {
    await this.openNewExpense();
    await this.fillForm(fields);
    await this.submit();
    await expect(this.sheet).toHaveCount(0);
  }

  // Opens an expense, asks to delete it and confirms.
  async deleteExpense(description) {
    await this.openExpense(description);
    await this.deleteButton.click();
    await expect(this.card).toBeVisible();
    await this.confirmButton.click();
    await expect(this.card).toHaveCount(0);
  }

  async openSettings() {
    await this.settingsButton.click();
    await expect(this.settings).toBeVisible();
  }

  async closeSettings() {
    await this.closeSettingsButton.click();
    await expect(this.settings).toHaveCount(0);
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
    return this.page.evaluate(
      () =>
        new Date().toLocaleString("default", { month: "long" }) +
        " " +
        new Date().getFullYear(),
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

// Hands a file to the import flow and stops at the confirmation card, which
// the caller accepts or refuses. The `<input type=file>` is created and clicked
// from script, so Playwright's file chooser has nothing to attach to; the file
// is planted on the input and the change event dispatched instead. A `content`
// of null plays the user backing out of the file picker.
export async function chooseFileToImport(
  app,
  { name = "moneta.json", content } = {},
) {
  await app.openSettings();
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
  await app.importRow.click();
}

// Imports a file all the way through: choose it, then confirm the card.
export async function importFile(app, options) {
  await chooseFileToImport(app, options);
  await expect(app.card).toBeVisible();
  await app.confirmButton.click();
  await expect(app.settings).toHaveCount(0);
}

// Exports through the settings screen, leaving settings open.
export async function exportFile(app) {
  await app.openSettings();
  const download = app.page.waitForEvent("download");
  await app.exportRow.click();
  return download;
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
