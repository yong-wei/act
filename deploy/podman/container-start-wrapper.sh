#!/bin/sh
set -eu

ROLE="${1:-app}"

wait_tcp() {
  host="$1"
  port="$2"
  attempts="${3:-60}"
  i=0

  while [ "$i" -lt "$attempts" ]; do
    if node -e 'const net = require("node:net"); const host = process.argv[1]; const port = Number(process.argv[2]); const socket = net.connect({ host, port }); function fail() { process.exit(1); } socket.setTimeout(3000); socket.on("connect", () => { socket.end(); process.exit(0); }); socket.on("timeout", fail); socket.on("error", fail);' "$host" "$port"; then
      return 0
    fi
    sleep 2
    i=$((i + 1))
  done

  return 1
}

db_host="$(node -e 'console.log(new URL(process.env.DATABASE_URL).hostname)')"
db_port="$(node -e 'console.log(new URL(process.env.DATABASE_URL).port || "5432")')"

if ! wait_tcp "$db_host" "$db_port" 60; then
  echo "[container-start-wrapper] 数据库未就绪: ${db_host}:${db_port}" >&2
  exit 1
fi

if [ "$ROLE" = "worker" ]; then
  redis_host="$(node -e 'console.log(new URL(process.env.REDIS_URL).hostname)')"
  redis_port="$(node -e 'console.log(new URL(process.env.REDIS_URL).port || "6379")')"
  if ! wait_tcp "$redis_host" "$redis_port" 60; then
    echo "[container-start-wrapper] Redis 未就绪: ${redis_host}:${redis_port}" >&2
    exit 1
  fi
  exec ./docker-entrypoint.sh ./node_modules/.bin/tsx scripts/workers/data-governance-worker.ts
fi

if [ "$ROLE" = "submission-scanner" ]; then
  SKIP_WOLFRAM_READY_CHECK=1 SUBMISSION_HEALTH_ROLE=scanner ./docker-entrypoint.sh ./node_modules/.bin/tsx scripts/assignments/check-submission-object-health.ts
  while :; do
    if ! SKIP_WOLFRAM_READY_CHECK=1 ./docker-entrypoint.sh ./node_modules/.bin/tsx scripts/assignments/scan-submission-objects.ts; then
      echo "[container-start-wrapper] 学生作业扫描批次失败，将在间隔后重试。" >&2
    fi
    sleep "${SUBMISSION_SCAN_INTERVAL_SECONDS:-15}"
  done
fi

if [ "$ROLE" = "submission-gc" ]; then
  SKIP_WOLFRAM_READY_CHECK=1 SUBMISSION_HEALTH_ROLE=gc ./docker-entrypoint.sh ./node_modules/.bin/tsx scripts/assignments/check-submission-object-health.ts
  while :; do
    SKIP_WOLFRAM_READY_CHECK=1 ./docker-entrypoint.sh ./node_modules/.bin/tsx scripts/assignments/gc-submission-objects.ts
    sleep "${SUBMISSION_GC_INTERVAL_SECONDS:-3600}"
  done
fi

exec ./docker-entrypoint.sh node server.js
