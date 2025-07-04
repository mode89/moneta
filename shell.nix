{
  pkgs ? import <nixpkgs> {
    config = {
      allowUnfree = true;
      android_sdk.accept_license = true;
    };
  }
}:

let
  buildToolsVersion = "30.0.3";
  androidsdk = (pkgs.androidenv.composeAndroidPackages {
    platformVersions = [ "32" ];
    buildToolsVersions = [ buildToolsVersion ];
    abiVersions = [ "x86_64" ];
    includeEmulator = true;
    includeSystemImages = true;
  }).androidsdk;
in pkgs.mkShell {
  packages = with pkgs; [
    androidsdk
    gradle_8
  ];
  shellHook = ''
    export ANDROID_SDK_ROOT=${androidsdk}/libexec/android-sdk
    export AAPT2=$ANDROID_SDK_ROOT/build-tools/${buildToolsVersion}/aapt2
  '';
}
