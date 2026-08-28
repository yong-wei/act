#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "${ROOT_DIR}"

IMAGE_TAG="${IMAGE_TAG:-localhost/act-obe-platform:20260301-amd64}"
OUTPUT_TAR="${OUTPUT_TAR:-deploy/images/act-obe.tar}"
PLATFORM="${PLATFORM:-linux/amd64}"
NPM_REGISTRY="${NPM_REGISTRY:-https://registry.npmmirror.com}"
PRISMA_ENGINES_MIRROR="${PRISMA_ENGINES_MIRROR:-https://registry.npmmirror.com/-/binary/prisma}"
APT_MIRROR="${APT_MIRROR:-}"
BUILD_OS_REV="${BUILD_OS_REV:-2026-08-01.1}"
RUNNER_OS_REV="${RUNNER_OS_REV:-2026-08-01.1}"
export NODE_MAX_OLD_SPACE_SIZE="${NODE_MAX_OLD_SPACE_SIZE:-12288}"
BUILD_SCOPE="${BUILD_SCOPE:-runtime-bound}"

# This name is deliberately fixed: dependency cache mounts are shared by all
# ACT worktrees through the same local docker-container BuildKit instance.
BUILDER_NAME="act-local-build-cache"
CACHE_MODE="max"

if [[ ! "${NODE_MAX_OLD_SPACE_SIZE}" =~ ^[1-9][0-9]*$ ]]; then
  echo "ERROR: NODE_MAX_OLD_SPACE_SIZE 必须是正整数。" >&2
  exit 1
fi
case "${BUILD_SCOPE}" in
  runtime-bound|app-only)
    ;;
  *)
    echo "ERROR: BUILD_SCOPE 必须为 runtime-bound 或 app-only。" >&2
    exit 1
    ;;
esac
for revision in "${BUILD_OS_REV}" "${RUNNER_OS_REV}"; do
  if [[ ! "${revision}" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]]; then
    echo "ERROR: BUILD_OS_REV/RUNNER_OS_REV 必须是非空版本标识。" >&2
    exit 1
  fi
done

normalize_platform() {
  local value="$1"
  value="$(printf '%s' "${value}" | LC_ALL=C sed -E \
    -e 's#[/:]+#-#g' \
    -e 's#[^A-Za-z0-9._-]+#-#g' \
    -e 's#^-+##' \
    -e 's#-+$##')"
  if [[ -z "${value}" || "${value}" == "." || "${value}" == ".." ]]; then
    echo "ERROR: PLATFORM 无法规范化为安全缓存命名空间：${PLATFORM}" >&2
    exit 1
  fi
  printf '%s\n' "${value}"
}

PLATFORM_KEY="$(normalize_platform "${PLATFORM}")"

default_cache_root() {
  case "$(uname -s)" in
    Darwin)
      printf '%s\n' "${HOME}/Library/Caches/act-build-cache"
      ;;
    *)
      printf '%s\n' "${XDG_CACHE_HOME:-${HOME}/.cache}/act-build-cache"
      ;;
  esac
}

if [[ -n "${ACT_BUILD_CACHE_ROOT:-}" ]]; then
  CACHE_ROOT_CONFIGURED="${ACT_BUILD_CACHE_ROOT}"
elif [[ -n "${CACHE_ROOT:-}" ]]; then
  # CACHE_ROOT remains a compatibility input for existing local operators.
  CACHE_ROOT_CONFIGURED="${CACHE_ROOT}"
else
  CACHE_ROOT_CONFIGURED="$(default_cache_root)"
fi

canonical_path() {
  python3 -c 'import os, sys; print(os.path.realpath(os.path.expanduser(sys.argv[1])))' "$1"
}

CACHE_ROOT="$(canonical_path "${CACHE_ROOT_CONFIGURED}")"
if [[ -z "${CACHE_ROOT}" || "${CACHE_ROOT}" == "/" ]]; then
  echo "ERROR: ACT 构建缓存根无效。" >&2
  exit 1
fi

assert_cache_root_outside_worktrees() {
  local worktree_list worktree_path worktree_root
  if ! worktree_list="$(git -C "${ROOT_DIR}" worktree list --porcelain)"; then
    echo "ERROR: 无法枚举 ACT worktree，拒绝使用共享构建缓存。" >&2
    return 1
  fi
  while IFS= read -r worktree_path; do
    [[ -z "${worktree_path}" ]] && continue
    worktree_root="$(canonical_path "${worktree_path}")"
    case "${CACHE_ROOT}" in
      "${worktree_root}"|"${worktree_root}"/*)
        echo "ERROR: 构建缓存根不得位于已登记 ACT worktree 内：${CACHE_ROOT}" >&2
        echo "       命中 worktree：${worktree_root}" >&2
        return 1
        ;;
    esac
  done < <(printf '%s\n' "${worktree_list}" | sed -n 's/^worktree //p')
}

assert_cache_root_outside_worktrees

PLATFORM_CACHE_ROOT="${CACHE_ROOT}/${PLATFORM_KEY}"
BUILD_CACHE_ROOT="${PLATFORM_CACHE_ROOT}/buildkit"
GENERATIONS_DIR="${BUILD_CACHE_ROOT}/generations"
CURRENT_CACHE_DIR="${BUILD_CACHE_ROOT}/current"
CACHE_LOCK_DIR="${PLATFORM_CACHE_ROOT}/lock"

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

if [[ "${BUILD_SCOPE}" == "runtime-bound" ]]; then
  echo "[preflight] 校验 resourceSet 外置教材 v2 runtime"
  node "${ROOT_DIR}/scripts/release/validate-textbook-runtime-v2.mjs" \
    --runtime-root "${TEXTBOOK_V2_RUNTIME_DIR}" \
    --index-dir "${TEXTBOOK_RETRIEVAL_INDEX_DIR}"
else
  echo "[preflight] app-only 镜像不声明或校验外置 runtime provenance"
fi

echo "[1/3] 本地构建校验（含 Prisma generate + Next 类型检查）"
rm -rf "${ROOT_DIR}/.next"
SKIP_WASM_BUILD=1 npm run build
assert_clean_release_worktree

mkdir -p "$(dirname "${OUTPUT_TAR}")"
mkdir -p "${GENERATIONS_DIR}"

LOCK_HOST="$(hostname 2>/dev/null || printf 'unknown')"
LOCK_HELD=0
GENERATION_DIR=""
CURRENT_LINK_TMP=""
GENERATION_PUBLISHED=0

cleanup() {
  local status=$?
  if [[ -n "${CURRENT_LINK_TMP}" ]]; then
    rm -f "${CURRENT_LINK_TMP}" || true
  fi
  if [[ "${GENERATION_PUBLISHED}" != 1 && -n "${GENERATION_DIR}" && -d "${GENERATION_DIR}" ]]; then
    rm -rf "${GENERATION_DIR}" || true
  fi
  if [[ "${LOCK_HELD}" == 1 ]]; then
    rm -f "${CACHE_LOCK_DIR}/pid" "${CACHE_LOCK_DIR}/host" || true
    rmdir "${CACHE_LOCK_DIR}" 2>/dev/null || true
  fi
  exit "${status}"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

acquire_platform_lock() {
  mkdir -p "${PLATFORM_CACHE_ROOT}"
  if mkdir "${CACHE_LOCK_DIR}" 2>/dev/null; then
    LOCK_HELD=1
    printf '%s\n' "$$" > "${CACHE_LOCK_DIR}/pid"
    printf '%s\n' "${LOCK_HOST}" > "${CACHE_LOCK_DIR}/host"
    return 0
  fi

  local owner_pid="" owner_host=""
  if [[ -f "${CACHE_LOCK_DIR}/pid" ]]; then
    owner_pid="$(<"${CACHE_LOCK_DIR}/pid")"
  fi
  if [[ -f "${CACHE_LOCK_DIR}/host" ]]; then
    owner_host="$(<"${CACHE_LOCK_DIR}/host")"
  fi

  # Only recover a lock proven stale on this host. Unknown or remote owners
  # fail closed so an operator can inspect them without losing current.
  if [[ "${owner_host}" == "${LOCK_HOST}" \
    && "${owner_pid}" =~ ^[1-9][0-9]*$ ]] \
    && ! kill -0 "${owner_pid}" 2>/dev/null; then
    rm -f "${CACHE_LOCK_DIR}/pid" "${CACHE_LOCK_DIR}/host"
    if ! rmdir "${CACHE_LOCK_DIR}" 2>/dev/null; then
      echo "ERROR: 无法回收同主机陈旧构建锁：${CACHE_LOCK_DIR}" >&2
      return 1
    fi
    if mkdir "${CACHE_LOCK_DIR}" 2>/dev/null; then
      LOCK_HELD=1
      printf '%s\n' "$$" > "${CACHE_LOCK_DIR}/pid"
      printf '%s\n' "${LOCK_HOST}" > "${CACHE_LOCK_DIR}/host"
      return 0
    fi
  fi

  echo "ERROR: ${PLATFORM} 构建缓存被占用（host=${owner_host:-unknown}, pid=${owner_pid:-unknown}）。" >&2
  return 1
}

ensure_buildx_builder() {
  if ! docker buildx inspect "${BUILDER_NAME}" >/dev/null 2>&1; then
    if ! docker buildx create \
      --name "${BUILDER_NAME}" \
      --driver docker-container >/dev/null; then
      docker buildx inspect "${BUILDER_NAME}" >/dev/null 2>&1 || return 1
    fi
  fi
  docker buildx inspect --bootstrap "${BUILDER_NAME}" >/dev/null
}

atomic_replace_current() {
  if [[ "$(uname -s)" == "Darwin" ]]; then
    # BSD mv follows a symlink to a directory unless -h is supplied.
    mv -hf "$1" "$2"
  else
    # GNU mv needs -T to replace the symlink itself rather than its target.
    mv -Tf "$1" "$2"
  fi
}

acquire_platform_lock
ensure_buildx_builder

BUILD_ARGS=(
  --build-arg "APP_REVISION=${APP_REVISION}"
  --build-arg "NODE_MAX_OLD_SPACE_SIZE=${NODE_MAX_OLD_SPACE_SIZE}"
  --build-arg "NPM_REGISTRY=${NPM_REGISTRY}"
  --build-arg "PRISMA_ENGINES_MIRROR=${PRISMA_ENGINES_MIRROR}"
  --build-arg "APT_MIRROR=${APT_MIRROR}"
  --build-arg "BUILD_OS_REV=${BUILD_OS_REV}"
  --build-arg "RUNNER_OS_REV=${RUNNER_OS_REV}"
  --build-arg "CACHE_PLATFORM=${PLATFORM_KEY}"
)
if [[ -n "${DATABASE_URL_FOR_BUILD}" ]]; then
  BUILD_ARGS+=(--secret "id=database_url,env=DATABASE_URL")
fi

CACHE_FROM_ARGS=()
if [[ -L "${CURRENT_CACHE_DIR}" && -f "${CURRENT_CACHE_DIR}/index.json" ]]; then
  CACHE_FROM_ARGS+=("--cache-from=type=local,src=${CURRENT_CACHE_DIR}")
  echo "[cache] 使用缓存: ${CURRENT_CACHE_DIR}"
else
  echo "[cache] 未找到可用 current cache，首次构建不使用 --cache-from"
fi

GENERATION_DIR="$(mktemp -d "${GENERATIONS_DIR}/${APP_REVISION}-${BASHPID:-$$}.XXXXXX")"
CACHE_TO_ARG="--cache-to=type=local,dest=${GENERATION_DIR},mode=max"

echo "[2/3] 预热 runner-os（不发布 external cache）"
docker buildx build \
  --builder "${BUILDER_NAME}" \
  --platform "${PLATFORM}" \
  --progress=plain \
  --target runner-os \
  "${BUILD_ARGS[@]}" \
  "${CACHE_FROM_ARGS[@]}" \
  --output=type=cacheonly \
  .

echo "[3/3] 构建并导出镜像（容器内 next build 同样执行类型检查）"
echo "[build] 外部运行时资源目录由宿主机提供，不进入镜像构建上下文: ${EXTERNAL_RUNTIME_DIR}"
DATABASE_URL="${DATABASE_URL_FOR_BUILD}" docker buildx build \
  --builder "${BUILDER_NAME}" \
  --platform "${PLATFORM}" \
  --progress=plain \
  "${BUILD_ARGS[@]}" \
  "${CACHE_FROM_ARGS[@]}" \
  "${CACHE_TO_ARG}" \
  -t "${IMAGE_TAG}" \
  --label "org.opencontainers.image.revision=${APP_REVISION}" \
  --output="type=docker,dest=${OUTPUT_TAR}" \
  .

if [[ ! -f "${GENERATION_DIR}/index.json" ]]; then
  echo "ERROR: Docker build 成功但未生成可导入的 local cache index。" >&2
  exit 1
fi

if [[ "${BUILD_SCOPE}" == "runtime-bound" ]]; then
  node "${ROOT_DIR}/scripts/release/textbook-runtime-v2-provenance.mjs" write-sidecar \
    --runtime-root "${TEXTBOOK_V2_RUNTIME_DIR}" \
    --index-dir "${TEXTBOOK_RETRIEVAL_INDEX_DIR}" \
    --image-tar "${OUTPUT_TAR}" \
    --app-revision "${APP_REVISION}" \
    --output "${PROVENANCE_FILE}"
else
  node "${ROOT_DIR}/scripts/release/textbook-runtime-v2-provenance.mjs" write-app-only-sidecar \
    --image-tar "${OUTPUT_TAR}" \
    --app-revision "${APP_REVISION}" \
    --output "${PROVENANCE_FILE}"
fi

CURRENT_LINK_TMP="${CURRENT_CACHE_DIR}.next-${BASHPID:-$$}"
rm -f "${CURRENT_LINK_TMP}"
ln -s "${GENERATION_DIR}" "${CURRENT_LINK_TMP}"
atomic_replace_current "${CURRENT_LINK_TMP}" "${CURRENT_CACHE_DIR}"
CURRENT_LINK_TMP=""
GENERATION_PUBLISHED=1

echo "[cache] 已原子发布 generation: ${GENERATION_DIR}"
echo "构建完成"
echo "  镜像标签: ${IMAGE_TAG}"
echo "  导出文件: ${OUTPUT_TAR}"
echo "  溯源文件: ${PROVENANCE_FILE}"
if command -v shasum >/dev/null 2>&1; then
  echo "  SHA256: $(shasum -a 256 "${OUTPUT_TAR}" | awk '{print $1}')"
fi
