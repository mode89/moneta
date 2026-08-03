// One run through the app the way it is actually used, start to finish.
import { test, expect, downloadedText, importFile } from "./fixtures.js";

test("a week of spending, exported and imported back", async ({
  app,
  page,
  dialogs,
}) => {
  await app.open({ now: "2026-02-12T12:00:00Z" });
  await expect(app.emptyMessage).toBeVisible();

  await app.addExpense({
    amount: "42.10",
    description: "Weekly shop",
    date: "2026-02-09",
    categories: "food",
  });
  // The clock is stopped, so it is nudged between saves: an id is the moment
  // the expense was created, and a day lists its expenses newest first.
  await app.tick();
  await app.addExpense({
    amount: "2.80",
    description: "Coffee",
    date: "2026-02-12",
    categories: "drinks",
  });
  await app.tick();
  await app.addExpense({
    amount: "18.00",
    description: "Cinema",
    date: "2026-02-12",
    categories: "fun",
  });

  await expect(app.expenseItems).toHaveCount(3);
  await expect(app.listedDays).toHaveText(["2026-02-12", "2026-02-09"]);
  await expect(app.listedDescriptions).toHaveText([
    "Cinema",
    "Coffee",
    "Weekly shop",
  ]);
  await expect(app.dayTotal("2026-02-12")).toHaveText("$20.80");
  await expect(app.totalSpent).toHaveText("$62.90");

  // The cinema ticket cost more than remembered, and the popcorn counts too.
  await app.openExpense("Cinema");
  await app.fillForm({ amount: "23.50", categories: "fun snacks" });
  await app.submit();
  await expect(app.amountOf("Cinema")).toHaveText("-$23.50");
  await expect(app.categoriesOf("Cinema")).toHaveText("fun, snacks");
  await expect(app.totalSpent).toHaveText("$68.40");

  // The coffee was someone else's round.
  dialogs.acceptAll();
  await app.openExpense("Coffee");
  await app.deleteButton.click();
  await expect(app.expenseItem("Coffee")).toHaveCount(0);
  await expect(app.totalSpent).toHaveText("$65.60");
  expect(dialogs.messages).toEqual(["Are you sure?"]);
  dialogs.clear();

  // Check the numbers, then hide them again.
  await app.totalSpentRow.click();
  await expect(app.totalSpent).toHaveClass("");
  await app.totalSpentRow.click();
  await expect(app.totalSpent).toHaveClass("blur-text");

  const download = page.waitForEvent("download");
  await app.exportButton.click();
  const backup = await downloadedText(await download);
  expect(JSON.parse(backup)).toEqual([
    expect.objectContaining({ description: "Weekly shop", amount: 42.1 }),
    expect.objectContaining({ description: "Cinema", amount: 23.5 }),
  ]);

  // A reload brings everything back from the device.
  await page.reload();
  await expect(app.expenseItems).toHaveCount(2);
  await expect(app.totalSpent).toHaveText("$65.60");

  // A stray import wipes it out; the backup puts it back.
  await importFile(app, { content: "[]" });
  await expect(app.emptyMessage).toBeVisible();

  await importFile(app, { content: backup });
  await expect(app.expenseItems).toHaveCount(2);
  await expect(app.totalSpent).toHaveText("$65.60");
  expect(await app.storedJson()).toBe(backup);
  expect(dialogs.messages).toEqual([]);
});
