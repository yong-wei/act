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

# 1. System packages: PostgreSQL + Redis (the app's required backing services).
if ! command -v pg_ctlcluster >/dev/null 2>&1 || ! command -v redis-server >/dev/null 2>&1; then
  sudo apt-get update -y
  sudo DEBIAN_FRONTEND=noninteractive apt-get install -y \
    postgresql postgresql-contrib redis-server
fi

# 2. Node dependencies (uses the committed package-lock.json).
npm install

# 3. Prisma client generation (schema -> generated client under node_modules).
export PRISMA_GENERATE_SKIP_AUTOINSTALL=1
npx prisma generate

echo "[install] Cloud Agent install complete."
