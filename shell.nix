{
  pkgs ? import <nixpkgs> {
    config = {
      allowUnfree = true;
      android_sdk.accept_license = true;
    };
  }
}:

let
  buildToolsVersion = "33.0.2";
  androidsdk = (pkgs.androidenv.composeAndroidPackages {
    platformVersions = [ "32" ];
    buildToolsVersions = [ buildToolsVersion ];
    abiVersions = [ "x86_64" ];
    includeEmulator = true;
    includeSystemImages = true;
  }).androidsdk;
  elm = let
      # 2025-07-05
      pkgs' = import (fetchTarball
        ("https://github.com/NixOS/nixpkgs/archive/" +
        "1161c1470c91344224bd8df9979768e5c9fd0e7d.tar.gz")) {};
    in pkgs'.elmPackages.elm;
in pkgs.mkShell {
  packages = with pkgs; [
    androidsdk
    elm
    gradle_8
  ];
  shellHook = ''
    export ANDROID_SDK_ROOT=${androidsdk}/libexec/android-sdk
    export AAPT2=$ANDROID_SDK_ROOT/build-tools/${buildToolsVersion}/aapt2
  '';
}
