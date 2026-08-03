# Moneta

Moneta is a simple Android application designed to help users track their daily
expenses effortlessly. With a clean and intuitive interface, it allows users to
quickly log expenditures, categorize them, and get an overview of their
spending habits. The application focuses on ease of use and provides a
straightforward way to manage personal finances on the go.

## Features

* **Expense Tracking**: Easily add and manage daily expenses.
* **Categorization**: Organize expenses with custom categories for better
  financial insights.
* **Overview of Spending**: Get a clear summary of your expenditures.
* **Intuitive User Interface**: Simple and user-friendly design for seamless
  navigation.
* **Data Persistence**: Your expense data is saved locally on the device.

# Development

All development commands live in the `justfile` and run inside the Nix shell,
which pins the Android SDK, Gradle, Node.js and `just`:

```
$ nix-shell
$ just
```

`just` on its own lists the recipes:

* `just test` — unit tests, east and west of UTC.
* `just test-browser [args]` — Playwright UI suite; arguments go to Playwright.
* `just serve` — serve the web app on port 8080.
* `just emulator` — create the `moneta` AVD if missing and start it.
* `just build` — build the web assets and the APK.
* `just install` — build and install the debug APK on the attached device.
