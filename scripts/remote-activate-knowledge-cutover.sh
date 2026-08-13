#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

APPLICATION_SOURCE_REVISION="${APPLICATION_SOURCE_REVISION:-$(git rev-parse HEAD)}"
[[ "$APPLICATION_SOURCE_REVISION" =~ ^[a-f0-9]{40}$ ]] || { echo 'ERROR: APPLICATION_SOURCE_REVISION 必须为 40 位 Git revision' >&2; exit 1; }
IMAGE_REVISION="$APPLICATION_SOURCE_REVISION"
IMAGE_TAG="${IMAGE_TAG:-localhost/act-obe-platform:knowledge-${APPLICATION_SOURCE_REVISION:0:12}}"
RELEASE_TAG="${RELEASE_TAG:-source-${APPLICATION_SOURCE_REVISION:0:12}}"
OPERATOR_SOURCE_REVISION="${OPERATOR_SOURCE_REVISION:-$APPLICATION_SOURCE_REVISION}"
BUILD_APPLICATION_IMAGE="${BUILD_APPLICATION_IMAGE:-0}"
SSH_TARGET="${SSH_TARGET:-root@121.40.124.135}"
REMOTE_PROJECT_DIR="${REMOTE_PROJECT_DIR:-/home/projects/act}"
PUBLIC_URL="${PUBLIC_URL:-https://act.adapt-learn.online}"
LOCAL_IMAGE_TAR="${LOCAL_IMAGE_TAR:-${ROOT_DIR}/deploy/images/act-obe-knowledge-${APPLICATION_SOURCE_REVISION:0:12}.tar}"
LOCAL_PROVENANCE_FILE="${LOCAL_PROVENANCE_FILE:-${LOCAL_IMAGE_TAR}.provenance.json}"
PROVENANCE_HELPER="${ROOT_DIR}/scripts/release/textbook-runtime-v2-provenance.mjs"
CUTOVER_TOOL="${ROOT_DIR}/scripts/knowledge-cutover/production-cutover.ts"
OPERATOR_BUNDLE_HELPER="${ROOT_DIR}/scripts/knowledge-cutover/create-operator-bundle.mjs"
REMOTE_OPERATOR_SCRIPT="${ROOT_DIR}/scripts/knowledge-cutover/remote-production-cutover.sh"
CLEANUP_ENGINE="${ROOT_DIR}/scripts/knowledge-cutover/cleanup-failed-authority-identity.cjs"
LOCAL_APP_DEPLOY_SCRIPT="${ROOT_DIR}/deploy/podman/deploy.sh"
AUTHORITY_ROOT="${ROOT_DIR}/course-content/authoring/knowledge/authority"
MIN_REMOTE_FREE_BYTES=$((1024 * 1024 * 1024))
TRANSACTION_ID=""
CLEANUP_FAILED_AUTHORITY_TRANSACTION_ID=""

usage() {
  cat <<'EOF'
用法: scripts/remote-activate-knowledge-cutover.sh [--transaction-id <id>]
       scripts/remote-activate-knowledge-cutover.sh --cleanup-failed-authority <transaction-id>

执行当前 application source revision 的生产数据面图谱切换：
  - 应用镜像必须由当前 revision 构建、带有 provenance，并在远端加载后做内容证明；
  - 新 image 只承载长期 Next runtime，operator source bundle 只在交易窗口执行；
  - 切换失败时只按本 transaction 的身份回滚，并恢复 Legacy 服务；
  - 在远端保留 plan、Authority staging archive、journal、receipt 和命令日志。

`--cleanup-failed-authority` 仅对一个尚未提交、且由同一 transaction 留下的
Authority 解包残留执行身份约束清理；它不会写入任何 current 指针或重建容器。
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
  node -e '
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const archive = process.argv[1];
const read = (entry) => execFileSync("tar", ["-xOf", archive, entry]);
const digestPattern = /^sha256:[a-f0-9]{64}$/u;
const index = JSON.parse(read("index.json").toString("utf8"));
if (!Array.isArray(index.manifests) || index.manifests.length !== 1) {
  throw new Error("expected exactly one OCI image manifest");
}
const manifestDigest = index.manifests[0]?.digest;
if (typeof manifestDigest !== "string" || !digestPattern.test(manifestDigest)) {
  throw new Error("OCI image manifest digest is invalid");
}
const manifest = JSON.parse(read(`blobs/sha256/${manifestDigest.slice("sha256:".length)}`).toString("utf8"));
const configDigest = manifest?.config?.digest;
if (typeof configDigest !== "string" || !digestPattern.test(configDigest)) {
  throw new Error("OCI image config digest is invalid");
}
const config = read(`blobs/sha256/${configDigest.slice("sha256:".length)}`);
const actualDigest = `sha256:${createHash("sha256").update(config).digest("hex")}`;
if (actualDigest !== configDigest) {
  throw new Error(`OCI image config digest mismatch: ${configDigest}`);
}
process.stdout.write(configDigest);
' -- "$image_tar"
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
    --cleanup-failed-authority)
      [[ $# -ge 2 ]] || fail '--cleanup-failed-authority 缺少 transaction id'
      CLEANUP_FAILED_AUTHORITY_TRANSACTION_ID="$2"
      shift 2
      ;;
    *)
      fail "未知参数: $1"
      ;;
  esac
done

if [[ -n "$CLEANUP_FAILED_AUTHORITY_TRANSACTION_ID" ]]; then
  [[ -z "$TRANSACTION_ID" ]] || fail '--cleanup-failed-authority 不能与 --transaction-id 同时使用'
  TRANSACTION_ID="$CLEANUP_FAILED_AUTHORITY_TRANSACTION_ID"
elif [[ -z "$TRANSACTION_ID" ]]; then
  TRANSACTION_ID="production-knowledge-${APPLICATION_SOURCE_REVISION:0:12}-$(date -u +%Y%m%dT%H%M%SZ)"
fi
if [[ -n "$CLEANUP_FAILED_AUTHORITY_TRANSACTION_ID" ]]; then
  [[ "$TRANSACTION_ID" =~ ^production-knowledge-[a-f0-9]{12}-[0-9]{8}T[0-9]{6}Z$|^production-v040-[a-f0-9]{7,12}-[0-9]{8}T[0-9]{6}Z$ ]] \
    || fail 'cleanup transaction id 格式无效'
else
  [[ "$TRANSACTION_ID" =~ ^production-knowledge-[a-f0-9]{12}-[0-9]{8}T[0-9]{6}Z$ ]] \
    || fail 'transaction id 必须为 production-knowledge-<revision>-YYYYmmddTHHMMSSZ'
fi

for command in git node tar ssh scp awk; do
  require_cmd "$command"
done
for value in "$SSH_TARGET" "$REMOTE_PROJECT_DIR" "$PUBLIC_URL" "$IMAGE_TAG" "$IMAGE_REVISION" "$OPERATOR_SOURCE_REVISION" "$TRANSACTION_ID"; do
  safe_remote_value "$value"
done
[[ "$OPERATOR_SOURCE_REVISION" =~ ^[a-f0-9]{40}$ ]] || fail 'OPERATOR_SOURCE_REVISION 必须为 40 位 Git revision'

[[ -f "$REMOTE_OPERATOR_SCRIPT" ]] || fail "缺少远端切换操作器: $REMOTE_OPERATOR_SCRIPT"
[[ -f "$CLEANUP_ENGINE" ]] || fail "缺少 failed Authority cleanup 引擎: $CLEANUP_ENGINE"

if [[ -n "$CLEANUP_FAILED_AUTHORITY_TRANSACTION_ID" ]]; then
  cleanup_engine_sha="$(sha256_file "$CLEANUP_ENGINE")"
  remote_stage="${REMOTE_PROJECT_DIR}/data/runtime/knowledge-cutover/staging/${TRANSACTION_ID}"
  safe_remote_value "$remote_stage"
  log '[cleanup] 上传哈希校验的 failed Authority cleanup 引擎'
  scp -q "$CLEANUP_ENGINE" "$SSH_TARGET:${remote_stage}/cleanup-failed-authority-identity.cjs.tmp"
  ssh -o BatchMode=yes "$SSH_TARGET" \
    "bash -s -- stage-cleanup-engine '$REMOTE_PROJECT_DIR' '$remote_stage' '$TRANSACTION_ID' '$cleanup_engine_sha'" \
    < "$REMOTE_OPERATOR_SCRIPT"
  log '[cleanup] 对已验证的 failed Authority 残留执行精确清理'
  ssh -o BatchMode=yes "$SSH_TARGET" \
    "bash -s -- cleanup-failed-authority '$REMOTE_PROJECT_DIR' '$remote_stage' '$TRANSACTION_ID' '$cleanup_engine_sha'" \
    < "$REMOTE_OPERATOR_SCRIPT"
  log "failed Authority 残留已清理：${TRANSACTION_ID}"
  exit 0
fi

[[ -x "${ROOT_DIR}/node_modules/.bin/tsx" ]] || fail '缺少 node_modules/.bin/tsx'
[[ -f "$CUTOVER_TOOL" ]] || fail "缺少生产切换工具: $CUTOVER_TOOL"
[[ -f "$OPERATOR_BUNDLE_HELPER" ]] || fail "缺少 operator bundle 构建器: $OPERATOR_BUNDLE_HELPER"
[[ -f "$LOCAL_APP_DEPLOY_SCRIPT" ]] || fail "缺少本轮部署脚本: $LOCAL_APP_DEPLOY_SCRIPT"
[[ -d "$AUTHORITY_ROOT" ]] || fail "缺少 Authority 工件目录: $AUTHORITY_ROOT"
[[ -f "$PROVENANCE_HELPER" ]] || fail "缺少 provenance 校验器: $PROVENANCE_HELPER"

if [[ "$BUILD_APPLICATION_IMAGE" == '1' ]]; then
  log '[build] 按当前 application source revision 构建新的 immutable application image'
  IMAGE_TAG="$IMAGE_TAG" OUTPUT_TAR="$LOCAL_IMAGE_TAR" scripts/build.sh
fi
[[ -s "$LOCAL_IMAGE_TAR" ]] || fail "缺少 application immutable image 包: $LOCAL_IMAGE_TAR"
[[ -f "$LOCAL_PROVENANCE_FILE" ]] || fail "缺少 application image provenance: $LOCAL_PROVENANCE_FILE"

git rev-parse --verify "${APPLICATION_SOURCE_REVISION}^{commit}" >/dev/null \
  || fail "application source revision 不存在: ${APPLICATION_SOURCE_REVISION}"
git rev-parse --verify "${OPERATOR_SOURCE_REVISION}^{commit}" >/dev/null \
  || fail "operator source revision 不存在: ${OPERATOR_SOURCE_REVISION}"

source_paths=(
  'course-content/authoring/knowledge/authority'
  'course-content/runtime/knowledge/projection'
  'course-content/runtime/knowledge/prerequisites'
  'course-content/runtime/knowledge/consumer-activation'
  'artifacts/actkg-cutover-preparation/1a56317aa44e46322be0b0d1ac73948c03c5c2c0/activation/first-activation-report.json'
)
for source_path in "${source_paths[@]}"; do
  git cat-file -e "${APPLICATION_SOURCE_REVISION}:${source_path}" \
    || fail "application source revision 缺少切换输入: ${source_path}"
done
if ! git diff --quiet "$APPLICATION_SOURCE_REVISION" -- "${source_paths[@]}"; then
  fail '当前工作树的切换输入与 application source revision 不一致'
fi
if [[ -n "$(git status --porcelain --untracked-files=all -- "${source_paths[@]}")" ]]; then
  fail '图谱切换输入存在未提交或未跟踪内容，拒绝生成混合 transaction plan'
fi
bundle_source_paths=(
  'src'
  'scripts/knowledge-cutover/production-cutover.ts'
  'tsconfig.json'
)
if ! git diff --quiet HEAD -- "${bundle_source_paths[@]}"; then
  fail 'operator bundle 输入存在未提交修改，拒绝封存混合 source bundle'
fi
if [[ -n "$(git status --porcelain --untracked-files=all -- "${bundle_source_paths[@]}")" ]]; then
  fail 'operator bundle 输入存在未提交或未跟踪内容，拒绝封存混合 source bundle'
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
application_provenance_revision="$(node "$PROVENANCE_HELPER" print-field --sidecar "$LOCAL_PROVENANCE_FILE" --field appRevision)"
runtime_provenance_revision="$(node "$PROVENANCE_HELPER" print-field --sidecar "$LOCAL_PROVENANCE_FILE" --field runtimeSourceRevision)"
index_provenance_revision="$(node "$PROVENANCE_HELPER" print-field --sidecar "$LOCAL_PROVENANCE_FILE" --field indexSourceRevision)"
[[ "$application_provenance_revision" == "$APPLICATION_SOURCE_REVISION" ]] || fail 'provenance appRevision 未绑定到 application source revision'
[[ "$runtime_provenance_revision" =~ ^[a-f0-9]{40}$ && "$runtime_provenance_revision" == "$index_provenance_revision" ]] \
  || fail 'provenance runtime/index source revision 必须独立且彼此一致'
node "$PROVENANCE_HELPER" verify-runtime \
  --runtime-root "${ROOT_DIR}/course-content/runtime/resources/textbooks-v2" \
  --index-dir "${ROOT_DIR}/course-content/runtime/resources/textbook-hybrid-retrieval/bge-m3" \
  --sidecar "$LOCAL_PROVENANCE_FILE"

log '[preflight] 核验远端 Legacy all-ABSENT 状态、镜像身份与容量'
ssh -o BatchMode=yes "$SSH_TARGET" \
  "bash -s -- preflight '$REMOTE_PROJECT_DIR' '$IMAGE_TAG' '$IMAGE_REVISION' '$MIN_REMOTE_FREE_BYTES' '$image_config_digest'" \
  < "$REMOTE_OPERATOR_SCRIPT"

work_dir="$(mktemp -d "${TMPDIR:-/tmp}/act-production-cutover.XXXXXX")"
plan_path="${work_dir}/plan.json"
authority_archive="${work_dir}/authority.tar.gz"
operator_bundle_root="${work_dir}/operator-bundle"
operator_bundle_manifest="${work_dir}/operator-bundle.manifest.json"
operator_bundle_archive="${work_dir}/operator-bundle.tar.gz"
image_provenance_sha256="$(sha256_file "$LOCAL_PROVENANCE_FILE")"
trap 'rm -rf -- "$work_dir"' EXIT

capture_revision="$(node -e '
const fs = require("node:fs");
const path = require("node:path");
const root = process.argv[1];
const pointer = JSON.parse(fs.readFileSync(path.join(root, "course-content/runtime/knowledge/consumer-activation/current.json"), "utf8"));
const activation = JSON.parse(fs.readFileSync(path.join(root, "course-content/runtime/knowledge/consumer-activation/releases", pointer.activationId, "activation.json"), "utf8"));
const revisions = new Set((activation.consumers ?? []).filter((row) => row.status === "READY").map((row) => row.combination?.captureRevision).filter((value) => typeof value === "string"));
if (revisions.size !== 1) throw new Error("ready consumers do not share one capture revision");
process.stdout.write([...revisions][0]);
' "$ROOT_DIR")"
[[ "$capture_revision" =~ ^[a-f0-9]{40}$ ]] || fail '无法解析 operator bundle capture revision'

log '[bundle] 构建 full-src operator bundle 与逐文件 manifest'
node "$OPERATOR_BUNDLE_HELPER" \
  --repo-root "$ROOT_DIR" \
  --output "$operator_bundle_root" \
  --manifest "$operator_bundle_manifest" \
  --operator-source-revision "$OPERATOR_SOURCE_REVISION" \
  --capture-revision "$capture_revision"
COPYFILE_DISABLE=1 tar -czf "$operator_bundle_archive" -C "$operator_bundle_root" .

log '[plan] 生成 hash-sealed production transaction plan'
"${ROOT_DIR}/node_modules/.bin/tsx" "$CUTOVER_TOOL" plan \
  --repo-root "$ROOT_DIR" \
  --output "$plan_path" \
  --transaction-id "$TRANSACTION_ID" \
  --release-tag "$RELEASE_TAG" \
  --application-source-revision "$IMAGE_REVISION" \
  --image-tag "$IMAGE_TAG" \
  --image-config-digest "$image_config_digest" \
  --image-tar-sha256 "$image_tar_sha256" \
  --image-provenance-sha256 "$image_provenance_sha256" \
  --deployment-script "$LOCAL_APP_DEPLOY_SCRIPT" \
  --cleanup-engine "$CLEANUP_ENGINE" \
  --operator-bundle-manifest "$operator_bundle_manifest" \
  --operator-bundle-archive "$operator_bundle_archive"

COPYFILE_DISABLE=1 tar \
  --exclude='./current.json' \
  --exclude='./._*' \
  --exclude='._*' \
  --exclude='./.DS_Store' \
  -C "$AUTHORITY_ROOT" \
  -czf "$authority_archive" .
if ! COPYFILE_DISABLE=1 tar -tzf "$authority_archive" | awk '
  /(^|\/)current\.json$/ || /(^|\/)\._/ || /(^|\/)\.DS_Store$/ || /^\// || /(^|\/)\.\.\// { invalid = 1 }
  END { exit invalid }
'; then
  fail 'Authority staging archive 包含 selector、macOS metadata 或不安全路径'
fi

remote_stage="${REMOTE_PROJECT_DIR}/data/runtime/knowledge-cutover/staging/${TRANSACTION_ID}"
safe_remote_value "$remote_stage"
plan_sha="$(sha256_file "$plan_path")"
bundle_archive_sha="$(sha256_file "$operator_bundle_archive")"
bundle_manifest_sha="$(sha256_file "$operator_bundle_manifest")"
archive_sha="$(sha256_file "$authority_archive")"
deploy_sha="$(sha256_file "$LOCAL_APP_DEPLOY_SCRIPT")"
cleanup_engine_sha="$(sha256_file "$CLEANUP_ENGINE")"

log '[stage] 上传 sealed plan、operator bundle 与 Authority archive'
ssh -o BatchMode=yes "$SSH_TARGET" "mkdir -p '$remote_stage' && chmod 700 '$remote_stage'"
scp -q "$plan_path" "$SSH_TARGET:${remote_stage}/plan.json.tmp"
scp -q "$operator_bundle_archive" "$SSH_TARGET:${remote_stage}/operator-bundle.tar.gz.tmp"
scp -q "$operator_bundle_manifest" "$SSH_TARGET:${remote_stage}/operator-bundle.manifest.json.tmp"
scp -q "$LOCAL_IMAGE_TAR" "$SSH_TARGET:${remote_stage}/image.tar.tmp"
scp -q "$LOCAL_PROVENANCE_FILE" "$SSH_TARGET:${remote_stage}/image.tar.provenance.json.tmp"
scp -q "$authority_archive" "$SSH_TARGET:${remote_stage}/authority.tar.gz.tmp"
scp -q "$LOCAL_APP_DEPLOY_SCRIPT" "$SSH_TARGET:${remote_stage}/4-deploy.sh.tmp"
scp -q "$CLEANUP_ENGINE" "$SSH_TARGET:${remote_stage}/cleanup-failed-authority-identity.cjs.tmp"
ssh -o BatchMode=yes "$SSH_TARGET" \
  "bash -s -- stage '$remote_stage' '$plan_sha' '$bundle_archive_sha' '$bundle_manifest_sha' '$image_tar_sha256' '$image_provenance_sha256' '$archive_sha' '$deploy_sha' '$cleanup_engine_sha'" \
  < "$REMOTE_OPERATOR_SCRIPT"

log '[activate] 在远端固定镜像中执行 first-activation；失败将自动恢复 Legacy 服务'
ssh -o BatchMode=yes "$SSH_TARGET" \
  "bash -s -- activate '$REMOTE_PROJECT_DIR' '$remote_stage' '$IMAGE_TAG' '$IMAGE_REVISION' '$TRANSACTION_ID' '$PUBLIC_URL' '$image_config_digest'" \
  < "$REMOTE_OPERATOR_SCRIPT"

log "图谱切换完成：${TRANSACTION_ID}"
log "远端审计目录：${remote_stage}"
