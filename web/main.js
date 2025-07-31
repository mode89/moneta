import * as Jotai from "jotai";
import * as React from "react";
import * as ReactDOM from "react-dom/client";

const store = Jotai.getDefaultStore();

const appState = Jotai.atom({
  expenses: loadExpenses(),
  addingExpense: false,
  editingExpenseId: null,
  showNumbers: false,
});

function main() {
  console.log("Initializing web application ...");
  ReactDOM.createRoot(document.getElementById("app"))
    .render(React.createElement(() => {
      const [app, setApp] = Jotai.useAtom(appState);
      return React.createElement("div", { className: "container mt-4" },
        React.createElement(SummaryCard, null),
        React.createElement(ExpenseList, null),
        React.createElement(NewExpenseButton, null),
        app.addingExpense && React.createElement(NewExpenseModal, null),
        app.editingExpenseId !== null && React.createElement(EditExpenseModal, {
          expenseId: app.editingExpenseId
        })
      );
    }));
}

function SummaryCard() {
  const [app, setApp] = Jotai.useAtom(appState);
  const total = app.expenses
    .reduce((sum, expense) => sum + expense.amount, 0);

  return React.createElement("div", { className: "card mb-4" },
    React.createElement("div", { className: "card-body" },
      React.createElement("h2", { className: "card-title" }, getCurrentMonth()),
      React.createElement("p",
        { className: "card-text fs-3",
          onClick: () => setApp(
            prev => ({ ...prev, showNumbers: !prev.showNumbers })
          ),
          style: { cursor: "pointer" },
        },
        "Total Spent: ",
        React.createElement("span", { style: { color: "#dc3545" } },
          app.showNumbers
            ? formatCurrency(total)
            : React.createElement("span", { className: "blur-text" },
                formatCurrency(total))
          )
      ),
    )
  );
}

function ExpenseList() {
  const [app, setApp] = Jotai.useAtom(appState);
  const expenses = app.expenses
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return React.createElement("div", { className: "card mt-4 custom-mb-100" },
    React.createElement("div",
      {
        className: "card-header d-flex justify-content-between " +
          "align-items-center"
      },
      React.createElement("h3", { className: "mb-0" }, "Expenses"),
      React.createElement("div", null,
        React.createElement("button",
          {
            className: "btn btn-outline-secondary btn-sm",
            onClick: importExpenses,
            title: "Import Expenses",
          },
          React.createElement("img", {
            src: "file_download.svg",
            alt: "Import",
            style: { width: "24px", height: "24px" },
          })
        ),
        React.createElement("button",
          {
            className: "btn btn-outline-secondary btn-sm ms-2",
            onClick: exportExpenses,
            title: "Export Expenses",
          },
          React.createElement("img", {
            src: "file_upload.svg",
            alt: "Export",
            style: { width: "24px", height: "24px" },
          })
        )
      )
    ),
    React.createElement("ul", { className: "list-group list-group-flush" },
      expenses.length === 0
        ? React.createElement("li",
            { className: "list-group-item text-muted text-center" },
            "No expenses yet"
          )
        : expenses.map(expense =>
            React.createElement(ExpenseItem, { key: expense.id, expense })
          )
    )
  );
}

function ExpenseItem({ expense }) {
  const [app, setApp] = Jotai.useAtom(appState);

  return React.createElement("li",
    {
      className:
        "list-group-item " +
        "d-flex " +
        "justify-content-between " +
        "align-items-center",
      style: { cursor: "pointer", userSelect: "none" },
      onClick: () => {
        setApp(prev => ({ ...prev, editingExpenseId: expense.id }));
      },
    },
    React.createElement(
      "div",
      null,
      React.createElement("strong", null, expense.description),
      React.createElement("br", null),
      React.createElement("small", { className: "text-muted" },
        formatDate(expense.date)
      ),
      expense.categories.length > 0 &&
        React.createElement("div", { className: "text-info small" },
          expense.categories.slice().sort().join(", ")
        )
    ),
    React.createElement("span",
      {
        className: "text-danger",
        onClick: (e) => {
          e.stopPropagation();
          setApp(prev => ({ ...prev, showNumbers: !prev.showNumbers }));
        },
      },
      app.showNumbers
        ? ("-" + formatCurrency(expense.amount))
        : React.createElement("span", { className: "blur-text" },
            "-" + formatCurrency(expense.amount)
          )
    )
  );
}

function NewExpenseButton() {
  const [app, setApp] = Jotai.useAtom(appState);
  return React.createElement(
    "button",
    {
      className: "btn btn-primary btn-lg rounded-circle fixed-bottom-right",
      style: { zIndex: 1000 },
      onClick: () => setApp(prev => ({ ...prev, addingExpense: true })),
    },
    "+"
  );
}

function NewExpenseModal() {
  const [app, setApp] = Jotai.useAtom(appState);
  const [newEntry, setNewEntry] = React.useState({
    amount: "",
    description: "",
    date: new Date(),
    categories: "",
  });

  return React.createElement("div",
    {
      className: "modal fade show",
      style: { display: "block", backgroundColor: "rgba(0,0,0,0.5)" },
      tabIndex: "-1",
    },
    React.createElement("div",
      { className: "modal-dialog modal-dialog-centered" },
      React.createElement("div", { className: "modal-content" },
        React.createElement("div", { className: "modal-header" },
          React.createElement("h5", { className: "modal-title" },
            "New Expense"
          ),
          React.createElement("button",
            {
              type: "button",
              className: "btn-close",
              onClick: () => {
                setApp(prev => ({ ...prev, addingExpense: false }));
              },
            }
          )
        ),
        React.createElement("div", { className: "modal-body" },
          React.createElement("form", null,
            React.createElement("div", { className: "mb-3" },
              React.createElement("label",
                {
                  htmlFor: "expenseAmount",
                  className: "form-label"
                },
                "Amount"
              ),
              React.createElement("input", {
                id: "expenseAmount",
                type: "number",
                className: "form-control",
                placeholder: "0.00",
                step: "0.01",
                value: newEntry.amount,
                onChange: e => setNewEntry(
                  prev => ({ ...prev, amount: e.target.value })
                ),
              })
            ),
            React.createElement("div", { className: "mb-3" },
              React.createElement("label", {
                  htmlFor: "expenseDescription",
                  className: "form-label"
                },
                "Description"
              ),
              React.createElement("input", {
                id: "expenseDescription",
                type: "text",
                className: "form-control",
                placeholder: "e.g., Groceries, Dinner",
                value: newEntry.description,
                onChange: e => setNewEntry(
                  prev => ({ ...prev, description: e.target.value })
                ),
              })
            ),
            React.createElement("div", { className: "mb-3" },
              React.createElement("label", {
                  htmlFor: "expenseDate",
                  className: "form-label"
                },
                "Date"
              ),
              React.createElement("input", {
                id: "expenseDate",
                type: "date",
                className: "form-control",
                value: formatDate(newEntry.date),
                onChange: e => setNewEntry(
                  prev => ({ ...prev, date: new Date(e.target.value) })
                ),
              })
            ),
            React.createElement("div",
              { className: "mb-3" },
              React.createElement("label",
                {
                  htmlFor: "expenseCategories",
                  className: "form-label"
                },
                "Categories"
              ),
              React.createElement("input", {
                id: "expenseCategories",
                type: "text",
                className: "form-control",
                placeholder: "e.g. food shopping",
                value: newEntry.categories,
                onChange: e => setNewEntry(
                  prev => ({ ...prev, categories: e.target.value })
                ),
              })
            )
          )
        ),
        React.createElement("div", { className: "modal-footer" },
          React.createElement("button",
            {
              type: "button",
              className: "btn btn-secondary",
              onClick: () => {
                setApp(prev => ({ ...prev, addingExpense: false }));
              }
            },
            "Cancel"
          ),
          React.createElement("button", {
              type: "button",
              className: "btn btn-primary",
              onClick: () => {
                const validationError = validateExpense(newEntry);
                if (validationError) {
                  alert(validationError);
                  return;
                }

                const expense = transformExpense(newEntry);
                if (expense !== null) {
                  const expenses = [ ...app.expenses, expense ];
                  setApp(prev => ({
                    ...prev,
                    expenses: expenses,
                    addingExpense: false,
                  }));
                  saveExpenses(expenses);
                }
              },
            },
            "Save"
          )
        )
      )
    )
  );
}

function EditExpenseModal({ expenseId }) {
  const [app, setApp] = Jotai.useAtom(appState);
  const [expense, setExpense] = React.useState(() => {
    const _expense = app.expenses.find(exp => exp.id === expenseId);
    if (!_expense) {
      alert("Expense not found.");
      setApp(prev => ({ ...prev, editingExpenseId: null }));
    }
    return {
      amount: String(_expense.amount),
      description: _expense.description,
      date: _expense.date,
      categories: _expense.categories.join(" "),
    };
  });

  const handleUpdate = () => {
    const validationError = validateExpense(expense);
    if (validationError) {
      alert(validationError);
      return;
    }

    const _expense = transformExpense(expense);
    if (_expense !== null) {
      const expenses = app.expenses.map(exp =>
        exp.id === expenseId ? _expense : exp
      );
      setApp(prev => ({
        ...prev,
        expenses: expenses,
        editingExpenseId: null,
      }));
      saveExpenses(expenses);
    }
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this expense?")) {
      const expenses = app.expenses.filter(
        exp => exp.id !== expenseId);
      setApp(prev => ({
        ...prev,
        expenses: expenses,
        editingExpenseId: null,
      }));
      saveExpenses(expenses);
    }
  };

  const handleClose = () => {
    setApp(prev => ({ ...prev, editingExpenseId: null }));
  };

  return React.createElement( "div", {
      className: "modal fade show",
      style: { display: "block", backgroundColor: "rgba(0,0,0,0.5)" },
      tabIndex: "-1",
    },
    React.createElement("div",
      { className: "modal-dialog modal-dialog-centered" },
      React.createElement("div", { className: "modal-content" },
        React.createElement("div", { className: "modal-header" },
          React.createElement("h5", { className: "modal-title" },
            "Edit Expense"
          ),
          React.createElement("button", {
            type: "button",
            className: "btn-close",
            onClick: handleClose,
          })
        ),
        React.createElement("div", { className: "modal-body" },
          React.createElement("form", null,
            React.createElement("div", { className: "mb-3" },
              React.createElement("label",
                { htmlFor: "editExpenseAmount", className: "form-label" },
                "Amount"
              ),
              React.createElement("input", {
                id: "editExpenseAmount",
                type: "number",
                className: "form-control",
                placeholder: "0.00",
                step: "0.01",
                value: expense.amount,
                onChange: e => setExpense(
                  prev => ({ ...prev, amount: e.target.value })
                ),
              })
            ),
            React.createElement("div", { className: "mb-3" },
              React.createElement(
                "label",
                {
                  htmlFor: "editExpenseDescription",
                  className: "form-label"
                },
                "Description"
              ),
              React.createElement("input", {
                id: "editExpenseDescription",
                type: "text",
                className: "form-control",
                placeholder: "e.g., Groceries, Dinner",
                value: expense.description,
                onChange: e =>
                  setExpense(prev => ({
                    ...prev,
                    description: e.target.value,
                  })),
              })
            ),
            React.createElement("div",
              { className: "mb-3" },
              React.createElement("label",
                { htmlFor: "editExpenseDate", className: "form-label" },
                "Date"
              ),
              React.createElement("input", {
                id: "editExpenseDate",
                type: "date",
                className: "form-control",
                value: formatDate(expense.date),
                onChange: e =>
                  setExpense(prev => ({
                    ...prev,
                    date: new Date(e.target.value),
                  })),
              })
            ),
            React.createElement("div", { className: "mb-3" },
              React.createElement("label",
                {
                  htmlFor: "editExpenseCategories",
                  className: "form-label"
                },
                "Categories"
              ),
              React.createElement("input", {
                id: "editExpenseCategories",
                type: "text",
                className: "form-control",
                placeholder: "e.g. food shopping",
                value: expense.categories,
                onChange: e =>
                  setExpense(prev => ({
                    ...prev,
                    categories: e.target.value,
                  })),
              })
            )
          )
        ),
        React.createElement("div", { className: "modal-footer" },
          React.createElement("button", {
              type: "button",
              className: "btn btn-danger me-auto",
              onClick: handleDelete,
            },
            "Delete"
          ),
          React.createElement("button", {
              type: "button",
              className: "btn btn-secondary",
              onClick: handleClose,
            },
            "Cancel"
          ),
          React.createElement("button", {
              type: "button",
              className: "btn btn-primary",
              onClick: handleUpdate,
            },
            "Update"
          )
        )
      )
    )
  );
}

function loadExpenses() {
  stored = localStorage.getItem("expenses");
  if (stored) {
    return JSON.parse(stored).map(expense => ({
      ...expense,
      date: new Date(expense.date),
    }));
  } else {
    return [];
  }
}

function saveExpenses(expenses) {
  console.log("Saving expenses to local storage");
  localStorage.setItem("expenses", jsonFromExpenses(expenses));
}

function exportExpenses() {
  const expenses = loadExpenses();
  const json = jsonFromExpenses(expenses);
  const filename = `moneta-${formatDate(new Date())}.json`;

  if (typeof Android !== 'undefined' && Android.createFile) {
    Android.createFile(filename, json);
  } else {
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}

function importExpenses() {
  console.log("Importing expenses ...");

  if (typeof Android !== 'undefined' && Android.pickFile) {
    console.log("Importing expenses via Android.pickFile");
    Android.pickFile(importExpensesFrom);
  } else {
    console.log("Importing expenses via file input (not Android)");
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = async (event) => {
          importExpensesFrom(event.target.result);
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }
}

function importExpensesFrom(content) {
  try {
    const setApp = (callback) => store.set(appState, callback);

    console.log("Parsing imported expenses JSON");
    const importedExpenses = JSON.parse(content)
      .map(expense => ({
        id: expense.id,
        amount: parseFloat(expense.amount),
        description: expense.description,
        date: new Date(expense.date),
        categories: expense.categories,
      }));

    const validationErrors = importedExpenses
      .map(validateExpense)
      .filter(error => error !== null);

    if (validationErrors.length > 0) {
      alert("Validation errors found:\n" +
        validationErrors.join("\n"));
      return;
    }

    setApp(prev => ({
      ...prev,
      expenses: importedExpenses,
    }));
    saveExpenses(importedExpenses);
  } catch (e) {
    alert("Failed to import expenses: " + e.message);
  }
}

function jsonFromExpenses(expenses) {
  return JSON.stringify(
    expenses.map(expense => ({
      ...expense,
      date: formatDate(expense.date),
    })),
    null, 2
  );
}

function validateExpense(expense) {
  const amount = parseFloat(expense.amount);
  const description = expense.description.trim();
  const date = beginningOfDay(expense.date);

  if (amount <= 0 || isNaN(amount)) {
    return "Invalid amount";
  } else if (description === "") {
    return "Description cannot be empty";
  } else if (!date) {
    return "Date is required";
  } else if (date > beginningOfDay(new Date())) {
    return "Date cannot be in the future";
  }

  return null;
}

function transformExpense(expense) {
  return {
    id: expense.id || new Date().getTime(),
    amount: parseFloat(expense.amount),
    description: expense.description.trim(),
    date: beginningOfDay(expense.date),
    categories: expense.categories
      .split(/\s+/)
      .filter(cat => cat)
      .map(cat => cat.toLowerCase())
      .sort(),
  };
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function formatCurrency(amount) {
  return "$" + amount.toFixed(2);
}

function getCurrentMonth() {
  const now = new Date();
  return now.toLocaleString("default", { month: "long", year: "numeric" });
}

function beginningOfDay(date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

main();
