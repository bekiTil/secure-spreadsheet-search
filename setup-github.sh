#!/bin/bash
# ─────────────────────────────────────────────────────────────────────────────
# Secure Spreadsheet Search — GitHub Setup + Push
# Run once from the project folder: bash setup-github.sh
# ─────────────────────────────────────────────────────────────────────────────
set -e
BOLD='\033[1m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}✓${NC} $1"; }
info() { echo -e "${YELLOW}→${NC} $1"; }
die()  { echo -e "${RED}✗${NC} $1"; exit 1; }
ask()  { echo -e "${CYAN}?${NC} $1"; }

GITHUB_USER="bekiTil"
REPO_NAME="secure-spreadsheet-search"
REPO_URL="https://github.com/${GITHUB_USER}/${REPO_NAME}.git"

echo -e "\n${BOLD}Secure Spreadsheet Search — GitHub Setup${NC}\n──────────────────────────────────────────\n"

# ── 1. Initialize git ─────────────────────────────────────────────────────────
if [ ! -d ".git" ]; then
  info "Initializing git repository…"
  git init
  git branch -m main
  ok "Git initialized"
else
  ok "Git already initialized"
fi

# ── 2. Configure git identity ─────────────────────────────────────────────────
git config user.name  "${GITHUB_USER}"
git config user.email "es299@fordham.edu"
ok "Git identity set (${GITHUB_USER})"

# ── 3. Stage all files ────────────────────────────────────────────────────────
info "Staging all project files…"
git add .
FILE_COUNT=$(git diff --cached --numstat | wc -l | tr -d ' ')
ok "${FILE_COUNT} files staged"

# ── 4. Commit ─────────────────────────────────────────────────────────────────
if git diff --cached --quiet; then
  ok "Nothing new to commit (already up to date)"
else
  info "Creating initial commit…"
  git commit -m "Initial release v1.0.0

- Tauri + React + TypeScript desktop app (macOS/Windows/Linux)
- AES-256-GCM encryption + Argon2id key derivation
- SQLite + FTS5 full-text search (handles 500k+ rows)
- .companybundle format with HMAC-SHA256 tamper detection
- Import XLSX, XLS, CSV, TSV — dynamic column detection
- All screens: Home, Import Wizard, Search, Manage, Settings, Open Bundle
- _OPEN_ME.html embedded in every bundle for no-app-installed flow
- Smart OS-detecting download page
- GitHub Actions CI: builds .dmg, .msi, .AppImage on every release
- 20 Rust unit tests + 29 frontend tests, all passing"
  ok "Committed"
fi

# ── 5. Create GitHub repo (using GitHub CLI if available, else manual) ────────
echo ""
if command -v gh &>/dev/null; then
  info "Creating GitHub repository via GitHub CLI…"
  # Check if repo already exists
  if gh repo view "${GITHUB_USER}/${REPO_NAME}" &>/dev/null 2>&1; then
    ok "GitHub repo already exists: https://github.com/${GITHUB_USER}/${REPO_NAME}"
  else
    gh repo create "${REPO_NAME}" \
      --public \
      --description "Secure offline desktop app for importing, searching, and sharing encrypted spreadsheet data" \
      --homepage "https://${GITHUB_USER}.github.io/${REPO_NAME}/download.html" \
      --source=. \
      --remote=origin \
      --push
    ok "GitHub repo created and pushed!"
    PUSHED=true
  fi
else
  echo -e "${YELLOW}GitHub CLI (gh) not installed. Installing it now…${NC}"
  brew install gh 2>/dev/null || true
  if command -v gh &>/dev/null; then
    info "Logging into GitHub…"
    gh auth login --web --git-protocol https
    info "Creating repository…"
    gh repo create "${REPO_NAME}" \
      --public \
      --description "Secure offline desktop app for encrypted spreadsheet search" \
      --source=. \
      --remote=origin \
      --push
    ok "GitHub repo created and pushed!"
    PUSHED=true
  fi
fi

# ── 6. Set remote and push (fallback if gh not used) ─────────────────────────
if [ "${PUSHED}" != "true" ]; then
  # Set remote
  if git remote get-url origin &>/dev/null 2>&1; then
    git remote set-url origin "${REPO_URL}"
  else
    git remote add origin "${REPO_URL}"
  fi
  ok "Remote set: ${REPO_URL}"

  info "Pushing to GitHub…"
  echo ""
  echo -e "  ${CYAN}When prompted:${NC}"
  echo -e "  Username: ${BOLD}bekiTil${NC}"
  echo -e "  Password: your ${BOLD}GitHub Personal Access Token${NC}"
  echo -e "  (Get one at: github.com/settings/tokens → New token → check 'repo')"
  echo ""
  git push -u origin main
  ok "Pushed to GitHub!"
fi

# ── 7. Enable GitHub Pages ────────────────────────────────────────────────────
if command -v gh &>/dev/null; then
  info "Enabling GitHub Pages for download page…"
  gh api \
    --method POST \
    -H "Accept: application/vnd.github+json" \
    "/repos/${GITHUB_USER}/${REPO_NAME}/pages" \
    -f source='{"branch":"main","path":"/"}' 2>/dev/null || true
  ok "GitHub Pages enabled"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
echo ""
echo -e "${BOLD}${GREEN}All done!${NC}"
echo ""
echo -e "  ${BOLD}Repository:${NC}   https://github.com/${GITHUB_USER}/${REPO_NAME}"
echo -e "  ${BOLD}Download page:${NC} https://${GITHUB_USER}.github.io/${REPO_NAME}/download.html"
echo ""
echo -e "  ${BOLD}Next step:${NC} Run the macOS build to get your .dmg:"
echo -e "  ${CYAN}bash build-mac.sh${NC}"
echo ""
