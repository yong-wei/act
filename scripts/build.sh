#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

IMAGE_TAG="${IMAGE_TAG:-localhost/act-obe-platform:20260301-amd64}"
OUTPUT_TAR="${OUTPUT_TAR:-deploy/images/act-obe.tar}"
PLATFORM="${PLATFORM:-linux/amd64}"
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmmirror.com}"
PRISMA_ENGINES_MIRROR="${PRISMA_ENGINES_MIRROR:-https://registry.npmmirror.com/-/binary/prisma}"
export NODE_MAX_OLD_SPACE_SIZE="${NODE_MAX_OLD_SPACE_SIZE:-12288}"
CACHE_MODE="${CACHE_MODE:-min}"

if [[ ! "${NODE_MAX_OLD_SPACE_SIZE}" =~ ^[1-9][0-9]*$ ]]; then
  echo "ERROR: NODE_MAX_OLD_SPACE_SIZE 必须是正整数。" >&2
  exit 1
fi

DOCKER_MIN_MEMORY_BYTES=$((20 * 1024 * 1024 * 1024))
if ! DOCKER_MEMORY_BYTES="$(docker info --format '{{.MemTotal}}' 2>/dev/null)"; then
  echo "ERROR: 无法读取 Docker VM 内存；请将 Docker Desktop 配置为至少 24 GiB 内存。" >&2
  exit 1
fi
if [[ ! "${DOCKER_MEMORY_BYTES}" =~ ^[1-9][0-9]*$ ]]; then
  echo "ERROR: Docker VM 内存信息不是正整数；请将 Docker Desktop 配置为至少 24 GiB 内存。" >&2
  exit 1
fi
if (( DOCKER_MEMORY_BYTES < DOCKER_MIN_MEMORY_BYTES )); then
  echo "ERROR: Docker VM 内存不足（${DOCKER_MEMORY_BYTES} bytes），至少需要 20 GiB；请将 Docker Desktop 配置为至少 24 GiB 内存。" >&2
  exit 1
fi

CACHE_ROOT="${CACHE_ROOT:-.cache/buildx}"
CACHE_FROM_DIR="${CACHE_FROM_DIR:-${CACHE_ROOT}/cache}"
CACHE_TO_DIR="${CACHE_TO_DIR:-${CACHE_ROOT}/cache-new}"
EXTERNAL_RUNTIME_DIR="${EXTERNAL_RUNTIME_DIR:-course-content/runtime}"
TEXTBOOK_V2_RUNTIME_DIR="${ROOT_DIR}/${EXTERNAL_RUNTIME_DIR}/resources/textbooks-v2"
TEXTBOOK_RETRIEVAL_INDEX_DIR="${ROOT_DIR}/${EXTERNAL_RUNTIME_DIR}/resources/textbook-hybrid-retrieval/bge-m3"
PROVENANCE_FILE="${OUTPUT_TAR}.provenance.json"
DATABASE_URL_FOR_BUILD="${DATABASE_URL:-}"
if [[ -z "${DATABASE_URL_FOR_BUILD}" && -f .env ]]; then
  DATABASE_URL_FOR_BUILD="$(node -e 'require("dotenv").config({ path: ".env", quiet: true }); process.stdout.write(process.env.DATABASE_URL || "");')"
fi

if ! grep -qx "${EXTERNAL_RUNTIME_DIR}" .dockerignore; then
  echo "ERROR: .dockerignore 必须排除 ${EXTERNAL_RUNTIME_DIR}，避免运行时资源进入镜像构建上下文。" >&2
  exit 1
fi
for required_script in scripts/build-next-with-trace-check.mjs scripts/prune-next-trace-boundary.mjs scripts/assets/validate-optimized-models.mjs; do
  if ! grep -qx "!${required_script}" .dockerignore; then
    echo "ERROR: .dockerignore 必须放行 ${required_script}，否则 Docker builder 阶段 npm run build 会缺少构建脚本。" >&2
    exit 1
  fi
done

assert_clean_release_worktree() {
  if [[ -n "$(git status --porcelain=v1 --untracked-files=normal)" ]]; then
    echo "ERROR: release build 要求 tracked/untracked 可见工作树干净；ignored runtime 不计入检查。" >&2
    git status --short --untracked-files=normal >&2
    exit 1
  fi
}

assert_clean_release_worktree
APP_REVISION="$(git rev-parse HEAD)"
if [[ ! "${APP_REVISION}" =~ ^[0-9a-f]{40}$ ]]; then
  echo "ERROR: 无法取得有效的 40 位 Git HEAD。" >&2
  exit 1
fi

echo "[preflight] 校验 CourseCoverage Overlay"
APP_REVISION="${APP_REVISION}" ./node_modules/.bin/tsx \
  scripts/db/import-course-coverage-overlay.ts --validate-only

echo "[preflight] 校验七套外置教材 v2 runtime"
node "${ROOT_DIR}/scripts/release/validate-textbook-runtime-v2.mjs" \
  --runtime-root "${TEXTBOOK_V2_RUNTIME_DIR}" \
  --index-dir "${TEXTBOOK_RETRIEVAL_INDEX_DIR}"

echo "[1/2] 本地构建校验（含 Prisma generate + Next 类型检查）"
rm -rf "${ROOT_DIR}/.next"
SKIP_WASM_BUILD=1 npm run build
assert_clean_release_worktree

mkdir -p "$(dirname "${OUTPUT_TAR}")"
mkdir -p "${CACHE_ROOT}"
rm -rf "${CACHE_TO_DIR}"
mkdir -p "${CACHE_TO_DIR}"

CACHE_ARGS=("--cache-to=type=local,dest=${CACHE_TO_DIR},mode=${CACHE_MODE}")
if [[ -f "${CACHE_FROM_DIR}/index.json" ]]; then
  CACHE_ARGS+=("--cache-from=type=local,src=${CACHE_FROM_DIR}")
  echo "[cache] 使用缓存: ${CACHE_FROM_DIR}"
else
  echo "[cache] 未找到 ${CACHE_FROM_DIR}/index.json，首次构建不使用 --cache-from"
fi

BUILD_ARGS=(
  --build-arg "APP_REVISION=${APP_REVISION}"
  --build-arg "NODE_MAX_OLD_SPACE_SIZE=${NODE_MAX_OLD_SPACE_SIZE}"
  --build-arg "NPM_REGISTRY=${NPM_REGISTRY}"
  --build-arg "PRISMA_ENGINES_MIRROR=${PRISMA_ENGINES_MIRROR}"
)
if [[ -n "${DATABASE_URL_FOR_BUILD}" ]]; then
  BUILD_ARGS+=(--secret "id=database_url,env=DATABASE_URL")
fi

echo "[2/2] 构建并导出镜像（容器内 next build 同样执行类型检查）"
echo "[build] 外部运行时资源目录由宿主机提供，不进入镜像构建上下文: ${EXTERNAL_RUNTIME_DIR}"
DATABASE_URL="${DATABASE_URL_FOR_BUILD}" docker buildx build \
  --platform "${PLATFORM}" \
  --progress=plain \
  "${BUILD_ARGS[@]}" \
  "${CACHE_ARGS[@]}" \
  -t "${IMAGE_TAG}" \
  --label "org.opencontainers.image.revision=${APP_REVISION}" \
  --output="type=docker,dest=${OUTPUT_TAR}" \
  .

if [[ "${CACHE_TO_DIR}" != "${CACHE_FROM_DIR}" && -d "${CACHE_TO_DIR}" ]]; then
  rm -rf "${CACHE_FROM_DIR}"
  mv "${CACHE_TO_DIR}" "${CACHE_FROM_DIR}"
  echo "[cache] 已更新缓存到: ${CACHE_FROM_DIR}"
fi

node "${ROOT_DIR}/scripts/release/textbook-runtime-v2-provenance.mjs" write-sidecar \
  --runtime-root "${TEXTBOOK_V2_RUNTIME_DIR}" \
  --index-dir "${TEXTBOOK_RETRIEVAL_INDEX_DIR}" \
  --image-tar "${OUTPUT_TAR}" \
  --app-revision "${APP_REVISION}" \
  --output "${PROVENANCE_FILE}"

echo "构建完成"
echo "  镜像标签: ${IMAGE_TAG}"
echo "  导出文件: ${OUTPUT_TAR}"
echo "  溯源文件: ${PROVENANCE_FILE}"
if command -v shasum >/dev/null 2>&1; then
  echo "  SHA256: $(shasum -a 256 "${OUTPUT_TAR}" | awk '{print $1}')"
fi
