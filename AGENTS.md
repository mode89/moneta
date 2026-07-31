# AGENTS.md

Moneta is an Android expense tracker. The entire user interface is a web app (plain JavaScript ES modules with Solid, loaded straight from source by the browser) rendered inside a single Android `WebView`. There is no native UI and no server: expenses live in the browser's `localStorage` on the device.

## Layout

* `web/main.js` — the whole app: state, UI components, persistence, import/export.
* `web/index.html` — page shell, custom CSS, import map, module script tag. `%VERSION%` is substituted at build time.
* `web/package.json` — npm deps used purely as a source of static assets (Bootstrap, Solid, Material icons).
* `android/src/main/java/net/akrain/moneta/MainActivity.java` — WebView host plus the `Android` JavaScript bridge (file save/pick).
* `android/src/main/assets/web/` — generated; build output copied here, not in git.
* `scripts/` — `build`, `install`, `serve`, `emulator`.
* `shell.nix` — Android SDK, Gradle (JDK 17), Node.js.

## Working in the Nix shell

The project pins its toolchain, so use plain `nix-shell` rather than `--packages`:

```
nix-shell --run "scripts/build"
```

`scripts/build` needs `$AAPT2`, which `shell.nix` exports; running it outside the shell will fail.

## Development loop

* `scripts/serve` serves `android/src/main/assets/web` on port 8080 for browser-based iteration. It serves the *built* assets, so run `scripts/build` first (or edit the copied `main.js` and re-copy). It sends no cache headers, so Chrome will happily serve a stale `main.js`; force a hard reload after editing (a query string on the page URL does not change the module's own URL, so it stays cached).
* `scripts/build` builds the web bundle, copies it into the Android assets, then runs `gradle build`.
* `scripts/install` installs the debug APK via `adb install -r`.
* `scripts/emulator` creates the `moneta` AVD if missing and starts it.

* `scripts/test` runs the unit tests in `web/test/` with Node's built-in runner, under two timezones. No linter is configured.

The tests cover the domain layer of `main.js` (validation, form conversion, stored JSON, store actions, import) but not the Solid components, so also verify UI changes by loading the app (browser via `scripts/serve`, or emulator) and exercising the affected flow.

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
