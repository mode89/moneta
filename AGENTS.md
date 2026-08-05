# AGENTS.md

Moneta is an Android expense tracker. The entire user interface is a web app (plain JavaScript ES modules with Solid, loaded straight from source by the browser) rendered inside a Capacitor `WebView`. There is no native UI and no server: expenses live in the browser's `localStorage` on the device.

## Layout

The npm project sits at the repository root, which is the layout Capacitor expects: `package.json`, `capacitor.config.json`, `node_modules/` and `android/` are all there, and `webDir` is the plain subpath `build/web/dist`.

* `web/main.js` — the whole app: state, UI components, persistence, import/export.
* `web/index.html` — page shell, custom CSS, import map, module script tag. `%VERSION%` is substituted at build time.
* `package.json` — npm deps used purely as a source of static assets (Bootstrap, Solid, Material icons, `@capacitor/core`), the Capacitor packages whose Java `cap sync` compiles, and `@playwright/test` for the UI suite.
* `web/test/` — Node unit tests over the domain layer of `main.js`.
* `web/e2e/` — Playwright UI suite: `fixtures.js` (page object, dialog recorder, seeding), `server.js` (serves the app for the tests), and the specs. `playwright.config.js` configures it.
* `maestro/` — Maestro flows run on a device or emulator: `smoke.yaml` plus the four things a browser cannot show (`import.yaml`, `export.yaml`, `back-button.yaml`, `safe-area.yaml`).
* `android/` — the generated Capacitor project. `MainActivity` is an empty `BridgeActivity` subclass; there is no hand-written Java left. The Gradle wrapper was deleted, so builds use the `gradle` from `shell.nix`.
* `android/app/src/main/assets/public/` — generated; `cap sync` copies the built web app here, not in git.
* `justfile` — every development command; `just` alone lists them.
* `scripts/emulator` — AVD creation and emulator start, called by `just emulator`.
* `shell.nix` — Android SDK, Gradle, Node.js, `just`. Its shell hook also points `GRADLE_USER_HOME` and `ANDROID_USER_HOME` inside the working tree, under `.cache/`.

## Working in the Nix shell

The project pins its toolchain, so use plain `nix-shell` rather than `--packages`, and drive everything through `just` inside it:

```
nix-shell --run "just build"
```

`just build` needs `$AAPT2`, which `shell.nix` exports; running it outside the shell will fail.

## Development loop

`just` with no recipe lists what follows. `just` hides `npm`, `gradle` and `adb`: no recipe needs them run by hand.

* `just serve` refreshes the web assets, then serves `build/web/dist` on port 8080 for browser-based iteration. It sends no cache headers, so Chrome will happily serve a stale `main.js`; force a hard reload after editing (a query string on the page URL does not change the module's own URL, so it stays cached).
* `just build` builds the web app into `build/web/dist` (`build-web`), then packages the APK (`build-android`, which first runs `sync` for `npx cap sync android`). Either half can be run alone. Gradle runs with `--no-daemon`, so no build leaves a JVM behind.
* `just install` checks that a device is attached, builds, then installs the debug APK. With no device it says so and stops before the build.
* `just emulator` creates the `moneta` AVD if missing and starts it, in the foreground. It passes its arguments to the emulator, so `just emulator -no-window` runs it headless.

* `just test` runs the unit tests in `web/test/` with Node's built-in runner, in a pinned timezone. `web/test/timezone.test.js` sets its own zones and clock, so it is the one place that proves dates survive a change of timezone.
* `just lint` checks every JavaScript file in `web/` with ESLint (`eslint.config.js`, the recommended rule set plus per-area globals) and with Prettier in check mode. `just format` applies Prettier. `.prettierrc` fixes indentation at 2 spaces, forbids tabs and sets the line width to 80 columns, and turns `embeddedLanguageFormatting` off because it otherwise reformats the `html` tagged templates as HTML and mangles the Solid markup. `.prettierignore` excludes `index.html`, whose layout is hand-made around the import map, the custom CSS and the `%VERSION%` placeholder.
* `just test-browser` runs the Playwright UI suite in `web/e2e/` under one Chromium project, `phone`, whose timezone is pinned to Asia/Kolkata so dated tests do not depend on the machine. It passes its arguments to Playwright, so `just test-browser add-expense --headed` works. It starts its own server on port 8099 from `web/e2e/server.js`, which serves `web/index.html`, `web/main.js` and the copied modules under the same names `build-web` gives them — so no build is needed, and the import map resolves exactly as it does on the device.

* `just test-android` runs the Maestro flows in `maestro/`; a flow path can be given to run one. It leaves running whatever it found running and stops whatever it started: with no device attached it starts a headless emulator, waits for `sys.boot_completed` and kills it on exit, and it kills the `adb` server too if port 5037 was closed when it began. It logs the emulator to `build/maestro/emulator.log`, then installs the app through `just install`, so it builds first. It writes `build/maestro/moneta-import.json` dated today, pushes it to `/sdcard/Download/` and tells the media store about it, because `maestro/import.yaml` picks that file out of the system file picker. The five flows take about 1m40s. `maestro` comes from `shell.nix`.

The unit tests cover the domain layer of `main.js` (validation, form conversion, stored JSON, store actions, import); the Playwright suite covers the Solid components and the flows through them (adding, editing, deleting, grouping and totals, blurred amounts, persistence and reload, import/export in both the browser and the native branch). Between them a UI change should be provable without a device. The Maestro flows take the rest: the system file picker, the Share sheet, the back button and the packaged APK itself.

Writing UI tests: `web/e2e/fixtures.js` holds a `MonetaApp` page object with the locators, `app.open({ expenses, now, native })` for seeding `localStorage`, fixing the clock and installing a stand-in bridge before the page loads, and a `dialogs` fixture — the app talks to the user through `alert` and `confirm`, which Playwright dismisses unless a test says `dialogs.acceptAll()`.

Writing device flows: Maestro reads the WebView through the Android accessibility tree, where the app's own labels appear — `aria-label`, heading and button text, and each input named by its label in capitals, as the CSS uppercases it. A selector is a full-string regular expression, so a field carrying a value reads `12.5, AMOUNT` and needs `.*AMOUNT`; the label and the input both match, and the input is `index: 1`. `eraseText` deletes from the caret, which a tap puts where it lands: at the end of the left-aligned description, but before the right-aligned amount, where erasing then does nothing.

Also, if you need to control browser, you can use `playwright-cli`:

```
npm install @playwright/cli@latest
curl http://localhost:9222/json/version # confirm browser is running
npx playwright-cli attach --cdp=http://localhost:9222 # attach to running browser
npx playwright-cli --help # for usage
```

## JavaScript conventions in `main.js`

* There is no bundler and no compile step. The browser loads `main.js` as an ES module and resolves `@capacitor/core`, `solid-js`, `solid-js/web`, `solid-js/store`, `solid-js/html` and the transition packages through the import map in `index.html`. Every such module has to be named in **three lists that must stay in step**: the `cp` block in the `justfile`'s `build-web`, `FILES` in `web/e2e/server.js`, and the import map itself. A missing entry gives a blank page, not an error.
* Markup uses Solid's `html` tagged template (no JSX, since JSX would need a compile step).
* State is module level: a `createStore` array of expenses plus `createSignal`s `editedExpense` (an id, `NEW_EXPENSE`, or `null` — the one signal behind both dialogs), `showNumbers`, `saveNotice`.
* Top-down ordering: `main` and `App` first, then components, then actions, then persistence, then small utilities (`toIsoDate`, `formatCurrency`, `beginningOfDay`, `now`, ...). Function declarations hoist, so no forward declarations are needed.
* Dates are `Date` objects in state, ISO `YYYY-MM-DD` strings in JSON and in the modal's form. `parseIsoDate` / `toIsoDate` convert; `parseIsoDate` builds from local parts because `new Date("YYYY-MM-DD")` reads the text as UTC.
* A form holds what the user typed (all strings); `expenseFromForm` is the only place it becomes an expense, and `expenseError` validates the expense — the same check the import path runs.
* Every mutation that should persist calls `saveExpenses`, which also triggers the "Saved" bubble.

### Two traps in `solid-js/html`

* A zero-argument function passed as a **component** prop is turned into a reactive getter and invoked on access, so it cannot be a callback. `ExpenseModal` therefore receives one `actions` object (`save`, `remove`, `close`) rather than separate `onSave` / `onClose` props. Element handlers (`onClick=${...}`) are unaffected.
* Anything read from the store while building a component's props becomes a dependency of the surrounding expression. Reading the edited expense out of the store must stay inside `untrack`, or deleting it re-runs the expression with a stale id and throws.

## Reaching the native side

The app is served from `http://localhost` inside Capacitor and from a plain web server in a browser, so both branches have to keep working. `Capacitor.isNativePlatform()`, imported from `@capacitor/core`, tells them apart.

Only `@capacitor/core` is loadable without a bundler: its `dist/index.js` is one self-contained ES module. The plugin packages are not, so the app never loads their JavaScript; `registerPlugin("Filesystem")` from core alone returns a proxy wired straight to the native bridge, and the plugin packages stay in `node_modules` only so that `cap sync` compiles their Java. Their enums are unreachable too, so plain values such as `"CACHE"` are written out.

Exporting on the device writes the file to the cache directory with `Filesystem` and offers it with `Share`; Capacitor has no Save-As dialog. Importing has no native branch at all, because Capacitor's WebView answers `<input type="file">` with the system picker.

The app draws under the status and navigation bars. Capacitor's built-in `SystemBars` plugin sets `--safe-area-inset-*` on the document element, because `env(safe-area-inset-*)` is wrong on Android WebView before version 140; the CSS reads `var(--safe-area-inset-top, env(safe-area-inset-top))`, so a plain browser falls back to `env()`.

## Generated files — do not edit

`build/`, `android/app/build/` and `android/app/src/main/assets/public/` are all build output; `.cache/` holds the Gradle and Android tool homes. None of them are in git.

**Memory — read first.** Read `MEMORY.md` at the start of each session, before your first response — it records facts about this project, its conventions, landmines, dead ends, and decision rationale you can't recover from the code. Skipping it risks repeating solved mistakes.
