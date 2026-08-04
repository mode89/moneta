import js from "@eslint/js";
import globals from "globals";
import prettier from "eslint-config-prettier";

// Each area of the app runs somewhere different, so each gets its own globals:
// main.js in the browser, the unit tests in Node, the UI suite in both.
export default [
  {
    ignores: [
      "node_modules/",
      ".cache/",
      "test-results/",
      "playwright-report/",
      "build/",
      "android/",
    ],
  },
  js.configs.recommended,
  prettier,
  {
    files: ["web/main.js"],
    // `Android` is the bridge MainActivity injects; it is absent in a browser,
    // so every use is guarded by `window.Android`.
    languageOptions: {
      globals: { ...globals.browser, Android: "readonly" },
    },
  },
  {
    files: ["web/test/*.js", "web/e2e/server.js", "playwright.config.js"],
    languageOptions: { globals: globals.nodeBuiltin },
  },
  {
    files: ["web/e2e/*.js"],
    languageOptions: {
      globals: { ...globals.nodeBuiltin, ...globals.browser },
    },
  },
];
