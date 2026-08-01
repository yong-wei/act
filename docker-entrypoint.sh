#!/bin/sh
set -eu

# 公式推导依赖就绪检查：SymPy 缺失时 /api/math/calculate 将返回 503。
if command -v python3 >/dev/null 2>&1; then
  if python3 -c "import sympy" >/dev/null 2>&1; then
    echo "[entrypoint] SymPy 公式推导依赖可用。"
  else
    echo "[entrypoint] WARNING: SymPy 不可用，/api/math/calculate 将返回 503。"
  fi
else
  echo "[entrypoint] WARNING: python3 不可用，/api/math/calculate 将返回 503。"
fi

if [ "${RUN_MIGRATIONS_ON_START:-1}" = "1" ]; then
  if [ -z "${DATABASE_URL:-}" ]; then
    echo "[entrypoint] DATABASE_URL 未设置，跳过 Prisma migrate deploy。"
  else
    echo "[entrypoint] 执行 Prisma 迁移：prisma migrate deploy"
    node ./node_modules/prisma/build/index.js migrate deploy --config ./prisma.config.ts
    echo "[entrypoint] 导入并核验 ActKG Release"
    ./node_modules/.bin/tsx scripts/db/import-authoritative-actkg-release.ts
    echo "[entrypoint] 导入并核验 CourseCoverage Overlay"
    ./node_modules/.bin/tsx scripts/db/import-course-coverage-overlay.ts
    echo "[entrypoint] 生成并导入 Canonical 资源绑定影子清单"
    ./node_modules/.bin/tsx scripts/db/import-canonical-resource-binding-shadow.ts
  fi
else
  echo "[entrypoint] RUN_MIGRATIONS_ON_START=0，跳过 Prisma migrate deploy。"
fi

exec "$@"
