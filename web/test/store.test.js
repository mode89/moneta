import { test, describe, beforeEach, mock } from "node:test";
import assert from "node:assert/strict";

const storage = new Map();
const alerts = [];

globalThis.localStorage = {
  getItem: (key) => (storage.has(key) ? storage.get(key) : null),
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: (key) => storage.delete(key),
};
globalThis.alert = (message) => alerts.push(message);

const {
  addExpense,
  bubble,
  deleteExpense,
  expenses,
  findExpense,
  formatDate,
  importExpensesFrom,
  loadExpenses,
  parseExpenses,
  saveExpenses,
  serializeExpenses,
  setExpenses,
  updateExpense,
} = await import("../main.js");

// Seeds the store the way a reload does, so that ids are distinct: addExpense
// derives ids from the clock and gives two same-millisecond expenses the same one.
const seed = (...stored) => setExpenses(parseExpenses(JSON.stringify(stored)));

const storedExpenses = () => storage.get("expenses");

const form = (overrides = {}) => ({
  amount: "12.50",
  description: "Groceries",
  date: new Date(2026, 1, 12),
  categories: "food",
  ...overrides,
});

const expense = (overrides = {}) => ({
  id: 1,
  amount: 12.5,
  description: "Groceries",
  date: "2026-02-12",
  categories: ["food"],
  ...overrides,
});

beforeEach(() => {
  storage.clear();
  alerts.length = 0;
  setExpenses([]);
});

describe("addExpense", () => {
  test("appends the expense described by the form", () => {
    addExpense(form());
    assert.equal(expenses.length, 1);
    assert.equal(expenses[0].amount, 12.5);
    assert.equal(expenses[0].description, "Groceries");
    assert.deepEqual(expenses[0].categories, ["food"]);
    assert.equal(formatDate(expenses[0].date), "2026-02-12");
  });

  test("assigns an id", () => {
    addExpense(form());
    assert.equal(typeof expenses[0].id, "number");
  });

  test("keeps earlier expenses", () => {
    addExpense(form({ description: "First" }));
    addExpense(form({ description: "Second" }));
    assert.deepEqual(
      expenses.map((each) => each.description),
      ["First", "Second"],
    );
  });

  test("persists the new list", () => {
    addExpense(form());
    assert.equal(storedExpenses(), serializeExpenses(expenses));
  });
});

describe("updateExpense", () => {
  beforeEach(() => {
    seed(expense({ id: 1, description: "First" }), expense({ id: 2, description: "Second" }));
  });

  test("replaces the fields of the matching expense", () => {
    const id = expenses[0].id;
    updateExpense(id, form({ amount: "99", description: "Rent", categories: "" }));
    const updated = findExpense(id);
    assert.equal(updated.amount, 99);
    assert.equal(updated.description, "Rent");
    assert.deepEqual(updated.categories, []);
  });

  test("keeps the id", () => {
    const id = expenses[0].id;
    updateExpense(id, form({ description: "Rent" }));
    assert.equal(findExpense(id).description, "Rent");
  });

  test("leaves other expenses alone", () => {
    updateExpense(expenses[0].id, form({ description: "Rent" }));
    assert.equal(expenses[1].description, "Second");
  });

  test("changes nothing when no expense matches", () => {
    const before = serializeExpenses(expenses);
    updateExpense(-1, form({ description: "Rent" }));
    assert.equal(serializeExpenses(expenses), before);
  });

  test("persists the updated list", () => {
    updateExpense(expenses[0].id, form({ description: "Rent" }));
    assert.equal(storedExpenses(), serializeExpenses(expenses));
  });
});

describe("deleteExpense", () => {
  test("removes only the matching expense and persists", () => {
    seed(expense({ id: 1, description: "First" }), expense({ id: 2, description: "Second" }));
    deleteExpense(expenses[0].id);
    assert.deepEqual(
      expenses.map((each) => each.description),
      ["Second"],
    );
    assert.equal(storedExpenses(), serializeExpenses(expenses));
  });

  test("changes nothing when no expense matches", () => {
    addExpense(form());
    deleteExpense(-1);
    assert.equal(expenses.length, 1);
  });
});

describe("findExpense", () => {
  test("returns the expense with that id, or undefined", () => {
    addExpense(form());
    const id = expenses[0].id;
    assert.equal(findExpense(id).description, "Groceries");
    assert.equal(findExpense(-1), undefined);
  });
});

describe("loadExpenses", () => {
  test("returns an empty list when nothing is stored", () => {
    assert.deepEqual(loadExpenses(), []);
  });

  test("restores what was saved, dates included", () => {
    addExpense(form());
    const loaded = loadExpenses();
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].amount, 12.5);
    assert.equal(formatDate(loaded[0].date), "2026-02-12");
  });
});

describe("the Saved bubble", () => {
  test("appears on save and disappears three seconds later", () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    try {
      saveExpenses();
      assert.equal(bubble(), "Saved");
      mock.timers.tick(3000);
      assert.equal(bubble(), null);
    } finally {
      mock.timers.reset();
    }
  });

  test("stays visible for three seconds after the most recent save", () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    try {
      saveExpenses();
      mock.timers.tick(2000);
      saveExpenses();
      mock.timers.tick(1500);
      assert.equal(bubble(), "Saved");
      mock.timers.tick(1500);
      assert.equal(bubble(), null);
    } finally {
      mock.timers.reset();
    }
  });
});

describe("importExpensesFrom", () => {
  test("replaces the current expenses and persists them", () => {
    addExpense(form({ description: "Existing" }));
    importExpensesFrom(JSON.stringify([expense({ description: "Imported" })]));
    assert.deepEqual(
      expenses.map((each) => each.description),
      ["Imported"],
    );
    assert.equal(storedExpenses(), serializeExpenses(expenses));
  });

  test("reads dates as the calendar day written in the file", () => {
    importExpensesFrom(JSON.stringify([expense()]));
    assert.equal(formatDate(expenses[0].date), "2026-02-12");
  });

  test("imports an empty file as an empty list", () => {
    addExpense(form());
    importExpensesFrom("[]");
    assert.equal(expenses.length, 0);
  });

  test("rejects a file with an invalid expense, keeping the current ones", () => {
    mock.method(console, "error", () => {});
    addExpense(form({ description: "Existing" }));
    const before = storedExpenses();
    importExpensesFrom(JSON.stringify([expense(), expense({ id: 2, amount: -1 })]));
    assert.deepEqual(alerts, ["File contains errors."]);
    assert.deepEqual(
      expenses.map((each) => each.description),
      ["Existing"],
    );
    assert.equal(storedExpenses(), before);
  });

  test("reports every problem it found to the console", () => {
    const logged = mock.method(console, "error", () => {});
    importExpensesFrom(
      JSON.stringify([expense({ amount: -1 }), expense({ id: 2, description: "" })]),
    );
    assert.deepEqual(
      logged.mock.calls.map((call) => call.arguments[0]),
      ["Invalid amount.", "Empty description."],
    );
  });

  test("rejects a malformed document", () => {
    addExpense(form({ description: "Existing" }));
    importExpensesFrom("not json");
    assert.equal(alerts.length, 1);
    assert.match(alerts[0], /^Failed to import expenses: /);
    assert.equal(expenses.length, 1);
  });

  test("rejects a document that is not a list of expenses", () => {
    importExpensesFrom(JSON.stringify({ expenses: [] }));
    assert.equal(alerts.length, 1);
    assert.match(alerts[0], /^Failed to import expenses: /);
  });
});
