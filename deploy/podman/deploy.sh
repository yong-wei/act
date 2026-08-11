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
operator_app_image_was_set=0
operator_app_image=""
if [ "${APP_IMAGE+x}" = "x" ]; then
  operator_app_image_was_set=1
  operator_app_image="$APP_IMAGE"
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
if [ "$operator_app_image_was_set" = "1" ]; then
  APP_IMAGE="$operator_app_image"
else
  unset APP_IMAGE
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
SUBMISSION_SCANNER_CONTAINER="${SUBMISSION_SCANNER_CONTAINER:-act-obe-submission-scanner}"
SUBMISSION_GC_CONTAINER="${SUBMISSION_GC_CONTAINER:-act-obe-submission-gc}"
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

APP_IMAGE="${APP_IMAGE:-localhost/act-obe-platform:20260301-amd64}"
DB_IMAGE="${DB_IMAGE:-${POSTGRES_IMAGE:-postgres:15-alpine-amd64}}"
REDIS_IMAGE="${REDIS_IMAGE:-docker.io/redis:7-alpine}"
NODE_ENV="${NODE_ENV:-production}"
ACT_KNOWLEDGE_DEPLOYMENT_MODE="${ACT_KNOWLEDGE_DEPLOYMENT_MODE:-legacy}"
NEXT_TELEMETRY_DISABLED="${NEXT_TELEMETRY_DISABLED:-1}"
WORKER_CONCURRENCY="${WORKER_CONCURRENCY:-2}"
MATH_DOCUMENT_GRADING_WORKER_REQUIRED="${MATH_DOCUMENT_GRADING_WORKER_REQUIRED:-true}"
ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED="${ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED:-true}"
SMART_COURSEWARE_ORDERING_SECRET="${SMART_COURSEWARE_ORDERING_SECRET:-}"
MATHPIX_IMAGE_ENDPOINT="${MATHPIX_IMAGE_ENDPOINT:-https://api.mathpix.com/v3/text}"
MATHPIX_DOCUMENT_ENDPOINT="${MATHPIX_DOCUMENT_ENDPOINT:-https://api.mathpix.com/v3/pdf}"
MATHPIX_CREDENTIAL_REF="${MATHPIX_CREDENTIAL_REF:-env:MATHPIX_APP_KEY}"
MATHPIX_VERSION="${MATHPIX_VERSION:-mathpix.v1}"
GRADING_MATHPIX_POLICY_VERSION="${GRADING_MATHPIX_POLICY_VERSION:-$MATHPIX_VERSION}"
SUBMISSION_SCAN_INTERVAL_SECONDS="${SUBMISSION_SCAN_INTERVAL_SECONDS:-15}"
SUBMISSION_GC_INTERVAL_SECONDS="${SUBMISSION_GC_INTERVAL_SECONDS:-3600}"
REDIS_MAXMEMORY="${REDIS_MAXMEMORY:-512mb}"
REDIS_MAXMEMORY_POLICY="${REDIS_MAXMEMORY_POLICY:-noeviction}"
POLICY_SEED_ENV_NAMES=(
  AI_PROVIDER AI_BASE_URL AI_SECRET_REF AI_MODEL
  MATHPIX_IMAGE_ENDPOINT MATHPIX_DOCUMENT_ENDPOINT MATHPIX_CREDENTIAL_REF MATHPIX_VERSION
  GRADING_SOURCE_ASSET_POLICY_VERSION GRADING_SOURCE_ASSET_RETENTION_SECONDS GRADING_SOURCE_ASSET_GOVERNED_RECORD_RULE GRADING_SOURCE_ASSET_DELETE_STRATEGY GRADING_SOURCE_ASSET_PROVIDER_RETENTION_SECONDS GRADING_SOURCE_ASSET_ENABLED
  GRADING_ANSWER_EVIDENCE_POLICY_VERSION GRADING_ANSWER_EVIDENCE_RETENTION_SECONDS GRADING_ANSWER_EVIDENCE_GOVERNED_RECORD_RULE GRADING_ANSWER_EVIDENCE_DELETE_STRATEGY GRADING_ANSWER_EVIDENCE_PROVIDER_RETENTION_SECONDS GRADING_ANSWER_EVIDENCE_ENABLED
  GRADING_DOCUMENT_CONVERSION_POLICY_VERSION GRADING_DOCUMENT_CONVERSION_RETENTION_SECONDS GRADING_DOCUMENT_CONVERSION_GOVERNED_RECORD_RULE GRADING_DOCUMENT_CONVERSION_DELETE_STRATEGY GRADING_DOCUMENT_CONVERSION_PROVIDER_RETENTION_SECONDS GRADING_DOCUMENT_CONVERSION_ENABLED
  GRADING_AI_DRAFT_POLICY_VERSION GRADING_AI_DRAFT_RETENTION_SECONDS GRADING_AI_DRAFT_GOVERNED_RECORD_RULE GRADING_AI_DRAFT_DELETE_STRATEGY GRADING_AI_DRAFT_PROVIDER_RETENTION_SECONDS GRADING_AI_DRAFT_ENABLED
  GRADING_RUN_POLICY_VERSION GRADING_RUN_RETENTION_SECONDS GRADING_RUN_GOVERNED_RECORD_RULE GRADING_RUN_DELETE_STRATEGY GRADING_RUN_PROVIDER_RETENTION_SECONDS GRADING_RUN_ENABLED
  GRADING_PROVIDER_PROCESSING_REGION GRADING_PROVIDER_AGREEMENT_VERSION GRADING_PROVIDER_NO_TRAINING GRADING_PROVIDER_RETENTION_SECONDS GRADING_PROVIDER_DELETION_CAPABILITY GRADING_PROVIDER_RATE_LIMIT_PER_MINUTE GRADING_PROVIDER_CLASS_SCOPE GRADING_PROVIDER_INSTITUTION_SCOPE
  GRADING_AI_PROVIDER_VERSION GRADING_AI_PROVIDER_ENABLED GRADING_AI_PROVIDER_DATA_CATEGORIES GRADING_AI_PROVIDER_MINIMIZED_SCOPE
  GRADING_MATHPIX_POLICY_VERSION GRADING_MATHPIX_ENABLED GRADING_MATHPIX_DATA_CATEGORIES GRADING_MATHPIX_MINIMIZED_SCOPE
)
RUN_MIGRATIONS_ON_START="${RUN_MIGRATIONS_ON_START:-}"
if [ -z "$RUN_MIGRATIONS_ON_START" ]; then
  RUN_MIGRATIONS_ON_START="1"
fi
RUNTIME_CONTENT_DIR="${RUNTIME_CONTENT_DIR:-${PROJECT_DIR}/course-content/runtime}"
# Activation-gate Authority / Teaching Projection stores (#1274).
# Projection lives under the host runtime mount so the whole-runtime volume
# overlay does not hide image-packaged empty scaffolds.
AUTHORITY_STORE_DIR="${AUTHORITY_STORE_DIR:-${PROJECT_DIR}/course-content/authoring/knowledge/authority}"
TEACHING_PROJECTION_STORE_DIR="${TEACHING_PROJECTION_STORE_DIR:-${RUNTIME_CONTENT_DIR}/knowledge/projection}"
ACT_AUTHORITY_STORE_ROOT="${ACT_AUTHORITY_STORE_ROOT:-/app/course-content/authoring/knowledge/authority}"
ACT_TEACHING_PROJECTION_STORE_ROOT="${ACT_TEACHING_PROJECTION_STORE_ROOT:-/app/course-content/runtime/knowledge/projection}"
START_WRAPPER_PATH="${START_WRAPPER_PATH:-${PROJECT_DIR}/scripts/container-start-wrapper.sh}"
if [ ! -f "$START_WRAPPER_PATH" ] && [ -f "${PROJECT_DIR}/deploy/podman/container-start-wrapper.sh" ]; then
  START_WRAPPER_PATH="${PROJECT_DIR}/deploy/podman/container-start-wrapper.sh"
fi

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo "ERROR: 缺少命令: $1" >&2
    exit 1
  fi
}

is_placeholder_mode_context_secret() {
  case "$1" in
    ""|konling-mode-context-development-secret|replace-with-strong-konling-context-secret|development-secret|your-secret-key)
      return 0
      ;;
    *)
      return 1
      ;;
  esac
}

require_konling_mode_context_secret() {
  KONLING_SERVER_MODE_CONTEXT_SECRET="${KONLING_SERVER_MODE_CONTEXT_SECRET:-${KONLING_MODE_CONTEXT_SECRET:-}}"
  if is_placeholder_mode_context_secret "$KONLING_SERVER_MODE_CONTEXT_SECRET"; then
    echo "ERROR: 缺少有效的 KONLING_SERVER_MODE_CONTEXT_SECRET，路径顾问无法签发 modeContextToken。" >&2
    echo "请在远端环境文件中配置非占位密钥后重新部署应用容器。" >&2
    exit 1
  fi
}

ensure_actkg_activation_store_dirs() {
  mkdir -p "$AUTHORITY_STORE_DIR" "$TEACHING_PROJECTION_STORE_DIR"
}

require_actkg_activation_store_pointers() {
  # Production defaults to the legacy reader.  A cutover must be explicit and
  # then provide every host-mounted activation pointer before app containers
  # are replaced (#1274/#1276).
  if [ "$NODE_ENV" != "production" ]; then
    return 0
  fi
  case "$ACT_KNOWLEDGE_DEPLOYMENT_MODE" in
    legacy)
      local present=0
      local pointer
      local legacy_pointers=(
        "${AUTHORITY_STORE_DIR}/current.json"
        "${TEACHING_PROJECTION_STORE_DIR}/current.json"
        "${RUNTIME_CONTENT_DIR}/knowledge/consumer-activation/current.json"
        "${RUNTIME_CONTENT_DIR}/knowledge/prerequisites/current.json"
      )
      for pointer in "${legacy_pointers[@]}"; do
        # -L also catches a dangling symlink: a stale/corrupt pointer must not
        # be treated as absent merely because its target was removed.
        if [ -e "$pointer" ] || [ -L "$pointer" ]; then
          echo "ERROR: production legacy 模式禁止存在 knowledge current 指针: $pointer" >&2
          present=1
        fi
      done
      if [ "$present" -ne 0 ]; then
        echo "请移除生产 host 上的 activation current 指针，或显式设置 ACT_KNOWLEDGE_DEPLOYMENT_MODE=cutover。" >&2
        exit 1
      fi
      echo "- Knowledge deployment mode: legacy (all activation current pointers absent)"
      ;;
    cutover)
      local missing=0
      local pointer
      local cutover_pointers=(
        "${AUTHORITY_STORE_DIR}/current.json"
        "${TEACHING_PROJECTION_STORE_DIR}/current.json"
        "${RUNTIME_CONTENT_DIR}/knowledge/consumer-activation/current.json"
        "${RUNTIME_CONTENT_DIR}/knowledge/prerequisites/current.json"
      )
      for pointer in "${cutover_pointers[@]}"; do
        if [ ! -f "$pointer" ]; then
          echo "ERROR: production cutover 缺少 activation 指针: $pointer" >&2
          missing=1
        fi
      done
      if [ "$missing" -ne 0 ]; then
        echo "请先运行 activation gate 将 Authority/Projection/consumer/prerequisites 工件同步到部署主机，再重新部署。" >&2
        exit 1
      fi
      echo "- Knowledge deployment mode: cutover (all activation current pointers present)"
      ;;
    *)
      echo "ERROR: ACT_KNOWLEDGE_DEPLOYMENT_MODE 必须为 legacy 或 cutover，实际为: $ACT_KNOWLEDGE_DEPLOYMENT_MODE" >&2
      exit 1
      ;;
  esac
  echo "- Authority store: ${AUTHORITY_STORE_DIR} -> ${ACT_AUTHORITY_STORE_ROOT}"
  echo "- Teaching Projection store: ${TEACHING_PROJECTION_STORE_DIR} -> ${ACT_TEACHING_PROJECTION_STORE_ROOT}"
}

require_grading_audit_secret() {
  if [ "$NODE_ENV" = "production" ]; then
    case "${GRADING_AUDIT_SECRET:-}" in
      ''|replace-with*|your-*|change-me*|sk-your*)
        echo "ERROR: production 数学文档批改必须配置真实的 GRADING_AUDIT_SECRET。" >&2
        exit 1
        ;;
    esac
  fi
}

require_smart_courseware_ordering_secret() {
  if [ "$NODE_ENV" != "production" ]; then
    return 0
  fi
  SMART_COURSEWARE_ORDERING_SECRET="$(printf '%s' "$SMART_COURSEWARE_ORDERING_SECRET" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')"
  case "$SMART_COURSEWARE_ORDERING_SECRET" in
    ''|replace-with*|your-*|change-me*|sk-your*)
      echo "ERROR: production 课件学生排序投影必须配置真实的 SMART_COURSEWARE_ORDERING_SECRET。" >&2
      exit 1
      ;;
  esac
  local secret_bytes
  secret_bytes="$(printf '%s' "$SMART_COURSEWARE_ORDERING_SECRET" | wc -c | tr -d '[:space:]')"
  if [ "$secret_bytes" -lt 32 ]; then
    echo "ERROR: production SMART_COURSEWARE_ORDERING_SECRET 必须至少为 32 bytes。" >&2
    exit 1
  fi
}

require_grading_lifecycle_lookup_secret() {
  if [ "$NODE_ENV" = "production" ]; then
    case "${GRADING_LIFECYCLE_LOOKUP_SECRET:-}" in
      ''|replace-with*|your-*|change-me*|sk-your*)
        echo "ERROR: production 数学文档批改必须配置稳定的 GRADING_LIFECYCLE_LOOKUP_SECRET，不能随 GRADING_AUDIT_SECRET 轮换。" >&2
        exit 1
        ;;
    esac
  fi
}

require_submission_security_pipeline() {
  local required=(SUBMISSION_S3_ENDPOINT SUBMISSION_S3_BUCKET SUBMISSION_S3_ACCESS_KEY SUBMISSION_S3_SECRET_KEY SUBMISSION_SCANNER_ACCESS_KEY SUBMISSION_SCANNER_SECRET_KEY SUBMISSION_SCANNER_PROBE_KEY SUBMISSION_GC_ACCESS_KEY SUBMISSION_GC_SECRET_KEY)
  if [ "${SUBMISSION_OBJECT_STORE:-}" != "s3" ] || [ "${SUBMISSION_SCANNER_MODE:-}" != "s3-object-tag" ]; then
    echo "ERROR: 生产部署必须配置 SUBMISSION_OBJECT_STORE=s3 与 SUBMISSION_SCANNER_MODE=s3-object-tag。" >&2; exit 1
  fi
  for name in "${required[@]}"; do if [ -z "${!name:-}" ]; then echo "ERROR: 缺少学生作业安全配置: $name" >&2; exit 1; fi; done
  case "${SUBMISSION_CONTENT_SCANNER:-}" in
    clamav-tcp) if [ -z "${SUBMISSION_CLAMAV_HOST:-}" ] || [ -z "${SUBMISSION_CLAMAV_PORT:-}" ]; then echo "ERROR: clamav-tcp 需要外部 SUBMISSION_CLAMAV_HOST/PORT。" >&2; exit 1; fi ;;
    https) if [ -z "${SUBMISSION_SCANNER_URL:-}" ] || [ -z "${SUBMISSION_SCANNER_TOKEN:-}" ]; then echo "ERROR: https scanner 需要外部 URL/TOKEN。" >&2; exit 1; fi ;;
    *) echo "ERROR: SUBMISSION_CONTENT_SCANNER 必须为 clamav-tcp 或 https。" >&2; exit 1 ;;
  esac
}

require_math_document_grading_worker_config() {
  if ! [[ "${MATH_DOCUMENT_GRADING_WORKER_REQUIRED:-true}" =~ ^(1|true|yes)$ ]]; then
    return 0
  fi

  local required=(DATABASE_URL REDIS_URL SUBMISSION_S3_ENDPOINT SUBMISSION_S3_BUCKET SUBMISSION_S3_ACCESS_KEY SUBMISSION_S3_SECRET_KEY SUBMISSION_SCANNER_ACCESS_KEY SUBMISSION_SCANNER_SECRET_KEY SUBMISSION_SCANNER_PROBE_KEY MATHPIX_APP_ID MATHPIX_APP_KEY)
  if [ "$NODE_ENV" = "production" ]; then
    required+=(GRADING_AUDIT_SECRET GRADING_LIFECYCLE_LOOKUP_SECRET)
  fi
  for name in "${required[@]}"; do
    if [ -z "${!name:-}" ]; then
      echo "ERROR: 数学文档批改 worker 缺少必要配置: $name" >&2
      exit 1
    fi
  done

  if [ "${SUBMISSION_OBJECT_STORE:-}" != "s3" ] || [ "${SUBMISSION_SCANNER_MODE:-}" != "s3-object-tag" ]; then
    echo "ERROR: 数学文档批改 worker 需要 S3 对象存储与可信扫描配置。" >&2
    exit 1
  fi

  local provider="${AI_PROVIDER:-${LLM_PROVIDER:-siliconflow}}"
  local endpoint="${AI_BASE_URL:-${SILICONFLOW_API_URL:-}}"
  local model="${AI_MODEL:-${SILICONFLOW_MODEL:-}}"
  local api_key="${AI_API_KEY:-}"
  if [ "$provider" = "siliconflow" ]; then
    api_key="${api_key:-${SILICONFLOW_API_KEY:-}}"
    endpoint="${endpoint:-https://api.siliconflow.cn/v1}"
    model="${model:-Qwen/Qwen3.6-35B-A3B}"
  fi
  if ! [[ "${GRADING_AI_PROVIDER_ENABLED:-false}" =~ ^(1|true|yes)$ ]] || [[ "$endpoint" != https://* ]] || [ -z "$model" ] || [ -z "$api_key" ]; then
    echo "ERROR: 数学文档批改 worker 缺少可用的 AI provider 配置。" >&2
    exit 1
  fi
  if [ "$(printf '%s' "${AI_PROVIDER_ENABLED:-}" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//' | tr '[:upper:]' '[:lower:]')" = "false" ]; then
    echo "ERROR: AI_PROVIDER_ENABLED=false 与数学文档批改 worker 不兼容。" >&2
    exit 1
  fi

  if ! [[ "${GRADING_MATHPIX_ENABLED:-false}" =~ ^(1|true|yes)$ ]]; then
    echo "ERROR: GRADING_MATHPIX_ENABLED=false 与数学文档批改 worker 不兼容。" >&2
    exit 1
  fi
  if [[ "$MATHPIX_IMAGE_ENDPOINT" != https://*/v3/text ]] || [[ "$MATHPIX_DOCUMENT_ENDPOINT" != https://*/v3/pdf ]] || [[ ! "$MATHPIX_CREDENTIAL_REF" =~ ^env:[A-Z][A-Z0-9_]*$ ]]; then
    echo "ERROR: Mathpix image/document endpoint 或 credential reference 配置无效。" >&2
    exit 1
  fi
}

validate_grading_policy_seed_config() {
  local policy_seed_env_args=()
  local env_name
  for env_name in "${POLICY_SEED_ENV_NAMES[@]}"; do
    if [ -n "${!env_name:-}" ]; then
      policy_seed_env_args+=(-e "${env_name}=${!env_name}")
    fi
  done

  echo "- 预检数学文档批改策略配置"
  podman run --rm \
    --entrypoint ./node_modules/.bin/tsx \
    "${policy_seed_env_args[@]}" \
    -e NODE_ENV="$NODE_ENV" \
    -e MATH_DOCUMENT_GRADING_WORKER_REQUIRED="$MATH_DOCUMENT_GRADING_WORKER_REQUIRED" \
    "$APP_IMAGE" \
    scripts/assignments/ensure-grading-policies.ts --dry-run >/dev/null
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

run_detached_container() {
  local name="$1"
  shift
  local run_output=''
  local run_status=0
  local start_output=''
  local start_status=0
  local state=''
  local attempt

  set +e
  run_output="$("$@" 2>&1)"
  run_status=$?
  set -e

  if [ "$run_status" -ne 0 ] && [ -n "$run_output" ]; then
    echo "$run_output" >&2
  fi

  for attempt in $(seq 1 3); do
    state="$(podman inspect "$name" --format '{{.State.Status}}' 2>/dev/null || true)"
    if [ "$state" = "running" ]; then
      return 0
    fi

    if [ "$state" = "created" ] || [ "$state" = "exited" ]; then
      echo "WARNING: 容器 ${name} 当前状态为 ${state}，尝试重新启动 (${attempt}/3)" >&2
      set +e
      start_output="$(podman start "$name" 2>&1)"
      start_status=$?
      set -e
      if [ -n "$start_output" ]; then
        echo "$start_output" >&2
      fi
      if [ "$start_status" -eq 0 ]; then
        state="$(podman inspect "$name" --format '{{.State.Status}}' 2>/dev/null || true)"
        if [ "$state" = "running" ]; then
          return 0
        fi
      fi
    elif [ "$run_status" -ne 0 ]; then
      break
    fi

    sleep 2
  done

  echo "ERROR: 容器启动失败: ${name}" >&2
  podman inspect "$name" --format '{{json .State}}' >&2 2>/dev/null || true
  podman logs --tail 120 "$name" >&2 2>/dev/null || true
  return 1
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
MATH_DOCUMENT_GRADING_WORKER_REQUIRED=$MATH_DOCUMENT_GRADING_WORKER_REQUIRED
NETWORK_NAME=$NETWORK_NAME
DB_VOLUME=$DB_VOLUME
REDIS_VOLUME=$REDIS_VOLUME
DB_NAME=$DB_NAME
DB_USER=$DB_USER
DB_HOST=$DB_HOST_ALIAS
RUNTIME_CONTENT_DIR=$RUNTIME_CONTENT_DIR
AUTHORITY_STORE_DIR=$AUTHORITY_STORE_DIR
TEACHING_PROJECTION_STORE_DIR=$TEACHING_PROJECTION_STORE_DIR
ACT_AUTHORITY_STORE_ROOT=$ACT_AUTHORITY_STORE_ROOT
ACT_TEACHING_PROJECTION_STORE_ROOT=$ACT_TEACHING_PROJECTION_STORE_ROOT
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
ensure_actkg_activation_store_dirs

if [ ! -f "$START_WRAPPER_PATH" ]; then
  echo "ERROR: 缺少启动包装脚本: $START_WRAPPER_PATH" >&2
  exit 1
fi

# Complete all configuration validation before removing any existing
# container.  A bad secret or provider configuration must not turn a failed
# preflight into an avoidable outage.
if [ "$MODE" != "--db-only" ]; then
  # Application-only: do not block --db-only database recovery paths (#1274 P2).
  require_actkg_activation_store_pointers
  require_konling_mode_context_secret
  if [[ "${MATH_DOCUMENT_GRADING_WORKER_REQUIRED:-true}" =~ ^(1|true|yes)$ ]]; then
    require_grading_audit_secret
    require_grading_lifecycle_lookup_secret
    require_submission_security_pipeline
  else
    echo "- 数学文档批改 worker 已禁用，跳过其专用安全配置预检"
  fi
  require_smart_courseware_ordering_secret

  REDIS_URL_DEFAULT="redis://${REDIS_HOST_ALIAS}:6379"
  REDIS_URL="${REDIS_URL:-$REDIS_URL_DEFAULT}"
  REDIS_URL="$(printf '%s' "$REDIS_URL" | sed "s#redis://${REDIS_CONTAINER}:#redis://${REDIS_HOST_ALIAS}:#")"
  REDIS_URL="$(printf '%s' "$REDIS_URL" | sed "s#redis://${REDIS_CONTAINER}\\.dns\\.podman:#redis://${REDIS_HOST_ALIAS}:#")"
  REDIS_URL="$(printf '%s' "$REDIS_URL" | sed "s#redis://localhost:#redis://${REDIS_HOST_ALIAS}:#")"
  DATABASE_URL_DEFAULT="postgresql://${DB_USER}:${DB_PASSWORD}@${DB_HOST_ALIAS}:5432/${DB_NAME}?connection_limit=10&pool_timeout=20"
  DATABASE_URL="${DATABASE_URL:-$DATABASE_URL_DEFAULT}"
  DATABASE_URL="$(printf '%s' "$DATABASE_URL" | sed "s#@${DB_CONTAINER}:#@${DB_HOST_ALIAS}:#")"
  DATABASE_URL="$(printf '%s' "$DATABASE_URL" | sed "s#@${DB_CONTAINER}\\.dns\\.podman:#@${DB_HOST_ALIAS}:#")"
  DATABASE_URL="$(printf '%s' "$DATABASE_URL" | sed "s#@localhost:#@${DB_HOST_ALIAS}:#")"
  DATABASE_URL="$(ensure_database_url_param "$DATABASE_URL" "connection_limit" "10")"
  DATABASE_URL="$(ensure_database_url_param "$DATABASE_URL" "pool_timeout" "20")"
  require_math_document_grading_worker_config
  if [[ "${MATH_DOCUMENT_GRADING_WORKER_REQUIRED:-true}" =~ ^(1|true|yes)$ ]]; then
    validate_grading_policy_seed_config
  fi
fi

if [ "$MODE" = "--all" ] || [ "$MODE" = "--db-only" ]; then
  remove_if_exists "$SUBMISSION_SCANNER_CONTAINER"
  remove_if_exists "$SUBMISSION_GC_CONTAINER"
  remove_if_exists "$WORKER_CONTAINER"
  remove_if_exists "$APP_CONTAINER"
  remove_if_exists "$REDIS_CONTAINER"
  remove_if_exists "$DB_CONTAINER"
else
  remove_if_exists "$SUBMISSION_SCANNER_CONTAINER"
  remove_if_exists "$SUBMISSION_GC_CONTAINER"
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
  -e ACT_KNOWLEDGE_DEPLOYMENT_MODE="$ACT_KNOWLEDGE_DEPLOYMENT_MODE"
  -e MATH_DOCUMENT_GRADING_WORKER_REQUIRED="$MATH_DOCUMENT_GRADING_WORKER_REQUIRED"
  -e ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED="$ADAPTIVE_LEARNER_STATE_SERVICE_ENABLED"
)
GRADING_AUDIT_ENV_ARGS=()
if [ -n "${GRADING_AUDIT_SECRET:-}" ]; then
  GRADING_AUDIT_ENV_ARGS=(-e GRADING_AUDIT_SECRET="$GRADING_AUDIT_SECRET")
fi
if [ -n "${GRADING_LIFECYCLE_LOOKUP_SECRET:-}" ]; then
  GRADING_AUDIT_ENV_ARGS+=(-e GRADING_LIFECYCLE_LOOKUP_SECRET="$GRADING_LIFECYCLE_LOOKUP_SECRET")
fi
APP_STORAGE_ENV_ARGS=()
SCANNER_ENV_ARGS=()
GC_ENV_ARGS=()
if [[ "${MATH_DOCUMENT_GRADING_WORKER_REQUIRED:-true}" =~ ^(1|true|yes)$ ]]; then
  APP_STORAGE_ENV_ARGS=(-e SUBMISSION_OBJECT_STORE="$SUBMISSION_OBJECT_STORE" -e SUBMISSION_S3_ENDPOINT="$SUBMISSION_S3_ENDPOINT" -e SUBMISSION_S3_BUCKET="$SUBMISSION_S3_BUCKET" -e SUBMISSION_S3_REGION="${SUBMISSION_S3_REGION:-us-east-1}" -e SUBMISSION_S3_ACCESS_KEY="$SUBMISSION_S3_ACCESS_KEY" -e SUBMISSION_S3_SECRET_KEY="$SUBMISSION_S3_SECRET_KEY" -e SUBMISSION_SCANNER_MODE="$SUBMISSION_SCANNER_MODE" -e SUBMISSION_CONTENT_SCANNER="$SUBMISSION_CONTENT_SCANNER")
  SCANNER_ENV_ARGS=("${SHARED_ENV_ARGS[@]}" -e SUBMISSION_S3_ENDPOINT="$SUBMISSION_S3_ENDPOINT" -e SUBMISSION_S3_BUCKET="$SUBMISSION_S3_BUCKET" -e SUBMISSION_S3_REGION="${SUBMISSION_S3_REGION:-us-east-1}" -e SUBMISSION_SCANNER_MODE="$SUBMISSION_SCANNER_MODE" -e SUBMISSION_SCANNER_ACCESS_KEY="$SUBMISSION_SCANNER_ACCESS_KEY" -e SUBMISSION_SCANNER_SECRET_KEY="$SUBMISSION_SCANNER_SECRET_KEY" -e SUBMISSION_SCANNER_PROBE_KEY="$SUBMISSION_SCANNER_PROBE_KEY" -e SUBMISSION_CONTENT_SCANNER="$SUBMISSION_CONTENT_SCANNER" -e SUBMISSION_SCAN_BATCH_SIZE="${SUBMISSION_SCAN_BATCH_SIZE:-25}")
  if [ "$SUBMISSION_CONTENT_SCANNER" = "clamav-tcp" ]; then SCANNER_ENV_ARGS+=(-e SUBMISSION_CLAMAV_HOST="$SUBMISSION_CLAMAV_HOST" -e SUBMISSION_CLAMAV_PORT="$SUBMISSION_CLAMAV_PORT"); else SCANNER_ENV_ARGS+=(-e SUBMISSION_SCANNER_URL="$SUBMISSION_SCANNER_URL" -e SUBMISSION_SCANNER_TOKEN="$SUBMISSION_SCANNER_TOKEN"); fi
  GC_ENV_ARGS=("${SHARED_ENV_ARGS[@]}" "${GRADING_AUDIT_ENV_ARGS[@]}" -e SUBMISSION_S3_ENDPOINT="$SUBMISSION_S3_ENDPOINT" -e SUBMISSION_S3_BUCKET="$SUBMISSION_S3_BUCKET" -e SUBMISSION_S3_REGION="${SUBMISSION_S3_REGION:-us-east-1}" -e SUBMISSION_GC_ACCESS_KEY="$SUBMISSION_GC_ACCESS_KEY" -e SUBMISSION_GC_SECRET_KEY="$SUBMISSION_GC_SECRET_KEY" -e SUBMISSION_QUARANTINE_RETENTION_HOURS="${SUBMISSION_QUARANTINE_RETENTION_HOURS:-24}")
fi
if [ -n "${KONLING_SERVER_MODE_CONTEXT_SECRET:-}" ]; then
  SHARED_ENV_ARGS+=(-e KONLING_SERVER_MODE_CONTEXT_SECRET="$KONLING_SERVER_MODE_CONTEXT_SECRET")
fi

APP_ENV_ARGS=(
  "${SHARED_ENV_ARGS[@]}"
  "${GRADING_AUDIT_ENV_ARGS[@]}"
  "${APP_STORAGE_ENV_ARGS[@]}"
  -e ACT_AUTHORITY_STORE_ROOT="$ACT_AUTHORITY_STORE_ROOT"
  -e ACT_TEACHING_PROJECTION_STORE_ROOT="$ACT_TEACHING_PROJECTION_STORE_ROOT"
  -e SMART_COURSEWARE_ORDERING_SECRET="$SMART_COURSEWARE_ORDERING_SECRET"
  -e GRADING_MATHPIX_ENABLED="${GRADING_MATHPIX_ENABLED:-false}"
  -e GRADING_MATHPIX_POLICY_VERSION="$GRADING_MATHPIX_POLICY_VERSION"
  -e RUN_MIGRATIONS_ON_START=0
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

AI_PROVIDER_ENV_ARGS=()
for env_name in AI_PROVIDER LLM_PROVIDER AI_PROVIDER_KIND LLM_PROVIDER_KIND AI_BASE_URL AI_API_KEY AI_SECRET_REF AI_MODEL AI_PROVIDER_ENABLED GRADING_AI_PROVIDER_ENABLED AI_PROVIDER_PRIORITY SILICONFLOW_API_URL SILICONFLOW_API_KEY SILICONFLOW_SECRET_REF SILICONFLOW_MODEL LLM_SERVICE_URL; do
  if [ -n "${!env_name:-}" ]; then
    AI_PROVIDER_ENV_ARGS+=(-e "${env_name}=${!env_name}")
  fi
done
MATHPIX_ENV_ARGS=(
  -e GRADING_MATHPIX_ENABLED="${GRADING_MATHPIX_ENABLED:-false}"
  -e GRADING_MATHPIX_POLICY_VERSION="$GRADING_MATHPIX_POLICY_VERSION"
  -e MATHPIX_IMAGE_ENDPOINT="$MATHPIX_IMAGE_ENDPOINT"
  -e MATHPIX_DOCUMENT_ENDPOINT="$MATHPIX_DOCUMENT_ENDPOINT"
  -e MATHPIX_CREDENTIAL_REF="$MATHPIX_CREDENTIAL_REF"
  -e MATHPIX_APP_ID="${MATHPIX_APP_ID:-}"
  -e MATHPIX_APP_KEY="${MATHPIX_APP_KEY:-}"
  -e MATHPIX_VERSION="$MATHPIX_VERSION"
)
WORKER_STORAGE_ENV_ARGS=()
if [[ "${MATH_DOCUMENT_GRADING_WORKER_REQUIRED:-true}" =~ ^(1|true|yes)$ ]]; then
  WORKER_STORAGE_ENV_ARGS=("${APP_STORAGE_ENV_ARGS[@]}" -e SUBMISSION_SCANNER_ACCESS_KEY="$SUBMISSION_SCANNER_ACCESS_KEY" -e SUBMISSION_SCANNER_SECRET_KEY="$SUBMISSION_SCANNER_SECRET_KEY" -e SUBMISSION_SCANNER_PROBE_KEY="$SUBMISSION_SCANNER_PROBE_KEY")
  if [ "$SUBMISSION_CONTENT_SCANNER" = "clamav-tcp" ]; then
    WORKER_STORAGE_ENV_ARGS+=(-e SUBMISSION_CLAMAV_HOST="$SUBMISSION_CLAMAV_HOST" -e SUBMISSION_CLAMAV_PORT="$SUBMISSION_CLAMAV_PORT")
  else
    WORKER_STORAGE_ENV_ARGS+=(-e SUBMISSION_SCANNER_URL="$SUBMISSION_SCANNER_URL" -e SUBMISSION_SCANNER_TOKEN="$SUBMISSION_SCANNER_TOKEN")
  fi
fi

POLICY_SEED_ENV_ARGS=("${SHARED_ENV_ARGS[@]}")
for env_name in "${POLICY_SEED_ENV_NAMES[@]}"; do
  if [ -n "${!env_name:-}" ]; then
    POLICY_SEED_ENV_ARGS+=(-e "${env_name}=${!env_name}")
  fi
done

if [[ "${MATH_DOCUMENT_GRADING_WORKER_REQUIRED:-true}" =~ ^(1|true|yes)$ ]]; then
  echo "- 执行 Prisma 迁移并物化数学文档批改策略"
  podman run --rm \
    --network "$NETWORK_NAME" \
    --entrypoint ./docker-entrypoint.sh \
    "${DB_HOST_ARGS[@]}" \
    "${POLICY_SEED_ENV_ARGS[@]}" \
    -e RUN_MIGRATIONS_ON_START="$RUN_MIGRATIONS_ON_START" \
    "$APP_IMAGE" \
    ./node_modules/.bin/tsx scripts/assignments/ensure-grading-policies.ts
else
  echo "- 执行 Prisma 迁移（数学文档批改策略暂不物化）"
  podman run --rm \
    --network "$NETWORK_NAME" \
    --entrypoint ./docker-entrypoint.sh \
    "${DB_HOST_ARGS[@]}" \
    "${SHARED_ENV_ARGS[@]}" \
    -e RUN_MIGRATIONS_ON_START="$RUN_MIGRATIONS_ON_START" \
    "$APP_IMAGE" \
    true
fi

if [[ "${MATH_DOCUMENT_GRADING_WORKER_REQUIRED:-true}" =~ ^(1|true|yes)$ ]]; then
  echo "- 验证学生作业对象存储与扫描服务健康"
  podman run --rm --network "$NETWORK_NAME" --entrypoint ./node_modules/.bin/tsx "${DB_HOST_ARGS[@]}" "${SHARED_ENV_ARGS[@]}" "${APP_STORAGE_ENV_ARGS[@]}" -e SUBMISSION_HEALTH_ROLE=app "$APP_IMAGE" scripts/assignments/check-submission-object-health.ts >/dev/null
  podman run --rm --network "$NETWORK_NAME" --entrypoint ./node_modules/.bin/tsx "${DB_HOST_ARGS[@]}" "${SCANNER_ENV_ARGS[@]}" -e SUBMISSION_HEALTH_ROLE=scanner "$APP_IMAGE" scripts/assignments/check-submission-object-health.ts >/dev/null
  podman run --rm --network "$NETWORK_NAME" --entrypoint ./node_modules/.bin/tsx "${DB_HOST_ARGS[@]}" "${GC_ENV_ARGS[@]}" -e SUBMISSION_HEALTH_ROLE=gc "$APP_IMAGE" scripts/assignments/check-submission-object-health.ts >/dev/null
fi

echo "- 启动应用容器: $APP_CONTAINER"
run_detached_container "$APP_CONTAINER" podman run -d \
  --name "$APP_CONTAINER" \
  --restart unless-stopped \
  --network "$NETWORK_NAME" \
  --entrypoint /bin/sh \
  -p "${APP_PORT}:${APP_CONTAINER_PORT}" \
  -v "${RUNTIME_CONTENT_DIR}:/app/course-content/runtime:ro" \
  -v "${AUTHORITY_STORE_DIR}:${ACT_AUTHORITY_STORE_ROOT}:ro" \
  -v "${TEACHING_PROJECTION_STORE_DIR}:${ACT_TEACHING_PROJECTION_STORE_ROOT}:ro" \
  -v "${START_WRAPPER_PATH}:/app-container-start-wrapper.sh:ro" \
  "${DB_HOST_ARGS[@]}" \
  "${REDIS_HOST_ARGS[@]}" \
  "${APP_ENV_ARGS[@]}" \
  "$APP_IMAGE" \
  /app-container-start-wrapper.sh app

WORKER_ENV_ARGS=(
  "${SHARED_ENV_ARGS[@]}"
  "${GRADING_AUDIT_ENV_ARGS[@]}"
  "${WORKER_STORAGE_ENV_ARGS[@]}"
  "${AI_PROVIDER_ENV_ARGS[@]}"
  "${MATHPIX_ENV_ARGS[@]}"
  -e RUN_MIGRATIONS_ON_START=0
  -e WORKER_CONCURRENCY="$WORKER_CONCURRENCY"
  -e MATH_DOCUMENT_GRADING_WORKER_REQUIRED="$MATH_DOCUMENT_GRADING_WORKER_REQUIRED"
)

echo "- 启动数据治理 worker 容器: $WORKER_CONTAINER"
run_detached_container "$WORKER_CONTAINER" podman run -d \
  --name "$WORKER_CONTAINER" \
  --restart unless-stopped \
  --network "$NETWORK_NAME" \
  --entrypoint /bin/sh \
  --health-cmd "node -e 'const required=[\"1\",\"true\",\"yes\"].includes((process.env.MATH_DOCUMENT_GRADING_WORKER_REQUIRED || \"true\").toLowerCase()); if(!required) process.exit(0); const Redis=require(\"ioredis\"); const redis=new Redis(process.env.REDIS_URL); Promise.all([redis.get(\"math-document-grading:worker:heartbeat\"), redis.get(\"math-document-grading:worker:capability\")]).then(([heartbeat, rawCapability])=>{let ready=false; try { const capability=JSON.parse(rawCapability || \"{}\"); const requiredCapabilities=[\"database\",\"redis\",\"objectStore\",\"scanner\",\"aiProvider\",\"mathpix\",\"auditSecret\"]; const keys=Object.keys(capability.capabilities || {}); ready=heartbeat === \"ready\" && capability.version === \"math-document-grading-worker.v1\" && capability.ready === true && capability.configReady === true && keys.length === requiredCapabilities.length && requiredCapabilities.every((key)=>capability.capabilities[key] === true) && keys.every((key)=>requiredCapabilities.includes(key)); } catch {} redis.disconnect(); process.exit(ready ? 0 : 1)}).catch(()=>process.exit(1))'" \
  --health-interval 15s \
  --health-timeout 5s \
  --health-retries 6 \
  -v "${START_WRAPPER_PATH}:/app-container-start-wrapper.sh:ro" \
  "${DB_HOST_ARGS[@]}" \
  "${REDIS_HOST_ARGS[@]}" \
  "${WORKER_ENV_ARGS[@]}" \
  "$APP_IMAGE" \
  /app-container-start-wrapper.sh worker

run_scheduler_once

if [[ "${MATH_DOCUMENT_GRADING_WORKER_REQUIRED:-true}" =~ ^(1|true|yes)$ ]]; then
  echo "- 启动学生作业扫描 worker 容器: $SUBMISSION_SCANNER_CONTAINER"
  podman run -d --name "$SUBMISSION_SCANNER_CONTAINER" --restart unless-stopped --network "$NETWORK_NAME" --entrypoint /bin/sh -v "${START_WRAPPER_PATH}:/app-container-start-wrapper.sh:ro" "${DB_HOST_ARGS[@]}" "${SCANNER_ENV_ARGS[@]}" -e SUBMISSION_SCAN_INTERVAL_SECONDS="$SUBMISSION_SCAN_INTERVAL_SECONDS" "$APP_IMAGE" /app-container-start-wrapper.sh submission-scanner >/dev/null

  echo "- 启动学生作业 GC worker 容器: $SUBMISSION_GC_CONTAINER"
  podman run -d --name "$SUBMISSION_GC_CONTAINER" --restart unless-stopped --network "$NETWORK_NAME" --entrypoint /bin/sh -v "${START_WRAPPER_PATH}:/app-container-start-wrapper.sh:ro" "${DB_HOST_ARGS[@]}" "${GC_ENV_ARGS[@]}" -e SUBMISSION_GC_INTERVAL_SECONDS="$SUBMISSION_GC_INTERVAL_SECONDS" "$APP_IMAGE" /app-container-start-wrapper.sh submission-gc >/dev/null
fi

echo "[4-deploy] 部署完成。"
echo "- 公网访问: http://121.40.124.135:${APP_PORT}"
echo "- 目标域名: http://${APP_DOMAIN} (需在 Nginx 配置反向代理到 127.0.0.1:${APP_PORT})"
echo "- 运行时资源目录: ${RUNTIME_CONTENT_DIR} -> /app/course-content/runtime"
echo "- Authority store: ${AUTHORITY_STORE_DIR} -> ${ACT_AUTHORITY_STORE_ROOT}"
echo "- Teaching Projection store: ${TEACHING_PROJECTION_STORE_DIR} -> ${ACT_TEACHING_PROJECTION_STORE_ROOT}"
echo
podman ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}' | grep -E "NAMES|${APP_CONTAINER}|${DB_CONTAINER}|${REDIS_CONTAINER}|${WORKER_CONTAINER}|${SUBMISSION_SCANNER_CONTAINER}|${SUBMISSION_GC_CONTAINER}" || true
