#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RELEASE_TAG='v0.4.0'
IMAGE_REVISION='58f70df257f493f7dc13b2dabfb0383b972ee017'
IMAGE_TAG='localhost/act-obe-platform:v0.4.0-58f70df'
SSH_TARGET="${SSH_TARGET:-root@121.40.124.135}"
REMOTE_PROJECT_DIR="${REMOTE_PROJECT_DIR:-/home/projects/act}"
PUBLIC_URL="${PUBLIC_URL:-https://act.adapt-learn.online}"
LOCAL_IMAGE_TAR="${LOCAL_IMAGE_TAR:-${ROOT_DIR}/deploy/images/act-obe-v0.4.0-58f70df.tar}"
LOCAL_PROVENANCE_FILE="${LOCAL_PROVENANCE_FILE:-${LOCAL_IMAGE_TAR}.provenance.json}"
PROVENANCE_HELPER="${ROOT_DIR}/scripts/release/textbook-runtime-v2-provenance.mjs"
CUTOVER_TOOL="${ROOT_DIR}/scripts/knowledge-cutover/production-cutover.ts"
LOCAL_APP_DEPLOY_SCRIPT="${ROOT_DIR}/deploy/podman/deploy.sh"
AUTHORITY_ROOT="${ROOT_DIR}/course-content/authoring/knowledge/authority"
MIN_REMOTE_FREE_BYTES=$((1024 * 1024 * 1024))
TRANSACTION_ID=""

usage() {
  cat <<'EOF'
用法: scripts/remote-activate-knowledge-cutover.sh [--transaction-id <id>]

仅执行已冻结 v0.4.0 / 58f70df 的生产数据面图谱切换：
  - 不构建、不上传或重标记应用镜像；
  - 在远端以同一不可变镜像运行既有 first-activation 协调器；
  - 切换失败时只按本 transaction 的身份回滚，并恢复 Legacy 服务；
  - 在远端保留 plan、Authority staging archive、journal、receipt 和命令日志。
EOF
}

log() {
  printf '%s\n' "$*"
}

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "缺少命令: $1"
}

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
    return
  fi
  shasum -a 256 "$1" | awk '{print $1}'
}

oci_image_config_digest() {
  local image_tar="$1"
  node - "$image_tar" <<'NODE'
const { createHash } = require('node:crypto');
const { execFileSync } = require('node:child_process');

const archive = process.argv[2];
const read = (entry) => execFileSync('tar', ['-xOf', archive, entry]);
const digestPattern = /^sha256:[a-f0-9]{64}$/u;
const index = JSON.parse(read('index.json').toString('utf8'));
if (!Array.isArray(index.manifests) || index.manifests.length !== 1) {
  throw new Error('expected exactly one OCI image manifest');
}
const manifestDigest = index.manifests[0]?.digest;
if (typeof manifestDigest !== 'string' || !digestPattern.test(manifestDigest)) {
  throw new Error('OCI image manifest digest is invalid');
}
const manifest = JSON.parse(read(`blobs/sha256/${manifestDigest.slice('sha256:'.length)}`).toString('utf8'));
const configDigest = manifest?.config?.digest;
if (typeof configDigest !== 'string' || !digestPattern.test(configDigest)) {
  throw new Error('OCI image config digest is invalid');
}
const config = read(`blobs/sha256/${configDigest.slice('sha256:'.length)}`);
const actualDigest = `sha256:${createHash('sha256').update(config).digest('hex')}`;
if (actualDigest !== configDigest) {
  throw new Error(`OCI image config digest mismatch: ${configDigest}`);
}
process.stdout.write(configDigest);
NODE
}

safe_remote_value() {
  [[ "$1" =~ ^[A-Za-z0-9._:/@-]+$ ]] || fail "远端参数包含不安全字符: $1"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    --transaction-id)
      [[ $# -ge 2 ]] || fail '--transaction-id 缺少值'
      TRANSACTION_ID="$2"
      shift 2
      ;;
    *)
      fail "未知参数: $1"
      ;;
  esac
done

if [[ -z "$TRANSACTION_ID" ]]; then
  TRANSACTION_ID="production-v040-58f70df-$(date -u +%Y%m%dT%H%M%SZ)"
fi
[[ "$TRANSACTION_ID" =~ ^production-v040-58f70df-[0-9]{8}T[0-9]{6}Z$ ]] \
  || fail 'transaction id 必须为 production-v040-58f70df-YYYYmmddTHHMMSSZ'

for command in git node tar ssh scp awk; do
  require_cmd "$command"
done
for value in "$SSH_TARGET" "$REMOTE_PROJECT_DIR" "$PUBLIC_URL" "$IMAGE_TAG" "$IMAGE_REVISION" "$TRANSACTION_ID"; do
  safe_remote_value "$value"
done

[[ -x "${ROOT_DIR}/node_modules/.bin/tsx" ]] || fail '缺少 node_modules/.bin/tsx'
[[ -f "$CUTOVER_TOOL" ]] || fail "缺少生产切换工具: $CUTOVER_TOOL"
[[ -f "$LOCAL_APP_DEPLOY_SCRIPT" ]] || fail "缺少本轮部署脚本: $LOCAL_APP_DEPLOY_SCRIPT"
[[ -d "$AUTHORITY_ROOT" ]] || fail "缺少 Authority 工件目录: $AUTHORITY_ROOT"
[[ -s "$LOCAL_IMAGE_TAR" ]] || fail "缺少冻结镜像包: $LOCAL_IMAGE_TAR"
[[ -f "$LOCAL_PROVENANCE_FILE" ]] || fail "缺少冻结 provenance: $LOCAL_PROVENANCE_FILE"
[[ -f "$PROVENANCE_HELPER" ]] || fail "缺少 provenance 校验器: $PROVENANCE_HELPER"

tag_revision="$(git rev-parse "${RELEASE_TAG}^{commit}")"
[[ "$tag_revision" == "$IMAGE_REVISION" ]] \
  || fail "${RELEASE_TAG} 未解析为固定 revision ${IMAGE_REVISION}"

source_paths=(
  'course-content/authoring/knowledge/authority'
  'course-content/runtime/knowledge/projection'
  'course-content/runtime/knowledge/prerequisites'
  'course-content/runtime/knowledge/consumer-activation'
  'artifacts/actkg-cutover-preparation/1a56317aa44e46322be0b0d1ac73948c03c5c2c0/activation/first-activation-report.json'
)
for source_path in "${source_paths[@]}"; do
  git cat-file -e "${RELEASE_TAG}:${source_path}" \
    || fail "冻结 tag 缺少切换输入: ${source_path}"
done
if ! git diff --quiet "$RELEASE_TAG" -- "${source_paths[@]}"; then
  fail '当前工作树中的图谱切换输入与 v0.4.0 不一致'
fi
if [[ -n "$(git status --porcelain --untracked-files=all -- "${source_paths[@]}")" ]]; then
  fail '图谱切换输入存在未提交或未跟踪内容，拒绝生成混合 transaction plan'
fi

log '[preflight] 校验冻结镜像与 runtime provenance'
node "$PROVENANCE_HELPER" verify-image \
  --image-tar "$LOCAL_IMAGE_TAR" \
  --sidecar "$LOCAL_PROVENANCE_FILE"
image_tar_sha256="$(sha256_file "$LOCAL_IMAGE_TAR")"
provenance_image_tar_sha256="$(node "$PROVENANCE_HELPER" print-field --sidecar "$LOCAL_PROVENANCE_FILE" --field imageTarSha256)"
[[ "$image_tar_sha256" == "$provenance_image_tar_sha256" ]] \
  || fail '冻结镜像 tar 哈希与 provenance 不一致'
image_config_digest="$(oci_image_config_digest "$LOCAL_IMAGE_TAR")"
[[ "$image_config_digest" =~ ^sha256:[a-f0-9]{64}$ ]] \
  || fail '无法从冻结镜像导出有效 OCI config digest'
safe_remote_value "$image_config_digest"
for field in appRevision runtimeSourceRevision indexSourceRevision; do
  value="$(node "$PROVENANCE_HELPER" print-field --sidecar "$LOCAL_PROVENANCE_FILE" --field "$field")"
  [[ "$value" == "$IMAGE_REVISION" ]] || fail "provenance ${field} 未绑定到固定 revision"
done
node "$PROVENANCE_HELPER" verify-runtime \
  --runtime-root "${ROOT_DIR}/course-content/runtime/resources/textbooks-v2" \
  --index-dir "${ROOT_DIR}/course-content/runtime/resources/textbook-retrieval" \
  --sidecar "$LOCAL_PROVENANCE_FILE"

log '[preflight] 核验远端 Legacy all-ABSENT 状态、镜像身份与容量'
ssh -o BatchMode=yes "$SSH_TARGET" \
  "bash -s -- '$REMOTE_PROJECT_DIR' '$IMAGE_TAG' '$IMAGE_REVISION' '$MIN_REMOTE_FREE_BYTES' '$image_config_digest'" <<'REMOTE_PREFLIGHT'
set -euo pipefail

project_dir="$1"
image_tag="$2"
image_revision="$3"
minimum_free_bytes="$4"
image_config_digest="$5"
runtime_root="${project_dir}/course-content/runtime"
authority_root="${project_dir}/course-content/authoring/knowledge/authority"
marker="${runtime_root}/knowledge/production-cutover-transactions/current.json"

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

for pointer in \
  "${authority_root}/current.json" \
  "${runtime_root}/knowledge/projection/current.json" \
  "${runtime_root}/knowledge/prerequisites/current.json" \
  "${runtime_root}/knowledge/consumer-activation/current.json" \
  "$marker"; do
  if [ -e "$pointer" ] || [ -L "$pointer" ]; then
    die "生产切换要求 Legacy all-ABSENT，检测到: $pointer"
  fi
done

[ -d "$authority_root" ] || die "Authority host store 不存在: $authority_root"
authority_entry="$(find "$authority_root" -mindepth 1 -maxdepth 1 -print -quit)"
if [ -n "$authority_entry" ]; then
  die "Authority host store 必须为空，检测到已有工件"
fi
if [ -e "${project_dir}/.env.server" ] || [ -L "${project_dir}/.env.server" ]; then
  die '.env.server 已存在；本 transaction 不覆盖既有生产环境文件'
fi

available_kib="$(df -Pk "$project_dir" | awk 'NR == 2 { print $4 }')"
[[ "$available_kib" =~ ^[0-9]+$ ]] || die '无法读取远端可用磁盘空间'
available_bytes=$((available_kib * 1024))
[ "$available_bytes" -ge "$minimum_free_bytes" ] \
  || die "远端可用空间不足 1 GiB: ${available_bytes} bytes"

podman image exists "$image_tag" || die "固定镜像不存在: $image_tag"
image_id="$(podman image inspect "$image_tag" --format '{{.Id}}')"
[ "$image_id" = "$image_config_digest" ] \
  || die "固定镜像 OCI config digest 不一致: $image_id"
label_revision="$(podman image inspect "$image_tag" --format '{{ index .Labels "org.opencontainers.image.revision" }}')"
[ "$label_revision" = "$image_revision" ] \
  || die "固定镜像 OCI revision 不一致: $label_revision"
for container in act-obe-app act-obe-worker; do
  podman container exists "$container" || die "运行容器不存在: $container"
  [ "$(podman inspect "$container" --format '{{.State.Running}}')" = true ] \
    || die "运行容器未启动: $container"
  [ "$(podman inspect "$container" --format '{{.Image}}')" = "$image_id" ] \
    || die "运行容器未使用固定镜像: $container"
  [ "$(podman exec "$container" cat /app/.app-revision)" = "$image_revision" ] \
    || die "运行容器 app revision 不一致: $container"
done

printf 'remote_preflight=passed available_bytes=%s image_config_digest=%s\n' "$available_bytes" "$image_id"
REMOTE_PREFLIGHT

work_dir="$(mktemp -d "${TMPDIR:-/tmp}/act-production-cutover.XXXXXX")"
plan_path="${work_dir}/plan.json"
authority_archive="${work_dir}/authority.tar.gz"
trap 'rm -rf -- "$work_dir"' EXIT

log '[plan] 生成 hash-sealed production transaction plan'
"${ROOT_DIR}/node_modules/.bin/tsx" "$CUTOVER_TOOL" plan \
  --repo-root "$ROOT_DIR" \
  --output "$plan_path" \
  --transaction-id "$TRANSACTION_ID" \
  --release-tag "$RELEASE_TAG" \
  --image-revision "$IMAGE_REVISION" \
  --image-tag "$IMAGE_TAG" \
  --image-config-digest "$image_config_digest" \
  --image-tar-sha256 "$image_tar_sha256" \
  --deployment-script "$LOCAL_APP_DEPLOY_SCRIPT"

tar --exclude='./current.json' -C "$AUTHORITY_ROOT" -czf "$authority_archive" .
if tar -tzf "$authority_archive" | grep -E '(^|/)current\.json$' >/dev/null; then
  fail 'Authority staging archive 不得包含 current.json'
fi

remote_stage="${REMOTE_PROJECT_DIR}/data/runtime/knowledge-cutover/staging/${TRANSACTION_ID}"
safe_remote_value "$remote_stage"
plan_sha="$(sha256_file "$plan_path")"
tool_sha="$(sha256_file "$CUTOVER_TOOL")"
archive_sha="$(sha256_file "$authority_archive")"
deploy_sha="$(sha256_file "$LOCAL_APP_DEPLOY_SCRIPT")"

log '[stage] 上传 sealed plan、operator tool 与 Authority archive'
ssh -o BatchMode=yes "$SSH_TARGET" "mkdir -p '$remote_stage' && chmod 700 '$remote_stage'"
scp -q "$plan_path" "$SSH_TARGET:${remote_stage}/plan.json.tmp"
scp -q "$CUTOVER_TOOL" "$SSH_TARGET:${remote_stage}/production-cutover.ts.tmp"
scp -q "$authority_archive" "$SSH_TARGET:${remote_stage}/authority.tar.gz.tmp"
scp -q "$LOCAL_APP_DEPLOY_SCRIPT" "$SSH_TARGET:${remote_stage}/4-deploy.sh.tmp"
ssh -o BatchMode=yes "$SSH_TARGET" "bash -s -- '$remote_stage' '$plan_sha' '$tool_sha' '$archive_sha' '$deploy_sha'" <<'REMOTE_STAGE'
set -euo pipefail
stage="$1"
plan_sha="$2"
tool_sha="$3"
archive_sha="$4"
deploy_sha="$5"
hash_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}
for pair in "plan.json.tmp:$plan_sha" "production-cutover.ts.tmp:$tool_sha" "authority.tar.gz.tmp:$archive_sha" "4-deploy.sh.tmp:$deploy_sha"; do
  file="${pair%%:*}"
  expected="${pair#*:}"
  [ "$(hash_file "${stage}/${file}")" = "$expected" ] || {
    echo "ERROR: staged file hash mismatch: $file" >&2
    exit 1
  }
done
node -e '
const fs = require("node:fs");
const plan = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (plan.source?.deploymentScriptSha256 !== process.argv[2]) process.exit(1);
' "${stage}/plan.json.tmp" "$deploy_sha" || {
  echo 'ERROR: sealed plan deployment script hash mismatch' >&2
  exit 1
}
mv "${stage}/plan.json.tmp" "${stage}/plan.json"
mv "${stage}/production-cutover.ts.tmp" "${stage}/production-cutover.ts"
mv "${stage}/authority.tar.gz.tmp" "${stage}/authority.tar.gz"
mv "${stage}/4-deploy.sh.tmp" "${stage}/4-deploy.sh"
chmod 600 "${stage}/plan.json" "${stage}/production-cutover.ts" "${stage}/authority.tar.gz" "${stage}/4-deploy.sh"
REMOTE_STAGE

log '[activate] 在远端固定镜像中执行 first-activation；失败将自动恢复 Legacy 服务'
ssh -o BatchMode=yes "$SSH_TARGET" \
  "bash -s -- '$REMOTE_PROJECT_DIR' '$remote_stage' '$IMAGE_TAG' '$IMAGE_REVISION' '$TRANSACTION_ID' '$PUBLIC_URL' '$image_config_digest'" <<'REMOTE_TRANSACTION'
set -Euo pipefail

project_dir="$1"
stage="$2"
image_tag="$3"
image_revision="$4"
transaction_id="$5"
public_url="$6"
image_config_digest="$7"
course_content="${project_dir}/course-content"
runtime_root="${course_content}/runtime"
authority_root="${course_content}/authoring/knowledge/authority"
deploy_script="${project_dir}/scripts/4-deploy.sh"
mode_file="${project_dir}/.env.server"
marker="${runtime_root}/knowledge/production-cutover-transactions/current.json"
journal="${runtime_root}/knowledge/consumer-activation/first-activation-transactions/${transaction_id}.json"
command_log="${stage}/command.log"
mode_file_created=0

exec > >(tee -a "$command_log") 2>&1

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

pointer_paths=(
  "${authority_root}/current.json"
  "${runtime_root}/knowledge/projection/current.json"
  "${runtime_root}/knowledge/prerequisites/current.json"
  "${runtime_root}/knowledge/consumer-activation/current.json"
)

all_pointers_absent() {
  local pointer
  for pointer in "${pointer_paths[@]}"; do
    if [ -e "$pointer" ] || [ -L "$pointer" ]; then
      return 1
    fi
  done
  return 0
}

stop_consumers() {
  local container
  for container in act-obe-app act-obe-worker act-obe-submission-gc act-obe-submission-scanner; do
    if podman container exists "$container"; then
      podman stop -t 30 "$container" >/dev/null || return 1
    fi
  done
  for container in act-obe-app act-obe-worker act-obe-submission-gc act-obe-submission-scanner; do
    if podman ps --format '{{.Names}}' | grep -Fx "$container" >/dev/null; then
      die "图谱消费者仍在运行: $container"
    fi
  done
}

run_driver() {
  local action="$1"
  local access="$2"
  podman run --rm --user 0 --network none \
    -e APP_REVISION="$image_revision" \
    -e ACT_AUTHORITY_STORE_ROOT='/activation-root/course-content/authoring/knowledge/authority' \
    -e ACT_CONSUMER_ACTIVATION_ROOT='/activation-root/course-content/runtime/knowledge/consumer-activation' \
    -v "${course_content}:/activation-root/course-content:${access},Z" \
    -v "${stage}/production-cutover.ts:/app/scripts/knowledge-cutover/production-cutover.ts:ro,Z" \
    -v "${stage}/plan.json:/activation-plan.json:ro,Z" \
    --entrypoint ./node_modules/.bin/tsx \
    "$image_tag" \
    scripts/knowledge-cutover/production-cutover.ts "$action" \
    --root /activation-root \
    --plan /activation-plan.json
}

hash_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

restore_legacy_after_failure() {
  local status="$1"
  local recovery_ok=0
  trap - ERR INT TERM
  set +e
  printf '切换失败，停止消费者并执行身份约束恢复。\n' >&2
  stop_consumers
  if [ -e "$marker" ] || [ -L "$marker" ]; then
    run_driver rollback rw
    recovery_ok=$?
  elif ! all_pointers_absent; then
    if [ -f "$journal" ]; then
      run_driver recover rw
      recovery_ok=$?
    else
      printf 'ERROR: 指针非空但 journal 缺失，拒绝猜测回滚。\n' >&2
      recovery_ok=1
    fi
  fi
  if [ "$mode_file_created" -eq 1 ]; then
    rm -f "$mode_file"
  fi
  if [ "$recovery_ok" -eq 0 ]; then
    APP_IMAGE="$image_tag" ACT_KNOWLEDGE_DEPLOYMENT_MODE=legacy "$deploy_script" --app-only
  else
    printf 'ERROR: 自动恢复未完成；消费者保持停止，保留 stage/journal 供显式恢复。\n' >&2
  fi
  exit "$status"
}

trap 'restore_legacy_after_failure $?' ERR
trap 'restore_legacy_after_failure 130' INT
trap 'restore_legacy_after_failure 143' TERM

[ -x "$deploy_script" ] || die "缺少远端部署脚本: $deploy_script"
[ ! -e "$mode_file" ] && [ ! -L "$mode_file" ] \
  || die '.env.server 在 transaction 期间出现，拒绝覆盖'
all_pointers_absent || die 'transaction 开始时不再是 all-ABSENT'
[ -d "$authority_root" ] || die 'Authority host store 不存在'
authority_entry="$(find "$authority_root" -mindepth 1 -maxdepth 1 -print -quit)"
if [ -n "$authority_entry" ]; then
  die 'Authority host store 在 transaction 开始时不为空'
fi
podman image exists "$image_tag" || die '固定镜像在 transaction 前不可用'
[ "$(podman image inspect "$image_tag" --format '{{.Id}}')" = "$image_config_digest" ] \
  || die '固定镜像 OCI config digest 在 transaction 前不一致'
[ "$(podman image inspect "$image_tag" --format '{{ index .Labels "org.opencontainers.image.revision" }}')" = "$image_revision" ] \
  || die '固定镜像 revision 在 transaction 前不一致'
podman run --rm --network none --entrypoint /bin/sh "$image_tag" -lc \
  'test -x ./node_modules/.bin/tsx && test -d ./src/lib/knowledge-cutover'

expected_deploy_sha="$(node -e 'const fs=require("node:fs"); process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).source.deploymentScriptSha256)' "${stage}/plan.json")"
[ "$(hash_file "${stage}/4-deploy.sh")" = "$expected_deploy_sha" ] \
  || die 'staged 4-deploy.sh 不匹配 sealed plan'
expected_image_config_digest="$(node -e 'const fs=require("node:fs"); process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).source.imageConfigDigest)' "${stage}/plan.json")"
[ "$expected_image_config_digest" = "$image_config_digest" ] \
  || die 'sealed plan 与固定镜像 OCI config digest 不一致'

stop_consumers
tar -tzf "${stage}/authority.tar.gz" | while IFS= read -r entry; do
  if [[ "$entry" == /* || "$entry" == ../* || "$entry" == *"/../"* ]]; then
    die "Authority archive 含不安全路径: $entry"
  fi
done
tar -xzf "${stage}/authority.tar.gz" -C "$authority_root"
all_pointers_absent || die 'Authority staging 不得写入 current pointer'

run_driver activate rw

cp "${stage}/4-deploy.sh" "${deploy_script}.tmp"
chmod 700 "${deploy_script}.tmp"
mv "${deploy_script}.tmp" "$deploy_script"
umask 077
printf 'APP_IMAGE=%s\nACT_KNOWLEDGE_DEPLOYMENT_MODE=cutover\n' "$image_tag" > "$mode_file"
mode_file_created=1
APP_IMAGE="$image_tag" ACT_KNOWLEDGE_DEPLOYMENT_MODE=cutover "$deploy_script" --app-only

run_driver verify ro

for container in act-obe-app act-obe-worker act-obe-postgres act-obe-redis; do
  podman ps --format '{{.Names}}' | grep -Fx "$container" >/dev/null \
    || die "切换后容器未运行: $container"
done
for container in act-obe-app act-obe-worker; do
  [ "$(podman inspect "$container" --format '{{.ImageName}}')" = "$image_tag" ] \
    || die "切换后容器镜像不一致: $container"
  [ "$(podman inspect "$container" --format '{{.Image}}')" = "$image_config_digest" ] \
    || die "切换后容器 OCI config digest 不一致: $container"
  [ "$(podman inspect "$container" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -Fxc 'ACT_KNOWLEDGE_DEPLOYMENT_MODE=cutover')" = 1 ] \
    || die "切换后容器未收到 explicit cutover mode: $container"
done

app_port="$(sed -n 's/^APP_PORT=//p' "${project_dir}/data/runtime/act-obe.env" | tail -n 1)"
app_port="${app_port:-8083}"
for _ in $(seq 1 40); do
  if curl -fsS "http://127.0.0.1:${app_port}/api/readyz" >/dev/null; then
    break
  fi
  sleep 3
done
curl -fsS "http://127.0.0.1:${app_port}/api/readyz" >/dev/null \
  || die '本机 readyz 未在切换后恢复'
curl -fsS "${public_url%/}/api/readyz" >/dev/null \
  || die '公网 readyz 未在切换后恢复'

printf 'production knowledge cutover committed: transaction=%s image=%s\n' "$transaction_id" "$image_tag"
REMOTE_TRANSACTION

log "图谱切换完成：${TRANSACTION_ID}"
log "远端审计目录：${remote_stage}"
