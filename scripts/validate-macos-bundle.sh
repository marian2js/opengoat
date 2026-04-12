#!/usr/bin/env bash

set -euo pipefail

bundle_root="${1:?usage: validate-macos-bundle.sh <bundle-root>}"

app_path="${APP_PATH:-}"
if [ -z "$app_path" ]; then
  app_path="$(find "$bundle_root" -type d -name '*.app' | head -n 1)"
fi

dmg_path="${DMG_PATH:-}"
if [ -z "$dmg_path" ]; then
  dmg_path="$(find "$bundle_root" -type f -name '*.dmg' | head -n 1)"
fi

if [ -z "$app_path" ]; then
  echo "::error::Could not find a macOS .app bundle under $bundle_root"
  exit 1
fi

if [ -z "$dmg_path" ]; then
  echo "::error::Could not find a macOS .dmg bundle under $bundle_root"
  exit 1
fi

codesign_output="$(codesign -dvvv "$app_path" 2>&1)"
printf '%s\n' "$codesign_output"

if printf '%s\n' "$codesign_output" | grep -q 'Signature=adhoc'; then
  echo "::error::macOS app bundle is ad-hoc signed and will be hard-rejected by Gatekeeper."
  exit 1
fi

if printf '%s\n' "$codesign_output" | grep -q 'TeamIdentifier=not set'; then
  echo "::error::macOS app bundle has no Apple team identifier."
  exit 1
fi

codesign --verify --deep --strict --verbose=2 "$app_path"
spctl --assess --type execute -vv "$app_path"
spctl --assess --type open -vv "$dmg_path"
