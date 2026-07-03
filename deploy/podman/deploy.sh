#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if [ -f "${SCRIPT_DIR}/../.env.server" ] || [ -d "${SCRIPT_DIR}/../data" ]; then
  PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
else
  PROJECT_DIR="$(cd "${SCRIPT_DIR}/../.." && pwd)"
fi
RUNTIME_ENV_FILE="${RUNTIME_ENV_FILE:-$PROJECT_DIR/data/runtime/act-obe.env}"

MODE="${1:---all}"
case "$MODE" in
  --all|--db-only|--app-only)
    ;;
  *)
    echo "用法: $0 [--all|--db-only|--app-only]" >&2
    exit 1
    ;;
esac

for env_file in "$PROJECT_DIR/.env.server" "$SCRIPT_DIR/.env.server" "$PROJECT_DIR/.env" "$SCRIPT_DIR/.env"; do
  if [ -f "$env_file" ]; then
    set -a
    # shellcheck disable=SC1090
    . "$env_file"
    set +a
  fi
done

operator_adaptive_learner_state_service_enabled_was_set=0
operator_adaptive_learner_state_service_enabled=""
if [ "${ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED+x}" = "x" ]; then
  operator_adaptive_learner_state_service_enabled_was_set=1
  operator_adaptive_learner_state_service_enabled="$ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED"
fi

if [ -f "$RUNTIME_ENV_FILE" ]; then
  set -a
  # shellcheck disable=SC1090
  . "$RUNTIME_ENV_FILE"
  set +a
fi

if [ "$operator_adaptive_learner_state_service_enabled_was_set" = "1" ]; then
  ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED="$operator_adaptive_learner_state_service_enabled"
else
  unset ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED
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

normalize_public_app_url() {
  local raw_url="$1"
  local app_domain="$2"

  if [ -z "$app_domain" ]; then
    printf '%s\n' "$raw_url"
    return 0
  fi

  if [ -z "$raw_url" ] || [[ "$raw_url" == http://localhost:* ]] || [[ "$raw_url" == http://127.0.0.1:* ]] || [[ "$raw_url" == https://localhost:* ]] || [[ "$raw_url" == https://127.0.0.1:* ]]; then
    printf 'https://%s\n' "$app_domain"
    return 0
  fi

  printf '%s\n' "$raw_url"
}

APP_CONTAINER="${APP_CONTAINER:-${APP_NAME:-act-obe-app}}"
DB_CONTAINER="${DB_CONTAINER:-${POSTGRES_NAME:-act-obe-postgres}}"
REDIS_CONTAINER="${REDIS_CONTAINER:-${REDIS_NAME:-act-obe-redis}}"
WORKER_CONTAINER="${WORKER_CONTAINER:-${WORKER_NAME:-act-obe-worker}}"
NETWORK_NAME="${NETWORK_NAME:-${PODMAN_NETWORK:-act-obe-network}}"
DB_HOST_ALIAS="${DB_HOST_ALIAS:-${DB_CONTAINER}.dns.podman}"
REDIS_HOST_ALIAS="${REDIS_HOST_ALIAS:-${REDIS_CONTAINER}.dns.podman}"
DB_VOLUME="${DB_VOLUME:-${POSTGRES_VOLUME:-act-obe-pgdata}}"
REDIS_VOLUME="${REDIS_VOLUME:-act-obe-redis-data}"

APP_PORT="${APP_PORT:-8083}"
APP_CONTAINER_PORT="${APP_CONTAINER_PORT:-3000}"
APP_PORT_MAX="${APP_PORT_MAX:-65535}"

DB_NAME="${DB_NAME:-${POSTGRES_DB:-act_obe}}"
DB_USER="${DB_USER:-${POSTGRES_USER:-act_user}}"
DB_PASSWORD="${DB_PASSWORD:-${POSTGRES_PASSWORD:-}}"
if [ -z "$DB_PASSWORD" ]; then
  DB_PASSWORD="$(derive_db_password || true)"
fi
DB_PASSWORD="${DB_PASSWORD:-ChangeMe_Act_2026!}"
APP_DOMAIN="${APP_DOMAIN:-act.adapt-learn.online}"
NEXTAUTH_URL="$(normalize_public_app_url "${NEXTAUTH_URL:-}" "$APP_DOMAIN")"

APP_IMAGE="${APP_IMAGE:-act-obe-platform:20260301-amd64}"
DB_IMAGE="${DB_IMAGE:-${POSTGRES_IMAGE:-postgres:15-alpine-amd64}}"
REDIS_IMAGE="${REDIS_IMAGE:-docker.io/redis:7-alpine}"
NODE_ENV="${NODE_ENV:-production}"
NEXT_TELEMETRY_DISABLED="${NEXT_TELEMETRY_DISABLED:-1}"
WORKER_CONCURRENCY="${WORKER_CONCURRENCY:-2}"
ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED="${ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED:-true}"
REDIS_MAXMEMORY="${REDIS_MAXMEMORY:-512mb}"
REDIS_MAXMEMORY_POLICY="${REDIS_MAXMEMORY_POLICY:-noeviction}"
RUN_MIGRATIONS_ON_START="${RUN_MIGRATIONS_ON_START:-}"
if [ -z "$RUN_MIGRATIONS_ON_START" ]; then
  RUN_MIGRATIONS_ON_START="1"
fi
RUNTIME_CONTENT_DIR="${RUNTIME_CONTENT_DIR:-${PROJECT_DIR}/course-content/runtime}"
START_WRAPPER_PATH="${START_WRAPPER_PATH:-${PROJECT_DIR}/scripts/container-start-wrapper.sh}"

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: 缺少命令: $1" >&2
    exit 1
  fi
}

resolve_image() {
  local preferred="$1"
  local pattern="$2"
  local found

  if podman image exists "$preferred"; then
    echo "$preferred"
    return 0
  fi

  if podman image exists "localhost/$preferred"; then
    echo "localhost/$preferred"
    return 0
  fi

  found="$(podman images --format '{{.Repository}}:{{.Tag}}' | grep -E "$pattern" | head -n 1 || true)"
  if [ -n "$found" ]; then
    echo "$found"
    return 0
  fi

  echo ""
  return 1
}

is_port_busy() {
  local port="$1"
  ss -lnt | awk '{print $4}' | grep -Eq "[.:]${port}$"
}

find_available_port() {
  local start_port="$1"
  local max_port="$2"
  local port="$start_port"

  while [ "$port" -le "$max_port" ]; do
    if ! is_port_busy "$port"; then
      echo "$port"
      return 0
    fi
    port=$((port + 1))
  done

  return 1
}

remove_if_exists() {
  local name="$1"
  if podman container exists "$name"; then
    echo "- 删除旧容器: $name"
    if ! podman rm -f "$name" >/dev/null 2>&1; then
      echo "WARNING: 常规删除失败，尝试 cleanup --rm: $name" >&2
      podman container cleanup --rm "$name" >/dev/null 2>&1 || true
    fi
    if podman container exists "$name"; then
      echo "ERROR: 无法删除旧容器: $name" >&2
      podman inspect "$name" --format '{{json .State}}' >&2 || true
      exit 1
    fi
  fi
}

wait_for_db() {
  local max_wait=120
  local elapsed=0

  while [ "$elapsed" -lt "$max_wait" ]; do
    if podman exec -e PGPASSWORD="$DB_PASSWORD" "$DB_CONTAINER" pg_isready -U "$DB_USER" -d "$DB_NAME" >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done

  return 1
}

wait_for_redis() {
  local max_wait=60
  local elapsed=0

  while [ "$elapsed" -lt "$max_wait" ]; do
    if podman exec "$REDIS_CONTAINER" redis-cli ping >/dev/null 2>&1; then
      return 0
    fi
    sleep 2
    elapsed=$((elapsed + 2))
  done

  return 1
}

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

resolve_container_ip() {
  local container_name="$1"
  local container_ip

  container_ip="$(
    podman inspect \
      --format "{{range \$name, \$conf := .NetworkSettings.Networks}}{{if eq \$name \"${NETWORK_NAME}\"}}{{\$conf.IPAddress}}{{end}}{{end}}" \
      "$container_name" 2>/dev/null || true
  )"

  if [ -z "$container_ip" ]; then
    echo "ERROR: 无法解析容器在网络 ${NETWORK_NAME} 上的 IP: ${container_name}" >&2
    podman inspect "$container_name" >&2 || true
    exit 1
  fi

  printf '%s\n' "$container_ip"
}

write_runtime_env() {
  local selected_app_port="$1"
  local redis_url_value="$2"

  mkdir -p "$(dirname "$RUNTIME_ENV_FILE")"
  cat > "$RUNTIME_ENV_FILE" <<EOF
APP_PORT=$selected_app_port
APP_CONTAINER_PORT=$APP_CONTAINER_PORT
APP_DOMAIN=$APP_DOMAIN
APP_IMAGE=$APP_IMAGE
APP_CONTAINER=$APP_CONTAINER
DB_CONTAINER=$DB_CONTAINER
DB_IMAGE=$DB_IMAGE
REDIS_CONTAINER=$REDIS_CONTAINER
REDIS_IMAGE=$REDIS_IMAGE
REDIS_URL=$redis_url_value
WORKER_CONTAINER=$WORKER_CONTAINER
WORKER_CONCURRENCY=$WORKER_CONCURRENCY
NETWORK_NAME=$NETWORK_NAME
DB_VOLUME=$DB_VOLUME
REDIS_VOLUME=$REDIS_VOLUME
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_HOST=$DB_HOST_ALIAS
RUNTIME_CONTENT_DIR=$RUNTIME_CONTENT_DIR
EOF
  echo "- 运行参数已写入: $RUNTIME_ENV_FILE"
}

ensure_network_and_volume() {
  if ! podman network exists "$NETWORK_NAME"; then
    echo "- 创建网络: $NETWORK_NAME"
    podman network create "$NETWORK_NAME" >/dev/null
  fi

  if ! podman volume exists "$DB_VOLUME"; then
    echo "- 创建数据卷: $DB_VOLUME"
    podman volume create "$DB_VOLUME" >/dev/null
  fi

  if ! podman volume exists "$REDIS_VOLUME"; then
    echo "- 创建 Redis 数据卷: $REDIS_VOLUME"
    podman volume create "$REDIS_VOLUME" >/dev/null
  fi
}

prepare_app_port() {
  local desired_port="${APP_PORT:-8083}"
  local selected_port

  selected_port="$(find_available_port "$desired_port" "$APP_PORT_MAX" || true)"
  if [ -z "$selected_port" ]; then
    echo "ERROR: 从端口 $desired_port 到 $APP_PORT_MAX 均不可用，无法部署应用容器。" >&2
    exit 1
  fi

  if [ "$selected_port" != "$desired_port" ]; then
    echo "- 端口 $desired_port 不可用，自动顺延使用: $selected_port"
  fi

  APP_PORT="$selected_port"
}

ensure_db_running() {
  if ! podman ps --format '{{.Names}}' | grep -Fxq "$DB_CONTAINER"; then
    echo "ERROR: PostgreSQL 容器未运行: $DB_CONTAINER" >&2
    exit 1
  fi

  if ! wait_for_db; then
    echo "ERROR: PostgreSQL 启动超时，请检查日志。" >&2
    podman logs --tail 80 "$DB_CONTAINER" || true
    exit 1
  fi
}

ensure_redis_running() {
  if ! podman ps --format '{{.Names}}' | grep -Fxq "$REDIS_CONTAINER"; then
    echo "ERROR: Redis 容器未运行: $REDIS_CONTAINER" >&2
    exit 1
  fi

  if ! wait_for_redis; then
    echo "ERROR: Redis 启动超时，请检查日志。" >&2
    podman logs --tail 80 "$REDIS_CONTAINER" || true
    exit 1
  fi
}

run_scheduler_once() {
  echo "- 执行 scheduler 初始化 BullMQ 重复任务"
  local attempt
  for attempt in $(seq 1 10); do
    if podman exec "$WORKER_CONTAINER" ./node_modules/.bin/tsx scripts/workers/scheduler.ts >/dev/null; then
      return 0
    fi
    sleep 3
  done

  echo "ERROR: scheduler 初始化失败" >&2
  podman logs --tail 120 "$WORKER_CONTAINER" >&2 || true
  return 1
}

require_cmd podman
require_cmd ss

echo "[4-deploy] 开始部署..."

if ! APP_IMAGE="$(resolve_image "$APP_IMAGE" '(^|/)act-obe-platform:')"; then
  echo "ERROR: 未找到应用镜像。请先执行 load-images。" >&2
  exit 1
fi

if ! DB_IMAGE="$(resolve_image "$DB_IMAGE" '(^|/)postgres:15-alpine-amd64$')"; then
  echo "ERROR: 未找到 PostgreSQL 镜像。请先执行 load-images。" >&2
  exit 1
fi

echo "- 应用镜像: $APP_IMAGE"
echo "- 数据库镜像: $DB_IMAGE"
echo "- Redis 镜像: $REDIS_IMAGE"

ensure_network_and_volume
mkdir -p "$RUNTIME_CONTENT_DIR"

if [ ! -f "$START_WRAPPER_PATH" ]; then
  echo "ERROR: 缺少启动包装脚本: $START_WRAPPER_PATH" >&2
  exit 1
fi

if [ "$MODE" = "--all" ] || [ "$MODE" = "--db-only" ]; then
  remove_if_exists "$WORKER_CONTAINER"
  remove_if_exists "$APP_CONTAINER"
  remove_if_exists "$REDIS_CONTAINER"
  remove_if_exists "$DB_CONTAINER"
else
  remove_if_exists "$WORKER_CONTAINER"
  remove_if_exists "$APP_CONTAINER"
  remove_if_exists "$REDIS_CONTAINER"
fi

prepare_app_port
REDIS_URL_DEFAULT="redis://${REDIS_HOST_ALIAS}:6379"
REDIS_URL="${REDIS_URL:-$REDIS_URL_DEFAULT}"
REDIS_URL="$(printf '%s' "$REDIS_URL" | sed "s#redis://${REDIS_CONTAINER}:#redis://${REDIS_HOST_ALIAS}:#")"
REDIS_URL="$(printf '%s' "$REDIS_URL" | sed "s#redis://${REDIS_CONTAINER}\\.dns\\.podman:#redis://${REDIS_HOST_ALIAS}:#")"
REDIS_URL="$(printf '%s' "$REDIS_URL" | sed "s#redis://localhost:#redis://${REDIS_HOST_ALIAS}:#")"
write_runtime_env "$APP_PORT" "$REDIS_URL"

if [ "$MODE" = "--all" ] || [ "$MODE" = "--db-only" ]; then
  echo "- 启动 PostgreSQL 容器: $DB_CONTAINER"
  podman run -d \
    --name "$DB_CONTAINER" \
    --restart unless-stopped \
    --network "$NETWORK_NAME" \
    --network-alias "$DB_CONTAINER" \
    -v "$DB_VOLUME":/var/lib/postgresql/data:Z \
    -e POSTGRES_DB="$DB_NAME" \
    -e POSTGRES_USER="$DB_USER" \
    -e POSTGRES_PASSWORD="$DB_PASSWORD" \
    --health-cmd "pg_isready -U $DB_USER -d $DB_NAME" \
    --health-interval 10s \
    --health-timeout 5s \
    --health-retries 6 \
    "$DB_IMAGE" >/dev/null

  ensure_db_running
fi

if [ "$MODE" = "--db-only" ]; then
  echo "[4-deploy] 数据库容器已就绪，应用与 Redis/worker 未启动。"
  podman ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}' | grep -E "NAMES|${DB_CONTAINER}" || true
  exit 0
fi

ensure_db_running
DATABASE_URL_DEFAULT="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST_ALIAS}:5432/${DB_NAME}?connection_limit=10&pool_timeout=20"
DATABASE_URL="${DATABASE_URL:-$DATABASE_URL_DEFAULT}"
DATABASE_URL="$(printf '%s' "$DATABASE_URL" | sed "s#@${DB_CONTAINER}:#@${DB_HOST_ALIAS}:#")"
DATABASE_URL="$(printf '%s' "$DATABASE_URL" | sed "s#@${DB_CONTAINER}\\.dns\\.podman:#@${DB_HOST_ALIAS}:#")"
DATABASE_URL="$(printf '%s' "$DATABASE_URL" | sed "s#@localhost:#@${DB_HOST_ALIAS}:#")"
DATABASE_URL="$(ensure_database_url_param "$DATABASE_URL" "connection_limit" "10")"
DATABASE_URL="$(ensure_database_url_param "$DATABASE_URL" "pool_timeout" "20")"

echo "- 启动 Redis 容器: $REDIS_CONTAINER"
podman run -d \
  --name "$REDIS_CONTAINER" \
  --restart unless-stopped \
  --network "$NETWORK_NAME" \
  --network-alias "$REDIS_CONTAINER" \
  -v "$REDIS_VOLUME":/data:Z \
  "$REDIS_IMAGE" \
  redis-server --appendonly yes --maxmemory "$REDIS_MAXMEMORY" --maxmemory-policy "$REDIS_MAXMEMORY_POLICY" >/dev/null

ensure_redis_running

DB_CONTAINER_IP="$(resolve_container_ip "$DB_CONTAINER")"
REDIS_CONTAINER_IP="$(resolve_container_ip "$REDIS_CONTAINER")"
DB_HOST_ARGS=(--add-host "${DB_CONTAINER}:${DB_CONTAINER_IP}" --add-host "${DB_CONTAINER}.dns.podman:${DB_CONTAINER_IP}")
REDIS_HOST_ARGS=(--add-host "${REDIS_CONTAINER}:${REDIS_CONTAINER_IP}" --add-host "${REDIS_CONTAINER}.dns.podman:${REDIS_CONTAINER_IP}")

echo "- 解析数据库容器 IP: ${DB_CONTAINER} -> ${DB_CONTAINER_IP}"
echo "- 解析 Redis 容器 IP: ${REDIS_CONTAINER} -> ${REDIS_CONTAINER_IP}"

echo "- 等待数据库 TCP 可连通: ${DB_CONTAINER_IP}:5432"
if ! wait_for_node_tcp "$DB_CONTAINER_IP" 5432; then
  echo "ERROR: 数据库 TCP 连通超时: ${DB_CONTAINER} (${DB_CONTAINER_IP}):5432" >&2
  podman network inspect "$NETWORK_NAME" >&2 || true
  exit 1
fi

echo "- 等待 Redis TCP 可连通: ${REDIS_CONTAINER_IP}:6379"
if ! wait_for_node_tcp "$REDIS_CONTAINER_IP" 6379; then
  echo "ERROR: Redis TCP 连通超时: ${REDIS_CONTAINER} (${REDIS_CONTAINER_IP}):6379" >&2
  podman network inspect "$NETWORK_NAME" >&2 || true
  exit 1
fi

SHARED_ENV_ARGS=(
  -e NODE_ENV="$NODE_ENV"
  -e NEXT_TELEMETRY_DISABLED="$NEXT_TELEMETRY_DISABLED"
  -e DATABASE_URL="$DATABASE_URL"
  -e POSTGRES_HOST="$DB_HOST_ALIAS"
  -e POSTGRES_PORT=5432
  -e POSTGRES_DB="$DB_NAME"
  -e POSTGRES_USER="$DB_USER"
  -e POSTGRES_PASSWORD="$DB_PASSWORD"
  -e APP_DOMAIN="$APP_DOMAIN"
  -e REDIS_URL="$REDIS_URL"
  -e ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED="$ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED"
)
if [ -n "${KONLING_SERVER_MODE_CONTEXT_SECRET:-}" ]; then
  SHARED_ENV_ARGS+=(-e KONLING_SERVER_MODE_CONTEXT_SECRET="$KONLING_SERVER_MODE_CONTEXT_SECRET")
fi

APP_ENV_ARGS=(
  "${SHARED_ENV_ARGS[@]}"
  -e RUN_MIGRATIONS_ON_START="$RUN_MIGRATIONS_ON_START"
  -e PORT="$APP_CONTAINER_PORT"
  -e HOSTNAME=0.0.0.0
)

if [ -n "${NEXTAUTH_URL:-}" ]; then
  APP_ENV_ARGS+=(-e NEXTAUTH_URL="$NEXTAUTH_URL")
fi
if [ -n "${NEXTAUTH_SECRET:-}" ]; then
  APP_ENV_ARGS+=(-e NEXTAUTH_SECRET="$NEXTAUTH_SECRET")
fi
if [ -n "${AI_PROVIDER:-}" ]; then
  APP_ENV_ARGS+=(-e AI_PROVIDER="$AI_PROVIDER")
fi
if [ -n "${AI_BASE_URL:-}" ]; then
  APP_ENV_ARGS+=(-e AI_BASE_URL="$AI_BASE_URL")
fi
if [ -n "${AI_API_KEY:-}" ]; then
  APP_ENV_ARGS+=(-e AI_API_KEY="$AI_API_KEY")
fi
if [ -n "${AI_MODEL:-}" ]; then
  APP_ENV_ARGS+=(-e AI_MODEL="$AI_MODEL")
fi
if [ -n "${SILICONFLOW_API_URL:-}" ]; then
  APP_ENV_ARGS+=(-e SILICONFLOW_API_URL="$SILICONFLOW_API_URL")
fi
if [ -n "${SILICONFLOW_API_KEY:-}" ]; then
  APP_ENV_ARGS+=(-e SILICONFLOW_API_KEY="$SILICONFLOW_API_KEY")
fi
if [ -n "${SILICONFLOW_MODEL:-}" ]; then
  APP_ENV_ARGS+=(-e SILICONFLOW_MODEL="$SILICONFLOW_MODEL")
fi
if [ -n "${SIM_SERVICE_URL:-}" ]; then
  APP_ENV_ARGS+=(-e SIM_SERVICE_URL="$SIM_SERVICE_URL")
fi
if [ -n "${LLM_SERVICE_URL:-}" ]; then
  APP_ENV_ARGS+=(-e LLM_SERVICE_URL="$LLM_SERVICE_URL")
fi

echo "- 启动应用容器: $APP_CONTAINER"
podman run -d \
  --name "$APP_CONTAINER" \
  --restart unless-stopped \
  --network "$NETWORK_NAME" \
  --entrypoint /bin/sh \
  -p "${APP_PORT}:${APP_CONTAINER_PORT}" \
  -v "${RUNTIME_CONTENT_DIR}:/app/course-content/runtime:ro" \
  -v "${START_WRAPPER_PATH}:/app-container-start-wrapper.sh:ro" \
  "${DB_HOST_ARGS[@]}" \
  "${REDIS_HOST_ARGS[@]}" \
  "${APP_ENV_ARGS[@]}" \
  "$APP_IMAGE" \
  /app-container-start-wrapper.sh app >/dev/null

WORKER_ENV_ARGS=(
  "${SHARED_ENV_ARGS[@]}"
  -e RUN_MIGRATIONS_ON_START=0
  -e WORKER_CONCURRENCY="$WORKER_CONCURRENCY"
)

echo "- 启动数据治理 worker 容器: $WORKER_CONTAINER"
podman run -d \
  --name "$WORKER_CONTAINER" \
  --restart unless-stopped \
  --network "$NETWORK_NAME" \
  --entrypoint /bin/sh \
  -v "${START_WRAPPER_PATH}:/app-container-start-wrapper.sh:ro" \
  "${DB_HOST_ARGS[@]}" \
  "${REDIS_HOST_ARGS[@]}" \
  "${WORKER_ENV_ARGS[@]}" \
  "$APP_IMAGE" \
  /app-container-start-wrapper.sh worker >/dev/null

run_scheduler_once

echo "[4-deploy] 部署完成。"
echo "- 公网访问: http://121.40.124.135:${APP_PORT}"
echo "- 目标域名: http://${APP_DOMAIN} (需在 Nginx 配置反向代理到 127.0.0.1:${APP_PORT})"
echo "- 运行时资源目录: ${RUNTIME_CONTENT_DIR} -> /app/course-content/runtime"
echo
podman ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}' | grep -E "NAMES|${APP_CONTAINER}|${DB_CONTAINER}|${REDIS_CONTAINER}|${WORKER_CONTAINER}" || true
