#!/usr/bin/env bash
###############################################################################
# Cloud Agent install script (durable, idempotent, source-derived setup).
#
# Runs once after the repository is checked out and, with environment builds,
# produces the baseline snapshot. Keep per-boot service startup out of here;
# that lives in .cursor/start.sh.
###############################################################################
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

persist_path_entry() {
  local entry="$1"
  local file="$2"
  local line="export PATH=\"${entry}:\$PATH\""
  mkdir -p "$(dirname "$file")"
  touch "$file"
  if ! grep -Fqs "$entry" "$file"; then
    printf '%s\n' "$line" >> "$file"
  fi
}

# User-writable npm global prefix. The Cloud image's `npm prefix -g` can
# resolve to `/usr`, which is not writable by ubuntu.
NPM_GLOBAL_PREFIX="${NPM_GLOBAL_PREFIX:-$HOME/.npm-global}"
mkdir -p "$NPM_GLOBAL_PREFIX/bin"
export npm_config_prefix="$NPM_GLOBAL_PREFIX"
export PATH="$NPM_GLOBAL_PREFIX/bin:$HOME/.local/bin:$PATH"
persist_path_entry "$NPM_GLOBAL_PREFIX/bin" "$HOME/.bashrc"
persist_path_entry "$NPM_GLOBAL_PREFIX/bin" "$HOME/.profile"
persist_path_entry "$HOME/.local/bin" "$HOME/.bashrc"
persist_path_entry "$HOME/.local/bin" "$HOME/.profile"

# 1. System packages: PostgreSQL + Redis (the app's required backing services),
#    plus pipx for the Python CRG CLI.
if ! command -v pg_ctlcluster >/dev/null 2>&1 \
  || ! command -v redis-server >/dev/null 2>&1 \
  || ! command -v pipx >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    postgresql postgresql-contrib redis-server pipx
fi
pipx ensurepath >/dev/null 2>&1 || true
export PATH="$HOME/.local/bin:$PATH"

# 2. Node dependencies (uses the committed package-lock.json).
npm install

# 3. Prisma client generation (schema -> generated client under node_modules).
export PRISMA_GENERATE_SKIP_AUTOINSTALL=1
npx prisma generate

# 4. OpenSpec CLI, Buddy, OpenWolf, and CodeGraph CLIs.
export OPENSPEC_TELEMETRY=0
npm install -g \
  @fission-ai/openspec \
  openspec-buddy \
  openwolf \
  @colbymchenry/codegraph
codegraph telemetry off >/dev/null 2>&1 || true

# 5. code-review-graph CLI (Python).
if ! command -v code-review-graph >/dev/null 2>&1; then
  pipx install code-review-graph
else
  pipx upgrade code-review-graph >/dev/null 2>&1 || true
fi

# 6. Materialize Buddy skills. Project git used to keep Mac-only sibling-repo
#    symlinks that dangle in Cloud Agent VMs; replace a dangling link then copy.
if [ -L .agents/skills/openspec-buddy ] && [ ! -e .agents/skills/openspec-buddy ]; then
  rm -f .agents/skills/openspec-buddy .agents/skills/openspec-buddy-auto
fi
openspec-buddy install --target agents --mode copy --force
openspec-buddy install --target project --mode copy --force

# 7. OpenWolf protocol files and Cursor rule. Existing STATUS.md / cerebrum
#    content is preserved (create-if-missing). Knowledge files stay gitignored.
openwolf init --agent cursor >/dev/null

# 8. Local Buddy config (gitignored). Cloud Agents default to integration.
if [ ! -f .env.openspec-buddy ]; then
  printf 'OPENSPEC_BUDDY_BASE_BRANCH=integration\n' > .env.openspec-buddy
fi

# 9. Graph indexes for CLI/MCP queries. Non-fatal: the CLIs remain usable if
#    indexing is skipped or the repo is too large for this snapshot window.
codegraph init -y "$REPO_ROOT" >/dev/null 2>&1 || true
codegraph index "$REPO_ROOT" || echo "[install] codegraph index skipped/failed (non-fatal)."
code-review-graph register "$REPO_ROOT" --alias act >/dev/null 2>&1 || true
code-review-graph build --repo "$REPO_ROOT" || echo "[install] code-review-graph build skipped/failed (non-fatal)."

echo "[install] Cloud Agent install complete."
