#!/usr/bin/env bash
###############################################################################
# Cloud Agent start script (per-boot service reconciliation).
#
# Starts PostgreSQL + Redis, ensures the local dev database exists, applies
# Prisma migrations, and seeds the verified test accounts. Must be idempotent
# and tolerate restarts. The Next.js dev server itself runs as a terminal
# (see .cursor/environment.json) so its logs stay visible.
#
# Database writes are fail-closed: migrate/seed run only against the local
# act_obe identity below. An existing .env that points at a shared, staging,
# or production database must not be loaded into this write path.
###############################################################################
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

# Canonical local Cloud Agent database identity.
LOCAL_DATABASE_URL='postgresql://act_user:act_pass@localhost:5432/act_obe?schema=public'
LOCAL_SHADOW_DATABASE_URL='postgresql://act_user:act_pass@localhost:5432/act_obe?schema=shadow'

is_allowed_local_act_obe_url() {
  local raw="${1:-}"
  raw="${raw%\"}"
  raw="${raw#\"}"
  raw="${raw%\'}"
  raw="${raw#\'}"
  [[ "$raw" =~ ^postgres(ql)?://act_user:act_pass@(localhost|127\.0\.0\.1)(:5432)?/act_obe(\?.*)?$ ]]
}

require_local_database_urls() {
  if ! is_allowed_local_act_obe_url "${DATABASE_URL:-}"; then
    echo "[start] Refusing database writes: DATABASE_URL is not the local act_obe instance." >&2
    echo "[start] Expected ${LOCAL_DATABASE_URL} (host may be 127.0.0.1)." >&2
    echo "[start] Remove or replace .env so Cloud Agent startup cannot migrate or seed a shared/staging/production database." >&2
    exit 1
  fi
  if [ -n "${SHADOW_DATABASE_URL:-}" ] && ! is_allowed_local_act_obe_url "${SHADOW_DATABASE_URL}"; then
    echo "[start] Refusing database writes: SHADOW_DATABASE_URL is not the local act_obe instance." >&2
    echo "[start] Expected ${LOCAL_SHADOW_DATABASE_URL} (host may be 127.0.0.1)." >&2
    exit 1
  fi
}

# 1. Ensure a local .env exists. Secrets are generated once and then reused so
#    NextAuth sessions survive restarts. .env is gitignored.
if [ ! -f .env ]; then
  echo "[start] Generating local .env with development secrets."
  cat > .env <<EOF
DATABASE_URL="${LOCAL_DATABASE_URL}"
SHADOW_DATABASE_URL="${LOCAL_SHADOW_DATABASE_URL}"
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

# 5. Load env, then fail closed unless the target is the local act_obe instance.
set -a; . ./.env; set +a
require_local_database_urls

# 6. Apply database migrations only after the local target identity is confirmed.
npx prisma migrate deploy

# 7. Local fixture accounts only. seed-demo-user.mjs is an apply-gated writer
#    in the product toolchain; this start path may call it only after the
#    DATABASE_URL identity check above has proven the target is local act_obe.
node scripts/db/seed-demo-user.mjs || echo "[start] demo account seed skipped/failed (non-fatal)."

echo "[start] Services ready. Dev server starts via the configured terminal."
