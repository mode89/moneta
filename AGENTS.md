# AGENTS.md

Moneta is an Android expense tracker. The entire user interface is a web app (plain JavaScript ES modules with Solid, loaded straight from source by the browser) rendered inside a single Android `WebView`. There is no native UI and no server: expenses live in the browser's `localStorage` on the device.

## Layout

* `web/main.js` — the whole app: state, UI components, persistence, import/export.
* `web/index.html` — page shell, custom CSS, import map, module script tag. `%VERSION%` is substituted at build time.
* `web/package.json` — npm deps used purely as a source of static assets (Bootstrap, Solid, Material icons), plus `@playwright/test` for the UI suite.
* `web/test/` — Node unit tests over the domain layer of `main.js`.
* `web/e2e/` — Playwright UI suite: `fixtures.js` (page object, dialog recorder, seeding), `server.js` (serves the app for the tests), and the specs. `web/playwright.config.js` configures it.
* `android/src/main/java/net/akrain/moneta/MainActivity.java` — WebView host plus the `Android` JavaScript bridge (file save/pick).
* `android/src/main/assets/web/` — generated; build output copied here, not in git.
* `justfile` — every development command; `just` alone lists them.
* `scripts/emulator` — AVD creation and emulator start, called by `just emulator`.
* `shell.nix` — Android SDK, Gradle (JDK 17), Node.js, `just`.

## Working in the Nix shell

The project pins its toolchain, so use plain `nix-shell` rather than `--packages`, and drive everything through `just` inside it:

```
nix-shell --run "just build"
```

`just build` needs `$AAPT2`, which `shell.nix` exports; running it outside the shell will fail.

## Development loop

`just` with no recipe lists what follows. `just` hides `npm`, `gradle` and `adb`: no recipe needs them run by hand.

* `just serve` refreshes the web assets, then serves `android/src/main/assets/web` on port 8080 for browser-based iteration. It sends no cache headers, so Chrome will happily serve a stale `main.js`; force a hard reload after editing (a query string on the page URL does not change the module's own URL, so it stays cached).
* `just build` copies the web app into the Android assets (`build-web`), then packages the APK (`build-android`). Either half can be run alone.
* `just install` checks that a device is attached, builds, then installs the debug APK. With no device it says so and stops before the build.
* `just emulator` creates the `moneta` AVD if missing and starts it, in the foreground.

* `just test` runs the unit tests in `web/test/` with Node's built-in runner, under two timezones. No linter is configured.
* `just test-browser` runs the Playwright UI suite in `web/e2e/`, also under two timezones (one Chromium project each for Asia/Kolkata and America/New_York). It passes its arguments to Playwright, so `just test-browser --project=east-of-utc add-expense --headed` works. It starts its own server on port 8099 from `web/e2e/server.js`, which serves `web/index.html`, `web/main.js` and the four Solid modules under the same names `build-web` gives them — so no build is needed, and the import map resolves exactly as it does on the device.

The unit tests cover the domain layer of `main.js` (validation, form conversion, stored JSON, store actions, import); the Playwright suite covers the Solid components and the flows through them (adding, editing, deleting, grouping and totals, blurred amounts, persistence and reload, import/export in both the browser and the Android branch). Between them a UI change should be provable without a device, but a change to the bridge itself still needs an emulator run.

Writing UI tests: `web/e2e/fixtures.js` holds a `MonetaApp` page object with the locators, `app.open({ expenses, now, android })` for seeding `localStorage`, fixing the clock and installing a stand-in bridge before the page loads, and a `dialogs` fixture — the app talks to the user through `alert` and `confirm`, which Playwright dismisses unless a test says `dialogs.acceptAll()`.

Also, if you need to control browser, you can use `playwright-cli`:

```
cd web
npm install @playwright/cli@latest
curl http://localhost:9222/json/version # confirm browser is running
npx playwright-cli attach --cdp=http://localhost:9222 # attach to running browser
npx playwright-cli --help # for usage
```

## JavaScript conventions in `main.js`

* There is no bundler and no compile step. The browser loads `main.js` as an ES module and resolves `solid-js`, `solid-js/web`, `solid-js/store` and `solid-js/html` through the import map in `index.html`; `scripts/build` copies those four files out of `node_modules` under the matching names. Mistakes surface as runtime errors in the console.
* Markup uses Solid's `html` tagged template (no JSX, since JSX would need a compile step).
* State is module level: a `createStore` array of expenses plus `createSignal`s `editedExpense` (an id, `NEW_EXPENSE`, or `null` — the one signal behind both dialogs), `showNumbers`, `saveNotice`.
* Top-down ordering: `main` and `App` first, then components, then actions, then persistence, then small utilities (`toIsoDate`, `formatCurrency`, `beginningOfDay`, `now`, ...). Function declarations hoist, so no forward declarations are needed.
* Dates are `Date` objects in state, ISO `YYYY-MM-DD` strings in JSON and in the modal's form. `parseIsoDate` / `toIsoDate` convert; `parseIsoDate` builds from local parts because `new Date("YYYY-MM-DD")` reads the text as UTC.
* A form holds what the user typed (all strings); `expenseFromForm` is the only place it becomes an expense, and `expenseError` validates the expense — the same check the import path runs.
* Every mutation that should persist calls `saveExpenses`, which also triggers the "Saved" bubble.

### Two traps in `solid-js/html`

* A zero-argument function passed as a **component** prop is turned into a reactive getter and invoked on access, so it cannot be a callback. `ExpenseModal` therefore receives one `actions` object (`save`, `remove`, `close`) rather than separate `onSave` / `onClose` props. Element handlers (`onClick=${...}`) are unaffected.
* Anything read from the store while building a component's props becomes a dependency of the surrounding expression. Reading the edited expense out of the store must stay inside `untrack`, or deleting it re-runs the expression with a stale id and throws.

## The Android bridge

`Android` is injected only inside the app; in a plain browser it is absent, so code paths branch on `window.Android` (see `exportExpenses` / `importExpenses`). Test the global as a property of `window`, not as a bare identifier, which would throw a `ReferenceError`. Keep both branches working.

`Android.pickFile` is defined in JavaScript that `MainActivity` evaluates into the page after load; it wraps the async `___pickFile` / `___pickFileResult` callback pair. Changing one side requires changing the other.

## Generated files — do not edit

`build/`, `android/build/`, and `android/src/main/assets/web/` are all build output.

**Memory — read first.** Read `MEMORY.md` at the start of each session, before your first response — it records facts about this project, its conventions, landmines, dead ends, and decision rationale you can't recover from the code. Skipping it risks repeating solved mistakes.
