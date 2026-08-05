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

All development commands live in `scripts/dev` and run inside the Nix shell,
which pins the Android SDK, Gradle and Node.js:

```
$ nix-shell
$ scripts/dev
```

`scripts/dev` on its own lists the commands:

* `scripts/dev test` — unit tests.
* `scripts/dev test-browser [args]` — Playwright UI suite; arguments go to
  Playwright.
* `scripts/dev serve` — serve the web app on port 8080.
* `scripts/dev emulator` — create the `moneta` AVD if missing and start it.
* `scripts/dev build` — build the web assets and the APK.
* `scripts/dev install` — build and install the debug APK on the attached
  device.
