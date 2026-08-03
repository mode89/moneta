// One run through the app the way it is actually used, start to finish.
import {
  test,
  expect,
  downloadedText,
  exportFile,
  importFile,
} from "./fixtures.js";

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

  await expect(app.rows).toHaveCount(3);
  await expect(app.listedDays).toHaveText(["Today", "9 February"]);
  await expect(app.listedDescriptions).toHaveText([
    "Cinema",
    "Coffee",
    "Weekly shop",
  ]);
  await expect(app.dayTotal("Today")).toHaveText("$20.80");
  await expect(app.totalSpent).toHaveText("$62.90");
  await expect(app.expenseCount).toHaveText("3 expenses");

  // What has the food been costing? The chips answer, then let it go.
  await app.legendChip("food").click();
  await expect(app.listedDescriptions).toHaveText(["Weekly shop"]);
  await expect(app.totalSpent).toHaveText("$42.10");
  await app.legendChip("food").click();
  await expect(app.rows).toHaveCount(3);

  // The cinema ticket cost more than remembered, and the popcorn counts too.
  await app.openExpense("Cinema");
  await app.fillForm({ amount: "23.50", categories: "fun snacks" });
  await app.submit();
  await expect(app.amountOf("Cinema")).toHaveText("23.50");
  await expect(app.categoriesOf("Cinema")).toHaveText("fun · snacks");
  await expect(app.totalSpent).toHaveText("$68.40");

  // The coffee was someone else's round.
  await app.openExpense("Coffee");
  await app.deleteButton.click();
  await expect(app.cardBody).toHaveText(
    "Coffee, $2.80 on 12 February. This cannot be undone.",
  );
  await app.confirmButton.click();
  await expect(app.expenseItem("Coffee")).toHaveCount(0);
  await expect(app.totalSpent).toHaveText("$65.60");

  // Check the numbers, then hide them again.
  await app.totalSpentRow.click();
  await expect(app.totalSpent).toHaveClass("");
  await app.totalSpentRow.click();
  await expect(app.totalSpent).toHaveClass("blur-text");

  const backup = await downloadedText(await exportFile(app));
  expect(JSON.parse(backup)).toEqual([
    expect.objectContaining({ description: "Weekly shop", amount: 42.1 }),
    expect.objectContaining({ description: "Cinema", amount: 23.5 }),
  ]);
  await app.closeSettings();

  // A reload brings everything back from the device.
  await page.reload();
  await expect(app.rows).toHaveCount(2);
  await expect(app.totalSpent).toHaveText("$65.60");

  // A stray import wipes it out; the backup puts it back.
  await importFile(app, { content: "[]" });
  await expect(app.emptyMessage).toBeVisible();

  await importFile(app, { content: backup });
  await expect(app.rows).toHaveCount(2);
  await expect(app.totalSpent).toHaveText("$65.60");
  expect(await app.storedJson()).toBe(backup);
  expect(dialogs.messages).toEqual([]);
});
