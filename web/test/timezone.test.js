import { test, describe, mock } from "node:test";
import assert from "node:assert/strict";

import {
  blankExpenseForm,
  expenseError,
  expenseFromForm,
  formFromExpense,
  formatDay,
  groupByDay,
  isSameMonth,
  parseExpenses,
  parseIsoDate,
  serializeExpenses,
  toIsoDate,
} from "../main.js";

// A date the user types is local, and the stored YYYY-MM-DD names that local
// day. Anything that reaches UTC on the way shifts the day one way east of the
// meridian and the other way west, so these run the whole chain in five zones
// at the hours where such a shift changes the date.
const ZONES = [
  "UTC",
  "Asia/Kolkata", // +5:30, off the hour
  "America/New_York", // -5, observes DST
  "Pacific/Kiritimati", // +14, the far edge
  "Pacific/Niue", // -11, the near edge
];

const INSTANTS = [
  { label: "just after midnight", parts: [2026, 6, 14, 0, 30] },
  { label: "late evening", parts: [2026, 6, 14, 21, 30] },
  { label: "the last evening of the month", parts: [2026, 6, 31, 23, 30] },
  { label: "the first minutes of the month", parts: [2026, 7, 1, 0, 30] },
];

for (const zone of ZONES) {
  for (const { label, parts } of INSTANTS) {
    describe(`in ${zone}, ${label}`, () => {
      const [year, month, day] = parts;
      const iso = `${year}-${pad(month + 1)}-${pad(day)}`;

      test("a new expense is dated today and is not in the future", () => {
        atLocalTime(zone, parts, () => {
          const form = blankExpenseForm();
          assert.equal(form.date, iso);

          const expense = expenseFromForm({
            ...form,
            amount: "10",
            description: "Coffee",
          });
          assert.equal(expenseError(expense), null);
        });
      });

      test("a typed date survives storage unchanged", () => {
        atLocalTime(zone, parts, () => {
          const expense = expenseFromForm({
            amount: "10",
            description: "Coffee",
            date: iso,
            categories: [],
          });
          const [restored] = parseExpenses(
            serializeExpenses([{ id: 1, ...expense }]),
          );
          assert.equal(toIsoDate(restored.date), iso);
          assert.equal(formFromExpense(restored).date, iso);
        });
      });

      test("today's expense groups under today, in this month", () => {
        atLocalTime(zone, parts, () => {
          const expense = { id: 1, amount: 10, description: "Coffee" };
          const [group] = groupByDay([{ ...expense, date: parseIsoDate(iso) }]);
          assert.equal(toIsoDate(group.date), iso);
          assert.equal(formatDay(group.date, new Date()), "Today");
          assert.equal(isSameMonth(group.date, new Date()), true);
        });
      });
    });
  }
}

// Node reads TZ on each date operation, so the zone can change inside a
// process; the clock is fixed as well, since the hours that expose a UTC slip
// are rarely the hours a test suite runs at.
function atLocalTime(zone, [year, month, day, hour, minute], body) {
  const previousZone = process.env.TZ;
  process.env.TZ = zone;
  try {
    const instant = new Date(year, month, day, hour, minute);
    mock.timers.enable({ apis: ["Date"], now: instant.getTime() });
    try {
      body();
    } finally {
      mock.timers.reset();
    }
  } finally {
    process.env.TZ = previousZone;
  }
}

function pad(number) {
  return String(number).padStart(2, "0");
}
