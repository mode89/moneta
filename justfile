mdi_dir := "node_modules/@material-design-icons/svg/outlined"
apk := "android/app/build/outputs/apk/debug/app-debug.apk"

# List the available recipes.
default:
    @just --list

# Run the unit tests in web/test/.
test: deps
    # The zone is pinned so results do not follow the machine; test/timezone.test.js
    # sets its own zones. A directory argument is read as a module path; only a
    # glob selects the files.
    TZ=Asia/Kolkata node --test "web/test/*.test.js"

# Run the Playwright UI suite in web/e2e/; takes Playwright's own arguments.
test-browser *args: deps
    npx playwright test {{ args }}

# Run the Maestro flows in maestro/; starts a headless emulator and an adb
# server if they are not running, and stops what it started. Takes a flow path.
test-android *args:
    #!/usr/bin/env bash
    set -e
    mkdir -p build/maestro
    # What this recipe finds running is left running; what it starts, it stops.
    started_emulator=false
    started_adb=true
    (exec 3<>/dev/tcp/127.0.0.1/5037) 2> /dev/null && started_adb=false
    cleanup() {
      $started_emulator && adb emu kill > /dev/null 2>&1
      $started_adb && adb kill-server > /dev/null 2>&1
      true
    }
    trap cleanup EXIT
    if [ "$(adb devices | awk 'NR > 1 && $2 == "device"' | wc -l)" -eq 0 ]; then
      echo "No device attached. Starting a headless emulator."
      started_emulator=true
      # The child keeps the output pipe of `nix-shell --run` open unless its
      # output goes elsewhere, and the run then never returns.
      just emulator -no-window -no-audio -no-boot-anim \
          > build/maestro/emulator.log 2>&1 &
      adb wait-for-device
      adb shell 'while [ "$(getprop sys.boot_completed)" != 1 ]; do sleep 1; done'
    fi
    just install
    echo
    echo "======================= Running device flows ======================"
    echo
    # maestro/import.yaml picks this file out of the system file picker. Its
    # date is today's, so the imported expense lands in the open month.
    printf '[{"id":1,"amount":42.5,"description":"Imported lunch","date":"%s","categories":["food"]}]' \
        "$(date +%Y-%m-%d)" > build/maestro/moneta-import.json
    adb push build/maestro/moneta-import.json /sdcard/Download/moneta-import.json
    # The picker lists a file only once the media store knows about it.
    adb shell am broadcast -a android.intent.action.MEDIA_SCANNER_SCAN_FILE \
        -d file:///sdcard/Download/moneta-import.json > /dev/null
    maestro test {{ if args == "" { "maestro" } else { args } }}

# Check the JavaScript in web/ with ESLint and Prettier.
lint: deps
    npx eslint .
    npx prettier --check .

# Reformat the JavaScript in web/ with Prettier.
format: deps
    npx prettier --write .

# Serve the web app on port 8080 for browser-based iteration.
serve: build-web
    cd build/web/dist && python3 -m http.server 8080

# Create the moneta AVD if missing and start it; takes emulator options.
emulator *args:
    scripts/emulator {{ args }}

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
        node_modules/bootstrap/dist/css/bootstrap.css \
        {{ mdi_dir }}/file_download.svg \
        {{ mdi_dir }}/file_upload.svg \
        build/web/dist
    cp node_modules/solid-js/dist/solid.js build/web/dist/solid.js
    cp node_modules/solid-js/web/dist/web.js build/web/dist/solid-web.js
    cp node_modules/solid-js/store/dist/store.js build/web/dist/solid-store.js
    cp node_modules/solid-js/html/dist/html.js build/web/dist/solid-html.js
    cp node_modules/@capacitor/core/dist/index.js build/web/dist/capacitor-core.js
    cp node_modules/solid-transition-group/dist/index.js build/web/dist/solid-transition-group.js
    cp node_modules/@solid-primitives/transition-group/dist/index.js build/web/dist/sp-transition-group.js
    cp node_modules/@solid-primitives/refs/dist/index.js build/web/dist/sp-refs.js
    cp node_modules/@solid-primitives/utils/dist/index.js build/web/dist/sp-utils.js
    # sp-utils.js re-exports ./types.js, a relative import no import map covers.
    cp node_modules/@solid-primitives/utils/dist/types.js build/web/dist/types.js

# Copy the web app into the Android project and refresh its Capacitor plugins.
sync: build-web
    #!/usr/bin/env bash
    set -e
    echo
    echo "========================= Syncing Capacitor ========================"
    echo
    npx cap sync android

# Package the Android app around the copied web assets.
build-android: sync
    #!/usr/bin/env bash
    set -e
    echo
    echo "====================== Building Android app ========================"
    echo
    # --no-daemon: the build leaves no background JVM behind, at the cost of a
    # cold start on every run.
    cd android && gradle --no-daemon \
        -Dorg.gradle.project.android.aapt2FromMavenOverride=${AAPT2:?} build

# Install the web dependencies.
deps:
    @npm install
