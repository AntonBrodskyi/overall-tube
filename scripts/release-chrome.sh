#!/usr/bin/env bash

set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXT_DIR="$ROOT_DIR/chrome-extension"
RELEASE_DIR="$ROOT_DIR/release"
VERSION="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["version"])' "$EXT_DIR/manifest.json")"
ZIP_NAME="overalltube-v${VERSION}.zip"
ZIP_PATH="$RELEASE_DIR/$ZIP_NAME"

if [[ ! -f "$EXT_DIR/manifest.json" ]]; then
  echo "manifest.json not found in $EXT_DIR"
  exit 1
fi

mkdir -p "$RELEASE_DIR"
rm -f "$ZIP_PATH"

(
  cd "$EXT_DIR"
  zip -r "$ZIP_PATH" . \
    -x "*.DS_Store" \
    -x "__MACOSX/*"
)

echo "Release package created:"
echo "$ZIP_PATH"
