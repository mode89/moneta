import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  beginningOfDay,
  blankExpenseForm,
  expenseError,
  expenseFromForm,
  formFromExpense,
  formatCurrency,
  formatDay,
  importedExpenseError,
  isSameMonth,
  parseCategories,
  parseExpenses,
  parseIsoDate,
  serializeExpenses,
  toIsoDate,
} from "../main.js";

const today = () => beginningOfDay(new Date());
const daysFromToday = (days) => {
  const date = today();
  date.setDate(date.getDate() + days);
  return date;
};
const isoDaysFromToday = (days) => toIsoDate(daysFromToday(days));

describe("toIsoDate", () => {
  test("renders a date as YYYY-MM-DD in local time", () => {
    assert.equal(toIsoDate(new Date(2026, 1, 12, 23, 30)), "2026-02-12");
  });

  test("pads single-digit months and days", () => {
    assert.equal(toIsoDate(new Date(2026, 0, 5)), "2026-01-05");
  });
});

describe("parseIsoDate", () => {
  test("reads the text as a calendar day at local midnight", () => {
    const date = parseIsoDate("2026-02-12");
    assert.equal(toIsoDate(date), "2026-02-12");
    assert.equal(date.getHours(), 0);
  });

  test("yields an unparseable date for text that is not one", () => {
    assert.ok(isNaN(parseIsoDate("").getTime()));
    assert.ok(isNaN(parseIsoDate("nonsense").getTime()));
  });
});

describe("formatDay", () => {
  test("renders a day heading", () => {
    assert.equal(formatDay(new Date(2026, 1, 12)), "2026-02-12");
  });
});

describe("isSameMonth", () => {
  test("compares year and month, ignoring the day", () => {
    assert.equal(isSameMonth(new Date(2026, 1, 1), new Date(2026, 1, 28)), true);
    assert.equal(isSameMonth(new Date(2026, 1, 1), new Date(2026, 2, 1)), false);
    assert.equal(isSameMonth(new Date(2025, 1, 1), new Date(2026, 1, 1)), false);
  });
});

describe("formatCurrency", () => {
  test("renders two decimal places with a leading dollar sign", () => {
    assert.equal(formatCurrency(12.5), "$12.50");
    assert.equal(formatCurrency(0), "$0.00");
  });

  test("puts the minus sign before the dollar sign", () => {
    assert.equal(formatCurrency(-12.5), "-$12.50");
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
    assert.equal(toIsoDate(midnight), "2026-02-12");
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
    assert.equal(form.date, toIsoDate(new Date()));
  });
});

describe("formFromExpense", () => {
  test("renders an expense as editable text", () => {
    const form = formFromExpense({
      id: 1,
      amount: 12.5,
      description: "Groceries",
      date: new Date(2026, 1, 12),
      categories: ["food", "shopping"],
    });
    assert.equal(form.amount, "12.5");
    assert.equal(form.description, "Groceries");
    assert.equal(form.categories, "food shopping");
    assert.equal(form.date, "2026-02-12");
  });
});

describe("expenseFromForm", () => {
  test("parses the amount, trims the description, and splits categories", () => {
    const expense = expenseFromForm({
      amount: "12.50",
      description: "  Groceries  ",
      date: "2026-02-12",
      categories: "Shopping food",
    });
    assert.equal(expense.amount, 12.5);
    assert.equal(expense.description, "Groceries");
    assert.deepEqual(expense.categories, ["food", "shopping"]);
    assert.equal(toIsoDate(expense.date), "2026-02-12");
  });

  test("dates the expense at the beginning of the day", () => {
    const expense = expenseFromForm({
      amount: "1",
      description: "x",
      date: "2026-02-12",
      categories: "",
    });
    assert.equal(expense.date.getHours(), 0);
  });

  test("yields an unparseable date for an empty date field", () => {
    const expense = expenseFromForm({
      amount: "1",
      description: "x",
      date: "",
      categories: "",
    });
    assert.ok(isNaN(expense.date.getTime()));
  });
});

describe("expenseError", () => {
  const validExpense = () => ({
    amount: 12.5,
    description: "Groceries",
    date: today(),
    categories: ["food"],
  });

  test("accepts a filled-in expense dated today", () => {
    assert.equal(expenseError(validExpense()), null);
  });

  test("accepts an expense with no categories", () => {
    assert.equal(expenseError({ ...validExpense(), categories: [] }), null);
  });

  test("rejects an amount that is missing, zero, negative, or not a number", () => {
    for (const amount of [NaN, 0, -5]) {
      assert.equal(
        expenseError({ ...validExpense(), amount }),
        "Invalid amount.",
        `amount ${amount}`,
      );
    }
  });

  test("rejects a missing or blank description", () => {
    assert.equal(
      expenseError({ ...validExpense(), description: "   " }),
      "Description cannot be empty.",
    );
    assert.equal(
      expenseError({ ...validExpense(), description: "" }),
      "Description cannot be empty.",
    );
  });

  test("rejects an unparseable date", () => {
    assert.equal(
      expenseError({ ...validExpense(), date: new Date("nonsense") }),
      "Invalid date.",
    );
  });

  test("rejects a future date but accepts a past one", () => {
    assert.equal(
      expenseError({ ...validExpense(), date: daysFromToday(1) }),
      "Date cannot be in the future.",
    );
    assert.equal(expenseError({ ...validExpense(), date: daysFromToday(-1) }), null);
  });

  test("judges the future by the day, not the time of day", () => {
    const lateToday = today();
    lateToday.setHours(23, 59, 59);
    assert.equal(expenseError({ ...validExpense(), date: lateToday }), null);
  });

  test("reports the amount first when several fields are wrong", () => {
    assert.equal(
      expenseError({ ...validExpense(), amount: NaN, description: "" }),
      "Invalid amount.",
    );
  });
});

describe("a form on its way to becoming an expense", () => {
  const validForm = () => ({
    amount: "12.50",
    description: "Groceries",
    date: isoDaysFromToday(0),
    categories: "food",
  });
  const formError = (overrides) =>
    expenseError(expenseFromForm({ ...validForm(), ...overrides }));

  test("accepts a filled-in form dated today", () => {
    assert.equal(formError({}), null);
  });

  test("rejects an amount that is missing, zero, negative, or not a number", () => {
    for (const amount of ["", "0", "-5", "abc"]) {
      assert.equal(
        formError({ amount }),
        "Invalid amount.",
        `amount ${JSON.stringify(amount)}`,
      );
    }
  });

  test("rejects a blank description", () => {
    assert.equal(formError({ description: "   " }), "Description cannot be empty.");
  });

  test("rejects an empty date field", () => {
    assert.equal(formError({ date: "" }), "Invalid date.");
  });

  test("rejects a future date but accepts a past one", () => {
    assert.equal(
      formError({ date: isoDaysFromToday(1) }),
      "Date cannot be in the future.",
    );
    assert.equal(formError({ date: isoDaysFromToday(-1) }), null);
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
      "Description cannot be empty.",
    );
    assert.equal(
      importedExpenseError({ ...validExpense(), description: "   " }),
      "Description cannot be empty.",
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
    assert.equal(toIsoDate(expense.date), "2026-02-12");
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

  test("sorts the categories it reads, so display order needs no sorting", () => {
    const [expense] = parseExpenses(
      JSON.stringify([
        { id: 1, amount: 3, description: "Coffee", date: "2026-02-12", categories: ["shopping", "food"] },
      ]),
    );
    assert.deepEqual(expense.categories, ["food", "shopping"]);
  });

  test("reads an expense with no categories field as having none", () => {
    const [expense] = parseExpenses(
      JSON.stringify([{ id: 1, amount: 3, description: "Coffee", date: "2026-02-12" }]),
    );
    assert.deepEqual(expense.categories, []);
  });

  test("rewrites unsorted categories on the way back out", () => {
    const unsorted = JSON.stringify(
      [
        {
          id: 1,
          amount: 3,
          description: "Coffee",
          date: "2026-02-12",
          categories: ["shopping", "food"],
        },
      ],
      null,
      2,
    );
    assert.equal(
      serializeExpenses(parseExpenses(unsorted)),
      unsorted.replace('"shopping",\n      "food"', '"food",\n      "shopping"'),
    );
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
    assert.equal(toIsoDate(restored.date), "2026-02-12");
  });
});
