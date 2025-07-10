const jotai = {
  atom: window.jotaiVanilla.atom,
  useAtom: window.jotaiReact.useAtom,
};
const r = window.React;
const rdom = window.ReactDOM;

state = jotai.atom({
  expenses: loadExpenses(),
  showModal: false,
});

function main() {
  rdom.createRoot(document.getElementById("app"))
    .render(r.createElement(() => {
      const [_state] = jotai.useAtom(state);
      return r.createElement("div", { className: "container mt-4" },
        r.createElement(SummaryCard, null),
        r.createElement(ExpenseList, null),
        r.createElement(NewEntryButton, null),
        _state.showModal && r.createElement(NewEntryModal, null)
      );
    }));
}

function SummaryCard() {
  const [_state] = jotai.useAtom(state);
  const total = _state.expenses
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
  const [_state] = jotai.useAtom(state);
  const expenses = _state.expenses
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
  return r.createElement("li",
    {
      className:
        "list-group-item " +
        "d-flex " +
        "justify-content-between " +
        "align-items-center",
      style: { cursor: "pointer", userSelect: "none" },
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

function NewEntryButton() {
  const [_state, setState] = jotai.useAtom(state);
  return r.createElement(
    "button",
    {
      className: "btn btn-primary btn-lg rounded-circle fixed-bottom-right",
      style: { zIndex: 1000 },
      onClick: () => setState(prev => ({ ...prev, showModal: true })),
    },
    "+"
  );
}

function NewEntryModal() {
  const [_state, setState] = jotai.useAtom(state);
  const [newEntry, setNewEntry] = r.useState({
    amount: "",
    description: "",
    date: new Date(),
    categories: [],
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
                setState(prev => ({ ...prev, showModal: false }));
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
                setState(prev => ({ ...prev, showModal: false }));
              }
            },
            "Cancel"
          ),
          React.createElement("button", {
              type: "button",
              className: "btn btn-primary",
              onClick: () => {
                const expense = handleNewEntry(newEntry);
                if (expense !== null) {
                  const expenses = [ ..._state.expenses, expense ];
                  setState(prev => ({
                    ...prev,
                    expenses: expenses,
                    showModal: false,
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

function handleNewEntry(entry) {
  const amount = parseFloat(entry.amount);
  const description = entry.description.trim();
  const date = beginningOfDay(entry.date);

  if (amount <= 0 || isNaN(amount)) {
    alert("Please enter a valid amount.");
  } else if (description === "") {
    alert("Please enter a description.");
  } else if (!date) {
    alert("Please select a date.");
  } else if (date > beginningOfDay(new Date())) {
    alert("Date cannot be in the future.");
  } else {
    return {
      // Unique ID based on timestamp
      id: new Date().getTime(),
      amount: amount,
      description: description,
      date: date,
      categories: entry.categories
        .split(/\s+/)
        .filter(cat => cat)
        .sort(),
    };
  }
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
