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
  deleteExpense,
  expenseFromForm,
  expenses,
  findExpense,
  loadExpenses,
  parseExpenses,
  replaceExpenses,
  saveExpenses,
  saveNotice,
  serializeExpenses,
  setExpenses,
  toIsoDate,
  updateExpense,
} = await import("../main.js");

// Seeds the store the way a reload does, so that ids are distinct: addExpense
// derives ids from the clock and gives two same-millisecond expenses the same one.
const seed = (...stored) => setExpenses(parseExpenses(JSON.stringify(stored)));

const storedExpenses = () => storage.get("expenses");

// The dialog converts the form before saving, so the store's own functions
// take expenses.
const filledIn = (overrides = {}) =>
  expenseFromForm({
    amount: "12.50",
    description: "Groceries",
    date: "2026-02-12",
    categories: ["food"],
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
  test("appends the expense", () => {
    addExpense(filledIn());
    assert.equal(expenses.length, 1);
    assert.equal(expenses[0].amount, 12.5);
    assert.equal(expenses[0].description, "Groceries");
    assert.deepEqual(expenses[0].categories, ["food"]);
    assert.equal(toIsoDate(expenses[0].date), "2026-02-12");
  });

  test("assigns an id", () => {
    addExpense(filledIn());
    assert.equal(typeof expenses[0].id, "number");
  });

  test("keeps earlier expenses", () => {
    addExpense(filledIn({ description: "First" }));
    addExpense(filledIn({ description: "Second" }));
    assert.deepEqual(
      expenses.map((each) => each.description),
      ["First", "Second"],
    );
  });

  test("persists the new list", () => {
    addExpense(filledIn());
    assert.equal(storedExpenses(), serializeExpenses(expenses));
  });
});

describe("updateExpense", () => {
  beforeEach(() => {
    seed(
      expense({ id: 1, description: "First" }),
      expense({ id: 2, description: "Second" }),
    );
  });

  test("replaces the fields of the matching expense", () => {
    const id = expenses[0].id;
    updateExpense(
      id,
      filledIn({ amount: "99", description: "Rent", categories: [] }),
    );
    const updated = findExpense(id);
    assert.equal(updated.amount, 99);
    assert.equal(updated.description, "Rent");
    assert.deepEqual(updated.categories, []);
  });

  test("keeps the id", () => {
    const id = expenses[0].id;
    updateExpense(id, filledIn({ description: "Rent" }));
    assert.equal(findExpense(id).description, "Rent");
  });

  test("writes the id first, as addExpense does", () => {
    updateExpense(expenses[0].id, filledIn({ description: "Rent" }));
    assert.deepEqual(Object.keys(expenses[0]), [
      "id",
      "amount",
      "description",
      "date",
      "categories",
    ]);
  });

  test("leaves other expenses alone", () => {
    updateExpense(expenses[0].id, filledIn({ description: "Rent" }));
    assert.equal(expenses[1].description, "Second");
  });

  test("changes nothing when no expense matches", () => {
    const before = serializeExpenses(expenses);
    updateExpense(-1, filledIn({ description: "Rent" }));
    assert.equal(serializeExpenses(expenses), before);
  });

  test("persists the updated list", () => {
    updateExpense(expenses[0].id, filledIn({ description: "Rent" }));
    assert.equal(storedExpenses(), serializeExpenses(expenses));
  });
});

describe("deleteExpense", () => {
  test("removes only the matching expense and persists", () => {
    seed(
      expense({ id: 1, description: "First" }),
      expense({ id: 2, description: "Second" }),
    );
    deleteExpense(expenses[0].id);
    assert.deepEqual(
      expenses.map((each) => each.description),
      ["Second"],
    );
    assert.equal(storedExpenses(), serializeExpenses(expenses));
  });

  test("changes nothing when no expense matches", () => {
    addExpense(filledIn());
    deleteExpense(-1);
    assert.equal(expenses.length, 1);
  });
});

describe("findExpense", () => {
  test("returns the expense with that id, or undefined", () => {
    addExpense(filledIn());
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
    addExpense(filledIn());
    const loaded = loadExpenses();
    assert.equal(loaded.length, 1);
    assert.equal(loaded[0].amount, 12.5);
    assert.equal(toIsoDate(loaded[0].date), "2026-02-12");
  });
});

describe("the Saved notice", () => {
  test("appears on save and disappears three seconds later", () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    try {
      saveExpenses(expenses);
      assert.equal(saveNotice(), "Saved");
      mock.timers.tick(3000);
      assert.equal(saveNotice(), null);
    } finally {
      mock.timers.reset();
    }
  });

  test("stays visible for three seconds after the most recent save", () => {
    mock.timers.enable({ apis: ["setTimeout"] });
    try {
      saveExpenses(expenses);
      mock.timers.tick(2000);
      saveExpenses(expenses);
      mock.timers.tick(1500);
      assert.equal(saveNotice(), "Saved");
      mock.timers.tick(1500);
      assert.equal(saveNotice(), null);
    } finally {
      mock.timers.reset();
    }
  });
});

describe("replaceExpenses", () => {
  // The card that offers an import has already read the file, so what reaches
  // the store is the parsed expenses.
  const fromFile = (...stored) => parseExpenses(JSON.stringify(stored));

  test("replaces the current expenses and persists them", () => {
    addExpense(filledIn({ description: "Existing" }));
    replaceExpenses(fromFile(expense({ description: "Imported" })));
    assert.deepEqual(
      expenses.map((each) => each.description),
      ["Imported"],
    );
    assert.equal(storedExpenses(), serializeExpenses(expenses));
  });

  test("reads dates as the calendar day written in the file", () => {
    replaceExpenses(fromFile(expense()));
    assert.equal(toIsoDate(expenses[0].date), "2026-02-12");
  });

  test("imports an empty file as an empty list", () => {
    addExpense(filledIn());
    replaceExpenses(fromFile());
    assert.equal(expenses.length, 0);
  });

  test("rejects a file with an invalid expense, keeping the current ones", () => {
    mock.method(console, "error", () => {});
    addExpense(filledIn({ description: "Existing" }));
    const before = storedExpenses();
    replaceExpenses(fromFile(expense(), expense({ id: 2, amount: -1 })));
    assert.deepEqual(alerts, ["File contains errors."]);
    assert.deepEqual(
      expenses.map((each) => each.description),
      ["Existing"],
    );
    assert.equal(storedExpenses(), before);
  });

  test("reports every problem it found to the console", () => {
    const logged = mock.method(console, "error", () => {});
    replaceExpenses(
      fromFile(expense({ amount: -1 }), expense({ id: 2, description: "" })),
    );
    assert.deepEqual(
      logged.mock.calls.map((call) => call.arguments[0]),
      ["Invalid amount.", "Description cannot be empty."],
    );
  });
});

describe("reading a file the import offers", () => {
  test("refuses a malformed document", () => {
    assert.throws(() => parseExpenses("not json"));
  });

  test("refuses a document that is not a list of expenses", () => {
    assert.throws(() => parseExpenses(JSON.stringify({ expenses: [] })));
  });
});
