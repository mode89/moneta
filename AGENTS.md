# AGENTS.md

Moneta is an Android expense tracker. The entire user interface is a web app (ClojureScript, interpreted at runtime by Scittle) rendered inside a single Android `WebView`. There is no native UI and no server: expenses live in the browser's `localStorage` on the device.

## Layout

* `web/main.cljs` — the whole app: state, UI components, persistence, import/export.
* `web/index.html` — page shell, custom CSS, script tags. `%VERSION%` is substituted at build time.
* `web/package.json` — npm deps used purely as a source of static assets (Bootstrap, React, Scittle, Material icons).
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

* `scripts/serve` serves `android/src/main/assets/web` on port 8080 for browser-based iteration. It serves the *built* assets, so run `scripts/build` first (or edit the copied `main.cljs` and re-copy).
* `scripts/build` builds the web bundle, copies it into the Android assets, then runs `gradle build`.
* `scripts/install` installs the debug APK via `adb install -r`.
* `scripts/emulator` creates the `moneta` AVD if missing and starts it.

There is no test suite and no linter configured. Verify changes by loading the app (browser via `scripts/serve`, or emulator) and exercising the affected flow.

Also, if you need to control browser, you can use `playwright-cli`:

```
cd web
npm install @playwright/cli@latest
curl http://localhost:9222/json/version # confirm browser is running
npx playwright-cli attach --cdp=http://localhost:9222 # attach to running browser
npx playwright-cli --help # for usage
```

## ClojureScript conventions in `main.cljs`

* Scittle interprets `main.cljs` at runtime; there is no compile step and no build error to catch mistakes. Typos surface as runtime errors in the console.
* Reagent with a single `app-state` ratom holding `:expenses`, `:adding-expense?`, `:editing-expense`, `:show-numbers?`, `:bubble`.
* Top-down ordering: `app` first, then components, then persistence helpers, then small utilities (`format-date`, `now`, `js-date`, `find-first`, ...). Forward references are made explicit with a `declare` block at the point they are needed.
* Dates are `js/Date` objects in state and ISO `YYYY-MM-DD` strings in JSON. Conversion happens in `parse-json-expenses` / `json-expenses`.
* Every mutation that should persist calls `save-expenses`, which also triggers the "Saved" bubble.

## The Android bridge

`js/Android` is injected only inside the app; in a plain browser it is absent, so code paths branch on `(some? js/Android)` (see `export-expenses` / `import-expenses`). Keep both branches working.

`Android.pickFile` is defined in JavaScript that `MainActivity` evaluates into the page after load; it wraps the async `___pickFile` / `___pickFileResult` callback pair. Changing one side requires changing the other.

## Generated files — do not edit

`build/`, `android/build/`, and `android/src/main/assets/web/` are all build output.
