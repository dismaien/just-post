#!/bin/sh
# Builds JustPost.ipa for sideloading with AltStore (or Sideloadly).
# Needs Xcode on a mac. Run from the repo folder:  sh make-ipa.sh
# The .ipa is unsigned on purpose: AltStore signs it with your apple id.
set -eu

cd "$(dirname "$0")"
out="build/ipa"
rm -rf "$out"
mkdir -p "$out/Payload"

xcodebuild \
  -project JustPost.xcodeproj \
  -scheme JustPost \
  -configuration Release \
  -sdk iphoneos \
  -destination 'generic/platform=iOS' \
  -derivedDataPath build/DerivedData \
  PRODUCT_BUNDLE_IDENTIFIER=app.justpost \
  CODE_SIGN_IDENTITY="" \
  CODE_SIGNING_REQUIRED=NO \
  CODE_SIGNING_ALLOWED=NO \
  build | tail -n 1

cp -R build/DerivedData/Build/Products/Release-iphoneos/JustPost.app "$out/Payload/"
(cd "$out" && zip -qry JustPost.ipa Payload)

echo
echo "done → $out/JustPost.ipa"
echo "open AltStore on your phone or drag the file onto AltServer to install."
