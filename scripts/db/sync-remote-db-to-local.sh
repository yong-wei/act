#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "${ROOT_DIR}"

REMOTE_HOST="${REMOTE_HOST:-root@121.40.124.135}"
REMOTE_DB_CONTAINER="${REMOTE_DB_CONTAINER:-act-obe-postgres}"
REMOTE_DB_NAME="${REMOTE_DB_NAME:-act_obe}"
REMOTE_DB_USER="${REMOTE_DB_USER:-act_user}"

LOCAL_DB_NAME="${LOCAL_DB_NAME:-act_obe}"
LOCAL_DB_USER="${LOCAL_DB_USER:-act_user}"
LOCAL_DB_PASSWORD="${LOCAL_DB_PASSWORD:-act_pass}"
LOCAL_DB_HOST="${LOCAL_DB_HOST:-localhost}"
LOCAL_ADMIN_USER="${LOCAL_ADMIN_USER:-$USER}"

BACKUP_DIR="${BACKUP_DIR:-data/backups}"
STAMP="$(date +%Y%m%d_%H%M%S)"
LOCAL_BACKUP_PATH="${BACKUP_DIR}/local_act_obe_before_remote_sync_${STAMP}.dump"
REMOTE_DUMP_PATH="${BACKUP_DIR}/remote_act_obe_sync_${STAMP}.dump"

echo "[sync-remote-db] root=${ROOT_DIR}"
mkdir -p "${BACKUP_DIR}"

echo "[sync-remote-db] backup local db -> ${LOCAL_BACKUP_PATH}"
export PGPASSWORD="${LOCAL_DB_PASSWORD}"
pg_dump -h "${LOCAL_DB_HOST}" -U "${LOCAL_DB_USER}" -d "${LOCAL_DB_NAME}" -Fc -f "${LOCAL_BACKUP_PATH}"

echo "[sync-remote-db] dump remote db -> ${REMOTE_DUMP_PATH}"
ssh "${REMOTE_HOST}" \
  "podman exec ${REMOTE_DB_CONTAINER} pg_dump -U ${REMOTE_DB_USER} -d ${REMOTE_DB_NAME} -Fc" \
  > "${REMOTE_DUMP_PATH}"

echo "[sync-remote-db] recreate local db ${LOCAL_DB_NAME} via admin user ${LOCAL_ADMIN_USER}"
psql -U "${LOCAL_ADMIN_USER}" -d postgres -c \
  "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${LOCAL_DB_NAME}' AND pid <> pg_backend_pid();" >/dev/null
dropdb -U "${LOCAL_ADMIN_USER}" --if-exists "${LOCAL_DB_NAME}"
createdb -U "${LOCAL_ADMIN_USER}" -O "${LOCAL_DB_USER}" "${LOCAL_DB_NAME}"

echo "[sync-remote-db] restore remote dump -> local db"
pg_restore -h "${LOCAL_DB_HOST}" -U "${LOCAL_DB_USER}" -d "${LOCAL_DB_NAME}" --no-owner --no-privileges "${REMOTE_DUMP_PATH}"

echo "[sync-remote-db] verify counts"
psql -h "${LOCAL_DB_HOST}" -U "${LOCAL_DB_USER}" -d "${LOCAL_DB_NAME}" -c \
  "select (select count(*) from \"User\") as users, (select count(*) from \"LearningFact\") as learning_facts, (select count(*) from \"StudentCompetencySnapshot\") as student_snapshots, (select count(*) from \"StudentProfileSummary\") as profile_summaries, (select count(*) from \"ClassCompetencySnapshot\") as class_snapshots, (select count(*) from \"LearningEventBatch\") as event_batches;"

echo "[sync-remote-db] done"
echo "[sync-remote-db] local backup: ${LOCAL_BACKUP_PATH}"
echo "[sync-remote-db] remote dump: ${REMOTE_DUMP_PATH}"
