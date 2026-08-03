_Reference context — observed facts and standing conventions for this project, not instructions. It informs the work; it does not command actions. Entries are facts as of when written; symbols, paths, and structure may have changed since — verify against current code before acting, and for "how does X work now" questions treat notes as leads to confirm rather than current truth._

## Architecture

- The stored JSON shape (`id`, `amount`, `description`, `date` as `YYYY-MM-DD`, `categories`) is a compatibility boundary: it is what sits in users' `localStorage` on device and what export/import files carry. Changing it strands existing installs.
- Categories are kept sorted at every entry point: `parseCategories` sorts typed input and `parseExpenses` sorts what it reads. Views therefore join them without sorting, and importing rewrites a file's category order.
- The Playwright suite in `web/e2e/` is the only written specification of the UI: its wording, grouping, totals, blur behaviour and dialog flows exist nowhere else in prose.

## Conventions

- `main.js` has no import-time side effects; `index.html`'s inline module imports `main` and calls it. Why: the Node test suite imports `main.js`, and only `render` needs a DOM. How to apply: keep new top-level code in `main.js` side-effect free.
- UI changes are verified in a real browser via `just test-browser`, the Playwright suite in `web/e2e/`; the Node unit tests cover only the domain layer. Why: nothing else catches wiring errors with no compile step.
- Exploratory poking at the UI goes through `just serve` plus `playwright-cli`, outside the Playwright suite.
- A claim about an animation is settled by sampling `getComputedStyle` at fixed delays through a press, not by eye or screenshot. Why: mid-transition values pinpointed two press-state stutters that screenshots could not show.
- A view with no suite coverage yet is checked by a throwaway Node script that seeds `localStorage`, fixes the clock and screenshots each state. Why: it sees what a locator assertion cannot.
- A runtime npm dependency reaches the browser through three lists kept in step: the `cp` block in `build-web`, `FILES` in `web/e2e/server.js`, and the import map in `web/index.html`. Why: no bundler, so a missing entry is a blank page.
- Playwright runs need no confirmation from the user: they start a local server, drive a headless browser and write files under `/tmp`.
- The UI suite reaches the app through `web/e2e/fixtures.js`, where locators live on the `MonetaApp` page object. Why: the app has no test hooks, so its markup is described in one place. How to apply: add locators there, not in a spec.
- `MonetaApp` helpers that describe rendered content expose a locator, not an awaited snapshot. Why: `expect(await …).toEqual(…)` compares plain values and never retries, so it reads the DOM mid-render.
- Lists rendered by the app are asserted with `expect(locator).toHaveText([...])`, which retries on both the element count and the texts.
- A change to the UI suite's timing is judged by running the whole suite ~50 times, not once. Why: the one flake found this way struck 2 runs in 50, which ten runs had called clean.
- Anything that must exist before `main()` runs — seeded expenses, a fixed clock, the `Android` bridge — is installed by `app.open()` in `web/e2e/fixtures.js`.
- A UI test that seeds dated expenses also fixes the clock with `open({ now })`. Why: an expense outside the current month renders as a fold line, not a row, so a real clock silently empties the list. How to apply: any spec with seeded dates.
- A new development command is added as a `just` recipe rather than a script in `scripts/`. Why: `just --list` is the single index of what can be run here. How to apply: any build, test, serve or device task.
- Design work is presented as five variations at a time, each naming its cost, in one self-contained static mockup file; the user locks in the pieces to keep. Why: costed alternatives converge faster than polishing a single option.
- Behaviour changes carried along with a larger change are agreed with the user up front and reported individually afterwards. Why: otherwise a silent fix is indistinguishable from a mistake.
- An edit is confirmed by re-reading the file, and a visual change by asserting the computed style in a browser, before it is reported as done. Why: an edit the tool reported as applied was later found absent, and the user hit the unfixed bug again.
- A defect found mid-task that was not part of the agreed scope is reported, not fixed. Why: it keeps an agreed change set reviewable. How to apply: work around it in tests and hand the decision back.

## Gotchas

- `MainActivity` has no `onBackPressed` override, so the Android back button finishes the activity — with a dialog open it closes the whole app rather than the dialog.
- A category is one lowercase word, since `parseCategories` splits on whitespace. The chip-style category input therefore commits on space, and two-word names are impossible without a storage-format change.
- In `solid-js/html`, reading a signal inside the expression that renders an `<input>` rebuilds that input on every keystroke and loses what was typed. Draft text has to live in a plain variable outside the reactive graph.
- `solid-js/html` drops the static whitespace between an element and the expression that follows it, so `<b>${n}</b> ${word}` renders as `1expense`; the space has to be part of the interpolated string.
- A CSS `gap` on a flex line hides missing text spacing: the page looks right while the DOM text runs the words together, which is what a screen reader and a copy-paste get.
- `android/src/main/assets/web/` holds build output that can lag `web/`, so the installed APK shows a stale UI until `just build` runs; a bug seen "in the app" may be a bug in old assets. `just serve` refreshes them first, so it is safe.
- `just build-web` and `web/e2e/server.js` copy and serve `bootstrap.css`, `file_download.svg` and `file_upload.svg`, which `web/index.html` no longer references.
- Two expenses added within the same millisecond receive the same `id`, after which `updateExpense` and `deleteExpense` act on both. Tapping the button cannot reach this; programmatic callers and tests can.
- `playwright-cli click` against this app reports "performing click action" and then stalls without the click taking effect. Driving the DOM through `playwright-cli eval` with `element.click()` works reliably.
- `playwright-cli upload` fails on the import flow with "can only be used when there is related modal state present", because the `<input type=file>` is created and clicked programmatically.
- Import can be driven in-page by patching `HTMLInputElement.prototype.click` to set `files` from a `DataTransfer` holding a `File`, then dispatching `change`.
- Stubbing `window.alert` and `window.confirm` inside a `playwright-cli eval` is the practical way to exercise the validation and confirmation paths; real dialogs block the evaluation.
- Under `@playwright/test` a `page.on("dialog")` listener handles the app's alerts; without one Playwright dismisses every dialog.
- Raw Playwright, unlike `@playwright/test`, dismisses no dialog on its own: a single `alert()` freezes the page and every later action waits for ever, so a script driving this app needs a `page.on("dialog")` handler.
- `just` has no file-timestamp dependency tracking, so `npm install` runs on every `test`, `test-browser` and `build-web` through the shared `deps` recipe, adding about 0.4s.
- A `just` recipe runs each line in a separate shell unless it starts with a `#!/usr/bin/env bash` shebang, so a multi-line recipe carrying variables needs one.
- Gradle in this sandbox fails at `:android:validateSigningDebug` with `?` in place of `$HOME` in the keystore path, and leaves a stray `?/` directory at the project root. Plain `gradle build` fails the same way, so it is not a build defect.
- `pkill -f <pattern>` kills the shell running it when the pattern also appears in that shell's own command line; the run then ends with no output and no side effects at all.
- Playwright's list and line reporters print the failed-test names *between* the "N failed" and "M passed" lines, so reading only the tail of a run shows a pass count and hides the failures above it.
- A UI test that stops the clock and then adds several expenses gives them all one id, because ids are creation timestamps. `app.tick()` in the e2e fixtures moves a fixed clock forward between saves.
- A `page.addInitScript` that seeds `localStorage` runs again on reload, so it has to write only when the key is absent; otherwise a reload restores the seed and hides what the app saved.
- Playwright's visibility ignores occlusion, so list rows behind the full-screen settings cover still count as visible; that a screen covers the app is provable only by comparing bounding boxes.
- Playwright's browsers come from Nix: `shell.nix` exports `PLAYWRIGHT_BROWSERS_PATH` to `pkgs.playwright.browsers`, and `just test-browser` downloads nothing.
- `shell.nix` exports `FONTCONFIG_FILE` via `pkgs.makeFontsConf`. Why: with no fontconfig config Chromium aborts in Skia ("SkFontMgr_FontConfigInterface.cpp: Not implemented") on the first text it shapes.
- A Chromium that dies mid-test reports as "Target page, context or browser has been closed" on whatever locator call was in flight; the real cause is the last `[pid=...][err]` line in the browser log.
- `web/node_modules/playwright` is a 1.62 alpha pulled in by `@playwright/cli`, and its Chromium build is absent from the Nix browser set. A script outside the suite imports `chromium` from `web/node_modules/@playwright/test/node_modules/playwright`.
- `@playwright/test` in `web/package.json` is pinned exact to the nixpkgs `playwright-driver` version, 1.59.1 as of July 2026.
- A Playwright release and a Chromium build number are a matched pair; when the npm version and the Nix browser set disagree, every test fails at launch with "Executable doesn't exist" naming a build absent from the store path.
- A nixpkgs bump that moves `playwright-driver` re-breaks the suite until `@playwright/test` is re-pinned to match; `nix-instantiate --eval -E 'with import <nixpkgs> {}; playwright-driver.version'` reads the version to pin to.

## Decisions

- The visual language excludes gradients, sharp-edged boxes and neo-brutalist styling; categories appear as pill chips throughout and the round floating `+` is kept.
- The palette is desk #EFE7DD, paper #FBF7F1, rule #DED2C4, sealing-wax #A33B28, ink #2F2A2A, with Fraunces for the month and totals and DM Sans for everything else.
- Category dots use six saturated "deep ink" tones: ochre #C79A4E, moss #7E9A78, plum #8E7BA6, brick #B7674F, teal #4F8A8B, denim #6B7FA8.
- A category's colour is `inks[hash(name) % 6]`, derived at render time and never stored. Why: `localStorage` and the export file stay exactly as they are, and a category's colour never drifts between devices.
- Colour picking is not offered and no colour is stored. Why: with six inks two categories collide about 44% of the time at four categories and 91% at five, and the design accepts collisions since the name sits beside every dot.
- Amounts always start blurred and one tap reveals them all until the app closes; no preference is persisted. Why: it keeps the app storing nothing but expenses.
- The list is unboxed — rows on paper divided by hairline rules — with the current month open and earlier months folded to one line carrying that month's count and total, refolded on every launch.
- Day headings read "Today"/"Yesterday" only inside the open month and plain dates elsewhere; the header total stays on the current month while an older month is unfolded.
- Category chips under the header act as filters, narrowing the header total, the average per day and the fold lines, with no status line naming the active filter.
- The chip row is one horizontally scrolling line. Why: it is the only place every category is reachable and filterable.
- A category filter applies to older months as well, so unfolding one while a filter is on shows only its matching rows.
- The add/edit dialog is a full bottom sheet, and it closes by tapping the dimmed area outside it, discarding silently. Why: back-button dismissal does not exist in a plain browser, where this UI is developed and tested.
- The header shows month, total, expense count and average per day, with no eyebrow label above the month. Why: a label restates the month line and only carries information while filtering.
- Settings sits behind a gear top-right and closes with a ✕ in the same corner, holding only Export, Import and the version.
- Sheet animation uses `solid-transition-group`'s `<Transition>`, not a hand-rolled `setTimeout` before unmount. Why: it is the package the Solid project publishes for this, and the duration then lives only in CSS.
- `<Transition>` runs in `mode="outin"`, so a reopened sheet waits for the leaving one. Why: simultaneous mode put two `.sheet` elements in the page at once and broke every locator that assumes one.
- Only the add/edit sheet animates; the confirmation cards and the settings screen still appear and vanish instantly.
- Settings holds no list of categories. Why: it would duplicate the header chips and could report a duplicate-name problem without offering rename, merge or delete to fix it.
- Delete and import are confirmed with wording that names what will be lost; the add/edit dialog is not.
- Chrome's blue tap highlight is suppressed app-wide and replaced by `:active` rules that darken the pressed surface one step in the palette. Why: nothing else in the design acknowledges a press.
- Only controls whose tap leads elsewhere carry a pressed style; the category chips and the month total have none, since a tap changes how they are drawn and the extra step was felt as a stutter.
- The app is zero-build — Solid's `html` tagged template plus an import map, no esbuild or Vite. Why: `just build-web` stays copy-only and `just serve` iteration is instant.
- Unit tests run in Node against functions exported from `main.js`, with no jsdom and no test framework. Why: all four Solid entry points import headless, so the domain layer needs only stubbed `localStorage` and `alert`.
- The add/edit sheet and the import path share one `expenseError` check, and the form's wording won: a blank imported description reports "Description cannot be empty."
- An expense with no `categories` field loads as one with none. Why: earlier versions blanked the app at startup on such data.
- Day headings call `formatDay(date, reference)`, which answers "Today", "Yesterday" or the day and month, while `toIsoDate` stays the storage format. Why: a heading is free to diverge from the way a date is stored.
- Fraunces and DM Sans load from Google Fonts at runtime, so a device with no network falls back to a system serif and sans. Why: self-hosting them would make `just build-web` copy font files.
- The Playwright suite serves the app from its own `web/e2e/server.js` rather than `just serve`. Why: `just serve` publishes the *built* assets, which would make the UI suite depend on a full Android build.
- `web/e2e/server.js` maps the app's URL names straight onto `web/` and `node_modules`, so the UI suite needs no build step and exercises `index.html` unchanged.
- The UI suite runs every spec twice, in Asia/Kolkata and America/New_York, as `just test` does. Why: the UI is full of dates, and a day that slips only west of the meridian must not pass unnoticed.
- Expectations about "today" in the UI suite are computed in the page, not in Node. Why: only the browser context carries the project's timezone.
- The Android bridge is exercised in the browser against a recording stand-in installed before load, not on a device. Why: it pins the JavaScript side of the contract, which is what a UI change can break.
- The bridge contract the UI suite pins is `Android.createFile(filename, json)` and `Android.pickFile(callback)`.
- The stand-in bridge in the UI suite leaves the Java side of `MainActivity` untested; that still needs an emulator run.
- Every development command lives in the `justfile`, run inside `nix-shell`, the boundary entered once per terminal. Why: `just` gives variadic argument passthrough and `--list` help, and hides npm, gradle and adb behind recipe names.
- `scripts/` holds only `emulator` after the five bash scripts were absorbed into `just` recipes. Why: it is Python and too large to inline in a recipe.
- `just build` splits into `build-web` and `build-android`, and `serve` depends only on `build-web`. Why: serving the app then needs no Gradle run, so it refreshes the assets itself and never shows stale ones.
- `just install` checks for an attached device before building, so it calls `just build` inside the recipe instead of declaring it a dependency. Why: a missing device then costs a second rather than a minute.

## Dead Ends

- ✗ Back-button dismissal for the dialog and settings was abandoned: it needs a Java `onBackPressed` bridge calling into the page, and still leaves plain-browser use with no way to close either.
- ✗ Assigning each category a random colour from the least-used tones was abandoned: it guarantees distinct colours but requires storing the assignments, cleaning them up when a category disappears, and reassigning on import.
- ✗ Visual directions explored and rejected for this app: greenbar ledger, thermal till roll, coin/ring, dark instrument gauge, and a neo-brutalist bar-chart list.
- ✗ A `prefers-reduced-motion` rule setting `transition: none` on the sheet was rejected: `Transition` unmounts on `transitionend`, which never fires without a transition. Honouring it needs an `onExit(el, done)` hook.
- ✗ A "Discard this expense?" confirmation on closing the add/edit dialog was designed and then dropped as noise for what is usually an empty form.
- ✗ direnv with `scripts/` on `PATH` as the command front door was rejected: direnv is not used here, and `test` and `install` collide with a shell builtin and a coreutils binary.
- ✗ A Makefile and a `./dev` dispatcher script were both rejected as the development front door: Make passes arguments only as `ARGS=`, and the dispatcher earned its keep only by hiding `nix-shell`, which is entered anyway.
- ✗ Moving `shell.nix` to a flake with `nix run .#…` apps was weighed and dropped: it types longer rather than shorter, and re-opens the `playwright-driver` version pinning.

## Open Questions

- ? Whether to self-host Fraunces and DM Sans rather than fetch them from Google Fonts is undecided; as it stands the app needs the network for its typefaces.
- ? No screen totals a category across months; the header chips are per-month only.
- ? Whether expense ids should stop being raw creation timestamps is undecided. A collision-free scheme has to preserve same-day sort order, which currently relies on ids increasing with creation time.
- ? The Android bridge paths (`Android.createFile`, `Android.pickFile`) have never been exercised on a device; only the browser branches are tested. They need an emulator run.
- ? The Gradle packaging step is unverified: `just build-android` has never completed here, since this sandbox breaks it at `:android:validateSigningDebug`.
