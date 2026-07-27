#!/bin/sh
set -eu

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
  fi
else
  echo "[entrypoint] RUN_MIGRATIONS_ON_START=0，跳过 Prisma migrate deploy。"
fi

exec "$@"
