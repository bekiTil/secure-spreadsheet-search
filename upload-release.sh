#!/bin/bash
# Uploads the already-built .dmg to the existing GitHub Release v1.0.0
set -e
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $1"; }
info() { echo -e "${YELLOW}→${NC} $1"; }

REPO="bekiTil/secure-spreadsheet-search"
TAG="v1.0.0"

# Find the .dmg
DMG=$(find src-tauri/target -name "*.dmg" 2>/dev/null | head -1)
if [ -z "$DMG" ]; then
  echo "No .dmg found. Run 'bash release.sh' first to build."
  exit 1
fi
ok "Found: $DMG"

info "Uploading to GitHub Release $TAG…"

# Delete old asset if it exists (in case of re-upload)
ASSET_ID=$(gh release view "$TAG" --repo "$REPO" --json assets \
  --jq '.assets[] | select(.name | contains(".dmg")) | .id' 2>/dev/null || true)
if [ -n "$ASSET_ID" ]; then
  info "Removing old .dmg asset…"
  gh release delete-asset "$TAG" "$ASSET_ID" --repo "$REPO" --yes 2>/dev/null || true
fi

gh release upload "$TAG" "$DMG" --repo "$REPO" --clobber
ok "Uploaded $(basename "$DMG")"

echo ""
echo "Direct download URL:"
echo "  https://github.com/$REPO/releases/download/$TAG/$(basename "$DMG" | sed 's/ /%20/g')"
echo ""
echo "Your download page will now work for macOS."
echo "Windows and Linux are built automatically by GitHub Actions when CI passes."
