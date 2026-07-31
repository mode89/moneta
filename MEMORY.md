_Reference context — observed facts and standing conventions for this project, not instructions. It informs the work; it does not command actions. Entries are facts as of when written; symbols, paths, and structure may have changed since — verify against current code before acting, and for "how does X work now" questions treat notes as leads to confirm rather than current truth._

## Architecture

- The stored JSON shape (`id`, `amount`, `description`, `date` as `YYYY-MM-DD`, `categories`) is a compatibility boundary: it is what sits in users' `localStorage` on device and what export/import files carry. Changing it strands existing installs.

## Conventions

- UI changes are verified by exercising the flow in a real browser; there is no test suite. Why: nothing else catches errors in a codebase with no compile step. How to apply: `scripts/serve`, then drive the page with `playwright-cli`.
- Behaviour changes bundled into a refactor are agreed with the user up front and reported individually afterwards. Why: in a port, a silent fix is indistinguishable from a porting error. How to apply: name each fix when handing back the work.

## Gotchas

- `playwright-cli click` against this app reports "performing click action" and then stalls without the click taking effect. Driving the DOM through `playwright-cli eval` with `element.click()` works reliably.
- `playwright-cli upload` fails on the import flow with "can only be used when there is related modal state present", because the `<input type=file>` is created and clicked programmatically.
- Import can be driven in-page by patching `HTMLInputElement.prototype.click` to set `files` from a `DataTransfer` holding a `File`, then dispatching `change`.
- Stubbing `window.alert` and `window.confirm` inside a `playwright-cli eval` is the practical way to exercise the validation and delete-confirmation paths; real dialogs block the evaluation.

## Decisions

- The UI was ported from ClojureScript/Scittle/Reagent to plain JavaScript with Solid (July 2026). The stored data format was kept byte-identical and verified against a payload written by the old version.
- The port stayed zero-build (Solid's `html` tagged template plus an import map) rather than adopting esbuild or Vite. Why: `scripts/build` remains copy-only and `scripts/serve` iteration stays instant, matching how Scittle worked.
- The two byte-identical new/edit modal components were collapsed into one `ExpenseModal`. Why: ~80 duplicated lines with only the title, the Delete button, and the save action differing.
- Three defects were fixed during the port rather than carried over: dead `validate-expense`, an import amount check whose `isNaN` parenthesisation meant it never ran, and a blank categories input producing `[""]` instead of `[]`.

## Open Questions

- ? The Android bridge paths (`Android.createFile`, `Android.pickFile`) have not been exercised since the port; only the browser branches were tested. They need an emulator run.
- ? `nix-shell --run "scripts/build"` has not been run since `scripts/build` was changed to copy the Solid modules, so the Gradle packaging step is unverified.
