import { createMemo, createSignal, untrack, For } from "solid-js";
import { createStore } from "solid-js/store";
import { render } from "solid-js/web";
import html from "solid-js/html";

const [expenses, setExpenses] = createStore([]);
const [addingExpense, setAddingExpense] = createSignal(false);
const [editingExpenseId, setEditingExpenseId] = createSignal(null);
const [showNumbers, setShowNumbers] = createSignal(false);
const [bubble, setBubble] = createSignal(null);

function main() {
  setExpenses(loadExpenses());
  render(App, document.getElementById("app"));
}

function App() {
  return html`
    <div class="container">
      <${SummaryCard} />
      <${ExpenseList} />
      <${NewExpenseButton} />
      ${() =>
        addingExpense() &&
        html`<${ExpenseModal}
          title="New Expense"
          initial=${blankExpenseForm()}
          actions=${newExpenseActions}
        />`}
      ${() => {
        const id = editingExpenseId();
        return (
          id !== null &&
          html`<${ExpenseModal}
            title="Edit Expense"
            initial=${untrack(() => expenseForm(findExpense(id)))}
            actions=${editExpenseActions(id)}
          />`
        );
      }}
      ${() =>
        bubble() &&
        html`<div class="bubble alert alert-success show" role="alert">
          ${bubble()}
        </div>`}
    </div>`;
}

function SummaryCard() {
  const monthlyTotal = createMemo(() => {
    const today = now();
    return expenses
      .filter(
        (expense) =>
          expense.date.getFullYear() === today.getFullYear() &&
          expense.date.getMonth() === today.getMonth(),
      )
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
            <${Amount} text=${() => formatCurrency(monthlyTotal())} />
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
      byDay.set(day, [...(byDay.get(day) || []), expense]);
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
  const sorted = createMemo(() =>
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
            <span>${() => formatDate(props.day.date)}</span>
            <span><${Amount} text=${() => formatCurrency(total())} /></span>
          </strong>
        </li>
        <${For} each=${sorted}>
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
      onClick=${() => setEditingExpenseId(props.expense.id)}
    >
      <div>
        <span>${() => props.expense.description}</span>
        <br />
        ${() =>
          props.expense.categories.length > 0 &&
          html`<div class="text-info small">
            ${[...props.expense.categories].sort().join(", ")}
          </div>`}
      </div>
      <span class="text-danger" onClick=${revealAmount}>
        <${Amount} text=${() => "-" + formatCurrency(props.expense.amount)} />
      </span>
    </li>`;
}

function NewExpenseButton() {
  return html`
    <button
      class="btn btn-primary btn-lg rounded-circle fixed-bottom-right"
      style=${{ "z-index": 1000 }}
      onClick=${() => setAddingExpense(true)}
    >
      +
    </button>`;
}

// Amount text, blurred until the user reveals numbers.
function Amount(props) {
  return html`<span class=${() => (showNumbers() ? "" : "blur-text")}>
    ${() => props.text}
  </span>`;
}

// Shared add/edit dialog; Delete appears only when the actions provide it.
function ExpenseModal(props) {
  const [form, setForm] = createStore(props.initial);
  const field = (key) => (event) => setForm(key, event.target.value);
  const submit = () => {
    const error = validateExpense(form);
    if (error) {
      alert(error);
      return;
    }
    props.actions.save(form);
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
                  value=${() => formatDate(form.date)}
                  onInput=${(event) =>
                    setForm("date", new Date(event.target.value))}
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
              ${() => (props.actions.remove ? "Update" : "Save")}
            </button>
          </div>
        </div>
      </div>
    </div>`;
}

const newExpenseActions = {
  save(form) {
    addExpense(form);
    setAddingExpense(false);
  },
  close() {
    setAddingExpense(false);
  },
};

function editExpenseActions(id) {
  return {
    save(form) {
      updateExpense(id, form);
      setEditingExpenseId(null);
    },
    remove() {
      if (!confirm("Are you sure?")) return;
      deleteExpense(id);
      setEditingExpenseId(null);
    },
    close() {
      setEditingExpenseId(null);
    },
  };
}

function addExpense(form) {
  setExpenses((expenses) => [
    ...expenses,
    { id: now().getTime(), ...expenseFromForm(form) },
  ]);
  saveExpenses();
}

function updateExpense(id, form) {
  setExpenses((expenses) =>
    expenses.map((expense) =>
      expense.id === id ? { id, ...expenseFromForm(form) } : expense,
    ),
  );
  saveExpenses();
}

function deleteExpense(id) {
  setExpenses((expenses) => expenses.filter((expense) => expense.id !== id));
  saveExpenses();
}

// Returns an error message for an invalid form, or null.
function validateExpense(form) {
  const amount = parseFloat(form.amount);
  const date = beginningOfDay(form.date);
  if (isNaN(amount) || amount <= 0) return "Invalid amount.";
  if (form.description.trim() === "") return "Description cannot be empty.";
  if (isNaN(date.getTime())) return "Invalid date.";
  if (date.getTime() > now().getTime()) return "Date cannot be in the future.";
  return null;
}

function blankExpenseForm() {
  return { amount: "", description: "", date: now(), categories: "" };
}

function expenseForm(expense) {
  return {
    amount: String(expense.amount),
    description: expense.description,
    date: expense.date,
    categories: [...expense.categories].join(" "),
  };
}

function expenseFromForm(form) {
  return {
    amount: parseFloat(form.amount),
    description: form.description.trim(),
    date: new Date(form.date),
    categories: parseCategories(form.categories),
  };
}

function exportExpenses() {
  const json = serializeExpenses(expenses);
  const filename = "moneta-" + formatDate(now()) + ".json";
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
    console.log("Importing expenses via Android.pickFile");
    Android.pickFile(importExpensesFrom);
    return;
  }
  console.log("Importing expenses via file input (not Android)");
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json";
  input.onchange = (event) => {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => importExpensesFrom(event.target.result);
    reader.readAsText(file);
  };
  input.click();
}

function importExpensesFrom(content) {
  try {
    const imported = parseExpenses(content);
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
function importedExpenseError(expense) {
  if (expense.id == null) return "Missing ID.";
  if (isNaN(expense.amount) || expense.amount <= 0) return "Invalid amount.";
  if (!expense.description || expense.description.trim() === "")
    return "Empty description.";
  if (expense.date.getTime() > now().getTime())
    return "Date cannot be in the future.";
  return null;
}

function loadExpenses() {
  const stored = localStorage.getItem("expenses");
  return stored ? parseExpenses(stored) : [];
}

function saveExpenses() {
  localStorage.setItem("expenses", serializeExpenses(expenses));
  setBubble("Saved");
  setTimeout(() => setBubble(null), 3000);
}

function parseExpenses(json) {
  return JSON.parse(json).map((expense) => ({
    ...expense,
    date: new Date(expense.date),
  }));
}

function serializeExpenses(expenses) {
  const stored = expenses.map((expense) => ({
    ...expense,
    date: formatDate(expense.date),
  }));
  return JSON.stringify(stored, null, 2);
}

function findExpense(id) {
  return expenses.find((expense) => expense.id === id);
}

function toggleNumbers() {
  setShowNumbers((shown) => !shown);
}

function parseCategories(input) {
  return input
    .trim()
    .split(/\s+/)
    .filter((category) => category !== "")
    .map((category) => category.toLowerCase())
    .sort();
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return year + "-" + month + "-" + day;
}

function formatCurrency(amount) {
  return "$" + amount.toFixed(2);
}

function beginningOfDay(date) {
  const day = new Date(date);
  day.setHours(0, 0, 0, 0);
  return day;
}

function now() {
  return new Date();
}

main();
