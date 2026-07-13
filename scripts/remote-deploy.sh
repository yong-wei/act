#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

SKIP_BUILD="${SKIP_BUILD:-0}"
SSH_TARGET="${SSH_TARGET:-root@121.40.124.135}"
REMOTE_PROJECT_DIR="${REMOTE_PROJECT_DIR:-/home/projects/act}"
LOCAL_IMAGE_TAR="${LOCAL_IMAGE_TAR:-deploy/images/act-obe.tar}"
REMOTE_IMAGES_DIR="${REMOTE_IMAGES_DIR:-${REMOTE_PROJECT_DIR}/images}"
REMOTE_IMAGE_TAR="${REMOTE_IMAGE_TAR:-${REMOTE_IMAGES_DIR}/act-obe.tar}"
LOCAL_RUNTIME_DIR="${LOCAL_RUNTIME_DIR:-${ROOT_DIR}/course-content/runtime}"
REMOTE_RUNTIME_DIR="${REMOTE_RUNTIME_DIR:-${REMOTE_PROJECT_DIR}/course-content/runtime}"
TEXTBOOK_RUNTIME_BOOK_ID="${TEXTBOOK_RUNTIME_BOOK_ID:-hu-shousong-exercise-analysis-3rd}"
LOCAL_TEXTBOOK_RUNTIME_DIR="${LOCAL_RUNTIME_DIR}/resources/textbooks/${TEXTBOOK_RUNTIME_BOOK_ID}"
REMOTE_TEXTBOOK_RUNTIME_DIR="${REMOTE_RUNTIME_DIR}/resources/textbooks/${TEXTBOOK_RUNTIME_BOOK_ID}"
LOCAL_APP_DEPLOY_SCRIPT="${LOCAL_APP_DEPLOY_SCRIPT:-${ROOT_DIR}/deploy/podman/deploy.sh}"
REMOTE_APP_DEPLOY_SCRIPT="${REMOTE_APP_DEPLOY_SCRIPT:-${REMOTE_PROJECT_DIR}/scripts/4-deploy.sh}"
LOCAL_SERVICE_SCRIPT="${LOCAL_SERVICE_SCRIPT:-${ROOT_DIR}/deploy/podman/configure-service.sh}"
REMOTE_SERVICE_SCRIPT="${REMOTE_SERVICE_SCRIPT:-${REMOTE_PROJECT_DIR}/scripts/5-configure-service.sh}"
LOCAL_START_WRAPPER_SCRIPT="${LOCAL_START_WRAPPER_SCRIPT:-${ROOT_DIR}/deploy/podman/container-start-wrapper.sh}"
REMOTE_START_WRAPPER_SCRIPT="${REMOTE_START_WRAPPER_SCRIPT:-${REMOTE_PROJECT_DIR}/scripts/container-start-wrapper.sh}"
REMOTE_EXPORT_DB_SCRIPT="${REMOTE_EXPORT_DB_SCRIPT:-${REMOTE_PROJECT_DIR}/scripts/1-export-db.sh}"
REMOTE_LOAD_IMAGES_SCRIPT="${REMOTE_LOAD_IMAGES_SCRIPT:-${REMOTE_PROJECT_DIR}/scripts/2-load-images.sh}"
REMOTE_IMPORT_DB_SCRIPT="${REMOTE_IMPORT_DB_SCRIPT:-${REMOTE_PROJECT_DIR}/scripts/3-import-db.sh}"
REMOTE_NGINX_SCRIPT="${REMOTE_NGINX_SCRIPT:-${REMOTE_PROJECT_DIR}/scripts/6-configure-nginx.sh}"
PUBLIC_URL="${PUBLIC_URL:-https://act.adapt-learn.online/}"
APP_NAME_HINT="${APP_NAME_HINT:-act-obe-app}"
DB_NAME_HINT="${DB_NAME_HINT:-act-obe-postgres}"
REDIS_NAME_HINT="${REDIS_NAME_HINT:-act-obe-redis}"
WORKER_NAME_HINT="${WORKER_NAME_HINT:-act-obe-worker}"
GC_NAME_HINT="${GC_NAME_HINT:-act-obe-submission-gc}"
REMOTE_APP_IMAGE="${REMOTE_APP_IMAGE:-localhost/act-obe-platform:20260301-amd64}"

REMOTE_TMP_TAR="${REMOTE_IMAGE_TAR}.tmp"
REMOTE_TMP_APP_DEPLOY_SCRIPT="${REMOTE_APP_DEPLOY_SCRIPT}.tmp"
REMOTE_TMP_SERVICE_SCRIPT="${REMOTE_SERVICE_SCRIPT}.tmp"
REMOTE_TMP_START_WRAPPER_SCRIPT="${REMOTE_START_WRAPPER_SCRIPT}.tmp"
REMOTE_LOG_FILE="${REMOTE_LOG_FILE:-/tmp/act-obe-one-key.log}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build)
      SKIP_BUILD=1
      shift
      ;;
    -h|--help)
      cat <<'EOF'
用法: scripts/remote-deploy.sh [--skip-build]

默认行为:
  1. 调用 scripts/build.sh 本地构建镜像
  2. 上传 deploy/images/act-obe.tar 到远端
  3. 执行远端一键部署并做验证

选项:
  --skip-build   跳过本地构建，直接上传并部署现有镜像产物
EOF
      exit 0
      ;;
    *)
      fail "未知参数: $1"
      ;;
  esac
done

log() {
  printf '%s\n' "$*"
}

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    fail "缺少命令: $1"
  fi
}

local_sha256() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
    return 0
  fi

  if command -v shasum >/dev/null 2>&1; then
    shasum -a 256 "$1" | awk '{print $1}'
    return 0
  fi

  fail "本机缺少 sha256sum/shasum，无法校验镜像文件"
}

remote() {
  ssh -o BatchMode=yes "${SSH_TARGET}" "$@"
}

remote_sha256() {
  remote "if command -v sha256sum >/dev/null 2>&1; then sha256sum '${1}' | awk '{print \$1}'; else shasum -a 256 '${1}' | awk '{print \$1}'; fi"
}

wait_for_remote_http() {
  local max_wait="${1:-120}"
  local elapsed=0

  while [[ "${elapsed}" -lt "${max_wait}" ]]; do
    if remote "bash -lc '
set -euo pipefail
. \"${REMOTE_PROJECT_DIR}/data/runtime/act-obe.env\"
curl -fsS \"http://127.0.0.1:\${APP_PORT}/api/readyz\" >/dev/null
'"; then
      return 0
    fi

    sleep 3
    elapsed=$((elapsed + 3))
  done

  return 1
}

wait_for_public_http() {
  local max_wait="${1:-120}"
  local elapsed=0

  while [[ "${elapsed}" -lt "${max_wait}" ]]; do
    if curl -fsS "${PUBLIC_URL}" >/dev/null; then
      return 0
    fi

    sleep 3
    elapsed=$((elapsed + 3))
  done

  return 1
}

wait_for_public_session_api() {
  local max_wait="${1:-120}"
  local elapsed=0

  while [[ "${elapsed}" -lt "${max_wait}" ]]; do
    if curl -fsS "${PUBLIC_URL%/}/api/auth/session" >/dev/null; then
      return 0
    fi

    sleep 3
    elapsed=$((elapsed + 3))
  done

  return 1
}

recover_prisma_migration_state() {
  log "- 检测到应用可能卡在 Prisma 迁移阶段，检查失败记录并停止服务"

  remote "bash -lc '
set -euo pipefail
set -a
[ -f \"${REMOTE_PROJECT_DIR}/.env.server\" ] && . \"${REMOTE_PROJECT_DIR}/.env.server\"
[ -f \"${REMOTE_PROJECT_DIR}/.env\" ] && . \"${REMOTE_PROJECT_DIR}/.env\"
. \"${REMOTE_PROJECT_DIR}/data/runtime/act-obe.env\"
set +a

APP_CONTAINER_REAL=\${APP_CONTAINER:-${APP_NAME_HINT}}
DB_CONTAINER_REAL=\${DB_CONTAINER:-${DB_NAME_HINT}}
NETWORK_NAME_REAL=\${NETWORK_NAME:-act-obe-net}
DB_USER_REAL=\${DB_USER:-\${POSTGRES_USER:-act_user}}
DB_NAME_REAL=\${DB_NAME:-\${POSTGRES_DB:-act_obe}}
DB_PASSWORD_REAL=\${DB_PASSWORD:-\${POSTGRES_PASSWORD:-}}
APP_IMAGE_REAL=\$(podman inspect \"\${APP_CONTAINER_REAL}\" --format \"{{.ImageName}}\")
DATABASE_URL_REAL=\$(podman inspect \"\${APP_CONTAINER_REAL}\" --format \"{{range .Config.Env}}{{println .}}{{end}}\" | grep \"^DATABASE_URL=\" | head -n 1 | cut -d= -f2-)

FAILED_MIGRATIONS=\$(podman exec -e PGPASSWORD=\"\${DB_PASSWORD_REAL}\" \"\${DB_CONTAINER_REAL}\" \
  psql -U \"\${DB_USER_REAL}\" -d \"\${DB_NAME_REAL}\" -tA -c \"select migration_name from _prisma_migrations where finished_at is null and rolled_back_at is null order by started_at;\")

if [ -n \"\${FAILED_MIGRATIONS}\" ]; then
  podman stop \"\${APP_CONTAINER_REAL}\" >/dev/null 2>&1 || true
  echo "ERROR: Prisma migration failed; application stopped. Manual migration repair is required:" >&2
  printf '%s\n' \"\${FAILED_MIGRATIONS}\" >&2
  exit 1
fi

if podman exec -e PGPASSWORD=\"\${DB_PASSWORD_REAL}\" \"\${DB_CONTAINER_REAL}\" \
  psql -U \"\${DB_USER_REAL}\" -d \"\${DB_NAME_REAL}\" -tA -c \"select 1 from information_schema.tables where table_schema=\\\$\\\$public\\\$\\\$ and table_name=\\\$\\\$PlatformSetting\\\$\\\$;\" | grep -qx 1; then
  if ! podman exec -e PGPASSWORD=\"\${DB_PASSWORD_REAL}\" \"\${DB_CONTAINER_REAL}\" \
    psql -U \"\${DB_USER_REAL}\" -d \"\${DB_NAME_REAL}\" -tA -c \"select 1 from _prisma_migrations where migration_name=\\\$\\\$20260303142500_add_platform_settings\\\$\\\$ and finished_at is not null limit 1;\" | grep -qx 1; then
    echo "ERROR: PlatformSetting 表已存在但 Prisma 迁移记录缺失；停止自动修复，请人工核对 schema 与 _prisma_migrations 后再部署。" >&2
    exit 1
  fi
fi

podman restart \"\${APP_CONTAINER_REAL}\" >/dev/null
'"
}

print_remote_diagnostics() {
  log
  log "[diagnostics] 远端部署日志尾部"
  remote "test -f '${REMOTE_LOG_FILE}' && tail -n 120 '${REMOTE_LOG_FILE}' || true" || true

  log
  log "[diagnostics] systemd 服务状态"
  remote "systemctl --no-pager --full status act-obe-stack.service || true" || true

  log
  log "[diagnostics] 容器状态"
  remote "podman ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' || true" || true

  log
  log "[diagnostics] Nginx 状态"
  remote "systemctl --no-pager --full status nginx || true" || true
}

on_error() {
  local exit_code=$?
  log
  log "部署流程失败，退出码: ${exit_code}"
  print_remote_diagnostics
  exit "${exit_code}"
}

trap on_error ERR

require_cmd bash
require_cmd ssh
require_cmd scp
require_cmd curl
require_cmd rsync

log "[1/5] 本地构建"
if [[ "${SKIP_BUILD}" == "1" ]]; then
  log "已启用 --skip-build，跳过本地构建，直接使用现有镜像产物"
else
  bash "${ROOT_DIR}/scripts/build.sh"
fi

[[ -s "${LOCAL_IMAGE_TAR}" ]] || fail "本地镜像产物不存在或为空: ${LOCAL_IMAGE_TAR}"

LOCAL_SHA="$(local_sha256 "${LOCAL_IMAGE_TAR}")"
log "本地镜像: ${LOCAL_IMAGE_TAR}"
log "本地 SHA256: ${LOCAL_SHA}"

log
log "[2/5] 同步运行时资源与部署脚本"
[[ -d "${LOCAL_RUNTIME_DIR}" ]] || fail "本地 runtime 目录不存在: ${LOCAL_RUNTIME_DIR}"
[[ -f "${LOCAL_TEXTBOOK_RUNTIME_DIR}/manifest.json" ]] || fail "本地教材 runtime 导出缺少 manifest: ${LOCAL_TEXTBOOK_RUNTIME_DIR}/manifest.json"
[[ -f "${LOCAL_TEXTBOOK_RUNTIME_DIR}/search-documents.jsonl" ]] || fail "本地教材 runtime 导出缺少 search-documents: ${LOCAL_TEXTBOOK_RUNTIME_DIR}/search-documents.jsonl"
[[ -f "${LOCAL_APP_DEPLOY_SCRIPT}" ]] || fail "本地应用部署脚本不存在: ${LOCAL_APP_DEPLOY_SCRIPT}"
[[ -f "${LOCAL_SERVICE_SCRIPT}" ]] || fail "本地 systemd 配置脚本不存在: ${LOCAL_SERVICE_SCRIPT}"
[[ -f "${LOCAL_START_WRAPPER_SCRIPT}" ]] || fail "本地容器启动包装脚本不存在: ${LOCAL_START_WRAPPER_SCRIPT}"

remote "mkdir -p '${REMOTE_IMAGES_DIR}' '${REMOTE_RUNTIME_DIR}' '$(dirname "${REMOTE_APP_DEPLOY_SCRIPT}")'"
rsync -az --delete -e "ssh -o BatchMode=yes" "${LOCAL_RUNTIME_DIR}/" "${SSH_TARGET}:${REMOTE_RUNTIME_DIR}/"

scp -q "${LOCAL_APP_DEPLOY_SCRIPT}" "${SSH_TARGET}:${REMOTE_TMP_APP_DEPLOY_SCRIPT}"
remote "chmod +x '${REMOTE_TMP_APP_DEPLOY_SCRIPT}' && mv '${REMOTE_TMP_APP_DEPLOY_SCRIPT}' '${REMOTE_APP_DEPLOY_SCRIPT}'"

scp -q "${LOCAL_SERVICE_SCRIPT}" "${SSH_TARGET}:${REMOTE_TMP_SERVICE_SCRIPT}"
remote "chmod +x '${REMOTE_TMP_SERVICE_SCRIPT}' && mv '${REMOTE_TMP_SERVICE_SCRIPT}' '${REMOTE_SERVICE_SCRIPT}'"

scp -q "${LOCAL_START_WRAPPER_SCRIPT}" "${SSH_TARGET}:${REMOTE_TMP_START_WRAPPER_SCRIPT}"
remote "chmod +x '${REMOTE_TMP_START_WRAPPER_SCRIPT}' && mv '${REMOTE_TMP_START_WRAPPER_SCRIPT}' '${REMOTE_START_WRAPPER_SCRIPT}'"

log "远端 runtime 目录: ${REMOTE_RUNTIME_DIR}"
log "远端应用部署脚本: ${REMOTE_APP_DEPLOY_SCRIPT}"
log "远端 systemd 配置脚本: ${REMOTE_SERVICE_SCRIPT}"
log "远端容器启动包装脚本: ${REMOTE_START_WRAPPER_SCRIPT}"

log
log "[3/5] 上传镜像"
REMOTE_EXISTING_SHA=""
if remote "test -f '${REMOTE_IMAGE_TAR}'"; then
  REMOTE_EXISTING_SHA="$(remote_sha256 "${REMOTE_IMAGE_TAR}")"
fi

if [[ "${REMOTE_EXISTING_SHA}" == "${LOCAL_SHA}" ]]; then
  REMOTE_FINAL_SHA="${REMOTE_EXISTING_SHA}"
  log "远端镜像已是相同 SHA256，跳过重复上传"
else
  remote "rm -f '${REMOTE_TMP_TAR}'"
  scp -q "${LOCAL_IMAGE_TAR}" "${SSH_TARGET}:${REMOTE_TMP_TAR}"

  REMOTE_TMP_SHA="$(remote_sha256 "${REMOTE_TMP_TAR}")"
  if [[ "${LOCAL_SHA}" != "${REMOTE_TMP_SHA}" ]]; then
    remote "rm -f '${REMOTE_TMP_TAR}'" || true
    fail "远端临时文件 SHA256 不一致，本地=${LOCAL_SHA}，远端=${REMOTE_TMP_SHA}"
  fi

  remote "mv '${REMOTE_TMP_TAR}' '${REMOTE_IMAGE_TAR}'"
  REMOTE_FINAL_SHA="$(remote_sha256 "${REMOTE_IMAGE_TAR}")"
  if [[ "${LOCAL_SHA}" != "${REMOTE_FINAL_SHA}" ]]; then
    fail "远端最终文件 SHA256 不一致，本地=${LOCAL_SHA}，远端=${REMOTE_FINAL_SHA}"
  fi
fi

log "远端镜像路径: ${REMOTE_IMAGE_TAR}"
log "远端 SHA256: ${REMOTE_FINAL_SHA}"

log
log "[4/5] 远端部署"
remote "bash -lc 'set -euo pipefail
{
  echo \"[remote-deploy] Step 1/7: 导出现有数据库\"
  \"${REMOTE_EXPORT_DB_SCRIPT}\"
  echo \"[remote-deploy] Step 2/7: 装载镜像\"
  \"${REMOTE_LOAD_IMAGES_SCRIPT}\"
  echo \"[remote-deploy] Step 3/7: 启动数据库容器\"
  APP_IMAGE=\"${REMOTE_APP_IMAGE}\" \"${REMOTE_APP_DEPLOY_SCRIPT}\" --db-only
  echo \"[remote-deploy] Step 4/7: 导入最新数据库\"
  \"${REMOTE_IMPORT_DB_SCRIPT}\"
  echo \"[remote-deploy] Step 5/8: 启动应用容器\"
  APP_IMAGE=\"${REMOTE_APP_IMAGE}\" \"${REMOTE_APP_DEPLOY_SCRIPT}\" --app-only
  echo \"[remote-deploy] Step 6/8: 同步 runtime 知识图谱到数据库\"
  podman exec \"${APP_NAME_HINT}\" npm run seed:knowledge
  echo \"[remote-deploy] Step 7/8: 配置 Nginx 域名反向代理\"
  \"${REMOTE_NGINX_SCRIPT}\"
  echo \"[remote-deploy] Step 8/8: 配置 systemd 开机自启\"
  \"${REMOTE_SERVICE_SCRIPT}\"
} 2>&1 | tee \"${REMOTE_LOG_FILE}\"'"

log
log "[5/5] 部署验证"

log "- 校验远端镜像文件"
remote "test -s '${REMOTE_IMAGE_TAR}'"

log "- 校验远端 runtime 目录"
remote "test -d '${REMOTE_PROJECT_DIR}/course-content/runtime'"
remote "test -f '${REMOTE_TEXTBOOK_RUNTIME_DIR}/manifest.json'"
remote "test -f '${REMOTE_TEXTBOOK_RUNTIME_DIR}/search-documents.jsonl'"

log "- 校验远端应用部署脚本已更新 runtime 挂载"
remote "grep -q '/app/course-content/runtime:ro' '${REMOTE_APP_DEPLOY_SCRIPT}'"

log "- 校验远端应用部署脚本已纳入 Redis 与 worker"
remote "grep -q 'redis-server --appendonly yes' '${REMOTE_APP_DEPLOY_SCRIPT}'"
remote "grep -q '/app-container-start-wrapper.sh worker' '${REMOTE_APP_DEPLOY_SCRIPT}'"

log "- 校验远端 systemd 配置脚本已更新数据库/Redis 等待逻辑"
remote "grep -q 'pg_isready' '${REMOTE_SERVICE_SCRIPT}'"
remote "grep -q '\"\${APP_DEPLOY_SCRIPT}\" --app-only' '${REMOTE_SERVICE_SCRIPT}'"

log "- 校验系统服务"
remote "test \"\$(systemctl is-active nginx)\" = active"
remote "test \"\$(systemctl is-active act-obe-stack.service)\" = active"

log "- 校验容器状态"
remote "podman ps --format '{{.Names}}' | grep -qx '${APP_NAME_HINT}'"
remote "podman ps --format '{{.Names}}' | grep -qx '${DB_NAME_HINT}'"
remote "podman ps --format '{{.Names}}' | grep -qx '${REDIS_NAME_HINT}'"
remote "podman ps --format '{{.Names}}' | grep -qx '${WORKER_NAME_HINT}'"
remote "podman ps --format '{{.Names}}\t{{.Status}}' | grep -E '^${DB_NAME_HINT}[[:space:]].*healthy'"

log "- 校验数据库连通性"
remote "bash -lc '
set -euo pipefail
set -a
[ -f \"${REMOTE_PROJECT_DIR}/.env.server\" ] && . \"${REMOTE_PROJECT_DIR}/.env.server\"
[ -f \"${REMOTE_PROJECT_DIR}/.env\" ] && . \"${REMOTE_PROJECT_DIR}/.env\"
. \"${REMOTE_PROJECT_DIR}/data/runtime/act-obe.env\"
set +a
DB_CONTAINER_REAL=\${DB_CONTAINER:-${DB_NAME_HINT}}
DB_USER_REAL=\${DB_USER:-\${POSTGRES_USER:-act_user}}
DB_NAME_REAL=\${DB_NAME:-\${POSTGRES_DB:-act_obe}}
DB_PASSWORD_REAL=\${DB_PASSWORD:-\${POSTGRES_PASSWORD:-}}
export PGPASSWORD=\"\${DB_PASSWORD_REAL}\"
podman exec \"\${DB_CONTAINER_REAL}\" psql -U \"\${DB_USER_REAL}\" -d \"\${DB_NAME_REAL}\" -tAc \"select 1;\" | grep -qx 1
'"

log "- 校验 runtime 知识图谱已同步到数据库"
remote "bash -lc '
set -euo pipefail
set -a
[ -f \"${REMOTE_PROJECT_DIR}/.env.server\" ] && . \"${REMOTE_PROJECT_DIR}/.env.server\"
[ -f \"${REMOTE_PROJECT_DIR}/.env\" ] && . \"${REMOTE_PROJECT_DIR}/.env\"
. \"${REMOTE_PROJECT_DIR}/data/runtime/act-obe.env\"
set +a
DB_CONTAINER_REAL=\${DB_CONTAINER:-${DB_NAME_HINT}}
DB_USER_REAL=\${DB_USER:-\${POSTGRES_USER:-act_user}}
DB_NAME_REAL=\${DB_NAME:-\${POSTGRES_DB:-act_obe}}
DB_PASSWORD_REAL=\${DB_PASSWORD:-\${POSTGRES_PASSWORD:-}}
export PGPASSWORD=\"\${DB_PASSWORD_REAL}\"
podman exec \"\${DB_CONTAINER_REAL}\" psql -U \"\${DB_USER_REAL}\" -d \"\${DB_NAME_REAL}\" -tAc \"select count(*) from \\\"KnowledgeNode\\\" where id in ('\\''性能指标_1_1'\\'', '\\''根轨迹_1_1'\\'', '\\''传统设计四联图校正_4_47004'\\'') and \\\"isActive\\\" = true;\" | grep -qx 3
'"

log "- 校验 Redis 连通性"
remote "podman exec '${REDIS_NAME_HINT}' redis-cli ping | grep -qx PONG"
remote "podman exec '${REDIS_NAME_HINT}' redis-cli CONFIG GET maxmemory-policy | tail -n 1 | grep -qx 'noeviction'"

log "- 校验应用与 worker 容器环境变量"
remote "podman inspect '${APP_NAME_HINT}' --format '{{.Config.Image}}' | grep -qx '${REMOTE_APP_IMAGE}'"
remote "podman inspect '${APP_NAME_HINT}' --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -q '^KONLING_SERVER_MODE_CONTEXT_SECRET='"
remote "podman inspect '${APP_NAME_HINT}' --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -q '^REDIS_URL=redis://${REDIS_NAME_HINT}\\.dns\\.podman:6379$'"
remote "podman inspect '${APP_NAME_HINT}' --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -q '^DATABASE_URL=.*connection_limit=10&pool_timeout=20'"
remote "podman inspect '${WORKER_NAME_HINT}' --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -q '^KONLING_SERVER_MODE_CONTEXT_SECRET='"
remote "podman inspect '${WORKER_NAME_HINT}' --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -q '^REDIS_URL=redis://${REDIS_NAME_HINT}\\.dns\\.podman:6379$'"
remote "podman inspect '${WORKER_NAME_HINT}' --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -q '^MATH_DOCUMENT_GRADING_WORKER_REQUIRED=true$'"
remote "podman inspect '${WORKER_NAME_HINT}' --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -q '^SUBMISSION_S3_ENDPOINT='"
remote "podman inspect '${WORKER_NAME_HINT}' --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -q '^SUBMISSION_SCANNER_MODE=s3-object-tag$'"
remote "podman inspect '${WORKER_NAME_HINT}' --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -q '^SUBMISSION_SCANNER_ACCESS_KEY='"
remote "podman inspect '${WORKER_NAME_HINT}' --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -q '^MATHPIX_APP_ID='"
remote "podman inspect '${WORKER_NAME_HINT}' --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -q '^MATHPIX_APP_KEY='"
remote "podman inspect '${WORKER_NAME_HINT}' --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -Eq '^(AI_API_KEY|SILICONFLOW_API_KEY)='"
remote "podman inspect '${APP_NAME_HINT}' --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -Eq '^GRADING_AUDIT_SECRET=.+$'"
remote "podman inspect '${WORKER_NAME_HINT}' --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -Eq '^GRADING_AUDIT_SECRET=.+$'"
remote "podman inspect '${GC_NAME_HINT}' --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -Eq '^GRADING_AUDIT_SECRET=.+$'"
remote "podman inspect '${APP_NAME_HINT}' --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -Eq '^GRADING_LIFECYCLE_LOOKUP_SECRET=.+$'"
remote "podman inspect '${WORKER_NAME_HINT}' --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -Eq '^GRADING_LIFECYCLE_LOOKUP_SECRET=.+$'"
remote "podman inspect '${GC_NAME_HINT}' --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -Eq '^GRADING_LIFECYCLE_LOOKUP_SECRET=.+$'"

log "- 校验 worker 启动日志"
remote "podman logs --tail 120 '${WORKER_NAME_HINT}' | grep -q '\\[Worker\\] Data governance worker started'"
remote "podman logs --tail 120 '${WORKER_NAME_HINT}' | grep -q '\\[MathDocumentGrading\\] worker started'"
remote "podman exec '${REDIS_NAME_HINT}' redis-cli get math-document-grading:worker:heartbeat | grep -qx ready"
remote "podman exec '${REDIS_NAME_HINT}' redis-cli get math-document-grading:worker:capability | grep -q '\"configReady\":true'"
remote "podman exec '${REDIS_NAME_HINT}' redis-cli get math-document-grading:worker:capability | grep -q '\"auditSecret\":true'"

log "- 校验 scheduler 已注册 BullMQ 任务"
remote "podman exec '${REDIS_NAME_HINT}' redis-cli --scan --pattern 'bull:*' | grep -q 'bull:'"

log "- 校验应用本机端口响应"
if ! wait_for_remote_http 180; then
  recover_prisma_migration_state
  wait_for_remote_http 180 || fail "应用容器在自愈后仍未就绪"
fi

log "- 校验公网首页"
wait_for_public_http 120 || fail "公网首页未在预期时间内恢复"

log "- 校验公网认证会话接口"
wait_for_public_session_api 120 || fail "公网认证会话接口未在预期时间内恢复"

log "- 校验公网 readyz 健康接口"
curl -fsS "${PUBLIC_URL%/}/api/readyz" | grep -q '"db":true'
curl -fsS "${PUBLIC_URL%/}/api/readyz" | grep -q '"redis":true'
curl -fsS "${PUBLIC_URL%/}/api/readyz" | grep -q '"mathDocumentGradingWorker":{"required":true,"ready":true}'
curl -fsS "${PUBLIC_URL%/}/api/readyz" | grep -q '"configReady":true'
curl -fsS "${PUBLIC_URL%/}/api/readyz" | grep -q '"auditSecret":true'

log
log "远端部署完成并验证通过"
log "  公网地址: ${PUBLIC_URL}"
log "  远端镜像: ${REMOTE_IMAGE_TAR}"
log "  SHA256: ${REMOTE_FINAL_SHA}"
