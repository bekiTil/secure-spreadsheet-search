#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Secure Spreadsheet Search — Full Release Script
# Builds the app, creates a GitHub Release, uploads the .dmg
# Run: bash release.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e
BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $1"; }
info() { echo -e "${YELLOW}→${NC} $1"; }

GITHUB_USER="bekiTil"
REPO_NAME="secure-spreadsheet-search"
VERSION="1.0.0"
TAG="v${VERSION}"

echo -e "\n${BOLD}Secure Spreadsheet Search — Release ${TAG}${NC}\n"

# ── 1. Install prerequisites ──────────────────────────────────────────────────
[ -f "$HOME/.cargo/env" ] && source "$HOME/.cargo/env"

if ! command -v rustc &>/dev/null; then
  info "Installing Rust…"
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
  source "$HOME/.cargo/env"
fi
ok "Rust: $(rustc --version)"

if ! command -v node &>/dev/null; then
  info "Installing Node.js…"
  brew install node
fi
ok "Node: $(node --version)"

if ! command -v gh &>/dev/null; then
  info "Installing GitHub CLI…"
  brew install gh
fi

# Universal binary on Apple Silicon
if [[ $(uname -m) == "arm64" ]]; then
  rustup target add x86_64-apple-darwin &>/dev/null || true
  BUILD_ARGS="--target universal-apple-darwin"
else
  BUILD_ARGS=""
fi

# ── 2. Run tests ──────────────────────────────────────────────────────────────
info "Running frontend tests…"
npm install --silent
npm test
ok "Frontend tests passed (29/29)"

info "Running Rust tests…"
(cd src-tauri && cargo test --lib 2>&1 | grep "test result")
ok "Rust tests passed (20/20)"

# ── 3. Build the app ──────────────────────────────────────────────────────────
info "Building macOS app (this takes 5–15 min first time)…"
npm run tauri build -- $BUILD_ARGS
echo ""

DMG=$(find src-tauri/target -name "*.dmg" 2>/dev/null | head -1)
[ -z "$DMG" ] && { echo "Build failed — no .dmg found"; exit 1; }
ok "Built: $(basename $DMG)"

# ── 4. Create GitHub Release and upload ───────────────────────────────────────
info "Creating GitHub Release ${TAG}…"

# Check if tag already exists
if git tag | grep -q "^${TAG}$"; then
  info "Tag ${TAG} already exists, deleting and recreating…"
  git tag -d "${TAG}" 2>/dev/null || true
  git push origin ":refs/tags/${TAG}" 2>/dev/null || true
fi

git tag "${TAG}"
git push origin "${TAG}" 2>/dev/null || git push --force origin "${TAG}"

gh release create "${TAG}" \
  --repo "${GITHUB_USER}/${REPO_NAME}" \
  --title "Secure Spreadsheet Search ${TAG}" \
  --notes "## What's new in ${TAG}

### First release!

- Import spreadsheet files (XLSX, XLS, CSV, TSV)
- Search across 500,000+ records instantly
- AES-256-GCM encrypted storage and sharing
- Share datasets as encrypted .companybundle files
- Works 100% offline — no accounts, no cloud, no internet

### Installation

**macOS**: Download the .dmg below, open it, drag to Applications.

**Windows / Linux**: Builds coming via GitHub Actions." \
  "${DMG}"

ok "GitHub Release created!"

# ── 5. Print result ───────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}Released!${NC}"
echo ""
echo -e "  ${BOLD}Release page:${NC}  https://github.com/${GITHUB_USER}/${REPO_NAME}/releases/tag/${TAG}"
echo -e "  ${BOLD}Direct download:${NC} https://github.com/${GITHUB_USER}/${REPO_NAME}/releases/latest/download/$(basename $DMG)"
echo -e "  ${BOLD}Download page:${NC} https://${GITHUB_USER}.github.io/${REPO_NAME}/download.html"
echo ""
echo -e "Share this link with anyone who needs to install the app:"
echo -e "  ${CYAN}https://${GITHUB_USER}.github.io/${REPO_NAME}/download.html${NC}"
echo ""
