#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${SCRIPT_DIR}/../.env.server" ] || [ -d "${SCRIPT_DIR}/../data" ]; then
  PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
else
  PROJECT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
fi
RUNTIME_ENV_FILE="${RUNTIME_ENV_FILE:-$PROJECT_DIR/data/runtime/act-obe.env}"

for env_file in "$PROJECT_DIR/.env.server" "$SCRIPT_DIR/.env.server" "$PROJECT_DIR/.env" "$SCRIPT_DIR/.env"; do
  if [ -f "$env_file" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$env_file"
    set +a
  fi
done

if [ -f "$RUNTIME_ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$RUNTIME_ENV_FILE"
  set +a
fi

derive_db_password() {
  local database_url="${DATABASE_URL:-}"
  local without_scheme
  local credentials
  local password

  if [ -z "$database_url" ]; then
    return 1
  fi

  without_scheme="${database_url#*://}"
  credentials="${without_scheme%%@*}"
  password="${credentials#*:}"

  if [ "$password" = "$credentials" ] || [ -z "$password" ]; then
    return 1
  fi

  printf '%s\n' "$password"
}

ensure_database_url_param() {
  local database_url="$1"
  local key="$2"
  local value="$3"
  local separator='?'

  if [[ "$database_url" == *"${key}="* ]]; then
    printf '%s\n' "$database_url"
    return 0
  fi

  if [[ "$database_url" == *\?* ]]; then
    separator='&'
  fi

  printf '%s%s%s=%s\n' "$database_url" "$separator" "$key" "$value"
}

APP_CONTAINER="${APP_CONTAINER:-${APP_NAME:-act-obe-app}}"
DB_CONTAINER="${DB_CONTAINER:-${POSTGRES_NAME:-act-obe-postgres}}"
REDIS_CONTAINER="${REDIS_CONTAINER:-${REDIS_NAME:-act-obe-redis}}"
WORKER_CONTAINER="${WORKER_CONTAINER:-${WORKER_NAME:-act-obe-worker}}"
SERVICE_NAME="${SERVICE_NAME:-act-obe-stack.service}"
SERVICE_FILE="/etc/systemd/system/${SERVICE_NAME}"
DB_NAME="${DB_NAME:-${POSTGRES_DB:-act_obe}}"
DB_USER="${DB_USER:-${POSTGRES_USER:-act_user}}"
DB_PASSWORD="${DB_PASSWORD:-${POSTGRES_PASSWORD:-}}"
if [ -z "$DB_PASSWORD" ]; then
  DB_PASSWORD="$(derive_db_password || true)"
fi
DB_PASSWORD="${DB_PASSWORD:-ChangeMe_Act_2026!}"
APP_PORT="${APP_PORT:-8083}"
APP_IMAGE="${APP_IMAGE:-localhost/act-obe-platform:20260301-amd64}"
APP_DEPLOY_SCRIPT="${APP_DEPLOY_SCRIPT:-${PROJECT_DIR}/scripts/4-deploy.sh}"
NETWORK_NAME="${NETWORK_NAME:-${PODMAN_NETWORK:-act-obe-network}}"
DB_HOST_ALIAS="${DB_HOST_ALIAS:-${DB_CONTAINER}.dns.podman}"
REDIS_HOST_ALIAS="${REDIS_HOST_ALIAS:-${REDIS_CONTAINER}.dns.podman}"
REDIS_URL="${REDIS_URL:-redis://${REDIS_HOST_ALIAS}:6379}"
REDIS_URL="$(printf '%s' "$REDIS_URL" | sed "s#redis://${REDIS_CONTAINER}:#redis://${REDIS_HOST_ALIAS}:#")"
REDIS_URL="$(printf '%s' "$REDIS_URL" | sed "s#redis://${REDIS_CONTAINER}\\.dns\\.podman:#redis://${REDIS_HOST_ALIAS}:#")"
REDIS_URL="$(printf '%s' "$REDIS_URL" | sed "s#redis://localhost:#redis://${REDIS_HOST_ALIAS}:#")"
WORKER_CONCURRENCY="${WORKER_CONCURRENCY:-2}"
DATABASE_URL="${DATABASE_URL:-postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST_ALIAS}:5432/${DB_NAME}?connection_limit=10&pool_timeout=20}"
DATABASE_URL="$(printf '%s' "$DATABASE_URL" | sed "s#@${DB_CONTAINER}:#@${DB_HOST_ALIAS}:#")"
DATABASE_URL="$(printf '%s' "$DATABASE_URL" | sed "s#@${DB_CONTAINER}\\.dns\\.podman:#@${DB_HOST_ALIAS}:#")"
DATABASE_URL="$(printf '%s' "$DATABASE_URL" | sed "s#@localhost:#@${DB_HOST_ALIAS}:#")"
DATABASE_URL="$(ensure_database_url_param "$DATABASE_URL" "connection_limit" "10")"
DATABASE_URL="$(ensure_database_url_param "$DATABASE_URL" "pool_timeout" "20")"

if ! command -v systemctl >/dev/null 2>&1; then
  echo "ERROR: systemctl 不可用，无法配置开机自启服务。" >&2
  exit 1
fi

if ! command -v podman >/dev/null 2>&1; then
  echo "ERROR: podman 未安装。" >&2
  exit 1
fi

if ! command -v curl >/dev/null 2>&1; then
  echo "ERROR: curl 未安装。" >&2
  exit 1
fi

if [ ! -x "$APP_DEPLOY_SCRIPT" ]; then
  echo "ERROR: 缺少可执行的应用部署脚本: $APP_DEPLOY_SCRIPT" >&2
  exit 1
fi

node_tcp_probe() {
  local host="$1"
  local port="$2"

  podman run --rm \
    --network "$NETWORK_NAME" \
    --entrypoint node \
    "$APP_IMAGE" \
    -e "const net = require('node:net'); const host = process.argv[1]; const port = Number(process.argv[2]); const socket = net.connect({ host, port }); function fail() { process.exit(1); } socket.setTimeout(3000); socket.on('connect', () => { socket.end(); process.exit(0); }); socket.on('timeout', fail); socket.on('error', fail);" \
    "$host" \
    "$port"
}

wait_for_node_tcp() {
  local host="$1"
  local port="$2"
  local max_wait="${3:-60}"
  local elapsed=0

  while [ "$elapsed" -lt "$max_wait" ]; do
    if node_tcp_probe "$host" "$port" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done

  return 1
}

if ! podman container exists "$DB_CONTAINER"; then
  echo "ERROR: 容器不存在: $DB_CONTAINER。请先部署。" >&2
  exit 1
fi

if ! podman container exists "$REDIS_CONTAINER"; then
  echo "ERROR: 容器不存在: $REDIS_CONTAINER。请先部署。" >&2
  exit 1
fi

if ! podman container exists "$APP_CONTAINER"; then
  echo "ERROR: 容器不存在: $APP_CONTAINER。请先部署。" >&2
  exit 1
fi

if ! podman container exists "$WORKER_CONTAINER"; then
  echo "ERROR: 容器不存在: $WORKER_CONTAINER。请先部署。" >&2
  exit 1
fi

echo "- 校验数据库 TCP 可连通: ${DB_HOST_ALIAS}:5432"
if ! wait_for_node_tcp "$DB_HOST_ALIAS" 5432; then
  echo "ERROR: 数据库 TCP 连通超时: ${DB_HOST_ALIAS}:5432" >&2
  podman network inspect "$NETWORK_NAME" >&2 || true
  exit 1
fi

echo "- 校验 Redis TCP 可连通: ${REDIS_HOST_ALIAS}:6379"
if ! wait_for_node_tcp "$REDIS_HOST_ALIAS" 6379; then
  echo "ERROR: Redis TCP 连通超时: ${REDIS_HOST_ALIAS}:6379" >&2
  podman network inspect "$NETWORK_NAME" >&2 || true
  exit 1
fi

NODE_TCP_PROBE="const net = require(\"node:net\"); const host = process.argv[1]; const port = Number(process.argv[2]); const socket = net.connect({ host, port }); function fail() { process.exit(1); } socket.setTimeout(3000); socket.on(\"connect\", () => { socket.end(); process.exit(0); }); socket.on(\"timeout\", fail); socket.on(\"error\", fail);"
WAIT_DB_TCP_CMD="/bin/sh -lc 'for i in \$(seq 1 30); do /usr/bin/podman run --rm --network ${NETWORK_NAME} --entrypoint node ${APP_IMAGE} -e '\\''${NODE_TCP_PROBE}'\\'' ${DB_HOST_ALIAS} 5432 >/dev/null 2>&1 && exit 0; sleep 2; done; exit 1'"
WAIT_REDIS_TCP_CMD="/bin/sh -lc 'for i in \$(seq 1 30); do /usr/bin/podman run --rm --network ${NETWORK_NAME} --entrypoint node ${APP_IMAGE} -e '\\''${NODE_TCP_PROBE}'\\'' ${REDIS_HOST_ALIAS} 6379 >/dev/null 2>&1 && exit 0; sleep 2; done; exit 1'"

cat > "$SERVICE_FILE" <<UNIT
[Unit]
Description=ACT OBE Podman Stack
Wants=network-online.target
After=network-online.target

[Service]
Type=oneshot
RemainAfterExit=yes
KillMode=none
Delegate=yes
ExecStart=/usr/bin/podman start ${DB_CONTAINER}
ExecStart=/bin/sh -lc 'until /usr/bin/podman exec -e PGPASSWORD="${DB_PASSWORD}" ${DB_CONTAINER} pg_isready -U "${DB_USER}" -d "${DB_NAME}" >/dev/null 2>&1; do sleep 2; done'
ExecStart=/bin/sh -lc '"${APP_DEPLOY_SCRIPT}" --app-only'
ExecStop=/usr/bin/podman stop -t 20 ${WORKER_CONTAINER}
ExecStop=/usr/bin/podman stop -t 20 ${APP_CONTAINER}
ExecStop=/usr/bin/podman stop -t 20 ${REDIS_CONTAINER}
ExecStop=/usr/bin/podman stop -t 20 ${DB_CONTAINER}
TimeoutStartSec=240
TimeoutStopSec=120

[Install]
WantedBy=multi-user.target
UNIT

systemctl daemon-reload
systemctl enable "$SERVICE_NAME" >/dev/null
systemctl restart "$SERVICE_NAME"

if ! podman ps --format '{{.Names}}' | grep -Fxq "$DB_CONTAINER"; then
  echo "ERROR: systemd 启动后数据库容器未运行: $DB_CONTAINER" >&2
  exit 1
fi

if ! podman ps --format '{{.Names}}' | grep -Fxq "$REDIS_CONTAINER"; then
  echo "ERROR: systemd 启动后 Redis 容器未运行: $REDIS_CONTAINER" >&2
  exit 1
fi

if ! podman ps --format '{{.Names}}' | grep -Fxq "$APP_CONTAINER"; then
  echo "ERROR: systemd 启动后应用容器未运行: $APP_CONTAINER" >&2
  exit 1
fi

if ! podman ps --format '{{.Names}}' | grep -Fxq "$WORKER_CONTAINER"; then
  echo "ERROR: systemd 启动后 worker 容器未运行: $WORKER_CONTAINER" >&2
  exit 1
fi

app_ready=0
for _ in $(seq 1 30); do
  http_code="$(curl --noproxy '*' -sS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${APP_PORT}/" || true)"
  if [ "$http_code" = "200" ]; then
    app_ready=1
    break
  fi
  sleep 2
done

if [ "$app_ready" -ne 1 ]; then
  echo "ERROR: systemd 启动后本机应用入口未就绪: http://127.0.0.1:${APP_PORT}/" >&2
  podman logs --tail 80 "$APP_CONTAINER" >&2 || true
  exit 1
fi

if ! podman exec "$REDIS_CONTAINER" redis-cli ping >/dev/null 2>&1; then
  echo "ERROR: systemd 启动后 Redis 未就绪。" >&2
  podman logs --tail 80 "$REDIS_CONTAINER" >&2 || true
  exit 1
fi

echo "[5-configure-service] 已配置并启动 systemd 服务: $SERVICE_NAME"
systemctl --no-pager --full status "$SERVICE_NAME" | sed -n '1,18p'
