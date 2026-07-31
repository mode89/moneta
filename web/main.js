import { createMemo, createSignal, untrack, For } from "solid-js";
import { createStore } from "solid-js/store";
import { render } from "solid-js/web";
import html from "solid-js/html";

export const [expenses, setExpenses] = createStore([]);
const [editedExpense, setEditedExpense] = createSignal(null);
const [showNumbers, setShowNumbers] = createSignal(false);
export const [saveNotice, setSaveNotice] = createSignal(null);

// `editedExpense` is the id of the expense being edited, NEW_EXPENSE while one
// is being added, or null when no dialog is open.
const NEW_EXPENSE = "new";

export function main() {
  setExpenses(loadExpenses());
  render(App, document.getElementById("app"));
}

function App() {
  return html`
    <div class="container">
      <${SummaryCard} />
      <${ExpenseList} />
      <${NewExpenseButton} />
      ${() => {
        const edited = editedExpense();
        if (edited === null) return null;
        if (edited === NEW_EXPENSE)
          return html`<${ExpenseModal}
            title="New Expense"
            submitLabel="Save"
            initial=${blankExpenseForm()}
            actions=${newExpenseActions()}
          />`;
        return html`<${ExpenseModal}
          title="Edit Expense"
          submitLabel="Update"
          initial=${untrack(() => formFromExpense(findExpense(edited)))}
          actions=${editExpenseActions(edited)}
        />`;
      }}
      ${() =>
        saveNotice() &&
        html`<div class="bubble alert alert-success show" role="alert">
          ${saveNotice()}
        </div>`}
    </div>`;
}

function SummaryCard() {
  const monthlyTotal = createMemo(() => {
    const today = now();
    return expenses
      .filter((expense) => isSameMonth(expense.date, today))
      .reduce((total, expense) => total + expense.amount, 0);
  });
  return html`
    <div class="card mb-4">
      <div class="card-body">
        <h2 class="card-title">
          ${now().toLocaleString("default", { month: "long" })}
        </h2>
        <p
          class="card-text fs-3 d-flex justify-content-between"
          style=${{ cursor: "pointer" }}
          onClick=${toggleNumbers}
        >
          <span>Total Spent:</span>
          <span style=${{ color: "#dc3545" }}>
            <${Amount} value=${() => monthlyTotal()} />
          </span>
        </p>
      </div>
    </div>`;
}

function ExpenseList() {
  const days = createMemo(() => {
    const byDay = new Map();
    for (const expense of expenses) {
      const day = beginningOfDay(expense.date).getTime();
      const group = byDay.get(day) ?? [];
      group.push(expense);
      byDay.set(day, group);
    }
    return [...byDay.entries()]
      .sort(([a], [b]) => b - a)
      .map(([day, expenses]) => ({ date: new Date(day), expenses }));
  });
  return html`
    <div class="card mt-4 custom-mb-100">
      <div
        class="card-header d-flex justify-content-between align-items-center"
      >
        <h3 class="mb-0">Expenses</h3>
        <div>
          <button
            class="btn btn-outline-secondary btn-sm"
            title="Import Expenses"
            onClick=${importExpenses}
          >
            <img
              src="file_download.svg"
              alt="Import"
              style=${{ width: "24px", height: "24px" }}
            />
          </button>
          <button
            class="btn btn-outline-secondary btn-sm ms-2"
            title="Export Expenses"
            onClick=${exportExpenses}
          >
            <img
              src="file_upload.svg"
              alt="Export"
              style=${{ width: "24px", height: "24px" }}
            />
          </button>
        </div>
      </div>
      <ul class="list-group list-group-flush">
        ${() =>
          expenses.length === 0 &&
          html`<li class="list-group-item text-muted text-center">
            No expenses yet
          </li>`}
        <${For} each=${days}>
          ${(day) => html`<${DailyExpenseList} day=${day} />`}
        <//>
      </ul>
    </div>`;
}

function DailyExpenseList(props) {
  const total = createMemo(() =>
    props.day.expenses.reduce((total, expense) => total + expense.amount, 0),
  );
  const newestFirst = createMemo(() =>
    [...props.day.expenses].sort((a, b) => b.id - a.id),
  );
  return html`
    <li class="list-group-item bg-light p-0" style=${{ "list-style-type": "none" }}>
      <ul class="list-group list-group-flush">
        <li class="list-group-item bg-light">
          <strong
            class="d-flex justify-content-between"
            style=${{ cursor: "pointer" }}
            onClick=${toggleNumbers}
          >
            <span>${() => formatDay(props.day.date)}</span>
            <span><${Amount} value=${() => total()} /></span>
          </strong>
        </li>
        <${For} each=${newestFirst}>
          ${(expense) => html`<${ExpenseItem} expense=${expense} />`}
        <//>
      </ul>
    </li>`;
}

function ExpenseItem(props) {
  const revealAmount = (event) => {
    event.stopPropagation();
    toggleNumbers();
  };
  return html`
    <li
      class="list-group-item d-flex justify-content-between align-items-center"
      style=${{ cursor: "pointer", "user-select": "none" }}
      onClick=${() => setEditedExpense(props.expense.id)}
    >
      <div>
        <span>${() => props.expense.description}</span>
        <br />
        ${() =>
          props.expense.categories.length > 0 &&
          html`<div class="text-info small">
            ${[...props.expense.categories].join(", ")}
          </div>`}
      </div>
      <span class="text-danger" onClick=${revealAmount}>
        <${Amount} value=${() => -props.expense.amount} />
      </span>
    </li>`;
}

function NewExpenseButton() {
  return html`
    <button
      class="btn btn-primary btn-lg rounded-circle fixed-bottom-right"
      style=${{ "z-index": 1000 }}
      onClick=${() => setEditedExpense(NEW_EXPENSE)}
    >
      +
    </button>`;
}

// A money amount, blurred until the user reveals numbers.
function Amount(props) {
  return html`<span class=${() => (showNumbers() ? "" : "blur-text")}>
    ${() => formatCurrency(props.value)}
  </span>`;
}

// Shared add/edit dialog; Delete appears only when the actions provide it.
function ExpenseModal(props) {
  const [form, setForm] = createStore(props.initial);
  const field = (key) => (event) => setForm(key, event.target.value);
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
    <div
      class="modal fade show"
      tabindex="-1"
      style=${{ display: "block", "background-color": "rgba(0,0,0,0.5)" }}
    >
      <div class="modal-dialog modal-dialog-centered">
        <div class="modal-content">
          <div class="modal-header">
            <h5 class="modal-title">${() => props.title}</h5>
            <button
              type="button"
              class="btn-close"
              onClick=${() => props.actions.close()}
            ></button>
          </div>
          <div class="modal-body">
            <form>
              <div class="mb-3">
                <label class="form-label" for="expense-amount">Amount</label>
                <input
                  class="form-control"
                  id="expense-amount"
                  type="number"
                  placeholder="0.00"
                  step="0.01"
                  value=${() => form.amount}
                  onInput=${field("amount")}
                />
              </div>
              <div class="mb-3">
                <label class="form-label" for="expense-description">
                  Description
                </label>
                <input
                  class="form-control"
                  id="expense-description"
                  type="text"
                  placeholder="e.g., Groceries, Dinner"
                  value=${() => form.description}
                  onInput=${field("description")}
                />
              </div>
              <div class="mb-3">
                <label class="form-label" for="expense-date">Date</label>
                <input
                  class="form-control"
                  id="expense-date"
                  type="date"
                  value=${() => form.date}
                  onInput=${field("date")}
                />
              </div>
              <div class="mb-3">
                <label class="form-label" for="expense-categories">
                  Categories
                </label>
                <input
                  class="form-control"
                  id="expense-categories"
                  type="text"
                  placeholder="e.g. food shopping"
                  value=${() => form.categories}
                  onInput=${field("categories")}
                />
              </div>
            </form>
          </div>
          <div class="modal-footer">
            ${() =>
              props.actions.remove &&
              html`<button
                type="button"
                class="btn btn-danger me-auto"
                onClick=${() => props.actions.remove()}
              >
                Delete
              </button>`}
            <button
              type="button"
              class="btn btn-secondary"
              onClick=${() => props.actions.close()}
            >
              Cancel
            </button>
            <button type="button" class="btn btn-primary" onClick=${submit}>
              ${() => props.submitLabel}
            </button>
          </div>
        </div>
      </div>
    </div>`;
}

function newExpenseActions() {
  return {
    save(expense) {
      addExpense(expense);
      closeModal();
    },
    close: closeModal,
  };
}

function editExpenseActions(id) {
  return {
    save(expense) {
      updateExpense(id, expense);
      closeModal();
    },
    remove() {
      if (!confirm("Are you sure?")) return;
      deleteExpense(id);
      closeModal();
    },
    close: closeModal,
  };
}

function closeModal() {
  setEditedExpense(null);
}

// Ids are creation timestamps; DailyExpenseList orders a day's expenses by them.
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
    Android.pickFile(replaceExpensesFromJson);
    return;
  }
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => replaceExpensesFromJson(event.target.result);
    reader.readAsText(file);
  };
  input.click();
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

function toggleNumbers() {
  setShowNumbers((shown) => !shown);
}

export function parseCategories(input) {
  return input
    .trim()
    .split(/\s+/)
    .filter((category) => category !== "")
    .map((category) => category.toLowerCase())
    .sort();
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

// Day headings happen to read as ISO dates today; they are free to diverge.
export function formatDay(date) {
  return toIsoDate(date);
}

export function formatCurrency(amount) {
  const sign = amount < 0 ? "-" : "";
  return sign + "$" + Math.abs(amount).toFixed(2);
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

function now() {
  return new Date();
}
