import { createMemo, createSignal, untrack, For } from "solid-js";
import { createStore } from "solid-js/store";
import { render } from "solid-js/web";
import html from "solid-js/html";

export const [expenses, setExpenses] = createStore([]);
const [editedExpense, setEditedExpense] = createSignal(null);
const [deletedExpense, setDeletedExpense] = createSignal(null);
const [reviewedImport, setReviewedImport] = createSignal(null);
const [settingsOpen, setSettingsOpen] = createSignal(false);
const [activeCategory, setActiveCategory] = createSignal(null);
const [unfoldedMonths, setUnfoldedMonths] = createSignal([]);
const [showNumbers, setShowNumbers] = createSignal(false);
export const [saveNotice, setSaveNotice] = createSignal(null);

// `editedExpense` is the id of the expense being edited, NEW_EXPENSE while one
// is being added, or null when no sheet is open.
const NEW_EXPENSE = "new";

export function main() {
  setExpenses(loadExpenses());
  render(App, document.getElementById("app"));
}

function App() {
  return html`
    <div class="app">
      <${MonthSummary} />
      <${CategoryLegend} />
      <div class="scroll"><${ExpenseList} /></div>
      <${NewExpenseButton} />
      ${() => {
        const edited = editedExpense();
        if (edited === null) return null;
        if (edited === NEW_EXPENSE)
          return html`<${ExpenseSheet}
            title="Add an expense"
            submitLabel="Save expense"
            initial=${blankExpenseForm()}
            actions=${newExpenseActions()}
          />`;
        return html`<${ExpenseSheet}
          title="Edit expense"
          submitLabel="Save changes"
          initial=${untrack(() => formFromExpense(findExpense(edited)))}
          actions=${editExpenseActions(edited)}
        />`;
      }}
      ${() => {
        const id = deletedExpense();
        if (id === null) return null;
        const expense = untrack(() => findExpense(id));
        return html`<${ConfirmCard}
          title="Delete this expense?"
          body=${deleteMessage(expense)}
          cancelLabel="Keep"
          confirmLabel="Delete"
          actions=${{
            confirm: () => {
              deleteExpense(id);
              setDeletedExpense(null);
            },
            cancel: () => setDeletedExpense(null),
          }}
        />`;
      }}
      ${() => settingsOpen() && html`<${SettingsScreen} />`}
      ${() => {
        const review = reviewedImport();
        if (review === null) return null;
        return html`<${ConfirmCard}
          title="Import this file?"
          body=${untrack(() => importMessage(review, expenses.length))}
          cancelLabel="Keep mine"
          confirmLabel="Import"
          actions=${{
            confirm: () => {
              setReviewedImport(null);
              setSettingsOpen(false);
              replaceExpensesFromJson(review.json);
            },
            cancel: () => setReviewedImport(null),
          }}
        />`;
      }}
      ${() =>
        saveNotice() && html`<div class="notice" role="status">${saveNotice()}</div>`}
    </div>`;
}

// The header describes the current month, narrowed to the active category. It
// stays on the current month even while an older one is unfolded below.
function MonthSummary() {
  const monthly = createMemo(() =>
    visibleExpenses().filter((expense) => isSameMonth(expense.date, now())),
  );
  const total = createMemo(() => totalOf(monthly()));
  return html`
    <div class="head">
      <button
        class="corner"
        title="Settings"
        aria-label="Settings"
        onClick=${() => setSettingsOpen(true)}
      >
        ⚙
      </button>
      <div class="month">${() => formatMonth(now())}</div>
      <div class="total" onClick=${toggleNumbers}>
        <${Amount} value=${() => total()} />
      </div>
      <div class="meta">
        <!-- the space belongs inside the expression: solid-js/html trims the
             whitespace between an element and the expression that follows -->
        <span>
          <b>${() => monthly().length}</b>${() =>
            " " + expenseNoun(monthly().length)}
        </span>
        ${() =>
          monthly().length > 0 &&
          html`<span>
            <b><${Amount} value=${() => averagePerDay(total(), now(), now())} /></b>
            ${() => " a day"}
          </span>`}
      </div>
    </div>`;
}

// One chip per category spent on this month, largest first. Tapping filters
// the whole list; tapping the selected one clears the filter.
function CategoryLegend() {
  const totals = createMemo(() =>
    categoryTotals(expenses.filter((expense) => isSameMonth(expense.date, now()))),
  );
  return html`
    <div class="legend">
      <${For} each=${totals}>
        ${(each) => html`
          <button
            class=${() => "chip" + (activeCategory() === each.name ? " on" : "")}
            onClick=${() => toggleFilter(each.name)}
          >
            <i style=${{ background: categoryInk(each.name) }}></i>
            ${each.name}
            <${Amount} value=${() => each.total} format=${roundedCurrency} />
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
    <${For} each=${() => days}>
      ${(day) => html`
        <div class="day" onClick=${toggleNumbers}>
          <span>${heading(day.date)}</span>
          <span class="sum"><${Amount} value=${() => totalOf(day.expenses)} /></span>
        </div>
        <${For} each=${() => day.expenses}>
          ${(expense) => html`<${ExpenseRow} expense=${expense} />`}
        <//>`}
    <//>`;
}

function ExpenseRow(props) {
  const expense = props.expense;
  const revealOnly = (event) => {
    event.stopPropagation();
    toggleNumbers();
  };
  return html`
    <div class="row" onClick=${() => setEditedExpense(expense.id)}>
      <i
        class=${expense.categories.length > 0 ? "dot" : "dot uncategorised"}
        style=${
          expense.categories.length > 0
            ? { background: categoryInk(expense.categories[0]) }
            : {}
        }
      ></i>
      <div>
        <div class="desc">${expense.description}</div>
        ${expense.categories.length > 0 &&
        html`<div class="cats">${expense.categories.join(" · ")}</div>`}
      </div>
      <div class="amt" onClick=${revealOnly}>
        <${Amount} value=${() => expense.amount} format=${plainAmount} />
      </div>
    </div>`;
}

// Every month before this one is a single line, unfolded in place by a tap and
// folded again by the next launch.
function FoldedMonth(props) {
  const month = props.month;
  const total = totalOf(month.expenses);
  const unfolded = () => unfoldedMonths().includes(month.key);
  const help = () => {
    const count = month.expenses.length;
    if (activeCategory()) return `${count} in ${activeCategory()}`;
    if (!unfolded()) return plural(count, "expense");
    return html`${plural(count, "expense")} · <${Amount}
        value=${() => averagePerDay(total, month.date, now())}
      /> a day`;
  };
  return html`
    <div>
      <div class="fold" onClick=${() => toggleMonth(month.key)}>
        <span class="caret">${() => (unfolded() ? "⌄" : "›")}</span>
        <div>
          <div class="name">${formatMonth(month.date)}</div>
          <div class="help">${help}</div>
        </div>
        <div class="sum"><${Amount} value=${() => total} /></div>
      </div>
      ${() => unfolded() && html`<${DayGroups} month=${month} />`}
    </div>`;
}

function NewExpenseButton() {
  return html`
    <button
      class="fab"
      aria-label="Add an expense"
      onClick=${() => setEditedExpense(NEW_EXPENSE)}
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

// Shared add/edit sheet; Delete appears only when the actions provide it. The
// dim behind it is the only way to close it, and closing discards silently.
function ExpenseSheet(props) {
  const [form, setForm] = createStore(props.initial);
  const [namingCategory, setNamingCategory] = createSignal(false);
  // The typed text is held outside the reactive graph: reading it in the markup
  // would rebuild the input on every keystroke and lose what was typed.
  let draftCategory = "";
  const field = (key) => (event) => setForm(key, event.target.value);
  const chosen = () => parseCategories(form.categories);
  const offered = createMemo(() => knownCategories(expenses, chosen()));
  const toggleCategory = (name) =>
    setForm("categories", withCategoryToggled(form.categories, name));
  const nameCategory = () => {
    draftCategory = "";
    setNamingCategory(true);
  };
  const commitDraft = () => {
    const [name] = parseCategories(draftCategory);
    setNamingCategory(false);
    if (name && !chosen().includes(name)) toggleCategory(name);
  };
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
    <div class="scrim" onClick=${() => props.actions.close()}></div>
    <div class="sheet" role="dialog">
      <div class="grab"></div>
      <h3>${() => props.title}</h3>
      <label class="flabel" for="expense-amount">Amount</label>
      <input
        class="in big"
        id="expense-amount"
        type="number"
        inputmode="decimal"
        placeholder="0.00"
        step="0.01"
        value=${() => form.amount}
        onInput=${field("amount")}
      />
      <label class="flabel" for="expense-description">Description</label>
      <input
        class="in"
        id="expense-description"
        type="text"
        placeholder="e.g. Groceries"
        value=${() => form.description}
        onInput=${field("description")}
      />
      <label class="flabel" for="expense-date">Date</label>
      <input
        class="in"
        id="expense-date"
        type="date"
        value=${() => form.date}
        onInput=${field("date")}
      />
      <label class="flabel">Categories</label>
      <div class="chiprow">
        <${For} each=${offered}>
          ${(name) => html`
            <button
              class=${() => "chip" + (chosen().includes(name) ? " on" : "")}
              onClick=${() => toggleCategory(name)}
            >
              <i style=${{ background: categoryInk(name) }}></i>
              ${name}${() => (chosen().includes(name) ? " ✕" : "")}
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
      </div>
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
    </div>`;
}

// Both destructive actions ask first, naming what will go.
function ConfirmCard(props) {
  return html`
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
    </div>`;
}

// Opened by the gear, closed by the ✕ in the same corner. It holds only what
// is used a few times a year.
function SettingsScreen() {
  return html`
    <div class="cover">
      <div class="bar">
        <button
          class="corner"
          aria-label="Close settings"
          onClick=${() => setSettingsOpen(false)}
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
    </div>`;
}

function newExpenseActions() {
  return {
    save(expense) {
      addExpense(expense);
      closeSheet();
    },
    close: closeSheet,
  };
}

function editExpenseActions(id) {
  return {
    save(expense) {
      updateExpense(id, expense);
      closeSheet();
    },
    remove() {
      closeSheet();
      setDeletedExpense(id);
    },
    close: closeSheet,
  };
}

function closeSheet() {
  setEditedExpense(null);
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

// Ids are creation timestamps; groupByDay orders a day's expenses by them.
export function addExpense(expense) {
  setExpenses((expenses) => [...expenses, { id: now().getTime(), ...expense }]);
  saveExpenses();
}

export function updateExpense(id, expense) {
  setExpenses((expenses) =>
    expenses.map((each) => (each.id === id ? { id, ...expense } : each)),
  );
  saveExpenses();
}

export function deleteExpense(id) {
  setExpenses((expenses) => expenses.filter((expense) => expense.id !== id));
  saveExpenses();
}

// Returns an error message for an invalid expense, or null.
export function expenseError(expense) {
  if (isNaN(expense.amount) || expense.amount <= 0) return "Invalid amount.";
  if (!expense.description || expense.description.trim() === "")
    return "Description cannot be empty.";
  if (isNaN(expense.date.getTime())) return "Invalid date.";
  if (beginningOfDay(expense.date).getTime() > now().getTime())
    return "Date cannot be in the future.";
  return null;
}

// A form holds what the user typed; expenseFromForm is the only place it
// becomes an expense.
export function blankExpenseForm() {
  return { amount: "", description: "", date: toIsoDate(now()), categories: "" };
}

export function formFromExpense(expense) {
  return {
    amount: String(expense.amount),
    description: expense.description,
    date: toIsoDate(expense.date),
    categories: [...expense.categories].join(" "),
  };
}

export function expenseFromForm(form) {
  return {
    amount: parseFloat(form.amount),
    description: form.description.trim(),
    date: parseIsoDate(form.date),
    categories: parseCategories(form.categories),
  };
}

export function deleteMessage(expense) {
  return `${expense.description}, ${formatCurrency(expense.amount)} on ${formatDate(expense.date)}. This cannot be undone.`;
}

export function importMessage(review, current) {
  const source = review.filename ?? "This file";
  const holds = `${source} holds ${plural(review.count, "expense")}.`;
  if (current === 0)
    return `${holds} Importing replaces everything on this device and cannot be undone.`;
  return `${holds} Importing removes the ${plural(current, "expense")} on this device and cannot be undone.`;
}

function exportExpenses() {
  const json = serializeExpenses(expenses);
  const filename = "moneta-" + toIsoDate(now()) + ".json";
  if (window.Android) {
    Android.createFile(filename, json);
    return;
  }
  const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function importExpenses() {
  if (window.Android) {
    Android.pickFile((json) => reviewImport(json, null));
    return;
  }
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => reviewImport(event.target.result, file.name);
    reader.readAsText(file);
  };
  input.click();
}

// Nothing is replaced until the card is confirmed, so a file that cannot even
// be read is reported here rather than after the question.
function reviewImport(json, filename) {
  let imported;
  try {
    imported = parseExpenses(json);
  } catch (e) {
    alert("Failed to import expenses: " + e.message);
    return;
  }
  setReviewedImport({ json, filename, count: imported.length });
}

// Importing discards the expenses already on the device.
export function replaceExpensesFromJson(json) {
  try {
    const imported = parseExpenses(json);
    const errors = imported.map(importedExpenseError).filter((e) => e !== null);
    if (errors.length > 0) {
      alert("File contains errors.");
      errors.forEach((error) => console.error(error));
      return;
    }
    setExpenses(imported);
    saveExpenses();
  } catch (e) {
    alert("Failed to import expenses: " + e.message);
  }
}

// Returns an error message for an invalid imported expense, or null.
export function importedExpenseError(expense) {
  if (expense.id == null) return "Missing ID.";
  return expenseError(expense);
}

export function loadExpenses() {
  const stored = localStorage.getItem("expenses");
  return stored ? parseExpenses(stored) : [];
}

let noticeTimer = null;

export function saveExpenses() {
  localStorage.setItem("expenses", serializeExpenses(expenses));
  setSaveNotice("Saved");
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(() => setSaveNotice(null), 3000);
}

export function parseExpenses(json) {
  return JSON.parse(json).map((expense) => ({
    ...expense,
    date: parseIsoDate(expense.date),
    categories: [...(expense.categories ?? [])].sort(),
  }));
}

export function serializeExpenses(expenses) {
  const stored = expenses.map((expense) => ({
    ...expense,
    date: toIsoDate(expense.date),
  }));
  return JSON.stringify(stored, null, 2);
}

export function findExpense(id) {
  return expenses.find((expense) => expense.id === id);
}

export function parseCategories(input) {
  return input
    .trim()
    .split(/\s+/)
    .filter((category) => category !== "")
    .map((category) => category.toLowerCase())
    .sort();
}

// Every category the user has ever used, plus the ones this form already
// carries, so a chip never disappears while it is selected.
export function knownCategories(expenses, extra = []) {
  const names = new Set(extra);
  for (const expense of expenses)
    for (const category of expense.categories) names.add(category);
  return [...names].sort();
}

export function withCategoryToggled(input, category) {
  const categories = parseCategories(input);
  const remaining = categories.filter((each) => each !== category);
  const toggled =
    remaining.length === categories.length
      ? [...categories, category].sort()
      : remaining;
  return toggled.join(" ");
}

export function filterByCategory(expenses, category) {
  if (!category) return [...expenses];
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
  return [...byMonth.values()].sort((a, b) => (a.key < b.key ? 1 : -1));
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
    .sort(([a], [b]) => b - a)
    .map(([day, expenses]) => ({
      date: new Date(day),
      expenses: [...expenses].sort((a, b) => b.id - a.id),
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
    .sort((a, b) => b.total - a.total || (a.name < b.name ? -1 : 1));
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
  const [year, month, day] = String(text).split("-").map(Number);
  return new Date(year, month - 1, day);
}

// The stored and exported JSON carry this format; changing it strands the
// expenses already on users' devices.
export function toIsoDate(date) {
  const year = date.getFullYear();
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
  return date.getDate() + " " + date.toLocaleString("default", { month: "long" });
}

export function formatDay(date, reference) {
  const day = beginningOfDay(date).getTime();
  const yesterday = beginningOfDay(reference);
  if (day === yesterday.getTime()) return "Today";
  yesterday.setDate(yesterday.getDate() - 1);
  if (day === yesterday.getTime()) return "Yesterday";
  return formatDate(date);
}

export function formatCurrency(amount) {
  const sign = amount < 0 ? "-" : "";
  return sign + "$" + groupDigits(Math.abs(amount), 2);
}

// Chips carry whole dollars: the shape of the month, not its cents.
export function roundedCurrency(amount) {
  return "$" + groupDigits(Math.abs(amount), 0);
}

// List rows sit under a heading that already says these are dollars.
export function plainAmount(amount) {
  return groupDigits(Math.abs(amount), 2);
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
  return count + " " + noun + (count === 1 ? "" : "s");
}

export function expenseNoun(count) {
  return count === 1 ? "expense" : "expenses";
}

function appVersion() {
  return document.querySelector('meta[name="version"]')?.content ?? "unknown";
}

function now() {
  return new Date();
}
