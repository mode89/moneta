_Reference context — observed facts and standing conventions for this project, not instructions. It informs the work; it does not command actions. Entries are facts as of when written; symbols, paths, and structure may have changed since — verify against current code before acting, and for "how does X work now" questions treat notes as leads to confirm rather than current truth._

## Architecture

- The stored JSON shape (`id`, `amount`, `description`, `date` as `YYYY-MM-DD`, `categories`) is a compatibility boundary: it is what sits in users' `localStorage` on device and what export/import files carry. Changing it strands existing installs.
- Categories are kept sorted at every entry point: `parseCategories` sorts typed input and `parseExpenses` sorts what it reads. Views therefore join them without sorting, and importing rewrites a file's category order.

## Conventions

- `main.js` has no import-time side effects; `index.html`'s inline module imports `main` and calls it. Why: the Node test suite imports `main.js`, and only `render` needs a DOM. How to apply: keep new top-level code in `main.js` side-effect free.
- UI changes are verified in a real browser; the Node unit tests cover only the domain layer. Why: nothing else catches wiring errors with no compile step. How to apply: `scripts/e2e` runs the Playwright suite in `web/e2e/` (July 2026); for exploratory poking, `scripts/serve` plus `playwright-cli`.
- The UI suite reaches the app through `web/e2e/fixtures.js`: locators live on the `MonetaApp` page object, and anything that must exist before `main()` runs — seeded expenses, a fixed clock, the `Android` bridge — is set up by `app.open()`. Why: the app carries no test hooks, so the markup it happens to render is described in one place. How to apply: add locators and setup there rather than in a spec.
- Behaviour changes bundled into a refactor are agreed with the user up front and reported individually afterwards. Why: in a port, a silent fix is indistinguishable from a porting error. How to apply: name each fix when handing back the work.
- A defect found mid-task that was not part of the agreed scope is reported, not fixed. Why: it keeps an agreed change set reviewable. How to apply: work around it in tests and hand the decision back.

## Gotchas

- Two expenses added within the same millisecond receive the same `id`, after which `updateExpense` and `deleteExpense` act on both. Tapping the button cannot reach this; programmatic callers and tests can.
- `playwright-cli click` against this app reports "performing click action" and then stalls without the click taking effect. Driving the DOM through `playwright-cli eval` with `element.click()` works reliably.
- `playwright-cli upload` fails on the import flow with "can only be used when there is related modal state present", because the `<input type=file>` is created and clicked programmatically.
- Import can be driven in-page by patching `HTMLInputElement.prototype.click` to set `files` from a `DataTransfer` holding a `File`, then dispatching `change`.
- Stubbing `window.alert` and `window.confirm` inside a `playwright-cli eval` is the practical way to exercise the validation and delete-confirmation paths; real dialogs block the evaluation. Under `@playwright/test` a `page.on("dialog")` listener does the same job, and without one Playwright dismisses every dialog — which reads as "no" to the delete confirmation.
- A UI test that stops the clock and then adds several expenses gives them all one id, because ids are creation timestamps. `app.tick()` in the e2e fixtures moves a fixed clock forward between saves.
- A `page.addInitScript` that seeds `localStorage` runs again on reload, so it has to write only when the key is absent; otherwise a reload restores the seed and hides what the app saved.
- `@playwright/test` must match the Chromium build already downloaded, or every test fails at launch with "Executable doesn't exist"; `npx playwright install chromium` (what `scripts/e2e` runs) fetches the matching one.

## Decisions

- The UI was ported from ClojureScript/Scittle/Reagent to plain JavaScript with Solid (July 2026). The stored data format was kept byte-identical and verified against a payload written by the old version.
- The port stayed zero-build (Solid's `html` tagged template plus an import map) rather than adopting esbuild or Vite. Why: `scripts/build` remains copy-only and `scripts/serve` iteration stays instant, matching how Scittle worked.
- The two byte-identical new/edit modal components were collapsed into one `ExpenseModal`. Why: ~80 duplicated lines with only the title, the Delete button, and the save action differing.
- Three defects were fixed during the port rather than carried over: dead `validate-expense`, an import amount check whose `isNaN` parenthesisation meant it never ran, and a blank categories input producing `[""]` instead of `[]`.
- Unit tests run in Node against functions exported from `main.js`, with no jsdom and no test framework (July 2026). Why: all four Solid entry points import headless, so the domain layer needs only stubbed `localStorage` and `alert`.
- The modal and the import path share one `expenseError` check (July 2026), and the form's wording won: a blank imported description now reports "Description cannot be empty." rather than "Empty description."
- An expense with no `categories` field loads as one with none (July 2026). Why: both the pre-refactor code and the first sorting version blanked the app at startup on such data, so tolerating it is a deliberate improvement.
- Day headings call `formatDay`, a one-line delegate to `toIsoDate`, rather than `toIsoDate` itself. Why: the heading is free to stop looking like a stored date without touching the storage format.
- The Playwright suite serves the app from its own `web/e2e/server.js` rather than from `scripts/serve` (July 2026). Why: `scripts/serve` publishes the *built* assets, which would make the UI suite depend on a full Android build; the test server maps the same URL names straight onto `web/` and `node_modules`, so no build step is involved and `index.html` is exercised unchanged.
- The UI suite runs every spec twice, in Asia/Kolkata and America/New_York (July 2026), as `scripts/test` does. Why: the UI is full of dates, and a day that slips only west of the meridian must not pass unnoticed. How to apply: expectations about "today" are computed in the page, not in Node, since only the browser context carries the project's timezone.
- The Android bridge is exercised in the browser against a recording stand-in installed before load, not on a device (July 2026). Why: it pins the JavaScript side's contract — `Android.createFile(filename, json)` and `Android.pickFile(callback)` — which is what the port could break; the Java side still needs an emulator run.

## Open Questions

- ? Whether expense ids should stop being raw creation timestamps is undecided. A collision-free scheme has to preserve same-day sort order, which currently relies on ids increasing with creation time.
- ? The Android bridge paths (`Android.createFile`, `Android.pickFile`) have not been exercised since the port; only the browser branches were tested. They need an emulator run.
- ? `nix-shell --run "scripts/build"` has not been run since `scripts/build` was changed to copy the Solid modules, so the Gradle packaging step is unverified.
