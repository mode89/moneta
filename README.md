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

Create AVD:
```
$ avdmanager create avd \
    --name <name>
    --package "system-images;android-32;google_apis;x86_64"
```

Enable hardware keyboard by setting `hw.keyboard` to `yes` in the AVD
config file `~/.android/avd/<name>.avd/config.ini`.

Run emulator:
```
$ emulator -avd <name>
```

Build and install APK:
```
$ scripts/build
$ scripts/install
```
