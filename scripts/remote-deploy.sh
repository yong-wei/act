#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

SKIP_BUILD="${SKIP_BUILD:-0}"
DEPLOY_SCOPE="all"
SSH_TARGET="${SSH_TARGET:-root@121.40.124.135}"
REMOTE_PROJECT_DIR="${REMOTE_PROJECT_DIR:-/home/projects/act}"
LOCAL_IMAGE_TAR="${LOCAL_IMAGE_TAR:-deploy/images/act-obe.tar}"
LOCAL_PROVENANCE_FILE="${LOCAL_PROVENANCE_FILE:-${LOCAL_IMAGE_TAR}.provenance.json}"
REMOTE_IMAGES_DIR="${REMOTE_IMAGES_DIR:-${REMOTE_PROJECT_DIR}/images}"
REMOTE_IMAGE_TAR="${REMOTE_IMAGE_TAR:-${REMOTE_IMAGES_DIR}/act-obe.tar}"
REMOTE_PROVENANCE_FILE="${REMOTE_PROVENANCE_FILE:-${REMOTE_IMAGE_TAR}.provenance.json}"
LOCAL_RUNTIME_DIR="${LOCAL_RUNTIME_DIR:-${ROOT_DIR}/course-content/runtime}"
REMOTE_RUNTIME_DIR="${REMOTE_RUNTIME_DIR:-${REMOTE_PROJECT_DIR}/course-content/runtime}"
REMOTE_OSSFS_MOUNT_ROOT="${REMOTE_OSSFS_MOUNT_ROOT:-${REMOTE_PROJECT_DIR}/data/runtime/ossfs/releases}"
REMOTE_BLOB_VIEW_ROOT="${REMOTE_BLOB_VIEW_ROOT:-${REMOTE_PROJECT_DIR}/data/runtime/blob-views}"
RUNTIME_DELIVERY_MODE="${RUNTIME_DELIVERY_MODE:-ossfs-blob-view}"
RUNTIME_RELEASE_ID="${RUNTIME_RELEASE_ID:-}"
RUNTIME_EXPECTED_ACTIVE_RELEASE="${RUNTIME_EXPECTED_ACTIVE_RELEASE:-}"
RUNTIME_VERIFICATION_RECEIPT="${RUNTIME_VERIFICATION_RECEIPT:-}"
RUNTIME_OSS_RAM_ROLE="${RUNTIME_OSS_RAM_ROLE:-}"
REMOTE_RUNTIME_PARENT_DIR="$(dirname "${REMOTE_RUNTIME_DIR}")"
REMOTE_AUTHORITY_CURRENT_POINTER="${REMOTE_AUTHORITY_CURRENT_POINTER:-${REMOTE_PROJECT_DIR}/course-content/authoring/knowledge/authority/current.json}"
if [[ "${RUNTIME_DELIVERY_MODE}" == "ossfs-blob-view" ]]; then
  REMOTE_PRODUCTION_CUTOVER_MARKER="${REMOTE_PRODUCTION_CUTOVER_MARKER:-${REMOTE_BLOB_VIEW_ROOT}/current/knowledge/production-cutover-transactions/current.json}"
else
  REMOTE_PRODUCTION_CUTOVER_MARKER="${REMOTE_PRODUCTION_CUTOVER_MARKER:-${REMOTE_RUNTIME_DIR}/knowledge/production-cutover-transactions/current.json}"
fi
LOCAL_TEXTBOOK_V2_RUNTIME_DIR="${LOCAL_RUNTIME_DIR}/resources/textbooks-v2"
REMOTE_TEXTBOOK_V2_RUNTIME_DIR="${REMOTE_RUNTIME_DIR}/resources/textbooks-v2"
LOCAL_TEXTBOOK_RETRIEVAL_INDEX_DIR="${LOCAL_RUNTIME_DIR}/resources/textbook-hybrid-retrieval/bge-m3"
REMOTE_TEXTBOOK_RETRIEVAL_INDEX_DIR="${REMOTE_RUNTIME_DIR}/resources/textbook-hybrid-retrieval/bge-m3"
REMOTE_RUNTIME_STAGING_DIR="${REMOTE_RUNTIME_DIR}.staging"
REMOTE_RUNTIME_SELECTION_LOCK="${REMOTE_RUNTIME_SELECTION_LOCK:-${REMOTE_PROJECT_DIR}/data/runtime/.act-runtime-selection.lock}"
LOCAL_RESOURCE_SET_HELPER="${ROOT_DIR}/scripts/release/textbook-resource-set.mjs"
LOCAL_RESOURCE_SET_CONFIG="${ROOT_DIR}/course-content/config/textbook-resource-set.json"
REMOTE_RESOURCE_SET_HELPER="${REMOTE_PROJECT_DIR}/scripts/textbook-resource-set.mjs"
REMOTE_RESOURCE_SET_CONFIG="${REMOTE_PROJECT_DIR}/course-content/config/textbook-resource-set.json"
TEXTBOOK_V2_BOOK_IDS="$(node "${LOCAL_RESOURCE_SET_HELPER}" ids)"
TEXTBOOK_V2_BOOK_COUNT="$(node "${LOCAL_RESOURCE_SET_HELPER}" count)"
TEXTBOOK_V2_REQUIRED_FILES="manifest.json navigation.json units.jsonl anchors.jsonl windows.jsonl anomalies.jsonl samples.jsonl"
TEXTBOOK_RETRIEVAL_REQUIRED_FILES="manifest.json windows.jsonl bodies.utf8 vectors.f32 lexical-terms.jsonl lexical-postings.bin build-report.json"
LOCAL_APP_DEPLOY_SCRIPT="${LOCAL_APP_DEPLOY_SCRIPT:-${ROOT_DIR}/deploy/podman/deploy.sh}"
REMOTE_APP_DEPLOY_SCRIPT="${REMOTE_APP_DEPLOY_SCRIPT:-${REMOTE_PROJECT_DIR}/scripts/4-deploy.sh}"
LOCAL_SERVICE_SCRIPT="${LOCAL_SERVICE_SCRIPT:-${ROOT_DIR}/deploy/podman/configure-service.sh}"
REMOTE_SERVICE_SCRIPT="${REMOTE_SERVICE_SCRIPT:-${REMOTE_PROJECT_DIR}/scripts/5-configure-service.sh}"
LOCAL_START_WRAPPER_SCRIPT="${LOCAL_START_WRAPPER_SCRIPT:-${ROOT_DIR}/deploy/podman/container-start-wrapper.sh}"
REMOTE_START_WRAPPER_SCRIPT="${REMOTE_START_WRAPPER_SCRIPT:-${REMOTE_PROJECT_DIR}/scripts/container-start-wrapper.sh}"
LOCAL_PROVENANCE_HELPER="${ROOT_DIR}/scripts/release/textbook-runtime-v2-provenance.mjs"
REMOTE_PROVENANCE_HELPER="${REMOTE_PROJECT_DIR}/scripts/textbook-runtime-v2-provenance.mjs"
LOCAL_PROVENANCE_INPUT_HELPER="${ROOT_DIR}/scripts/release/textbook-runtime-input-provenance.mjs"
REMOTE_PROVENANCE_INPUT_HELPER="${REMOTE_PROJECT_DIR}/scripts/textbook-runtime-input-provenance.mjs"
REMOTE_EXPORT_DB_SCRIPT="${REMOTE_EXPORT_DB_SCRIPT:-${REMOTE_PROJECT_DIR}/scripts/1-export-db.sh}"
REMOTE_LOAD_IMAGES_SCRIPT="${REMOTE_LOAD_IMAGES_SCRIPT:-${REMOTE_PROJECT_DIR}/scripts/2-load-images.sh}"
REMOTE_IMPORT_DB_SCRIPT="${REMOTE_IMPORT_DB_SCRIPT:-${REMOTE_PROJECT_DIR}/scripts/3-import-db.sh}"
REMOTE_NGINX_SCRIPT="${REMOTE_NGINX_SCRIPT:-${REMOTE_PROJECT_DIR}/scripts/6-configure-nginx.sh}"
LOCAL_RUNTIME_RELEASE_DIR="${LOCAL_RUNTIME_RELEASE_DIR:-${ROOT_DIR}/scripts/runtime-release}"
REMOTE_RUNTIME_RELEASE_DIR="${REMOTE_RUNTIME_RELEASE_DIR:-${REMOTE_PROJECT_DIR}/scripts/runtime-release}"
REMOTE_RUNTIME_HOST_STATE_SCRIPT="${REMOTE_RUNTIME_HOST_STATE_SCRIPT:-${REMOTE_PROJECT_DIR}/scripts/runtime-release-host-state.py}"
REMOTE_RUNTIME_OSSFS_CONFIG_SCRIPT="${REMOTE_RUNTIME_OSSFS_CONFIG_SCRIPT:-${REMOTE_PROJECT_DIR}/scripts/configure-runtime-ossfs-release.sh}"
REMOTE_RUNTIME_ACTIVATE_SCRIPT="${REMOTE_RUNTIME_ACTIVATE_SCRIPT:-${REMOTE_PROJECT_DIR}/scripts/activate-runtime-release.sh}"
REMOTE_RUNTIME_OSSFS_SERVICE="${REMOTE_RUNTIME_OSSFS_SERVICE:-/etc/systemd/system/act-runtime-ossfs@.service}"
REMOTE_RUNTIME_VERIFICATION_RECEIPT="${REMOTE_RUNTIME_VERIFICATION_RECEIPT:-${REMOTE_PROJECT_DIR}/data/runtime/act-runtime-release-verification.json}"
PUBLIC_URL="${PUBLIC_URL:-https://act.adapt-learn.online/}"
APP_NAME_HINT="${APP_NAME_HINT:-act-obe-app}"
DB_NAME_HINT="${DB_NAME_HINT:-act-obe-postgres}"
REDIS_NAME_HINT="${REDIS_NAME_HINT:-act-obe-redis}"
WORKER_NAME_HINT="${WORKER_NAME_HINT:-act-obe-worker}"
GC_NAME_HINT="${GC_NAME_HINT:-act-obe-submission-gc}"
REMOTE_APP_IMAGE="${REMOTE_APP_IMAGE:-localhost/act-obe-platform:20260301-amd64}"

REMOTE_TMP_TAR="${REMOTE_IMAGE_TAR}.tmp"
REMOTE_TMP_PROVENANCE_FILE="${REMOTE_PROVENANCE_FILE}.tmp"
REMOTE_TMP_PROVENANCE_HELPER="${REMOTE_PROVENANCE_HELPER}.tmp"
REMOTE_TMP_PROVENANCE_INPUT_HELPER="${REMOTE_PROVENANCE_INPUT_HELPER}.tmp"
REMOTE_TMP_RESOURCE_SET_HELPER="${REMOTE_RESOURCE_SET_HELPER}.tmp"
REMOTE_TMP_RESOURCE_SET_CONFIG="${REMOTE_RESOURCE_SET_CONFIG}.tmp"
REMOTE_TMP_APP_DEPLOY_SCRIPT="${REMOTE_APP_DEPLOY_SCRIPT}.tmp"
REMOTE_TMP_SERVICE_SCRIPT="${REMOTE_SERVICE_SCRIPT}.tmp"
REMOTE_TMP_START_WRAPPER_SCRIPT="${REMOTE_START_WRAPPER_SCRIPT}.tmp"
REMOTE_LOG_FILE="${REMOTE_LOG_FILE:-/tmp/act-obe-one-key.log}"
CUTOVER_STARTED=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --skip-build)
      SKIP_BUILD=1
      shift
      ;;
    --app-only)
      DEPLOY_SCOPE="app"
      shift
      ;;
    -h|--help)
      cat <<'EOF'
用法: scripts/remote-deploy.sh [--skip-build] [--app-only]

默认行为:
  1. 调用 scripts/build.sh 本地构建镜像
  2. 上传 deploy/images/act-obe.tar 到远端
  3. 绑定远端已物化的 OSS blob-view，执行应用部署并验证

本脚本默认 RUNTIME_DELIVERY_MODE=ossfs-blob-view，不会 rsync
course-content/runtime。更新 runtime 请使用 npm run deploy:runtime。
legacy-rsync 已退役；更新 runtime 只能使用 npm run deploy:runtime。

选项:
  --skip-build   跳过本地构建，直接上传并部署现有镜像产物
  --app-only     仅更新镜像和应用；不传输、选择或验证 runtime release
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

check_remote_textbook_v2_files() {
  local runtime_dir="${1:-${REMOTE_RUNTIME_DIR}}"
  remote "bash -lc '
set -euo pipefail
runtime_root=\"${runtime_dir}/resources/textbooks-v2\"
index_root=\"${runtime_dir}/resources/textbook-hybrid-retrieval/bge-m3\"
found=0
for candidate in \"\${runtime_root}\"/*; do
  [ -d \"\${candidate}\" ] || continue
  book_id=\$(basename \"\${candidate}\")
  case \" ${TEXTBOOK_V2_BOOK_IDS} \" in
    *\" \${book_id} \"*) ;;
    *) echo \"ERROR: unexpected textbook v2 runtime directory: \${book_id}\" >&2; exit 1 ;;
  esac
  found=\$((found + 1))
done
[ \"\${found}\" -eq \"${TEXTBOOK_V2_BOOK_COUNT}\" ]
for book_id in ${TEXTBOOK_V2_BOOK_IDS}; do
  for file_name in ${TEXTBOOK_V2_REQUIRED_FILES}; do
    test -f \"\${runtime_root}/\${book_id}/\${file_name}\"
  done
  grep -q \"schemaVersion.*structured-textbook-runtime.v2\" \"\${runtime_root}/\${book_id}/manifest.json\"
  grep -q \"sourceRevision.*${PROVENANCE_APP_REVISION:-__preflight_pending__}\" \"\${runtime_root}/\${book_id}/manifest.json\"
done
for file_name in ${TEXTBOOK_RETRIEVAL_REQUIRED_FILES}; do
  test -f \"\${index_root}/\${file_name}\"
done
grep -q \"formatVersion.*textbook-hybrid-retrieval.v1\" \"\${index_root}/manifest.json\"
grep -q \"sourceRevision.*${PROVENANCE_APP_REVISION:-__preflight_pending__}\" \"\${index_root}/manifest.json\"
'"
}

check_remote_runtime_pointer_absence() {
  local runtime_dir="${1:-${REMOTE_RUNTIME_DIR}}"
  remote "bash -lc '
set -euo pipefail
runtime_root=\"${runtime_dir}\"
for pointer in \
  knowledge/consumer-activation/current.json \
  knowledge/projection/current.json \
  knowledge/prerequisites/current.json \
  knowledge/authority-domain-shards/current.json; do
  if [ -e \"\${runtime_root}/\${pointer}\" ]; then
    echo \"ERROR: production runtime pointer must be absent: \${pointer}\" >&2
    exit 1
  fi
done
'"
}

check_remote_authority_current_pointer_absence() {
  remote "bash -lc '
set -euo pipefail
pointer=\"${REMOTE_AUTHORITY_CURRENT_POINTER}\"
if [ -e \"\${pointer}\" ] || [ -L \"\${pointer}\" ]; then
  echo \"ERROR: production legacy runtime must not contain host Authority current pointer: \${pointer}\" >&2
  exit 1
fi
'"
}

check_remote_blob_view() {
  local view_dir="${1:-${REMOTE_BLOB_VIEW_ROOT}/current}"
  remote "bash -lc '
set -euo pipefail
view=\"${view_dir}\"
if [ ! -d \"\${view}\" ]; then
  echo \"ERROR: ossfs-blob-view 缺少已物化 current view: \${view}\" >&2
  echo \"ERROR: 更新 runtime 请使用 npm run deploy:runtime，不要 rsync course-content/runtime\" >&2
  exit 1
fi
if [ ! -e \"\${view}/.act-runtime-release.v2.json\" ] && [ ! -L \"\${view}/.act-runtime-release.v2.json\" ]; then
  echo \"ERROR: ossfs-blob-view 缺少 v2 身份工件: \${view}/.act-runtime-release.v2.json\" >&2
  exit 1
fi
if [ ! -e \"\${view}/.act-runtime-release-materialization.v1.json\" ] && [ ! -L \"\${view}/.act-runtime-release-materialization.v1.json\" ]; then
  echo \"ERROR: ossfs-blob-view 缺少物化 receipt: \${view}/.act-runtime-release-materialization.v1.json\" >&2
  exit 1
fi
helper=\"\${view}/.act-runtime-blobs\"
if [ ! -d \"\${helper}\" ] || [ -L \"\${helper}\" ]; then
  echo \"ERROR: ossfs-blob-view 缺少真实 helper 目录: \${helper}\" >&2
  exit 1
fi
findmnt -rn -M \"\${helper}\" -o FSTYPE | grep -Eq \"^fuse(\\.|\$)\"
findmnt -rn -M \"\${helper}\" -o OPTIONS | grep -Eq \"(^|,)ro(,|\$)\"
'"
}

check_container_blob_view() {
  remote "podman exec '${APP_NAME_HINT}' sh -lc '
set -eu
test -e /app/course-content/runtime/.act-runtime-release.v2.json
test -e /app/course-content/runtime/.act-runtime-release-materialization.v1.json
test -d /app/course-content/runtime/.act-runtime-blobs
'"
}

require_oss_runtime_release_inputs() {
  [[ "${RUNTIME_DELIVERY_MODE}" == "ossfs-release" ]] || return 0
  [[ "${RUNTIME_RELEASE_ID}" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]] || fail "ossfs-release 缺少有效 RUNTIME_RELEASE_ID"
  [[ "${RUNTIME_EXPECTED_ACTIVE_RELEASE}" == "none" || "${RUNTIME_EXPECTED_ACTIVE_RELEASE}" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]] || fail "ossfs-release 缺少有效 RUNTIME_EXPECTED_ACTIVE_RELEASE（首次切换使用 none）"
  [[ -f "${RUNTIME_VERIFICATION_RECEIPT}" ]] || fail "ossfs-release 缺少本地 verification receipt"
  [[ "${RUNTIME_OSS_RAM_ROLE}" =~ ^[A-Za-z0-9_+=,.@-]{1,128}$ ]] || fail "ossfs-release 缺少有效 ECS RAM Role 名称"
  for file in runtime-release-host-state.py configure-runtime-ossfs-release.sh activate-runtime-release.sh rollback-runtime-release.sh act-runtime-ossfs@.service; do
    [[ -f "${LOCAL_RUNTIME_RELEASE_DIR}/${file}" ]] || fail "ossfs-release 本地工具缺失: ${LOCAL_RUNTIME_RELEASE_DIR}/${file}"
  done
}

sync_oss_runtime_release_host_tools() {
  remote "mkdir -p '${REMOTE_RUNTIME_RELEASE_DIR}' '$(dirname "${REMOTE_RUNTIME_HOST_STATE_SCRIPT}")' '$(dirname "${REMOTE_RUNTIME_VERIFICATION_RECEIPT}")' '$(dirname "${REMOTE_RUNTIME_OSSFS_SERVICE}")'"
  scp -q "${LOCAL_RUNTIME_RELEASE_DIR}/runtime-release-host-state.py" "${SSH_TARGET}:${REMOTE_RUNTIME_HOST_STATE_SCRIPT}.tmp"
  remote "chmod 0755 '${REMOTE_RUNTIME_HOST_STATE_SCRIPT}.tmp' && mv '${REMOTE_RUNTIME_HOST_STATE_SCRIPT}.tmp' '${REMOTE_RUNTIME_HOST_STATE_SCRIPT}'"
  scp -q "${LOCAL_RUNTIME_RELEASE_DIR}/configure-runtime-ossfs-release.sh" "${SSH_TARGET}:${REMOTE_RUNTIME_OSSFS_CONFIG_SCRIPT}.tmp"
  remote "chmod 0755 '${REMOTE_RUNTIME_OSSFS_CONFIG_SCRIPT}.tmp' && mv '${REMOTE_RUNTIME_OSSFS_CONFIG_SCRIPT}.tmp' '${REMOTE_RUNTIME_OSSFS_CONFIG_SCRIPT}'"
  scp -q "${LOCAL_RUNTIME_RELEASE_DIR}/activate-runtime-release.sh" "${SSH_TARGET}:${REMOTE_RUNTIME_ACTIVATE_SCRIPT}.tmp"
  remote "chmod 0755 '${REMOTE_RUNTIME_ACTIVATE_SCRIPT}.tmp' && mv '${REMOTE_RUNTIME_ACTIVATE_SCRIPT}.tmp' '${REMOTE_RUNTIME_ACTIVATE_SCRIPT}'"
  scp -q "${LOCAL_RUNTIME_RELEASE_DIR}/rollback-runtime-release.sh" "${SSH_TARGET}:${REMOTE_RUNTIME_RELEASE_DIR}/rollback-runtime-release.sh.tmp"
  remote "chmod 0755 '${REMOTE_RUNTIME_RELEASE_DIR}/rollback-runtime-release.sh.tmp' && mv '${REMOTE_RUNTIME_RELEASE_DIR}/rollback-runtime-release.sh.tmp' '${REMOTE_RUNTIME_RELEASE_DIR}/rollback-runtime-release.sh'"
  scp -q "${LOCAL_RUNTIME_RELEASE_DIR}/act-runtime-ossfs@.service" "${SSH_TARGET}:${REMOTE_RUNTIME_OSSFS_SERVICE}.tmp"
  remote "chmod 0644 '${REMOTE_RUNTIME_OSSFS_SERVICE}.tmp' && mv '${REMOTE_RUNTIME_OSSFS_SERVICE}.tmp' '${REMOTE_RUNTIME_OSSFS_SERVICE}' && systemctl daemon-reload"
  scp -q "${RUNTIME_VERIFICATION_RECEIPT}" "${SSH_TARGET}:${REMOTE_RUNTIME_VERIFICATION_RECEIPT}.tmp"
  remote "chmod 0600 '${REMOTE_RUNTIME_VERIFICATION_RECEIPT}.tmp' && mv '${REMOTE_RUNTIME_VERIFICATION_RECEIPT}.tmp' '${REMOTE_RUNTIME_VERIFICATION_RECEIPT}'"
}

guard_no_committed_production_cutover() {
  if ! remote "bash -lc '
set -euo pipefail
marker=\"${REMOTE_PRODUCTION_CUTOVER_MARKER}\"
if [ -e \"\${marker}\" ] || [ -L \"\${marker}\" ]; then
  echo \"ERROR: committed production knowledge cutover marker is present: \${marker}\" >&2
  exit 1
fi
'"; then
    fail "检测到已提交的生产图谱切换；普通 Legacy 部署会删除 selector，必须使用切换感知的发布流程或先执行显式回滚"
  fi
}

check_container_textbook_v2_files() {
  remote "podman exec '${APP_NAME_HINT}' sh -lc '
set -eu
runtime_root=/app/course-content/runtime/resources/textbooks-v2
index_root=/app/course-content/runtime/resources/textbook-hybrid-retrieval/bge-m3
found=0
for candidate in \"\${runtime_root}\"/*; do
  [ -d \"\${candidate}\" ] || continue
  book_id=\$(basename \"\${candidate}\")
  case \" ${TEXTBOOK_V2_BOOK_IDS} \" in
    *\" \${book_id} \"*) ;;
    *) echo \"ERROR: unexpected mounted textbook v2 runtime directory: \${book_id}\" >&2; exit 1 ;;
  esac
  found=\$((found + 1))
done
[ \"\${found}\" -eq \"${TEXTBOOK_V2_BOOK_COUNT}\" ]
for book_id in ${TEXTBOOK_V2_BOOK_IDS}; do
  for file_name in ${TEXTBOOK_V2_REQUIRED_FILES}; do
    test -f \"\${runtime_root}/\${book_id}/\${file_name}\"
  done
  grep -q \"schemaVersion.*structured-textbook-runtime.v2\" \"\${runtime_root}/\${book_id}/manifest.json\"
  grep -q \"sourceRevision.*${PROVENANCE_APP_REVISION}\" \"\${runtime_root}/\${book_id}/manifest.json\"
done
for file_name in ${TEXTBOOK_RETRIEVAL_REQUIRED_FILES}; do
  test -f \"\${index_root}/\${file_name}\"
done
grep -q \"formatVersion.*textbook-hybrid-retrieval.v1\" \"\${index_root}/manifest.json\"
grep -q \"sourceRevision.*${PROVENANCE_APP_REVISION}\" \"\${index_root}/manifest.json\"
'"
}

stop_remote_runtime_consumers() {
  remote "bash -lc '
set -euo pipefail
mkdir -p "${REMOTE_PROJECT_DIR}/data/runtime"
exec 9>"${REMOTE_RUNTIME_SELECTION_LOCK}"
flock -x 9
for container in \
  \"${APP_NAME_HINT}\" \
  \"${WORKER_NAME_HINT}\" \
  \"${GC_NAME_HINT}\" \
  act-obe-submission-scanner; do
  if podman container exists \"\${container}\"; then
    podman stop -t 30 \"\${container}\" >/dev/null
  fi
done
for container in \
  \"${APP_NAME_HINT}\" \
  \"${WORKER_NAME_HINT}\" \
  \"${GC_NAME_HINT}\" \
  act-obe-submission-scanner; do
  if podman ps --format \"{{.Names}}\" | grep -Fxq \"\${container}\"; then
    echo \"ERROR: runtime consumer still running: \${container}\" >&2
    exit 1
  fi
done
'"
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

handle_failure() {
  local exit_code="$1"
  log
  log "部署流程失败，退出码: ${exit_code}"
  log "未执行 course-content/runtime rsync；保持当前远端 runtime 选择"
  if [[ "${CUTOVER_STARTED}" == "1" ]]; then
    print_remote_diagnostics
  else
    log "本地预检未通过，尚未开始远端 runtime 切换"
  fi
}

on_error() {
  local exit_code=$?
  trap - ERR EXIT
  handle_failure "${exit_code}"
  exit "${exit_code}"
}

on_exit() {
  local exit_code=$?
  if [[ "${exit_code}" -eq 0 ]]; then
    return
  fi
  trap - ERR EXIT
  handle_failure "${exit_code}"
  exit "${exit_code}"
}

trap on_error ERR
trap on_exit EXIT

require_cmd bash
require_cmd ssh
require_cmd scp
require_cmd curl
require_cmd python3
require_cmd node

if [[ "${DEPLOY_SCOPE}" == "all" ]]; then
  case "${RUNTIME_DELIVERY_MODE}" in
    ossfs-blob-view)
      ;;
    ossfs-release)
      require_oss_runtime_release_inputs
      ;;
    legacy-rsync)
      fail "legacy-rsync 已退役。更新 course-content/runtime 请使用 npm run deploy:runtime"
      ;;
    *)
      fail "RUNTIME_DELIVERY_MODE 必须为 ossfs-blob-view 或 ossfs-release。legacy-rsync 已退役，请使用 npm run deploy:runtime"
      ;;
  esac
fi

log "[1/5] 本地构建"
if [[ "${SKIP_BUILD}" == "1" ]]; then
  log "已启用 --skip-build，跳过本地构建，直接使用现有镜像产物"
else
  BUILD_SCOPE="$([[ "${DEPLOY_SCOPE}" == "app" ]] && printf '%s' app-only || printf '%s' runtime-bound)" \
    OUTPUT_TAR="${LOCAL_IMAGE_TAR}" IMAGE_TAG="${REMOTE_APP_IMAGE}" \
    bash "${ROOT_DIR}/scripts/build.sh"
fi

[[ -s "${LOCAL_IMAGE_TAR}" ]] || fail "本地镜像产物不存在或为空: ${LOCAL_IMAGE_TAR}"
[[ -f "${LOCAL_PROVENANCE_FILE}" ]] || fail "本地镜像缺少 provenance sidecar: ${LOCAL_PROVENANCE_FILE}"
[[ -f "${LOCAL_PROVENANCE_HELPER}" ]] || fail "本地教材 runtime provenance helper 不存在"
[[ -f "${LOCAL_PROVENANCE_INPUT_HELPER}" ]] || fail "本地教材 runtime input provenance helper 不存在"
[[ -f "${LOCAL_RESOURCE_SET_HELPER}" ]] || fail "本地教材 resourceSet helper 不存在"
[[ -f "${LOCAL_RESOURCE_SET_CONFIG}" ]] || fail "本地教材 resourceSet 配置不存在"

node "${LOCAL_PROVENANCE_HELPER}" verify-image \
  --image-tar "${LOCAL_IMAGE_TAR}" \
  --sidecar "${LOCAL_PROVENANCE_FILE}"
PROVENANCE_DEPLOYMENT_SCOPE="$(
  node "${LOCAL_PROVENANCE_HELPER}" print-field \
    --sidecar "${LOCAL_PROVENANCE_FILE}" \
    --field deploymentScope
)"
if [[ "${DEPLOY_SCOPE}" == "app" ]]; then
  [[ "${PROVENANCE_DEPLOYMENT_SCOPE}" == "app-only" ]] \
    || fail "--app-only 必须使用 deploymentScope=app-only 的镜像 provenance"
else
  [[ "${PROVENANCE_DEPLOYMENT_SCOPE}" == "runtime-bound" ]] \
    || fail "包含 runtime 选择的部署必须使用 runtime-bound 镜像 provenance"
fi
PROVENANCE_APP_REVISION="$(
  node "${LOCAL_PROVENANCE_HELPER}" print-field \
    --sidecar "${LOCAL_PROVENANCE_FILE}" \
    --field appRevision
)"
PROVENANCE_RUNTIME_REVISION=""
PROVENANCE_RUNTIME_DIGEST=""
PROVENANCE_INDEX_REVISION=""
PROVENANCE_INDEX_DIGEST=""
if [[ "${PROVENANCE_DEPLOYMENT_SCOPE}" == "runtime-bound" ]]; then
  PROVENANCE_RUNTIME_REVISION="$(
    node "${LOCAL_PROVENANCE_HELPER}" print-field \
      --sidecar "${LOCAL_PROVENANCE_FILE}" \
      --field runtimeSourceRevision
  )"
  PROVENANCE_RUNTIME_DIGEST="$(
    node "${LOCAL_PROVENANCE_HELPER}" print-field \
      --sidecar "${LOCAL_PROVENANCE_FILE}" \
      --field runtimeDigest
  )"
  PROVENANCE_INDEX_REVISION="$(
    node "${LOCAL_PROVENANCE_HELPER}" print-field \
      --sidecar "${LOCAL_PROVENANCE_FILE}" \
      --field indexSourceRevision
  )"
  PROVENANCE_INDEX_DIGEST="$(
    node "${LOCAL_PROVENANCE_HELPER}" print-field \
      --sidecar "${LOCAL_PROVENANCE_FILE}" \
      --field indexDigest
  )"
fi

LOCAL_SHA="$(local_sha256 "${LOCAL_IMAGE_TAR}")"
log "本地镜像: ${LOCAL_IMAGE_TAR}"
log "本地 SHA256: ${LOCAL_SHA}"

log
log "[2/5] 同步部署脚本"
[[ -f "${LOCAL_APP_DEPLOY_SCRIPT}" ]] || fail "本地应用部署脚本不存在: ${LOCAL_APP_DEPLOY_SCRIPT}"
[[ -f "${LOCAL_SERVICE_SCRIPT}" ]] || fail "本地 systemd 配置脚本不存在: ${LOCAL_SERVICE_SCRIPT}"
[[ -f "${LOCAL_START_WRAPPER_SCRIPT}" ]] || fail "本地容器启动包装脚本不存在: ${LOCAL_START_WRAPPER_SCRIPT}"

remote "mkdir -p '${REMOTE_IMAGES_DIR}' '${REMOTE_RUNTIME_PARENT_DIR}' '$(dirname "${REMOTE_APP_DEPLOY_SCRIPT}")' '$(dirname "${REMOTE_PROVENANCE_HELPER}")' '$(dirname "${REMOTE_RESOURCE_SET_CONFIG}")'"

scp -q "${LOCAL_PROVENANCE_FILE}" "${SSH_TARGET}:${REMOTE_TMP_PROVENANCE_FILE}"
remote "mv '${REMOTE_TMP_PROVENANCE_FILE}' '${REMOTE_PROVENANCE_FILE}'"
scp -q "${LOCAL_PROVENANCE_HELPER}" "${SSH_TARGET}:${REMOTE_TMP_PROVENANCE_HELPER}"
remote "mv '${REMOTE_TMP_PROVENANCE_HELPER}' '${REMOTE_PROVENANCE_HELPER}'"
scp -q "${LOCAL_PROVENANCE_INPUT_HELPER}" "${SSH_TARGET}:${REMOTE_TMP_PROVENANCE_INPUT_HELPER}"
remote "mv '${REMOTE_TMP_PROVENANCE_INPUT_HELPER}' '${REMOTE_PROVENANCE_INPUT_HELPER}'"
scp -q "${LOCAL_RESOURCE_SET_HELPER}" "${SSH_TARGET}:${REMOTE_TMP_RESOURCE_SET_HELPER}"
remote "mv '${REMOTE_TMP_RESOURCE_SET_HELPER}' '${REMOTE_RESOURCE_SET_HELPER}'"
scp -q "${LOCAL_RESOURCE_SET_CONFIG}" "${SSH_TARGET}:${REMOTE_TMP_RESOURCE_SET_CONFIG}"
remote "mv '${REMOTE_TMP_RESOURCE_SET_CONFIG}' '${REMOTE_RESOURCE_SET_CONFIG}'"

if [[ "${DEPLOY_SCOPE}" == "all" ]]; then
  case "${RUNTIME_DELIVERY_MODE}" in
    ossfs-blob-view)
      log "- ossfs-blob-view：不传输 runtime 内容，绑定远端已物化 view"
      REMOTE_RUNTIME_DIR="${REMOTE_BLOB_VIEW_ROOT}/current"
      REMOTE_TEXTBOOK_V2_RUNTIME_DIR="${REMOTE_RUNTIME_DIR}/resources/textbooks-v2"
      REMOTE_TEXTBOOK_RETRIEVAL_INDEX_DIR="${REMOTE_RUNTIME_DIR}/resources/textbook-hybrid-retrieval/bge-m3"
      ;;
    legacy-rsync)
      fail "legacy-rsync 已退役。更新 course-content/runtime 请使用 npm run deploy:runtime"
      ;;
    ossfs-release)
      log "- 同步 OSS runtime release 主机工具与已验证 receipt（不复制 runtime 内容）"
      sync_oss_runtime_release_host_tools
      REMOTE_RUNTIME_DIR="${REMOTE_OSSFS_MOUNT_ROOT}/${RUNTIME_RELEASE_ID}"
      REMOTE_TEXTBOOK_V2_RUNTIME_DIR="${REMOTE_RUNTIME_DIR}/resources/textbooks-v2"
      REMOTE_TEXTBOOK_RETRIEVAL_INDEX_DIR="${REMOTE_RUNTIME_DIR}/resources/textbook-hybrid-retrieval/bge-m3"
      ;;
    *)
      fail "RUNTIME_DELIVERY_MODE 必须为 ossfs-blob-view 或 ossfs-release。legacy-rsync 已退役，请使用 npm run deploy:runtime"
      ;;
  esac
else
  log "- --app-only：保留当前 runtime 选择，不传输或变更 runtime 内容"
fi

if [[ "${DEPLOY_SCOPE}" == "all" && "${RUNTIME_DELIVERY_MODE}" == "ossfs-blob-view" ]]; then
  log "- 预检远端已物化 blob-view，缺失时失败关闭而不是 rsync runtime"
  check_remote_blob_view
fi

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
remote "cd '${REMOTE_PROJECT_DIR}' && node '${REMOTE_PROVENANCE_HELPER}' verify-image \
  --image-tar '${REMOTE_IMAGE_TAR}' \
  --sidecar '${REMOTE_PROVENANCE_FILE}'"

log
log "[4/5] 远端部署"
remote "bash -lc 'set -euo pipefail
{
  echo \"[remote-deploy] Step 1/7: 导出现有数据库\"
  \"${REMOTE_EXPORT_DB_SCRIPT}\"
  echo \"[remote-deploy] Step 2/7: 装载镜像\"
  \"${REMOTE_LOAD_IMAGES_SCRIPT}\"
  IMAGE_REVISION=\$(podman image inspect \"${REMOTE_APP_IMAGE}\" --format \"{{ index .Labels \\\"org.opencontainers.image.revision\\\" }}\")
  if [ \"\${IMAGE_REVISION}\" != \"${PROVENANCE_APP_REVISION}\" ]; then
    echo \"ERROR: loaded image revision mismatch: expected=${PROVENANCE_APP_REVISION} actual=\${IMAGE_REVISION}\" >&2
    exit 1
  fi
  echo \"[remote-deploy] Step 3/7: 启动数据库容器\"
  APP_IMAGE=\"${REMOTE_APP_IMAGE}\" \"${REMOTE_APP_DEPLOY_SCRIPT}\" --db-only
  echo \"[remote-deploy] Step 4/7: 导入最新数据库\"
  \"${REMOTE_IMPORT_DB_SCRIPT}\"
  echo \"[remote-deploy] Step 5/8: 启动应用容器\"
  if [ \"${DEPLOY_SCOPE}\" = \"all\" ] && [ \"${RUNTIME_DELIVERY_MODE}\" = \"ossfs-release\" ]; then
    RUNTIME_DELIVERY_MODE=ossfs-release \\
      ACT_RUNTIME_OSS_RAM_ROLE=\"${RUNTIME_OSS_RAM_ROLE}\" \\
      ACT_RUNTIME_OSS_BUCKET=act-course-assets \\
      ACT_RUNTIME_OSS_REGION=oss-cn-hangzhou \\
      APP_IMAGE=\"${REMOTE_APP_IMAGE}\" \\
      ACT_RUNTIME_DEPLOY_SCRIPT=\"${REMOTE_APP_DEPLOY_SCRIPT}\" \\
      \"${REMOTE_RUNTIME_ACTIVATE_SCRIPT}\" \\
        --release-id \"${RUNTIME_RELEASE_ID}\" \\
        --expected-active-release \"${RUNTIME_EXPECTED_ACTIVE_RELEASE}\" \\
        --verification-receipt \"${REMOTE_RUNTIME_VERIFICATION_RECEIPT}\" \\
        --ram-role \"${RUNTIME_OSS_RAM_ROLE}\"
  elif [ \"${DEPLOY_SCOPE}\" = \"all\" ] && [ \"${RUNTIME_DELIVERY_MODE}\" = \"ossfs-blob-view\" ]; then
    RUNTIME_DELIVERY_MODE=ossfs-blob-view \\
      RUNTIME_CONTENT_DIR=\"${REMOTE_BLOB_VIEW_ROOT}/current\" \\
      ${RUNTIME_OSS_RAM_ROLE:+ACT_RUNTIME_OSS_RAM_ROLE=\"${RUNTIME_OSS_RAM_ROLE}\" }\\
      APP_IMAGE=\"${REMOTE_APP_IMAGE}\" \\
      \"${REMOTE_APP_DEPLOY_SCRIPT}\" --app-only
  else
    APP_IMAGE=\"${REMOTE_APP_IMAGE}\" \"${REMOTE_APP_DEPLOY_SCRIPT}\" --app-only
  fi
  echo \"[remote-deploy] Step 6/8: 同步 runtime 知识图谱到数据库\"
  podman exec \"${APP_NAME_HINT}\" npm run seed:knowledge
  echo \"[remote-deploy] Step 7/8: 配置 Nginx 域名反向代理\"
  \"${REMOTE_NGINX_SCRIPT}\"
  echo \"[remote-deploy] Step 8/8: 配置 systemd 开机自启\"
  \"${REMOTE_SERVICE_SCRIPT}\"
} 2>&1 | tee \"${REMOTE_LOG_FILE}\"'"

log "[5/5] 部署验证"

log "- 校验远端镜像文件"
remote "test -s '${REMOTE_IMAGE_TAR}'"
remote "test -f '${REMOTE_PROVENANCE_FILE}'"
remote "test -f '${REMOTE_PROVENANCE_HELPER}'"
remote "test -f '${REMOTE_PROVENANCE_INPUT_HELPER}'"
remote "test -f '${REMOTE_RESOURCE_SET_HELPER}'"
remote "test -f '${REMOTE_RESOURCE_SET_CONFIG}'"

if [[ "${DEPLOY_SCOPE}" == "all" ]]; then
  if [[ "${RUNTIME_DELIVERY_MODE}" == "ossfs-blob-view" ]]; then
    log "- 校验远端已物化 blob-view（不按镜像 provenance 重核 runtime）"
    check_remote_blob_view
  else
    log "- 校验远端 runtime 目录"
    remote "test -d '${REMOTE_RUNTIME_DIR}'"
    check_remote_textbook_v2_files
    check_remote_runtime_pointer_absence
    remote "cd '${REMOTE_PROJECT_DIR}' && node '${REMOTE_PROVENANCE_HELPER}' verify-runtime \
      --runtime-root '${REMOTE_TEXTBOOK_V2_RUNTIME_DIR}' \
      --index-dir '${REMOTE_TEXTBOOK_RETRIEVAL_INDEX_DIR}' \
      --sidecar '${REMOTE_PROVENANCE_FILE}'"
    if [[ "${RUNTIME_DELIVERY_MODE}" == "ossfs-release" ]]; then
      remote "findmnt -rn -T '${REMOTE_RUNTIME_DIR}' -o FSTYPE | grep -Eq '^fuse(\\.|\$)'"
      remote "findmnt -rn -T '${REMOTE_RUNTIME_DIR}' -o OPTIONS | grep -Eq '(^|,)ro(,|\$)'"
      remote "python3 '${REMOTE_RUNTIME_HOST_STATE_SCRIPT}' active --state-dir '${REMOTE_PROJECT_DIR}/data/runtime' | grep -q '\"activeReleaseId\":\"${RUNTIME_RELEASE_ID}\"'"
    fi
  fi
else
  log "- --app-only：跳过 runtime release 验证"
fi

log "- 校验远端应用部署脚本已更新 runtime 挂载"
remote "grep -q '/app/course-content/runtime:ro' '${REMOTE_APP_DEPLOY_SCRIPT}'"

log "- 校验远端应用部署脚本已纳入 Redis 与 worker"
remote "grep -q 'redis-server --appendonly yes' '${REMOTE_APP_DEPLOY_SCRIPT}'"
remote "grep -q '/app-container-start-wrapper.sh worker' '${REMOTE_APP_DEPLOY_SCRIPT}'"

log "- 校验远端 systemd 配置脚本已更新数据库/Redis 等待逻辑"
remote "grep -q 'pg_isready' '${REMOTE_SERVICE_SCRIPT}'"
remote "grep -q 'APP_IMAGE=\${APP_IMAGE} ACT_KNOWLEDGE_DEPLOYMENT_MODE=\${ACT_KNOWLEDGE_DEPLOYMENT_MODE}' '${REMOTE_SERVICE_SCRIPT}'"

log "- 校验系统服务"
remote "test \"\$(systemctl is-active nginx)\" = active"
remote "test \"\$(systemctl is-active act-obe-stack.service)\" = active"

log "- 校验容器状态"
remote "podman ps --format '{{.Names}}' | grep -qx '${APP_NAME_HINT}'"
remote "podman ps --format '{{.Names}}' | grep -qx '${DB_NAME_HINT}'"
remote "podman ps --format '{{.Names}}' | grep -qx '${REDIS_NAME_HINT}'"
remote "podman ps --format '{{.Names}}' | grep -qx '${WORKER_NAME_HINT}'"
remote "podman ps --format '{{.Names}}\t{{.Status}}' | grep -E '^${DB_NAME_HINT}[[:space:]].*healthy'"

log "- 校验容器内 Wolfram Cloud MCP 就绪"
remote "podman exec '${APP_NAME_HINT}' ./scripts/math-calc/check-wolfram-ready.sh"

if [[ "${DEPLOY_SCOPE}" == "all" ]]; then
  if [[ "${RUNTIME_DELIVERY_MODE}" == "ossfs-blob-view" ]]; then
    log "- 校验应用容器已绑定 ossfs-blob-view"
    check_container_blob_view
  else
    log "- 校验应用容器只读挂载中的 resourceSet 教材 v2 runtime"
    check_container_textbook_v2_files
  fi
fi

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

log "- 核验 ActKG Release 与 CourseCoverage Overlay 部署投影"
remote "podman exec '${APP_NAME_HINT}' npm run db:verify-authoritative-knowledge-deployment"

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
MATH_DOCUMENT_GRADING_WORKER_REQUIRED="$(remote "podman inspect '${APP_NAME_HINT}' --format '{{range .Config.Env}}{{println .}}{{end}}' | sed -n 's/^MATH_DOCUMENT_GRADING_WORKER_REQUIRED=//p' | tail -n 1")"
case "${MATH_DOCUMENT_GRADING_WORKER_REQUIRED}" in
  1|true|yes)
    MATH_DOCUMENT_GRADING_WORKER_REQUIRED=true
    ;;
  0|false|no)
    MATH_DOCUMENT_GRADING_WORKER_REQUIRED=false
    ;;
  *)
    fail "远端应用容器的 MATH_DOCUMENT_GRADING_WORKER_REQUIRED 缺失或无效"
    ;;
esac
if [[ "${MATH_DOCUMENT_GRADING_WORKER_REQUIRED}" =~ ^(1|true|yes)$ ]]; then
  remote "podman inspect '${WORKER_NAME_HINT}' --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -Eq '^MATH_DOCUMENT_GRADING_WORKER_REQUIRED=(1|true|yes)$'"
else
  remote "podman inspect '${WORKER_NAME_HINT}' --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -Eq '^MATH_DOCUMENT_GRADING_WORKER_REQUIRED=(0|false|no)$'"
fi
if [[ "${MATH_DOCUMENT_GRADING_WORKER_REQUIRED}" =~ ^(1|true|yes)$ ]]; then
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
fi

log "- 校验 worker 启动日志"
remote "podman logs --tail 120 '${WORKER_NAME_HINT}' | grep -q '\\[Worker\\] Data governance worker started'"
if [[ "${MATH_DOCUMENT_GRADING_WORKER_REQUIRED}" =~ ^(1|true|yes)$ ]]; then
  remote "podman logs --tail 120 '${WORKER_NAME_HINT}' | grep -q '\\[MathDocumentGrading\\] worker started'"
  remote "podman exec '${REDIS_NAME_HINT}' redis-cli get math-document-grading:worker:heartbeat | grep -qx ready"
  remote "podman exec '${REDIS_NAME_HINT}' redis-cli get math-document-grading:worker:capability | grep -q '\"configReady\":true'"
  remote "podman exec '${REDIS_NAME_HINT}' redis-cli get math-document-grading:worker:capability | grep -q '\"auditSecret\":true'"
else
  log "- 数学文档批改 worker 已禁用，跳过其专用健康检查"
fi

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
readyz_response="$(curl -fsS "${PUBLIC_URL%/}/api/readyz")"
if [[ "${MATH_DOCUMENT_GRADING_WORKER_REQUIRED}" =~ ^(1|true|yes)$ ]]; then
  printf '%s\n' "$readyz_response" | python3 "${ROOT_DIR}/scripts/lib/validate-readyz.py" true
else
  printf '%s\n' "$readyz_response" | python3 "${ROOT_DIR}/scripts/lib/validate-readyz.py" false
fi

log
log "远端部署完成并验证通过"
log "  公网地址: ${PUBLIC_URL}"
log "  远端镜像: ${REMOTE_IMAGE_TAR}"
log "  SHA256: ${REMOTE_FINAL_SHA}"
log "  应用修订: ${PROVENANCE_APP_REVISION}"
if [[ "${PROVENANCE_DEPLOYMENT_SCOPE}" == "runtime-bound" ]]; then
  log "  教材 runtime 修订: ${PROVENANCE_RUNTIME_REVISION}"
  log "  教材 runtime digest: ${PROVENANCE_RUNTIME_DIGEST}"
  log "  教材检索索引修订: ${PROVENANCE_INDEX_REVISION}"
  log "  教材检索索引 digest: ${PROVENANCE_INDEX_DIGEST}"
else
  log "  runtime provenance: 未声明（app-only 部署保持远端现有 runtime）"
fi
