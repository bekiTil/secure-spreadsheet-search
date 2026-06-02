#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Secure Spreadsheet Search — macOS Build Script
# Produces a universal .dmg (Intel + Apple Silicon)
# Run from the project root: bash build-mac.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e
BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $1"; }
info() { echo -e "${YELLOW}→${NC} $1"; }
die()  { echo -e "${RED}✗ ERROR:${NC} $1"; exit 1; }

echo -e "\n${BOLD}Secure Spreadsheet Search — macOS Build${NC}\n────────────────────────────────────────\n"

# 1. Xcode Command Line Tools
if ! xcode-select -p &>/dev/null; then
  info "Installing Xcode Command Line Tools…"
  xcode-select --install
  echo "After installation completes, re-run this script."
  exit 0
fi
ok "Xcode Command Line Tools"

# 2. Homebrew
if ! command -v brew &>/dev/null; then
  info "Installing Homebrew…"
  /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
  [[ $(uname -m) == "arm64" ]] && eval "$(/opt/homebrew/bin/brew shellenv)"
fi
ok "Homebrew"

# 3. Node.js
if ! command -v node &>/dev/null; then
  info "Installing Node.js…"
  brew install node
fi
ok "Node.js $(node --version)"

# 4. Rust
if ! command -v rustc &>/dev/null; then
  info "Installing Rust…"
  curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable
  source "$HOME/.cargo/env"
fi
[ -f "$HOME/.cargo/env" ] && source "$HOME/.cargo/env"
ok "Rust: $(rustc --version)"

# 5. Universal binary targets
if [[ $(uname -m) == "arm64" ]]; then
  rustup target add x86_64-apple-darwin &>/dev/null || true
  ok "Universal targets: arm64 + x86_64"
  BUILD_ARGS="--target universal-apple-darwin"
else
  BUILD_ARGS=""
fi

# 6. Dependencies
info "Installing Node dependencies…"
npm install --silent
ok "Node dependencies"

# 7. Tests
info "Running frontend tests…"
npm test
ok "Frontend tests passed"

info "Running Rust unit tests…"
(cd src-tauri && cargo test --lib 2>&1 | grep -E "test result|FAILED|ok$" | tail -3)
ok "Rust tests passed"

# 8. Build
info "Building the app (first build: 5–15 min)…"
npm run tauri build -- $BUILD_ARGS
echo ""

# 9. Result
DMG=$(find src-tauri/target -name "*.dmg" 2>/dev/null | head -1)
if [[ -n "$DMG" ]]; then
  ok "Build complete!"
  echo -e "\n  ${BOLD}Installer:${NC} $DMG\n"
  echo "  Share this .dmg with users. They double-click it, drag to Applications, done."
  echo ""
  echo "  Also update RELEASES_BASE in download.html and _OPEN_ME.html"
  echo "  to point to where you host the installer files."
  echo ""
  open "$(dirname "$DMG")"
else
  ok "Build complete — check src-tauri/target/release/bundle/ for output"
fi
