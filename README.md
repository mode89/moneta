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
