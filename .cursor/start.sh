#!/usr/bin/env bash
###############################################################################
# Cloud Agent start script (per-boot service reconciliation).
#
# Starts PostgreSQL + Redis, ensures the local dev database exists, applies
# Prisma migrations, and seeds the verified test accounts. Must be idempotent
# and tolerate restarts. The Next.js dev server itself runs as a terminal
# (see .cursor/environment.json) so its logs stay visible.
###############################################################################
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# 1. Ensure a local .env exists. Secrets are generated once and then reused so
#    NextAuth sessions survive restarts. .env is gitignored.
if [ ! -f .env ]; then
  echo "[start] Generating local .env with development secrets."
  cat > .env <<EOF
DATABASE_URL="postgresql://act_user:act_pass@localhost:5432/act_obe?schema=public"
SHADOW_DATABASE_URL="postgresql://act_user:act_pass@localhost:5432/act_obe?schema=shadow"
NEXTAUTH_URL="http://localhost:3001"
NEXTAUTH_SECRET="$(openssl rand -hex 32)"
KONLING_SERVER_MODE_CONTEXT_SECRET="$(openssl rand -hex 32)"
ADAPTIVE_ASSESSMENT_PERSISTENCE_ENABLED="true"
ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED="true"
REDIS_URL="redis://localhost:6379"
AI_PROVIDER="siliconflow"
AI_BASE_URL="https://api.siliconflow.cn/v1"
AI_API_KEY="sk-placeholder-local-dev"
AI_MODEL="Qwen/Qwen3.5-35B-A3B"
SILICONFLOW_API_URL="https://api.siliconflow.cn/v1"
SILICONFLOW_API_KEY="sk-placeholder-local-dev"
SILICONFLOW_MODEL="Qwen/Qwen3.5-35B-A3B"
SMART_COURSEWARE_ORDERING_SECRET="$(openssl rand -hex 32)"
EOF
fi

# 2. Start PostgreSQL and wait for readiness (idempotent).
sudo pg_ctlcluster 16 main start 2>/dev/null || sudo service postgresql start || true
for _ in $(seq 1 30); do
  if sudo -u postgres pg_isready -q 2>/dev/null; then break; fi
  sleep 1
done

# 3. Ensure the application role and database exist.
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_roles WHERE rolname='act_user'" | grep -q 1; then
  sudo -u postgres psql -c "CREATE ROLE act_user LOGIN PASSWORD 'act_pass' CREATEDB;"
fi
if ! sudo -u postgres psql -tAc "SELECT 1 FROM pg_database WHERE datname='act_obe'" | grep -q 1; then
  sudo -u postgres createdb -O act_user act_obe
fi
sudo -u postgres psql -d act_obe \
  -c "GRANT ALL ON SCHEMA public TO act_user; ALTER SCHEMA public OWNER TO act_user;" \
  >/dev/null 2>&1 || true

# 4. Start Redis (idempotent).
sudo service redis-server start 2>/dev/null || redis-server --daemonize yes || true

# 5. Apply database migrations.
set -a; . ./.env; set +a
npx prisma migrate deploy

# 6. Seed verified test accounts (best effort; safe to re-run).
node scripts/db/seed-demo-user.mjs || echo "[start] demo account seed skipped/failed (non-fatal)."

echo "[start] Services ready. Dev server starts via the configured terminal."
