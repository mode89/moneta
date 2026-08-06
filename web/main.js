import { createMemo, createSignal, untrack, For } from "solid-js";
import { createStore } from "solid-js/store";
import { render } from "solid-js/web";
import html from "solid-js/html";
import { Capacitor, registerPlugin } from "@capacitor/core";
import { Transition } from "solid-transition-group";

// The plugins' own JavaScript cannot be loaded without a bundler, so the app
// asks the native bridge for them by name; in a browser they stay unused.
const Filesystem = registerPlugin("Filesystem");
const Share = registerPlugin("Share");
const AppPlugin = registerPlugin("App");

export const [expenses, setExpenses] = createStore([]);
const [activeCategory, setActiveCategory] = createSignal(null);
const [unfoldedMonths, setUnfoldedMonths] = createSignal([]);
const [showNumbers, setShowNumbers] = createSignal(false);
export const [saveNotice, setSaveNotice] = createSignal(null);

// What is open over the app, outermost first: settings, then the sheet or a
// card opened from it. Each overlay names itself with a kind, and at most one
// of a kind is open, so a kind identifies it.
const [overlays, setOverlays] = createSignal([]);

export function main() {
  setExpenses(loadExpenses());
  // The listener replaces Android's default back action altogether, so with
  // nothing open the app has to leave itself.
  if (Capacitor.isNativePlatform())
    AppPlugin.addListener("backButton", closeTopOverlay);
  render(App, document.getElementById("app"));
}

// The back button closes one overlay at a time, innermost first.
function closeTopOverlay() {
  const open = overlays();
  if (open.length > 0) setOverlays(open.slice(0, -1));
  else if (!overlayOnScreen()) AppPlugin.exitApp();
}

// An overlay leaves the stack at once but stays drawn while it slides away, so
// a press in that moment is still aimed at it rather than at the app.
function overlayOnScreen() {
  return document.querySelector(".sheet-layer, .cover-layer") !== null;
}

function App() {
  return html`
    <div class="app">
      <${MonthSummary} />
      <${CategoryLegend} />
      <div class="scroll"><${ExpenseList} /></div>
      <${NewExpenseButton} />
      <${EditedExpenseSheet} />
      <${DeleteConfirmation} />
      <${SettingsCover} />
      <${ImportConfirmation} />
      <${SaveNotice} />
    </div>`;
}

// The header describes the current month, narrowed to the active category. It
// stays on the current month even while an older one is unfolded below.
function MonthSummary() {
  const monthly = createMemo(() =>
    filterByCategory(currentMonthExpenses(), activeCategory()),
  );
  const total = createMemo(() => totalOf(monthly()));
  const perDay = createMemo(() => {
    const today = now();
    return averagePerDay(total(), today, today);
  });
  return html`
    <div class="head">
      <button
        class="corner"
        title="Settings"
        aria-label="Settings"
        onClick=${() => openOverlay({ kind: "settings" })}
      >
        ⚙
      </button>
      <div class="month">${() => formatMonth(now())}</div>
      <div class="total" onClick=${toggleNumbers}>
        <${Amount} value=${total} />
      </div>
      <div class="meta">
        <!-- the space belongs inside the expression: solid-js/html trims the
             whitespace between an element and the expression that follows -->
        <span>
          <b>${() => monthly().length}</b>${() =>
            " " + pluralNoun(monthly().length, "expense")}
        </span>
        ${() =>
          monthly().length > 0 &&
          html`<span>
            <b><${Amount} value=${perDay} /></b>
            ${() => " a day"}
          </span>`}
      </div>
    </div>`;
}

// One chip per category spent on this month, largest first. Tapping filters
// the whole list; tapping the selected one clears the filter.
function CategoryLegend() {
  const totals = createMemo(() => categoryTotals(currentMonthExpenses()));
  return html`
    <div class="legend">
      <${For} each=${totals}>
        ${(category) => html`
          <button
            class=${() =>
              "chip" + (activeCategory() === category.name ? " on" : "")}
            onClick=${() => toggleFilter(category.name)}
          >
            <i style=${{ background: categoryInk(category.name) }}></i>
            ${category.name}
            <${Amount} value=${category.total} format=${roundedCurrency} />
          </button>`}
      <//>
    </div>`;
}

function ExpenseList() {
  const months = createMemo(() => groupByMonth(visibleExpenses()));
  const current = createMemo(() =>
    months().find((month) => isSameMonth(month.date, now())),
  );
  const past = createMemo(() =>
    months().filter((month) => !isSameMonth(month.date, now())),
  );
  return html`
    ${() => expenses.length === 0 && html`<${EmptyList} />`}
    ${() => current() && html`<${DayGroups} month=${current()} relative=${true} />`}
    <${For} each=${past}>
      ${(month) => html`<${FoldedMonth} month=${month} />`}
    <//>`;
}

function EmptyList() {
  return html`
    <div class="empty">
      Nothing recorded yet.<br /><br />
      Tap <b>+</b> to add your first expense — or open settings to import a file
      you exported before.
    </div>`;
}

// Day headings say Today and Yesterday only in the current month; an unfolded
// older month names its days outright.
function DayGroups(props) {
  const days = groupByDay(props.month.expenses);
  const heading = (date) =>
    props.relative ? formatDay(date, now()) : formatDate(date);
  return html`
    <${For} each=${days}>
      ${(day) => html`
        <div class="day" onClick=${toggleNumbers}>
          <span>${heading(day.date)}</span>
          <span class="sum"><${Amount} value=${totalOf(day.expenses)} /></span>
        </div>
        <${For} each=${day.expenses}>
          ${(expense) => html`<${ExpenseRow} expense=${expense} />`}
        <//>`}
    <//>`;
}

function ExpenseRow(props) {
  const expense = props.expense;
  const categorised = expense.categories.length > 0;
  const revealOnly = (event) => {
    event.stopPropagation();
    toggleNumbers();
  };
  return html`
    <div
      class="row"
      onClick=${() => openOverlay({ kind: "editExpense", id: expense.id })}
    >
      <i
        class=${categorised ? "dot" : "dot uncategorised"}
        style=${categorised ? { background: categoryInk(expense.categories[0]) } : {}}
      ></i>
      <div>
        <div class="desc">${expense.description}</div>
        ${
          categorised &&
          html`<div class="cats">${expense.categories.join(" · ")}</div>`
        }
      </div>
      <div class="amt" onClick=${revealOnly}>
        <${Amount} value=${expense.amount} format=${plainAmount} />
      </div>
    </div>`;
}

// Every month before this one is a single line, unfolded in place by a tap and
// folded again by the next launch.
function FoldedMonth(props) {
  const month = props.month;
  const total = totalOf(month.expenses);
  const unfolded = () => unfoldedMonths().includes(month.key);
  // Every word sits inside an expression, since solid-js/html trims the static
  // whitespace around an element.
  const foldSummary = () => {
    const count = month.expenses.length;
    const filter = activeCategory();
    if (filter) return html`<span>${`${count} in ${filter}`}</span>`;
    if (!unfolded()) return html`<span>${plural(count, "expense")}</span>`;
    return html`<span>
      ${plural(count, "expense") + " · "}
      <${Amount} value=${averagePerDay(total, month.date, now())} />
      ${" a day"}
    </span>`;
  };
  return html`
    <div>
      <div class="fold" onClick=${() => toggleMonth(month.key)}>
        <span class="caret">${() => (unfolded() ? "⌄" : "›")}</span>
        <div>
          <div class="name">${formatMonth(month.date)}</div>
          <div class="help">${foldSummary}</div>
        </div>
        <div class="sum"><${Amount} value=${total} /></div>
      </div>
      ${() => unfolded() && html`<${DayGroups} month=${month} />`}
    </div>`;
}

function NewExpenseButton() {
  return html`
    <button
      class="fab"
      aria-label="Add an expense"
      onClick=${() => openOverlay({ kind: "newExpense" })}
    >
      +
    </button>`;
}

// A money amount, blurred until the user reveals numbers. Every launch starts
// blurred: nothing about the blur is stored.
function Amount(props) {
  const format = props.format ?? formatCurrency;
  return html`<span class=${() => (showNumbers() ? "" : "blur-text")}>
    ${() => format(props.value)}
  </span>`;
}

// The one sheet behind adding and editing. `mode="outin"` makes a reopened
// sheet wait for the leaving one, so only ever one is in the page.
function EditedExpenseSheet() {
  const addedExpense = createMemo(() => overlayOf("newExpense"));
  const editedExpense = createMemo(() => overlayOf("editExpense"));
  return html`
    <${Transition}
      name="sheet"
      mode="outin"
      onEnter=${settleTransition}
      onExit=${settleTransition}
    >
      ${() => {
        // Read through memos over the two overlays this sheet answers to, not
        // the stack: opening the delete card over it would otherwise rebuild
        // the sheet and lose what the user had typed.
        if (addedExpense())
          return html`<${ExpenseSheet}
            title="Add an expense"
            submitLabel="Save expense"
            initial=${blankExpenseForm()}
            actions=${newExpenseActions()}
          />`;
        const edited = editedExpense();
        if (!edited) return null;
        return html`<${ExpenseSheet}
          title="Edit expense"
          submitLabel="Save changes"
          initial=${untrack(() => formFromExpense(findExpense(edited.id)))}
          actions=${editExpenseActions(edited.id)}
        />`;
      }}
    <//>`;
}

// Shared add/edit sheet; Delete appears only when the actions provide it. The
// dim behind it is the only way to close it, and closing discards silently.
function ExpenseSheet(props) {
  const [form, setForm] = createStore(props.initial);
  const updateField = (key) => (event) => setForm(key, event.target.value);
  const toggleCategory = (name) =>
    setForm("categories", withCategoryToggled(form.categories, name));
  const submit = () => {
    const expense = expenseFromForm(form);
    const error = expenseError(expense);
    if (error) {
      alert(error);
      return;
    }
    props.actions.save(expense);
  };
  return html`
    <div class="sheet-layer">
      <div class="scrim" onClick=${() => props.actions.close()}></div>
      <div class="sheet" role="dialog">
        <div class="grab"></div>
        <h3>${() => props.title}</h3>
        <label class="flabel" for="expense-amount">Amount</label>
        <!-- text, not number: a number field drops a typed decimal comma -->
        <input
          class="in big"
          id="expense-amount"
          type="text"
          inputmode="decimal"
          placeholder="0.00"
          value=${() => form.amount}
          onInput=${updateField("amount")}
        />
        <label class="flabel" for="expense-description">Description</label>
        <input
          class="in"
          id="expense-description"
          type="text"
          placeholder="e.g. Groceries"
          value=${() => form.description}
          onInput=${updateField("description")}
        />
        <label class="flabel" for="expense-date">Date</label>
        <input
          class="in"
          id="expense-date"
          type="date"
          value=${() => form.date}
          onInput=${updateField("date")}
        />
        <label class="flabel">Categories</label>
        <${CategoryPicker}
          chosen=${() => form.categories}
          actions=${{ toggle: toggleCategory }}
        />
        ${() =>
          props.actions.remove
            ? html`<div class="actions">
                <button class="ghost" onClick=${() => props.actions.remove()}>
                  Delete
                </button>
                <button class="save" onClick=${submit}>${props.submitLabel}</button>
              </div>`
            : html`<button class="save" onClick=${submit}>
                ${props.submitLabel}
              </button>`}
      </div>
    </div>`;
}

// Every category used before, most recent first, and a field that names a new
// one. A typed name is taken on space, Enter or leaving the field.
function CategoryPicker(props) {
  const [namingCategory, setNamingCategory] = createSignal(false);
  // The typed text is held outside the reactive graph: reading it in the markup
  // would rebuild the input on every keystroke and lose what was typed.
  let draftCategory = "";
  const offered = createMemo(() => knownCategories(expenses, props.chosen));
  const nameCategory = () => {
    draftCategory = "";
    setNamingCategory(true);
  };
  // Every name the field holds, since a pasted line can carry several and
  // parseCategories sorts them.
  const commitDraft = () => {
    const names = parseCategories(draftCategory);
    draftCategory = "";
    setNamingCategory(false);
    for (const name of names)
      if (!props.chosen.includes(name)) props.actions.toggle(name);
  };
  // Pressing a chip must not move focus: the blur would commit the draft and
  // rebuild this row under the finger, and the tap would land on nothing.
  const keepFocus = (event) => event.preventDefault();
  const draftKey = (event) => {
    if (event.key === " " || event.key === "Enter") {
      event.preventDefault();
      commitDraft();
    } else if (event.key === "Escape") {
      setNamingCategory(false);
    } else if (event.key === "Backspace" && event.target.value === "") {
      setNamingCategory(false);
    }
  };
  return html`
    <div class="chiprow">
      <${For} each=${offered}>
        ${(name) => html`
          <button
            class=${() => "chip" + (props.chosen.includes(name) ? " on" : "")}
            onMouseDown=${keepFocus}
            onClick=${() => props.actions.toggle(name)}
          >
            <i style=${{ background: categoryInk(name) }}></i>
            ${name}${() => (props.chosen.includes(name) ? " ✕" : "")}
          </button>`}
      <//>
      ${() =>
        namingCategory()
          ? html`<input
              class="chip-field"
              autofocus
              ref=${(element) => setTimeout(() => element.focus())}
              onInput=${(event) => (draftCategory = event.target.value)}
              onKeyDown=${draftKey}
              onBlur=${commitDraft}
            />`
          : html`<button class="chip" onClick=${nameCategory}>+ new</button>`}
    </div>`;
}

// Deleting names the expense that will go, and sits over the sheet it was
// asked for from, which is left as it was if the deletion is refused.
function DeleteConfirmation() {
  return () => {
    const overlay = overlayOf("deleteExpense");
    if (!overlay) return null;
    const expense = untrack(() => findExpense(overlay.id));
    return html`<${ConfirmCard}
      title="Delete this expense?"
      body=${deleteMessage(expense)}
      cancelLabel="Keep"
      confirmLabel="Delete"
      actions=${{
        confirm: () => {
          closeOverlay("deleteExpense");
          closeOverlay("editExpense");
          deleteExpense(overlay.id);
        },
        cancel: () => closeOverlay("deleteExpense"),
      }}
    />`;
  };
}

// Both destructive actions ask first, naming what will go.
function ConfirmCard(props) {
  return html`
    <div class="card-layer">
      <div class="scrim" onClick=${() => props.actions.cancel()}></div>
      <div class="card" role="dialog">
        <h3>${() => props.title}</h3>
        <p>${() => props.body}</p>
        <div class="actions">
          <button class="ghost" onClick=${() => props.actions.cancel()}>
            ${() => props.cancelLabel}
          </button>
          <button class="save danger" onClick=${() => props.actions.confirm()}>
            ${() => props.confirmLabel}
          </button>
        </div>
      </div>
    </div>`;
}

// The settings screen slides in beside the app and covers it at rest.
function SettingsCover() {
  return html`
    <${Transition}
      name="cover"
      mode="outin"
      onEnter=${settleTransition}
      onExit=${settleTransition}
    >
      ${() => overlayOf("settings") && html`<${SettingsScreen} />`}
    <//>`;
}

// Opened by the gear, closed by the ✕ in the same corner. It holds only what
// is used a few times a year.
function SettingsScreen() {
  return html`
    <div class="cover-layer">
      <div class="cover">
        <div class="bar">
          <button
            class="corner"
            aria-label="Close settings"
            onClick=${() => closeOverlay("settings")}
          >
            ✕
          </button>
          <h2>Settings</h2>
        </div>
        <div class="scroll">
          <div class="group-label">Your data</div>
          <div class="set-row" onClick=${exportExpenses}>
            <div>
              <div class="set-title">Export expenses</div>
              <div class="set-help">Save a JSON file you can keep or move</div>
            </div>
          </div>
          <div class="set-row" onClick=${importExpenses}>
            <div>
              <div class="set-title">Import expenses</div>
              <div class="set-help">Replaces everything on this device</div>
            </div>
          </div>
          <div class="version">Version ${appVersion()}</div>
        </div>
      </div>
    </div>`;
}

// Nothing is replaced until this card is confirmed. A file that is taken
// leaves settings as well, since the list behind it has changed; a file that
// is refused leaves settings open, where the user asked for it.
function ImportConfirmation() {
  return () => {
    const review = overlayOf("importConfirmation");
    if (!review) return null;
    return html`<${ConfirmCard}
      title="Import this file?"
      body=${untrack(() => importMessage(review, expenses.length))}
      cancelLabel="Keep mine"
      confirmLabel="Import"
      actions=${{
        confirm: () => {
          closeOverlay("importConfirmation");
          if (replaceExpenses(review.expenses)) closeOverlay("settings");
        },
        cancel: () => closeOverlay("importConfirmation"),
      }}
    />`;
  };
}

function SaveNotice() {
  return html`
    <${Transition}
      name="notice"
      onEnter=${settleTransition}
      onExit=${settleTransition}
    >
      ${() =>
        saveNotice() &&
        html`<div class="notice" role="status">${saveNotice()}</div>`}
    <//>`;
}

function openOverlay(overlay) {
  setOverlays((open) => [...open, overlay]);
}

function closeOverlay(kind) {
  setOverlays((open) => open.filter((each) => each.kind !== kind));
}

function overlayOf(kind) {
  return overlays().find((each) => each.kind === kind) ?? null;
}

function newExpenseActions() {
  return {
    save(expense) {
      addExpense(expense);
      closeOverlay("newExpense");
    },
    close: () => closeOverlay("newExpense"),
  };
}

function editExpenseActions(id) {
  return {
    save(expense) {
      updateExpense(id, expense);
      closeOverlay("editExpense");
    },
    remove() {
      openOverlay({ kind: "deleteExpense", id });
    },
    close: () => closeOverlay("editExpense"),
  };
}

function toggleFilter(category) {
  setActiveCategory((active) => (active === category ? null : category));
}

function toggleMonth(key) {
  setUnfoldedMonths((open) =>
    open.includes(key) ? open.filter((each) => each !== key) : [...open, key],
  );
}

function toggleNumbers() {
  setShowNumbers((shown) => !shown);
}

function visibleExpenses() {
  return filterByCategory(expenses, activeCategory());
}

function currentMonthExpenses() {
  return expenses.filter((expense) => isSameMonth(expense.date, now()));
}

export function addExpense(expense) {
  setExpenses((expenses) => [
    ...expenses,
    { id: nextId(expenses), ...expense },
  ]);
  saveExpenses(expenses);
}

export function updateExpense(id, expense) {
  setExpenses((expenses) =>
    expenses.map((each) => (each.id === id ? { id, ...expense } : each)),
  );
  dropVanishedFilter();
  saveExpenses(expenses);
}

export function deleteExpense(id) {
  setExpenses((expenses) => expenses.filter((expense) => expense.id !== id));
  dropVanishedFilter();
  saveExpenses(expenses);
}

// Ids are creation timestamps, which groupByDay orders a day by; two saved in
// the same millisecond would otherwise share one.
function nextId(expenses) {
  const stamp = now().getTime();
  const highest = expenses.reduce((max, each) => Math.max(max, each.id), 0);
  return stamp > highest ? stamp : highest + 1;
}

// The chip is the only way to clear a filter, so a filter that outlived the
// last expense carrying it would narrow the list with nothing left to tap.
function dropVanishedFilter() {
  const name = activeCategory();
  if (!name) return;
  const carried = currentMonthExpenses().some((expense) =>
    expense.categories.includes(name),
  );
  if (!carried) setActiveCategory(null);
}

// Returns an error message for an invalid expense, or null.
export function expenseError(expense) {
  if (!isPrintableAmount(expense.amount) || expense.amount <= 0)
    return "Invalid amount.";
  if (
    typeof expense.description !== "string" ||
    expense.description.trim() === ""
  )
    return "Description cannot be empty.";
  if (isNaN(expense.date.getTime())) return "Invalid date.";
  if (beginningOfDay(expense.date).getTime() > now().getTime())
    return "Date cannot be in the future.";
  return null;
}

// A form holds what the user typed, as text apart from the categories the
// chips carry; expenseFromForm is the only place it becomes an expense.
export function blankExpenseForm() {
  return {
    amount: "",
    description: "",
    date: toIsoDate(now()),
    categories: [],
  };
}

// The amount in cents, which is the text the field takes back; String() would
// give the exponent form for a very small one. A field the app cannot read at
// all starts empty, so that the sheet can repair the record rather than show
// it as NaN.
export function formFromExpense(expense) {
  return {
    amount: Number.isFinite(expense.amount) ? expense.amount.toFixed(2) : "",
    description: String(expense.description ?? ""),
    date: isReadableDate(expense.date) ? toIsoDate(expense.date) : "",
    categories: [...expense.categories],
  };
}

export function expenseFromForm(form) {
  return {
    amount: parseAmount(form.amount),
    description: form.description.trim(),
    date: parseIsoDate(form.date),
    categories: [...form.categories],
  };
}

// Either separator, since a device keyboard offers whichever its locale
// prefers, and cents, which are as fine as the app draws an amount.
export function parseAmount(text) {
  const typed = String(text).trim();
  if (!/^\d*[.,]?\d*$/.test(typed) || !/\d/.test(typed)) return NaN;
  return roundToCents(Number(typed.replace(",", ".")));
}

function roundToCents(amount) {
  return Math.round(amount * 100) / 100;
}

// Beyond this range toFixed gives the exponent form, which carries neither
// thousands nor cents. Number.isFinite, not isNaN: an imported file can carry
// the amount as text.
function isPrintableAmount(amount) {
  return (
    Number.isFinite(amount) && Number.isSafeInteger(Math.round(amount * 100))
  );
}

export function deleteMessage(expense) {
  return `${expense.description}, ${formatCurrency(expense.amount)} on ${formatDate(expense.date)}. This cannot be undone.`;
}

export function importMessage(review, current) {
  const holds = `${review.filename} holds ${plural(review.expenses.length, "expense")}.`;
  if (current === 0)
    return `${holds} Importing replaces everything on this device and cannot be undone.`;
  return `${holds} Importing removes the ${plural(current, "expense")} on this device and cannot be undone.`;
}

function exportExpenses() {
  const json = serializeExpenses(expenses);
  const filename = "moneta-" + toIsoDate(now()) + ".json";
  if (Capacitor.isNativePlatform()) shareExport(filename, json);
  else downloadFile(filename, json);
}

function downloadFile(filename, json) {
  const url = URL.createObjectURL(
    new Blob([json], { type: "application/json" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// What the Share plugin rejects with when the user closes the sheet.
const SHARE_DISMISSED = ["Share canceled", "Share cancelled"];

// Android offers no Save-As dialog, so the file is written to the cache
// directory and handed to the system share sheet. The directory and encoding
// are the plain strings the Directory and Encoding enums hold.
async function shareExport(filename, json) {
  try {
    const { uri } = await Filesystem.writeFile({
      path: filename,
      data: json,
      directory: "CACHE",
      encoding: "utf8",
    });
    await Share.share({ title: filename, url: uri });
  } catch (e) {
    // Dismissing the share sheet rejects the call; that is not a failure.
    const message = e?.message ?? String(e);
    if (!SHARE_DISMISSED.includes(message))
      alert("Failed to export expenses: " + message);
  }
}

function importExpenses() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => reviewImport(event.target.result, file.name);
    reader.onerror = () => alert("Failed to read " + file.name + ".");
    reader.readAsText(file);
  };
  input.click();
}

// The file is read once, here: a file that cannot be read at all is reported
// instead of the question, and the card carries the expenses it offers.
function reviewImport(json, filename) {
  let imported;
  try {
    imported = parseExpenses(json);
  } catch (e) {
    alert("Failed to import expenses: " + e.message);
    return;
  }
  openOverlay({ kind: "importConfirmation", filename, expenses: imported });
}

// Importing discards the expenses already on the device. It answers whether
// the file was taken, since a refused file changes nothing at all.
export function replaceExpenses(imported) {
  const errors = imported.map(importedExpenseError).filter((e) => e !== null);
  const ids = new Set(imported.map((expense) => expense.id));
  if (ids.size < imported.length)
    errors.push("Two expenses share an ID; editing one would change both.");
  if (errors.length > 0) {
    alert("File contains errors.");
    errors.forEach((error) => console.error(error));
    return false;
  }
  setExpenses(imported);
  dropVanishedFilter();
  return saveExpenses(imported);
}

// Returns an error message for an invalid imported expense, or null.
export function importedExpenseError(expense) {
  if (expense.id == null) return "Missing ID.";
  return expenseError(expense);
}

// Storage the app cannot read at all leaves it empty and says so, rather than
// throwing before anything is drawn. Nothing is deleted: what is unreadable
// stays where it is until the user saves over it.
export function loadExpenses() {
  const stored = localStorage.getItem("expenses");
  if (!stored) return [];
  try {
    return parseExpenses(stored);
  } catch (e) {
    alert("Could not read the expenses on this device: " + e.message);
    return [];
  }
}

// Answers whether it wrote: losing an expense in silence is the worst thing
// the app can do, and an import must not call itself done on a refused write.
export function saveExpenses(expenses) {
  try {
    localStorage.setItem("expenses", serializeExpenses(expenses));
  } catch {
    alert("Could not save: the storage on this device is full or unavailable.");
    return false;
  }
  noticeSaved();
  return true;
}

let noticeTimer = null;

function noticeSaved() {
  setSaveNotice("Saved");
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => setSaveNotice(null), 3000);
}

// An entry that is not an expense at all is passed over, so that one of them
// cannot cost the expenses beside it.
export function parseExpenses(json) {
  const parsed = JSON.parse(json);
  if (!Array.isArray(parsed)) throw new Error("It holds no list of expenses.");
  return parsed
    .filter((expense) => expense && typeof expense === "object")
    .map((expense) => ({
      ...expense,
      date: parseIsoDate(expense.date),
      // Through parseCategories, not a plain sort: files written by the
      // ClojureScript version hold [""] where an expense has no category.
      categories: parseCategories(categoryText(expense.categories)),
    }));
}

// The list the app writes, or the single name a hand-written file may carry.
function categoryText(categories) {
  if (Array.isArray(categories)) return categories.map(String).join(" ");
  return categories == null ? "" : String(categories);
}

// A date it could not read is written back as none: an invented day would
// make the file impossible to read again.
export function serializeExpenses(expenses) {
  const stored = expenses.map((expense) => ({
    ...expense,
    date: isReadableDate(expense.date) ? toIsoDate(expense.date) : null,
  }));
  return JSON.stringify(stored, null, 2);
}

function isReadableDate(date) {
  return date instanceof Date && !isNaN(date.getTime());
}

export function findExpense(id) {
  return expenses.find((expense) => expense.id === id);
}

// One name is one category however often a file repeats it: a repeat would
// count that expense twice in the category totals.
export function parseCategories(input) {
  const named = input
    .trim()
    .split(/\s+/)
    .filter((category) => category !== "")
    .map((category) => category.toLowerCase());
  return [...new Set(named)].sort();
}

// Every category the user has ever used, the most recently spent on first and
// ties broken by name, behind the ones this form carries that are new — so a
// chip never disappears while it is selected.
export function knownCategories(expenses, extra = []) {
  const lastSpent = new Map();
  for (const expense of expenses)
    for (const category of expense.categories) {
      const seen = lastSpent.get(category);
      if (seen === undefined || expense.date > seen)
        lastSpent.set(category, expense.date);
    }
  const used = [...lastSpent.keys()].sort(
    (one, other) =>
      lastSpent.get(other) - lastSpent.get(one) || one.localeCompare(other),
  );
  return [...extra.filter((name) => !lastSpent.has(name)), ...used];
}

export function withCategoryToggled(categories, category) {
  if (categories.includes(category))
    return categories.filter((each) => each !== category);
  return [...categories, category].sort();
}

export function filterByCategory(expenses, category) {
  if (!category) return expenses;
  return expenses.filter((expense) => expense.categories.includes(category));
}

export function totalOf(expenses) {
  return expenses.reduce((total, expense) => total + expense.amount, 0);
}

// Newest month first; each month keeps the expenses that fall in it.
export function groupByMonth(expenses) {
  const byMonth = new Map();
  for (const expense of expenses) {
    const key = monthKey(expense.date);
    const group = byMonth.get(key) ?? { key, date: expense.date, expenses: [] };
    group.expenses.push(expense);
    byMonth.set(key, group);
  }
  return [...byMonth.values()].sort((one, other) =>
    one.key < other.key ? 1 : -1,
  );
}

// Newest day first, and newest expense first within a day.
export function groupByDay(expenses) {
  const byDay = new Map();
  for (const expense of expenses) {
    const day = beginningOfDay(expense.date).getTime();
    const group = byDay.get(day) ?? [];
    group.push(expense);
    byDay.set(day, group);
  }
  return [...byDay.entries()]
    .sort(([one], [other]) => other - one)
    .map(([day, expenses]) => ({
      date: new Date(day),
      expenses: [...expenses].sort((one, other) => other.id - one.id),
    }));
}

// Largest spend first, ties broken by name so the order never wavers.
export function categoryTotals(expenses) {
  const totals = new Map();
  for (const expense of expenses)
    for (const category of expense.categories)
      totals.set(category, (totals.get(category) ?? 0) + expense.amount);
  return [...totals.entries()]
    .map(([name, total]) => ({ name, total }))
    .sort(
      (one, other) =>
        other.total - one.total || (one.name < other.name ? -1 : 1),
    );
}

// The six deep inks. A category's colour is derived from its name, never
// stored, so it is the same on every device and cannot be chosen.
const CATEGORY_INKS = [
  "#c79a4e",
  "#7e9a78",
  "#8e7ba6",
  "#b7674f",
  "#4f8a8b",
  "#6b7fa8",
];

export function categoryInk(name) {
  let hash = 0;
  for (const character of name)
    hash = (hash * 31 + character.codePointAt(0)) % 1000003;
  return CATEGORY_INKS[hash % CATEGORY_INKS.length];
}

// Built from local parts, since `new Date("YYYY-MM-DD")` reads the text as UTC
// midnight and would shift the day west of the meridian.
export function parseIsoDate(text) {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(text));
  if (!parts) return new Date(NaN);
  const [year, month, day] = parts.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  // Two-digit years mean the 1900s to the Date constructor alone.
  date.setFullYear(year);
  // A day the calendar does not hold rolls into the next month rather than
  // failing, so a mistyped date would be stored as another day.
  if (date.getMonth() !== month - 1 || date.getDate() !== day)
    return new Date(NaN);
  return date;
}

// The stored and exported JSON carry this format; changing it strands the
// expenses already on users' devices.
export function toIsoDate(date) {
  const year = String(date.getFullYear()).padStart(4, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

export function monthKey(date) {
  return toIsoDate(date).slice(0, 7);
}

export function formatMonth(date) {
  return (
    date.toLocaleString("default", { month: "long" }) + " " + date.getFullYear()
  );
}

// Day and month in that order, whatever the browser's locale would prefer.
export function formatDate(date) {
  return (
    date.getDate() + " " + date.toLocaleString("default", { month: "long" })
  );
}

// Compared by calendar parts, not by timestamp: where the clock jumps at
// midnight there is no beginning of the day to compare.
export function formatDay(date, reference) {
  if (isSameDay(date, reference)) return "Today";
  const yesterday = new Date(reference);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(date, yesterday)) return "Yesterday";
  return formatDate(date);
}

export function formatCurrency(amount) {
  return signOf(amount) + "$" + groupDigits(Math.abs(amount), 2);
}

// Chips carry whole dollars: the shape of the month, not its cents.
export function roundedCurrency(amount) {
  return signOf(amount) + "$" + groupDigits(Math.abs(amount), 0);
}

// List rows sit under a heading that already says these are dollars.
export function plainAmount(amount) {
  return signOf(amount) + groupDigits(Math.abs(amount), 2);
}

function signOf(amount) {
  return amount < 0 ? "-" : "";
}

function groupDigits(amount, decimals) {
  const [whole, fraction] = amount.toFixed(decimals).split(".");
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  return fraction ? grouped + "." + fraction : grouped;
}

// The month so far for the current month, the whole month for an earlier one.
export function averagePerDay(total, month, reference) {
  const days = isSameMonth(month, reference)
    ? reference.getDate()
    : new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  return total / days;
}

export function isSameDay(date, other) {
  return isSameMonth(date, other) && date.getDate() === other.getDate();
}

export function isSameMonth(date, other) {
  return (
    date.getFullYear() === other.getFullYear() &&
    date.getMonth() === other.getMonth()
  );
}

export function beginningOfDay(date) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

export function plural(count, noun) {
  return count + " " + pluralNoun(count, noun);
}

export function pluralNoun(count, noun) {
  return count === 1 ? noun : noun + "s";
}

const TRANSITION_SLACK_MS = 50;

// An overlay's transition counts as over once it has been drawn. Transition's
// own default waits for transitionend alone, which never arrives when no
// transition runs — with animations turned off, or when a stalled main thread
// collapses the change into one frame — leaving the overlay on screen for ever
// on the way out and its enter class stuck on the way in. The wait is read from
// the element, so the duration stays written only in the CSS. Taking two
// parameters is what stops Transition adding its own listener.
function settleTransition(element, done) {
  const style = getComputedStyle(element);
  const seconds =
    parseFloat(style.transitionDuration) + parseFloat(style.transitionDelay);

  const finish = (event) => {
    if (event && event.target !== element) return;
    clearTimeout(timer);
    element.removeEventListener("transitionend", finish);
    done();
  };
  const timer = setTimeout(finish, seconds * 1000 + TRANSITION_SLACK_MS);
  element.addEventListener("transitionend", finish);
}

function appVersion() {
  return document.querySelector('meta[name="version"]')?.content ?? "unknown";
}

function now() {
  return new Date();
}
