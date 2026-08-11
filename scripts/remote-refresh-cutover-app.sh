#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

SSH_TARGET="${SSH_TARGET:-root@121.40.124.135}"
REMOTE_PROJECT_DIR="${REMOTE_PROJECT_DIR:-/home/projects/act}"
LOCAL_IMAGE_TAR="${LOCAL_IMAGE_TAR:-${ROOT_DIR}/deploy/images/act-obe.tar}"
LOCAL_PROVENANCE_FILE="${LOCAL_PROVENANCE_FILE:-${LOCAL_IMAGE_TAR}.provenance.json}"
REMOTE_APP_IMAGE="${REMOTE_APP_IMAGE:-localhost/act-obe-platform:20260301-amd64}"
PUBLIC_URL="${PUBLIC_URL:-https://act.adapt-learn.online}"
MIN_REMOTE_FREE_BYTES="${MIN_REMOTE_FREE_BYTES:-1073741824}"
REMOTE_REFRESH_ROOT="${REMOTE_REFRESH_ROOT:-${REMOTE_PROJECT_DIR}/data/runtime/knowledge-cutover/app-refresh-staging}"
REMOTE_REFRESH_SCRIPT="${REMOTE_REFRESH_SCRIPT:-${REMOTE_PROJECT_DIR}/scripts/knowledge-cutover/remote-application-refresh.sh}"
REMOTE_DEPLOY_SCRIPT="${REMOTE_DEPLOY_SCRIPT:-${REMOTE_PROJECT_DIR}/scripts/4-deploy.sh}"
REMOTE_STAGE_HELPER="${REMOTE_STAGE_HELPER:-refresh-state.mjs}"
REFRESH_ID="${REFRESH_ID:-app-refresh-$(date -u +%Y%m%dT%H%M%SZ)-$$}"

LOCAL_DEPLOY_SCRIPT="${ROOT_DIR}/deploy/podman/deploy.sh"
LOCAL_REFRESH_SCRIPT="${ROOT_DIR}/scripts/knowledge-cutover/remote-application-refresh.sh"
LOCAL_STATE_HELPER="${ROOT_DIR}/scripts/knowledge-cutover/refresh-state.mjs"

usage() {
  cat <<'EOF'
用法: scripts/remote-refresh-cutover-app.sh

只上传本地已由 scripts/build.sh 生成并通过 provenance 校验的 OCI 镜像 tar，
在已提交 production cutover 的远端锁内替换 app/worker。远端不会执行源码构建，
也不会调用普通 Legacy 部署入口。

环境变量:
  LOCAL_IMAGE_TAR / LOCAL_PROVENANCE_FILE  本地镜像与 provenance
  REMOTE_APP_IMAGE                         镜像 tar 中的目标标签
  REFRESH_ID                               唯一 refresh receipt id
  SSH_TARGET / REMOTE_PROJECT_DIR          远端连接与项目目录
EOF
}

fail() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "缺少命令: $1"
}

safe_token() {
  [[ "$1" =~ ^[A-Za-z0-9._:/@-]+$ ]] || fail '参数包含不安全字符'
}

sha256_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

oci_image_config_digest() {
  local image_tar="$1"
  node -e '
const { createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const archive = process.argv[1];
const read = (entry) => execFileSync("tar", ["-xOf", archive, entry]);
const digest = /^sha256:[a-f0-9]{64}$/u;
const index = JSON.parse(read("index.json").toString("utf8"));
if (!Array.isArray(index.manifests) || index.manifests.length !== 1 || !digest.test(index.manifests[0]?.digest || "")) process.exit(1);
const manifestDigest = index.manifests[0].digest.slice("sha256:".length);
const manifest = JSON.parse(read(`blobs/sha256/${manifestDigest}`).toString("utf8"));
const configDigest = manifest.config?.digest;
if (!digest.test(configDigest || "")) process.exit(1);
const config = read(`blobs/sha256/${configDigest.slice("sha256:".length)}`);
if (`sha256:${createHash("sha256").update(config).digest("hex")}` !== configDigest) process.exit(1);
process.stdout.write(configDigest);
' -- "$image_tar"
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "未知参数: $1"
      ;;
  esac
done

for command in bash node tar ssh scp awk; do
  require_cmd "$command"
done
for value in "$SSH_TARGET" "$REMOTE_PROJECT_DIR" "$REMOTE_APP_IMAGE" "$PUBLIC_URL" "$REMOTE_REFRESH_ROOT" "$REMOTE_REFRESH_SCRIPT" "$REMOTE_DEPLOY_SCRIPT" "$REFRESH_ID" "$MIN_REMOTE_FREE_BYTES"; do
  safe_token "$value"
done
[[ "$MIN_REMOTE_FREE_BYTES" =~ ^[0-9]+$ ]] || fail 'MIN_REMOTE_FREE_BYTES 必须为非负整数'
[[ "$REFRESH_ID" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || fail 'REFRESH_ID 包含不安全字符'

[[ -s "$LOCAL_IMAGE_TAR" ]] || fail "本地镜像 tar 不存在或为空: $LOCAL_IMAGE_TAR"
[[ -f "$LOCAL_PROVENANCE_FILE" ]] || fail "本地 provenance 不存在: $LOCAL_PROVENANCE_FILE"
[[ -f "$LOCAL_DEPLOY_SCRIPT" ]] || fail "本地 Podman 部署脚本不存在: $LOCAL_DEPLOY_SCRIPT"
[[ -f "$LOCAL_REFRESH_SCRIPT" ]] || fail "本地远端 refresh 操作器不存在: $LOCAL_REFRESH_SCRIPT"
[[ -f "$LOCAL_STATE_HELPER" ]] || fail "本地 cutover 状态 helper 不存在: $LOCAL_STATE_HELPER"

node "${ROOT_DIR}/scripts/release/textbook-runtime-v2-provenance.mjs" verify-image \
  --image-tar "$LOCAL_IMAGE_TAR" \
  --sidecar "$LOCAL_PROVENANCE_FILE" >/dev/null
IMAGE_TAR_SHA="$(sha256_file "$LOCAL_IMAGE_TAR")"
PROVENANCE_TAR_SHA="$(node "${ROOT_DIR}/scripts/release/textbook-runtime-v2-provenance.mjs" print-field --sidecar "$LOCAL_PROVENANCE_FILE" --field imageTarSha256)"
[[ "$IMAGE_TAR_SHA" = "$PROVENANCE_TAR_SHA" ]] || fail '本地镜像 tar 与 provenance 摘要不一致'
IMAGE_REVISION="$(node "${ROOT_DIR}/scripts/release/textbook-runtime-v2-provenance.mjs" print-field --sidecar "$LOCAL_PROVENANCE_FILE" --field appRevision)"
[[ "$IMAGE_REVISION" =~ ^[a-f0-9]{40}$ ]] || fail 'provenance appRevision 无效'
IMAGE_CONFIG_DIGEST="$(oci_image_config_digest "$LOCAL_IMAGE_TAR")"
[[ "$IMAGE_CONFIG_DIGEST" =~ ^sha256:[a-f0-9]{64}$ ]] || fail '无法解析本地 OCI config digest'
HELPER_SHA="$(sha256_file "$LOCAL_STATE_HELPER")"
DEPLOY_SHA="$(sha256_file "$LOCAL_DEPLOY_SCRIPT")"

REMOTE_STAGE="${REMOTE_REFRESH_ROOT}/${REFRESH_ID}"
safe_token "$REMOTE_STAGE"

printf '[refresh] 本地镜像 tar 已验证，开始传输 immutable staging inputs\n'
ssh -o BatchMode=yes "$SSH_TARGET" "mkdir -p '$REMOTE_STAGE' && chmod 700 '$REMOTE_STAGE'"
scp -q "$LOCAL_IMAGE_TAR" "$SSH_TARGET:${REMOTE_STAGE}/image.tar.tmp"
scp -q "$LOCAL_PROVENANCE_FILE" "$SSH_TARGET:${REMOTE_STAGE}/image.tar.provenance.json.tmp"
scp -q "$LOCAL_STATE_HELPER" "$SSH_TARGET:${REMOTE_STAGE}/${REMOTE_STAGE_HELPER}.tmp"
scp -q "$LOCAL_DEPLOY_SCRIPT" "$SSH_TARGET:${REMOTE_STAGE}/4-deploy.sh.tmp"
ssh -o BatchMode=yes "$SSH_TARGET" "set -eu; mv '$REMOTE_STAGE/image.tar.tmp' '$REMOTE_STAGE/image.tar'; mv '$REMOTE_STAGE/image.tar.provenance.json.tmp' '$REMOTE_STAGE/image.tar.provenance.json'; mv '$REMOTE_STAGE/${REMOTE_STAGE_HELPER}.tmp' '$REMOTE_STAGE/${REMOTE_STAGE_HELPER}'; mv '$REMOTE_STAGE/4-deploy.sh.tmp' '$REMOTE_STAGE/4-deploy.sh'; chmod 600 '$REMOTE_STAGE/image.tar' '$REMOTE_STAGE/image.tar.provenance.json' '$REMOTE_STAGE/${REMOTE_STAGE_HELPER}' '$REMOTE_STAGE/4-deploy.sh'"

printf '[refresh] 在共享部署锁内校验 control plane 并替换 app/worker\n'
ssh -o BatchMode=yes "$SSH_TARGET" \
  "bash -s -- refresh '$REMOTE_PROJECT_DIR' '$REMOTE_STAGE' '$REFRESH_ID' '$REMOTE_APP_IMAGE' '$IMAGE_TAR_SHA' '$IMAGE_CONFIG_DIGEST' '$IMAGE_REVISION' '$PUBLIC_URL' '$MIN_REMOTE_FREE_BYTES' '$HELPER_SHA' '$DEPLOY_SHA'" \
  < "$LOCAL_REFRESH_SCRIPT"

printf '[refresh] cutover-aware application refresh 已完成：%s\n' "$REFRESH_ID"
