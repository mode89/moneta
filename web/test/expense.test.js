import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  beginningOfDay,
  blankExpenseForm,
  expenseForm,
  expenseFromForm,
  formatCurrency,
  formatDate,
  importedExpenseError,
  parseCategories,
  parseExpenses,
  serializeExpenses,
  validateExpense,
} from "../main.js";

const today = () => beginningOfDay(new Date());
const daysFromToday = (days) => {
  const date = today();
  date.setDate(date.getDate() + days);
  return date;
};

describe("formatDate", () => {
  test("renders a date as YYYY-MM-DD in local time", () => {
    assert.equal(formatDate(new Date(2026, 1, 12, 23, 30)), "2026-02-12");
  });

  test("pads single-digit months and days", () => {
    assert.equal(formatDate(new Date(2026, 0, 5)), "2026-01-05");
  });
});

describe("formatCurrency", () => {
  test("renders two decimal places with a leading dollar sign", () => {
    assert.equal(formatCurrency(12.5), "$12.50");
    assert.equal(formatCurrency(0), "$0.00");
  });

  test("rounds to the nearest cent", () => {
    assert.equal(formatCurrency(1.005), "$1.00");
    assert.equal(formatCurrency(2.346), "$2.35");
  });
});

describe("beginningOfDay", () => {
  test("drops the time of day", () => {
    const midnight = beginningOfDay(new Date(2026, 1, 12, 17, 45, 30, 250));
    assert.equal(midnight.getHours(), 0);
    assert.equal(midnight.getMinutes(), 0);
    assert.equal(midnight.getSeconds(), 0);
    assert.equal(midnight.getMilliseconds(), 0);
    assert.equal(formatDate(midnight), "2026-02-12");
  });

  test("leaves its argument untouched", () => {
    const original = new Date(2026, 1, 12, 17, 45);
    beginningOfDay(original);
    assert.equal(original.getHours(), 17);
  });
});

describe("parseCategories", () => {
  test("splits on whitespace, lowercases, and sorts", () => {
    assert.deepEqual(parseCategories("Shopping  food"), ["food", "shopping"]);
  });

  test("yields an empty list for blank input", () => {
    assert.deepEqual(parseCategories(""), []);
    assert.deepEqual(parseCategories("   "), []);
  });

  test("keeps repeated categories", () => {
    assert.deepEqual(parseCategories("food food"), ["food", "food"]);
  });
});

describe("blankExpenseForm", () => {
  test("starts empty and dated today", () => {
    const form = blankExpenseForm();
    assert.equal(form.amount, "");
    assert.equal(form.description, "");
    assert.equal(form.categories, "");
    assert.equal(formatDate(form.date), formatDate(new Date()));
  });
});

describe("expenseForm", () => {
  test("renders an expense as editable text", () => {
    const form = expenseForm({
      id: 1,
      amount: 12.5,
      description: "Groceries",
      date: new Date(2026, 1, 12),
      categories: ["food", "shopping"],
    });
    assert.equal(form.amount, "12.5");
    assert.equal(form.description, "Groceries");
    assert.equal(form.categories, "food shopping");
    assert.equal(formatDate(form.date), "2026-02-12");
  });
});

describe("expenseFromForm", () => {
  test("parses the amount, trims the description, and splits categories", () => {
    const expense = expenseFromForm({
      amount: "12.50",
      description: "  Groceries  ",
      date: new Date(2026, 1, 12),
      categories: "Shopping food",
    });
    assert.equal(expense.amount, 12.5);
    assert.equal(expense.description, "Groceries");
    assert.deepEqual(expense.categories, ["food", "shopping"]);
    assert.equal(formatDate(expense.date), "2026-02-12");
  });

  test("keeps the time of day carried by the form's date", () => {
    const expense = expenseFromForm({
      amount: "1",
      description: "x",
      date: new Date(2026, 1, 12, 17, 45),
      categories: "",
    });
    assert.equal(expense.date.getHours(), 17);
  });
});

describe("validateExpense", () => {
  const validForm = () => ({
    amount: "12.50",
    description: "Groceries",
    date: today(),
    categories: "food",
  });

  test("accepts a filled-in form dated today", () => {
    assert.equal(validateExpense(validForm()), null);
  });

  test("accepts a form with no categories", () => {
    assert.equal(validateExpense({ ...validForm(), categories: "" }), null);
  });

  test("rejects an amount that is missing, zero, negative, or not a number", () => {
    for (const amount of ["", "0", "-5", "abc"]) {
      assert.equal(
        validateExpense({ ...validForm(), amount }),
        "Invalid amount.",
        `amount ${JSON.stringify(amount)}`,
      );
    }
  });

  test("rejects a blank description", () => {
    assert.equal(
      validateExpense({ ...validForm(), description: "   " }),
      "Description cannot be empty.",
    );
  });

  test("rejects an unparseable date", () => {
    assert.equal(
      validateExpense({ ...validForm(), date: new Date("nonsense") }),
      "Invalid date.",
    );
  });

  test("rejects a future date but accepts a past one", () => {
    assert.equal(
      validateExpense({ ...validForm(), date: daysFromToday(1) }),
      "Date cannot be in the future.",
    );
    assert.equal(validateExpense({ ...validForm(), date: daysFromToday(-1) }), null);
  });

  test("reports the amount first when several fields are wrong", () => {
    assert.equal(
      validateExpense({ ...validForm(), amount: "", description: "" }),
      "Invalid amount.",
    );
  });
});

describe("importedExpenseError", () => {
  const validExpense = () => ({
    id: 1,
    amount: 12.5,
    description: "Groceries",
    date: today(),
    categories: ["food"],
  });

  test("accepts a well-formed expense", () => {
    assert.equal(importedExpenseError(validExpense()), null);
  });

  test("rejects a missing id", () => {
    assert.equal(importedExpenseError({ ...validExpense(), id: undefined }), "Missing ID.");
  });

  test("rejects an amount that is zero, negative, or not a number", () => {
    for (const amount of [0, -5, NaN]) {
      assert.equal(
        importedExpenseError({ ...validExpense(), amount }),
        "Invalid amount.",
        `amount ${amount}`,
      );
    }
  });

  test("rejects a missing or blank description", () => {
    assert.equal(
      importedExpenseError({ ...validExpense(), description: "" }),
      "Empty description.",
    );
    assert.equal(
      importedExpenseError({ ...validExpense(), description: "   " }),
      "Empty description.",
    );
  });

  test("rejects a future date", () => {
    assert.equal(
      importedExpenseError({ ...validExpense(), date: daysFromToday(1) }),
      "Date cannot be in the future.",
    );
  });

  test("rejects an unparseable date", () => {
    assert.equal(
      importedExpenseError({ ...validExpense(), date: new Date("nonsense") }),
      "Invalid date.",
    );
  });
});

describe("stored JSON format", () => {
  const storedJson = JSON.stringify(
    [
      {
        id: 1739299200000,
        amount: 12.5,
        description: "Groceries",
        date: "2026-02-12",
        categories: ["food", "shopping"],
      },
    ],
    null,
    2,
  );

  test("parses a stored date as that calendar day in local time", () => {
    const [expense] = parseExpenses(storedJson);
    assert.equal(expense.date.getFullYear(), 2026);
    assert.equal(expense.date.getMonth(), 1);
    assert.equal(expense.date.getDate(), 12);
    assert.equal(formatDate(expense.date), "2026-02-12");
  });

  test("parses the remaining fields unchanged", () => {
    const [expense] = parseExpenses(storedJson);
    assert.equal(expense.id, 1739299200000);
    assert.equal(expense.amount, 12.5);
    assert.equal(expense.description, "Groceries");
    assert.deepEqual(expense.categories, ["food", "shopping"]);
  });

  test("serializes back to exactly the same document", () => {
    assert.equal(serializeExpenses(parseExpenses(storedJson)), storedJson);
  });

  test("serializes an empty list", () => {
    assert.equal(serializeExpenses([]), "[]");
  });

  test("survives a round trip through the store's date objects", () => {
    const expense = {
      id: 1,
      amount: 3,
      description: "Coffee",
      date: new Date(2026, 1, 12, 23, 30),
      categories: [],
    };
    const [restored] = parseExpenses(serializeExpenses([expense]));
    assert.equal(formatDate(restored.date), "2026-02-12");
  });
});
