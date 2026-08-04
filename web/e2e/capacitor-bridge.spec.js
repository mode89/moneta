// Inside the app Capacitor's WebView makes the platform native, and exporting
// writes a file and offers it to the system share sheet instead of handing it
// to the browser's downloads. Importing takes the same path on both, so the
// only thing to prove there is that no native call happens. Neither bridge nor
// plugins exist in a plain browser, so both branches have to keep working.
import {
  test,
  expect,
  nativeCalls,
  failNextCallTo,
  chooseFileToImport,
} from "./fixtures.js";

const FEBRUARY = "2026-02-12T12:00:00Z";

const stored = [
  {
    id: 1,
    amount: 12.5,
    description: "Groceries",
    date: "2026-02-12",
    categories: ["food"],
  },
];

const imported = [
  {
    id: 10,
    amount: 5,
    description: "Bus",
    date: "2026-02-11",
    categories: ["travel"],
  },
];

test.describe("on the native platform", () => {
  test.beforeEach(async ({ app }) => {
    await app.open({ now: FEBRUARY, expenses: stored, native: true });
    await app.openSettings();
  });

  test("export writes the file and shares it, without a download", async ({
    app,
    page,
  }) => {
    let downloads = 0;
    page.on("download", () => (downloads += 1));

    await app.exportRow.click();

    await expect.poll(() => nativeCalls(page)).toHaveLength(2);
    const [write, share] = await nativeCalls(page);
    expect(write.plugin).toBe("Filesystem");
    expect(write.method).toBe("writeFile");
    expect(write.options.path).toBe("moneta-2026-02-12.json");
    expect(write.options.directory).toBe("CACHE");
    expect(JSON.parse(write.options.data)).toEqual(stored);
    expect(share.plugin).toBe("Share");
    expect(share.method).toBe("share");
    expect(share.options.url).toBe("file:///cache/moneta-2026-02-12.json");
    expect(downloads).toBe(0);
    await expect(page.locator("a[download]")).toHaveCount(0);
  });

  test("a failure to write the file is reported", async ({
    app,
    page,
    dialogs,
  }) => {
    await failNextCallTo(page, "Filesystem", "No space left");

    await app.exportRow.click();

    await dialogs.expectMessage("Failed to export expenses: No space left");
    expect(await nativeCalls(page)).toHaveLength(1);
  });

  test("dismissing the share sheet says nothing", async ({
    app,
    page,
    dialogs,
  }) => {
    await failNextCallTo(page, "Share", "Share canceled");

    await app.exportRow.click();

    await expect.poll(() => nativeCalls(page)).toHaveLength(2);
    await dialogs.expectNone();
  });

  test("import goes through the file input, not through a plugin", async ({
    app,
    page,
  }) => {
    await app.closeSettings();

    await chooseFileToImport(app, { content: JSON.stringify(imported) });

    await expect(app.cardBody).toHaveText(
      "moneta.json holds 1 expense. Importing removes the 1 expense on this device and cannot be undone.",
    );
    expect(await nativeCalls(page)).toEqual([]);
  });

  test("everything else still works", async ({ app }) => {
    await app.closeSettings();

    await app.addExpense({
      amount: "5",
      description: "Bus",
      date: "2026-02-12",
    });

    await expect(app.expenseItem("Bus")).toBeVisible();
    await expect(app.totalSpent).toHaveText("$17.50");
  });
});

test.describe("in a plain browser", () => {
  test("export falls back to a browser download", async ({ app, page }) => {
    await app.open({ now: FEBRUARY, expenses: stored });
    await app.openSettings();

    const download = page.waitForEvent("download");
    await app.exportRow.click();

    expect((await download).suggestedFilename()).toBe("moneta-2026-02-12.json");
    expect(await page.evaluate(() => window.Capacitor.isNativePlatform())).toBe(
      false,
    );
  });
});
