{
  pkgs ? import <nixpkgs> {
    config = {
      allowUnfree = true;
      android_sdk.accept_license = true;
    };
  }
}:

let
  buildToolsVersion = "36.0.0";
  androidsdk = (pkgs.androidenv.composeAndroidPackages {
    platformVersions = [ "36" ];
    buildToolsVersions = [ buildToolsVersion ];
    abiVersions = [ "x86_64" ];
    includeEmulator = true;
    includeSystemImages = true;
  }).androidsdk;
in pkgs.mkShell {
  packages = with pkgs; [
    androidsdk
    gradle_8
    nodejs
    just
  ];
  shellHook = ''
    export ANDROID_SDK_ROOT=${androidsdk}/libexec/android-sdk
    export AAPT2=$ANDROID_SDK_ROOT/build-tools/${buildToolsVersion}/aapt2
    export PLAYWRIGHT_BROWSERS_PATH=${pkgs.playwright.browsers}
    # Without a fontconfig config Chromium aborts in Skia on the first text it
    # has to shape, killing the browser mid-test.
    export FONTCONFIG_FILE=${pkgs.makeFontsConf { fontDirectories = [ pkgs.dejavu_fonts ]; }}
  '';
}
