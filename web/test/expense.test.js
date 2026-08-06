import { test, describe } from "node:test";
import assert from "node:assert/strict";

import {
  averagePerDay,
  beginningOfDay,
  blankExpenseForm,
  categoryInk,
  categoryTotals,
  deleteMessage,
  expenseError,
  expenseFromForm,
  filterByCategory,
  formFromExpense,
  formatCurrency,
  formatDate,
  formatDay,
  formatMonth,
  groupByDay,
  groupByMonth,
  importMessage,
  importedExpenseError,
  isSameMonth,
  knownCategories,
  monthKey,
  parseAmount,
  parseCategories,
  parseExpenses,
  parseIsoDate,
  plainAmount,
  pluralNoun,
  roundedCurrency,
  serializeExpenses,
  toIsoDate,
  totalOf,
  withCategoryToggled,
} from "../main.js";

const anExpense = (overrides) => ({
  id: 1,
  amount: 10,
  description: "Coffee",
  date: new Date(2026, 6, 14),
  categories: [],
  ...overrides,
});

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

  // A day the calendar does not hold used to roll into the next month, which
  // stored a mistyped date as another day without saying so.
  test("yields an unparseable date for a day the calendar has not got", () => {
    for (const text of ["2026-02-30", "2026-13-01", "2026-00-10", "2026-2-3"])
      assert.ok(isNaN(parseIsoDate(text).getTime()), text);
  });

  test("reads a year before 1000 as that year", () => {
    assert.equal(toIsoDate(parseIsoDate("0099-05-01")), "0099-05-01");
    assert.equal(monthKey(parseIsoDate("0999-05-03")), "0999-05");
  });
});

describe("formatDay", () => {
  const reference = new Date(2026, 6, 14, 9, 30);

  test("names the two days a person thinks of by name", () => {
    assert.equal(formatDay(new Date(2026, 6, 14), reference), "Today");
    assert.equal(formatDay(new Date(2026, 6, 13), reference), "Yesterday");
  });

  test("gives every other day its date", () => {
    assert.equal(formatDay(new Date(2026, 6, 12), reference), "12 July");
  });

  test("reads yesterday across a month boundary", () => {
    const firstOfJuly = new Date(2026, 6, 1, 9, 30);
    assert.equal(formatDay(new Date(2026, 5, 30), firstOfJuly), "Yesterday");
  });
});

describe("formatDate", () => {
  test("puts the day before the month and drops the year", () => {
    assert.equal(formatDate(new Date(2026, 1, 5)), "5 February");
  });
});

describe("formatMonth", () => {
  test("names the month and its year", () => {
    assert.equal(formatMonth(new Date(2026, 6, 14)), "July 2026");
  });
});

describe("monthKey", () => {
  test("identifies a month by year and number, so months sort as text", () => {
    assert.equal(monthKey(new Date(2026, 6, 14)), "2026-07");
    assert.ok(monthKey(new Date(2026, 6, 1)) > monthKey(new Date(2026, 5, 30)));
  });
});

describe("averagePerDay", () => {
  test("divides the current month by the days elapsed so far", () => {
    const today = new Date(2026, 6, 14, 18, 0);
    assert.equal(averagePerDay(1400, today, today), 100);
  });

  test("divides an earlier month by its whole length", () => {
    const june = new Date(2026, 5, 12);
    const july = new Date(2026, 6, 14);
    assert.equal(averagePerDay(3000, june, july), 100);
  });
});

describe("totalOf", () => {
  test("adds the amounts, and is zero for nothing", () => {
    assert.equal(
      totalOf([anExpense({ amount: 2.5 }), anExpense({ amount: 1 })]),
      3.5,
    );
    assert.equal(totalOf([]), 0);
  });
});

describe("filterByCategory", () => {
  const groceries = anExpense({ id: 1, categories: ["food", "household"] });
  const bus = anExpense({ id: 2, categories: ["transport"] });

  test("keeps the expenses carrying the category", () => {
    assert.deepEqual(filterByCategory([groceries, bus], "food"), [groceries]);
  });

  test("keeps everything when no category is active", () => {
    assert.deepEqual(filterByCategory([groceries, bus], null), [
      groceries,
      bus,
    ]);
  });
});

describe("groupByMonth", () => {
  test("groups by calendar month, newest month first", () => {
    const july = anExpense({ id: 1, date: new Date(2026, 6, 2) });
    const alsoJuly = anExpense({ id: 2, date: new Date(2026, 6, 30) });
    const june = anExpense({ id: 3, date: new Date(2026, 5, 12) });
    const months = groupByMonth([june, july, alsoJuly]);
    assert.deepEqual(
      months.map((month) => [month.key, month.expenses.length]),
      [
        ["2026-07", 2],
        ["2026-06", 1],
      ],
    );
  });
});

describe("groupByDay", () => {
  test("groups by day, newest day and newest expense first", () => {
    const older = anExpense({ id: 1, date: new Date(2026, 6, 14, 10) });
    const newer = anExpense({ id: 2, date: new Date(2026, 6, 14, 10) });
    const earlierDay = anExpense({ id: 3, date: new Date(2026, 6, 12) });
    const days = groupByDay([earlierDay, older, newer]);
    assert.deepEqual(
      days.map((day) => [toIsoDate(day.date), day.expenses.map((e) => e.id)]),
      [
        ["2026-07-14", [2, 1]],
        ["2026-07-12", [3]],
      ],
    );
  });
});

describe("categoryTotals", () => {
  test("totals each category, largest first, ties by name", () => {
    const expenses = [
      anExpense({ amount: 40, categories: ["food", "household"] }),
      anExpense({ amount: 60, categories: ["food"] }),
      anExpense({ amount: 40, categories: ["bills"] }),
    ];
    assert.deepEqual(categoryTotals(expenses), [
      { name: "food", total: 100 },
      { name: "bills", total: 40 },
      { name: "household", total: 40 },
    ]);
  });

  test("ignores expenses with no categories", () => {
    assert.deepEqual(categoryTotals([anExpense({})]), []);
  });
});

describe("categoryInk", () => {
  test("gives a name the same ink every time", () => {
    assert.equal(categoryInk("food"), categoryInk("food"));
  });

  test("only ever answers with one of the six inks", () => {
    const inks = new Set();
    for (const name of ["food", "bills", "fun", "transport", "health", "x", ""])
      inks.add(categoryInk(name));
    for (const ink of inks) assert.match(ink, /^#[0-9a-f]{6}$/);
    assert.ok(inks.size <= 6);
  });
});

describe("knownCategories", () => {
  test("collects every category used, without repeats", () => {
    const expenses = [
      anExpense({ categories: ["food", "household"] }),
      anExpense({ categories: ["food"] }),
    ];
    assert.deepEqual(knownCategories(expenses), ["food", "household"]);
  });

  test("puts the most recently spent on first", () => {
    const expenses = [
      anExpense({ date: new Date(2026, 6, 1), categories: ["household"] }),
      anExpense({ date: new Date(2026, 6, 20), categories: ["food"] }),
      anExpense({ date: new Date(2026, 6, 10), categories: ["travel"] }),
    ];
    assert.deepEqual(knownCategories(expenses), [
      "food",
      "travel",
      "household",
    ]);
  });

  test("ranks a category by its newest expense", () => {
    const expenses = [
      anExpense({ date: new Date(2026, 6, 20), categories: ["food"] }),
      anExpense({ date: new Date(2026, 6, 1), categories: ["travel"] }),
      anExpense({ date: new Date(2026, 6, 25), categories: ["travel"] }),
    ];
    assert.deepEqual(knownCategories(expenses), ["travel", "food"]);
  });

  test("sorts categories spent on the same day by name", () => {
    const expenses = [
      anExpense({ categories: ["travel", "food", "household"] }),
    ];
    assert.deepEqual(knownCategories(expenses), [
      "food",
      "household",
      "travel",
    ]);
  });

  test("includes the ones the open form carries", () => {
    assert.deepEqual(knownCategories([], ["cycling"]), ["cycling"]);
  });

  test("puts a category no expense uses yet ahead of the used ones", () => {
    const expenses = [anExpense({ categories: ["food"] })];
    assert.deepEqual(knownCategories(expenses, ["cycling", "food"]), [
      "cycling",
      "food",
    ]);
  });
});

describe("withCategoryToggled", () => {
  test("adds a category the form does not carry, in order", () => {
    assert.deepEqual(withCategoryToggled(["food"], "bills"), ["bills", "food"]);
  });

  test("removes one it does", () => {
    assert.deepEqual(withCategoryToggled(["bills", "food"], "food"), ["bills"]);
  });

  test("adds to an empty form", () => {
    assert.deepEqual(withCategoryToggled([], "food"), ["food"]);
  });
});

describe("pluralNoun", () => {
  test("counts one expense in the singular", () => {
    assert.equal(pluralNoun(1, "expense"), "expense");
    assert.equal(pluralNoun(0, "expense"), "expenses");
    assert.equal(pluralNoun(14, "expense"), "expenses");
  });
});

describe("deleteMessage", () => {
  test("names the expense being deleted", () => {
    assert.equal(
      deleteMessage(
        anExpense({
          amount: 310,
          description: "Electricity",
          date: new Date(2026, 6, 12),
        }),
      ),
      "Electricity, $310.00 on 12 July. This cannot be undone.",
    );
  });
});

describe("importMessage", () => {
  test("names the file and what it replaces", () => {
    assert.equal(
      importMessage({ filename: "moneta.json", expenses: new Array(96) }, 14),
      "moneta.json holds 96 expenses. Importing removes the 14 expenses on this device and cannot be undone.",
    );
  });

  test("claims nothing is lost when there is nothing to lose", () => {
    assert.match(
      importMessage({ filename: "a.json", expenses: new Array(3) }, 0),
      /replaces everything/,
    );
  });
});

describe("isSameMonth", () => {
  test("compares year and month, ignoring the day", () => {
    assert.equal(
      isSameMonth(new Date(2026, 1, 1), new Date(2026, 1, 28)),
      true,
    );
    assert.equal(
      isSameMonth(new Date(2026, 1, 1), new Date(2026, 2, 1)),
      false,
    );
    assert.equal(
      isSameMonth(new Date(2025, 1, 1), new Date(2026, 1, 1)),
      false,
    );
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

  test("groups thousands", () => {
    assert.equal(formatCurrency(1284.6), "$1,284.60");
  });
});

describe("roundedCurrency", () => {
  test("drops the cents, for chips that carry the shape of a month", () => {
    assert.equal(roundedCurrency(528.1), "$528");
    assert.equal(roundedCurrency(1284.6), "$1,285");
  });
});

describe("plainAmount", () => {
  test("drops the dollar sign, for rows under a heading", () => {
    assert.equal(plainAmount(42.1), "42.10");
  });

  test("keeps the minus sign, as the other two do", () => {
    assert.equal(plainAmount(-42.1), "-42.10");
    assert.equal(roundedCurrency(-528.1), "-$528");
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

  test("names a repeated category once", () => {
    assert.deepEqual(parseCategories("food food"), ["food"]);
  });
});

describe("blankExpenseForm", () => {
  test("starts empty and dated today", () => {
    const form = blankExpenseForm();
    assert.equal(form.amount, "");
    assert.equal(form.description, "");
    assert.deepEqual(form.categories, []);
    assert.equal(form.date, toIsoDate(new Date()));
  });
});

// The field is text, not a number input: a number input drops a typed decimal
// comma silently, turning 12,50 into 1250.
describe("parseAmount", () => {
  test("takes a plain decimal written with either separator", () => {
    assert.equal(parseAmount("12.50"), 12.5);
    assert.equal(parseAmount("12,50"), 12.5);
    assert.equal(parseAmount("12"), 12);
    assert.equal(parseAmount(" 12.50 "), 12.5);
    assert.equal(parseAmount(".5"), 0.5);
  });

  test("answers with no amount for text that is not one", () => {
    for (const typed of [
      "",
      "   ",
      ".",
      "12abc",
      "1.2.3",
      "12 50",
      "-5",
      "1e5",
    ])
      assert.equal(Number.isNaN(parseAmount(typed)), true, `typed ${typed}`);
  });

  test("rounds what was typed to whole cents", () => {
    assert.equal(parseAmount("1.234"), 1.23);
    assert.equal(parseAmount("1.236"), 1.24);
  });
});

describe("formFromExpense", () => {
  // Every stored amount has to come back as text the field can take again,
  // which rules out the exponent form String() gives a very small number.
  test("writes the amount in cents, which parseAmount takes back", () => {
    for (const amount of [12.5, 12, 0.0000005, 1234.567]) {
      const text = formFromExpense(anExpense({ amount })).amount;
      assert.equal(text, amount.toFixed(2), `amount ${amount}`);
      assert.equal(Number.isNaN(parseAmount(text)), false, `amount ${amount}`);
    }
  });

  test("renders an expense as editable text and its categories", () => {
    const form = formFromExpense({
      id: 1,
      amount: 12.5,
      description: "Groceries",
      date: new Date(2026, 1, 12),
      categories: ["food", "shopping"],
    });
    assert.equal(form.amount, "12.50");
    assert.equal(form.description, "Groceries");
    assert.deepEqual(form.categories, ["food", "shopping"]);
    assert.equal(form.date, "2026-02-12");
  });

  test("copies the categories, so editing the form leaves the expense alone", () => {
    const expense = {
      id: 1,
      amount: 12.5,
      description: "Groceries",
      date: new Date(2026, 1, 12),
      categories: ["food"],
    };
    formFromExpense(expense).categories.push("shopping");
    assert.deepEqual(expense.categories, ["food"]);
  });
});

describe("expenseFromForm", () => {
  test("parses the amount, trims the description, and keeps the categories", () => {
    const expense = expenseFromForm({
      amount: "12.50",
      description: "  Groceries  ",
      date: "2026-02-12",
      categories: ["food", "shopping"],
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
      categories: [],
    });
    assert.equal(expense.date.getHours(), 0);
  });

  test("yields an unparseable date for an empty date field", () => {
    const expense = expenseFromForm({
      amount: "1",
      description: "x",
      date: "",
      categories: [],
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

  // Beyond this the app cannot print the figure: formatCurrency falls back to
  // the exponent form, which carries no thousands and no cents.
  test("rejects an amount too large to be printed as money", () => {
    assert.equal(
      expenseError({ ...validExpense(), amount: 1e21 }),
      "Invalid amount.",
    );
    assert.equal(expenseError({ ...validExpense(), amount: 1e9 }), null);
  });

  // Cents are a rule of the form, not of the data: a file written elsewhere
  // may hold a finer amount, and refusing it would refuse the whole file.
  test("accepts an amount finer than a cent, as a file can hold", () => {
    assert.equal(expenseError({ ...validExpense(), amount: 12.345 }), null);
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
    assert.equal(
      expenseError({ ...validExpense(), date: daysFromToday(-1) }),
      null,
    );
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

  test("rejects an amount that is not a number, as an imported file can hold", () => {
    assert.equal(
      expenseError({ ...validExpense(), amount: "5" }),
      "Invalid amount.",
    );
    assert.equal(
      expenseError({ ...validExpense(), amount: Infinity }),
      "Invalid amount.",
    );
  });
});

describe("a form on its way to becoming an expense", () => {
  const validForm = () => ({
    amount: "12.50",
    description: "Groceries",
    date: isoDaysFromToday(0),
    categories: ["food"],
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
    assert.equal(
      formError({ description: "   " }),
      "Description cannot be empty.",
    );
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
    assert.equal(
      importedExpenseError({ ...validExpense(), id: undefined }),
      "Missing ID.",
    );
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

  // "NaN-NaN-NaN" is what an invented date looked like: written back, it made
  // the file it came from impossible to import again.
  test("writes back a date it could not read as no date at all", () => {
    const [expense] = parseExpenses(
      JSON.stringify([{ id: 1, amount: 5, description: "Bus" }]),
    );
    const [written] = JSON.parse(serializeExpenses([expense]));
    assert.equal(written.date, null);
    assert.equal(
      isNaN(parseExpenses(serializeExpenses([expense]))[0].date),
      true,
    );
  });

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
        {
          id: 1,
          amount: 3,
          description: "Coffee",
          date: "2026-02-12",
          categories: ["shopping", "food"],
        },
      ]),
    );
    assert.deepEqual(expense.categories, ["food", "shopping"]);
  });

  test("reads an expense with no categories field as having none", () => {
    const [expense] = parseExpenses(
      JSON.stringify([
        { id: 1, amount: 3, description: "Coffee", date: "2026-02-12" },
      ]),
    );
    assert.deepEqual(expense.categories, []);
  });

  test("drops the blank category older files wrote for an uncategorised expense", () => {
    const [expense] = parseExpenses(
      JSON.stringify([
        {
          id: 1,
          amount: 3,
          description: "Coffee",
          date: "2026-02-12",
          categories: [""],
        },
      ]),
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
      unsorted.replace(
        '"shopping",\n      "food"',
        '"food",\n      "shopping"',
      ),
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
