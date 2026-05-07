#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

IMAGE_TAG="${IMAGE_TAG:-act-obe-platform:20260301-amd64}"
OUTPUT_TAR="${OUTPUT_TAR:-deploy/images/act-obe.tar}"
PLATFORM="${PLATFORM:-linux/amd64}"
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmmirror.com}"
PRISMA_ENGINES_MIRROR="${PRISMA_ENGINES_MIRROR:-https://registry.npmmirror.com/-/binary/prisma}"
CACHE_MODE="${CACHE_MODE:-min}"

CACHE_ROOT="${CACHE_ROOT:-.cache/buildx}"
CACHE_FROM_DIR="${CACHE_FROM_DIR:-${CACHE_ROOT}/cache}"
CACHE_TO_DIR="${CACHE_TO_DIR:-${CACHE_ROOT}/cache-new}"
EXTERNAL_RUNTIME_DIR="${EXTERNAL_RUNTIME_DIR:-course-content/runtime}"

if ! grep -qx "${EXTERNAL_RUNTIME_DIR}" .dockerignore; then
  echo "ERROR: .dockerignore 必须排除 ${EXTERNAL_RUNTIME_DIR}，避免运行时资源进入镜像构建上下文。" >&2
  exit 1
fi

echo "[1/2] 本地构建校验（含 Prisma generate + Next 类型检查）"
rm -rf "${ROOT_DIR}/.next"
npm run build

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

echo "[2/2] 构建并导出镜像（容器内 next build 同样执行类型检查）"
echo "[build] 外部运行时资源目录由宿主机提供，不进入镜像构建上下文: ${EXTERNAL_RUNTIME_DIR}"
docker buildx build \
  --platform "${PLATFORM}" \
  --progress=plain \
  --build-arg "NPM_REGISTRY=${NPM_REGISTRY}" \
  --build-arg "PRISMA_ENGINES_MIRROR=${PRISMA_ENGINES_MIRROR}" \
  "${CACHE_ARGS[@]}" \
  -t "${IMAGE_TAG}" \
  --output="type=docker,dest=${OUTPUT_TAR}" \
  .

if [[ "${CACHE_TO_DIR}" != "${CACHE_FROM_DIR}" && -d "${CACHE_TO_DIR}" ]]; then
  rm -rf "${CACHE_FROM_DIR}"
  mv "${CACHE_TO_DIR}" "${CACHE_FROM_DIR}"
  echo "[cache] 已更新缓存到: ${CACHE_FROM_DIR}"
fi

echo "构建完成"
echo "  镜像标签: ${IMAGE_TAG}"
echo "  导出文件: ${OUTPUT_TAR}"
if command -v shasum >/dev/null 2>&1; then
  echo "  SHA256: $(shasum -a 256 "${OUTPUT_TAR}" | awk '{print $1}')"
fi
