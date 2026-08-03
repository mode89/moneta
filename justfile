mdi_dir := "web/node_modules/@material-design-icons/svg/outlined"
apk := "android/build/outputs/apk/debug/android-debug.apk"

# List the available recipes.
default:
    @just --list

# Run the unit tests in web/test/, east and west of UTC.
test: deps
    #!/usr/bin/env bash
    # Both timezones always run, so one failure still reports the other's
    # results.
    cd web
    status=0
    for tz in Asia/Kolkata America/New_York; do
      echo "===================== TZ=${tz} ====================="
      # A directory argument is read as a module path; only a glob selects the files.
      TZ="${tz}" node --test "test/*.test.js" || status=$?
    done
    exit ${status}

# Run the Playwright UI suite in web/e2e/; takes Playwright's own arguments.
test-browser *args: deps
    cd web && npx playwright test {{ args }}

# Serve the web app on port 8080 for browser-based iteration.
serve: build-web
    cd android/src/main/assets/web && python3 -m http.server 8080

# Create the moneta AVD if missing and start the emulator.
emulator:
    scripts/emulator

# Build the web assets and the Android APK.
build: build-web build-android

# Install the debug APK on the attached device.
install:
    #!/usr/bin/env bash
    set -e
    # Checked before the build, so a missing device costs a second, not a minute.
    if [ "$(adb devices | awk 'NR > 1 && $2 == "device"' | wc -l)" -eq 0 ]; then
      echo "No device attached. Start one with 'just emulator'." >&2
      exit 1
    fi
    just build
    echo
    echo "===================== Installing Android app ======================="
    echo
    adb install -r {{ apk }}

# Copy the web app and its dependencies into the Android assets.
build-web: deps
    #!/usr/bin/env bash
    set -e
    echo
    echo "======================== Building Web app =========================="
    echo
    rm -rf build/web
    mkdir -p build/web/dist
    version="$(git log -1 --format=%cd --date=format:%Y-%m-%d)-$(git rev-parse --short HEAD)"
    sed "s#%VERSION%#${version}#g" web/index.html > build/web/dist/index.html
    cp \
        web/main.js \
        web/node_modules/bootstrap/dist/css/bootstrap.css \
        {{ mdi_dir }}/file_download.svg \
        {{ mdi_dir }}/file_upload.svg \
        build/web/dist
    cp web/node_modules/solid-js/dist/solid.js build/web/dist/solid.js
    cp web/node_modules/solid-js/web/dist/web.js build/web/dist/solid-web.js
    cp web/node_modules/solid-js/store/dist/store.js build/web/dist/solid-store.js
    cp web/node_modules/solid-js/html/dist/html.js build/web/dist/solid-html.js
    cp web/node_modules/solid-transition-group/dist/index.js build/web/dist/solid-transition-group.js
    cp web/node_modules/@solid-primitives/transition-group/dist/index.js build/web/dist/sp-transition-group.js
    cp web/node_modules/@solid-primitives/refs/dist/index.js build/web/dist/sp-refs.js
    cp web/node_modules/@solid-primitives/utils/dist/index.js build/web/dist/sp-utils.js
    # sp-utils.js re-exports ./types.js, a relative import no import map covers.
    cp web/node_modules/@solid-primitives/utils/dist/types.js build/web/dist/types.js
    rm -rf android/src/main/assets/web
    cp -r build/web/dist android/src/main/assets/web

# Package the Android app around the copied web assets.
build-android: build-web
    #!/usr/bin/env bash
    set -e
    echo
    echo "====================== Building Android app ========================"
    echo
    gradle -Dorg.gradle.project.android.aapt2FromMavenOverride=${AAPT2:?} build

# Install the web dependencies.
deps:
    @cd web && npm install
