{
  pkgs ? import <nixpkgs> {
    config = {
      allowUnfree = true;
      android_sdk.accept_license = true;
    };
  }
}:

let
  androidsdk = (pkgs.androidenv.composeAndroidPackages {
    platformVersions = [ "32" ];
    abiVersions = [ "x86_64" ];
    includeEmulator = true;
    includeSystemImages = true;
  }).androidsdk;
in pkgs.mkShell {
  packages = with pkgs; [
    androidsdk
  ];
  shellHook = ''
    export ANDROID_SDK_ROOT=${androidsdk}/libexec/android-sdk
  '';
}
