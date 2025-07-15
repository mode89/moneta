const jotai = {
  atom: window.jotaiVanilla.atom,
  useAtom: window.jotaiReact.useAtom,
};
const r = window.React;
const rdom = window.ReactDOM;

const appState = jotai.atom({
  expenses: loadExpenses(),
  addingExpense: false,
  editingExpenseId: null,
});

function main() {
  rdom.createRoot(document.getElementById("app"))
    .render(r.createElement(() => {
      const [app, setApp] = jotai.useAtom(appState);
      return r.createElement("div", { className: "container mt-4" },
        r.createElement(SummaryCard, null),
        r.createElement(ExpenseList, null),
        r.createElement(NewExpenseButton, null),
        app.addingExpense && r.createElement(NewExpenseModal, null),
        app.editingExpenseId !== null && r.createElement(EditExpenseModal, {
          expenseId: app.editingExpenseId
        })
      );
    }));
}

function SummaryCard() {
  const [app] = jotai.useAtom(appState);
  const total = app.expenses
    .reduce((sum, expense) => sum + expense.amount, 0);

  return r.createElement("div", { className: "card mb-4" },
    r.createElement("div", { className: "card-body" },
      r.createElement("h2", { className: "card-title" }, getCurrentMonth()),
      r.createElement("p", { className: "card-text fs-3" },
        "Total Spent: ",
        r.createElement("span", { style: { color: "#dc3545" } },
          formatCurrency(total))
      ),
    )
  );
}

function ExpenseList() {
  const [app, setApp] = jotai.useAtom(appState);
  const expenses = app.expenses
    .slice()
    .sort((a, b) => new Date(b.date) - new Date(a.date));

  return r.createElement("div", { className: "card mt-4 custom-mb-100" },
    r.createElement("div", { className: "card-header" },
      r.createElement("h3", { className: "mb-0" }, "Expenses"),
    ),
    r.createElement("ul", { className: "list-group list-group-flush" },
      expenses.length === 0
        ? r.createElement("li",
            { className: "list-group-item text-muted text-center" },
            "No expenses yet"
          )
        : expenses.map(expense =>
            r.createElement(ExpenseItem, { key: expense.id, expense })
          )
    )
  );
}

function ExpenseItem({ expense }) {
  const [app, setApp] = jotai.useAtom(appState);

  return r.createElement("li",
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
    r.createElement(
      "div",
      null,
      r.createElement("strong", null, expense.description),
      r.createElement("br", null),
      r.createElement("small", { className: "text-muted" },
        formatDate(expense.date)
      ),
      expense.categories.length > 0 &&
        r.createElement("div", { className: "text-info small" },
          expense.categories.slice().sort().join(", ")
        )
    ),
    r.createElement("span", { className: "text-danger" },
      "-" + formatCurrency(expense.amount)
    )
  );
}

function NewExpenseButton() {
  const [app, setApp] = jotai.useAtom(appState);
  return r.createElement(
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
  const [app, setApp] = jotai.useAtom(appState);
  const [newEntry, setNewEntry] = r.useState({
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
  const [app, setApp] = jotai.useAtom(appState);
  const [expense, setExpense] = r.useState(() => {
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
  localStorage.setItem("expenses", JSON.stringify(
    expenses.map(expense => ({
      ...expense,
      date: formatDate(expense.date),
    }))
  ));
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
