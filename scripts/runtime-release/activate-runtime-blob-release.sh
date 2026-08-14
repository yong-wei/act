#!/usr/bin/env bash
set -euo pipefail

# This is the runtime-only v2 path. It consumes an immutable release that has
# already been published by the local operator, then changes only the host
# view and runtime consumers. It never builds/transfers an image, touches the
# database, writes Nginx, or modifies systemd units.

STATE_DIR="${ACT_RUNTIME_STATE_DIR:-/home/projects/act/data/runtime}"
VIEW_ROOT="${ACT_RUNTIME_BLOB_VIEW_ROOT:-/home/projects/act/data/runtime/blob-views}"
BLOB_ROOT="${ACT_RUNTIME_BLOB_ROOT:-/home/projects/act/data/runtime/ossfs/blobs}"
BLOB_OSSFS_CONFIG="${ACT_RUNTIME_BLOB_OSSFS_CONFIG:-/etc/act-runtime-blob-ossfs/blobs.conf}"
HOST_STATE_SCRIPT="${ACT_RUNTIME_HOST_STATE_SCRIPT:-/home/projects/act/scripts/runtime-release-host-state.py}"
MATERIALIZER="${ACT_RUNTIME_BLOB_MATERIALIZER:-/home/projects/act/scripts/materialize-runtime-blob-release.py}"
DEPLOY_SCRIPT="${ACT_RUNTIME_DEPLOY_SCRIPT:-/home/projects/act/scripts/4-deploy.sh}"
ENV_FILE="${ACT_RUNTIME_ENV_FILE:-/home/projects/act/data/runtime/act-obe.env}"
LEGACY_RUNTIME_ROOT="${ACT_RUNTIME_LEGACY_ROOT:-/home/projects/act/course-content/runtime}"
APP_CONTAINER="${ACT_RUNTIME_APP_CONTAINER:-act-obe-app}"
READYZ_TIMEOUT_SECONDS="${ACT_RUNTIME_READYZ_TIMEOUT_SECONDS:-180}"

release_id=""
expected_active_release=""
manifest=""
release_receipt=""
verification_receipt=""
ram_role=""
old_active="none"
parent_view=""
rollback_app_image=""
candidate_deploy_attempted=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --release-id) release_id="$2"; shift 2 ;;
    --expected-active-release) expected_active_release="$2"; shift 2 ;;
    --manifest) manifest="$2"; shift 2 ;;
    --release-receipt) release_receipt="$2"; shift 2 ;;
    --verification-receipt) verification_receipt="$2"; shift 2 ;;
    --ram-role) ram_role="$2"; shift 2 ;;
    *) echo "ERROR: unknown argument: $1" >&2; exit 1 ;;
  esac
done

[[ "$release_id" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]] || { echo "ERROR: invalid release id" >&2; exit 1; }
[[ "$expected_active_release" == "none" || "$expected_active_release" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]] || { echo "ERROR: invalid expected active release" >&2; exit 1; }
[[ -f "$manifest" && ! -L "$manifest" ]] || { echo "ERROR: v2 manifest is required" >&2; exit 1; }
[[ -f "$release_receipt" && ! -L "$release_receipt" ]] || { echo "ERROR: v2 release receipt is required" >&2; exit 1; }
[[ -f "$verification_receipt" && ! -L "$verification_receipt" ]] || { echo "ERROR: v2 verification receipt is required" >&2; exit 1; }
[[ "$ram_role" =~ ^[A-Za-z0-9_+=,.@-]{1,128}$ ]] || { echo "ERROR: invalid RAM role name" >&2; exit 1; }
[[ "$READYZ_TIMEOUT_SECONDS" =~ ^[1-9][0-9]{0,2}$ && "$READYZ_TIMEOUT_SECONDS" -le 600 ]] || { echo "ERROR: runtime readiness timeout is invalid" >&2; exit 1; }

for command in flock podman python3 findmnt mount curl; do
  command -v "$command" >/dev/null 2>&1 || { echo "ERROR: missing command: $command" >&2; exit 1; }
done
for file in "$HOST_STATE_SCRIPT" "$MATERIALIZER" "$DEPLOY_SCRIPT"; do
  [[ -f "$file" && ! -L "$file" ]] || { echo "ERROR: required runtime tool is missing: $file" >&2; exit 1; }
done

require_read_only_blob_mount() {
  [[ -f "$BLOB_OSSFS_CONFIG" && ! -L "$BLOB_OSSFS_CONFIG" ]] || {
    echo "ERROR: blob ossfs configuration is missing: $BLOB_OSSFS_CONFIG" >&2
    exit 1
  }
  grep -Fxq -- "--ram_role=${ram_role}" "$BLOB_OSSFS_CONFIG" || {
    echo "ERROR: blob ossfs configuration does not use the requested read role" >&2
    exit 1
  }
  findmnt -rn -M "$BLOB_ROOT" -o FSTYPE | grep -Eq '^fuse(\.|$)' || {
    echo "ERROR: blob root is not an ossfs FUSE mount: $BLOB_ROOT" >&2
    exit 1
  }
  findmnt -rn -M "$BLOB_ROOT" -o OPTIONS | grep -Eq '(^|,)ro(,|$)' || {
    echo "ERROR: blob root must be mounted read-only: $BLOB_ROOT" >&2
    exit 1
  }
}

ensure_helper_mount() {
  local helper="$1"
  if ! findmnt -rn -M "$helper" -o TARGET | grep -Fxq "$helper"; then
    chmod 0755 "$helper"
    mount --bind "$BLOB_ROOT" "$helper"
    mount -o remount,bind,ro "$helper"
    chmod 0555 "$helper"
  fi
  findmnt -rn -M "$helper" -o FSTYPE | grep -Eq '^fuse(\.|$)' || {
    echo "ERROR: runtime helper is not an ossfs FUSE bind mount: $helper" >&2
    exit 1
  }
  findmnt -rn -M "$helper" -o OPTIONS | grep -Eq '(^|,)ro(,|$)' || {
    echo "ERROR: runtime helper bind mount must be read-only: $helper" >&2
    exit 1
  }
}

wait_for_readyz() {
  local deadline=$((SECONDS + READYZ_TIMEOUT_SECONDS))
  while (( SECONDS < deadline )); do
    if curl --connect-timeout 2 --max-time 5 --fail --silent --show-error "http://127.0.0.1:${APP_PORT}/api/readyz" >/dev/null; then
      return 0
    fi
    sleep 3
  done
  echo "ERROR: application readiness did not succeed within ${READYZ_TIMEOUT_SECONDS}s" >&2
  return 1
}

capture_rollback_image() {
  local image
  image="$(podman inspect --format '{{.Image}}' "$APP_CONTAINER")"
  [[ "$image" =~ ^(sha256:)?([a-f0-9]{64})$ ]] || { echo "ERROR: existing app image digest is invalid" >&2; exit 1; }
  rollback_app_image="sha256:${BASH_REMATCH[2]}"
}

restore_runtime_consumers() {
  local status=$?
  set +e
  if [[ "$candidate_deploy_attempted" == "1" ]]; then
    if [[ -n "$parent_view" ]]; then
      python3 "$MATERIALIZER" select --release-id "$old_active" --view-root "$VIEW_ROOT" >/dev/null
      RUNTIME_DELIVERY_MODE=ossfs-blob-view \
        ACT_RUNTIME_OSS_RAM_ROLE="$ram_role" \
        RUNTIME_CONTENT_DIR="$VIEW_ROOT/current" \
        APP_IMAGE="$rollback_app_image" \
        "$DEPLOY_SCRIPT" --runtime-cutover-app-only
    else
      RUNTIME_DELIVERY_MODE=legacy-rsync \
        RUNTIME_CONTENT_DIR="$LEGACY_RUNTIME_ROOT" \
        APP_IMAGE="$rollback_app_image" \
        "$DEPLOY_SCRIPT" --runtime-cutover-app-only
    fi
  fi
  exit "$status"
}

mkdir -p "$STATE_DIR"
exec 9>"$STATE_DIR/.act-runtime-selection.lock"
flock -x 9

require_read_only_blob_mount
old_active="$(python3 "$HOST_STATE_SCRIPT" active --state-dir "$STATE_DIR" | python3 -c 'import json,sys; print(json.load(sys.stdin)["activeReleaseId"] or "none")')"
if [[ "$old_active" != "none" && -d "$VIEW_ROOT/views/$old_active" && ! -L "$VIEW_ROOT/views/$old_active" ]]; then
  parent_view="$VIEW_ROOT/views/$old_active"
fi
if [[ -z "$parent_view" && "$old_active" == "none" && ! -d "$LEGACY_RUNTIME_ROOT" ]]; then
  echo "ERROR: legacy runtime root is required for first activation rollback" >&2
  exit 1
fi
capture_rollback_image

prepare_args=(prepare --manifest "$manifest" --receipt "$release_receipt" --blob-root "$BLOB_ROOT" --view-root "$VIEW_ROOT" --cache-textbook-retrieval)
if [[ -n "$parent_view" ]]; then
  prepare_args+=(--parent-view "$parent_view")
fi
python3 "$MATERIALIZER" "${prepare_args[@]}" >/dev/null
candidate_view="$VIEW_ROOT/views/$release_id"
ensure_helper_mount "$candidate_view/.act-runtime-blobs"

verify_args=(verify-mounted --format v2 --runtime-root "$candidate_view" --blob-root "$candidate_view/.act-runtime-blobs" --release-id "$release_id" --verification-receipt "$verification_receipt")
if [[ -n "$parent_view" ]]; then
  verify_args+=(--parent-runtime-root "$parent_view")
fi
python3 "$HOST_STATE_SCRIPT" "${verify_args[@]}" >/dev/null
python3 "$HOST_STATE_SCRIPT" select \
  --state-dir "$STATE_DIR" \
  --expected-active-release "$expected_active_release" \
  --verification-receipt "$verification_receipt" >/dev/null
python3 "$MATERIALIZER" select --release-id "$release_id" --view-root "$VIEW_ROOT" >/dev/null

trap restore_runtime_consumers ERR
candidate_deploy_attempted=1
RUNTIME_DELIVERY_MODE=ossfs-blob-view \
  ACT_RUNTIME_OSS_RAM_ROLE="$ram_role" \
  RUNTIME_CONTENT_DIR="$VIEW_ROOT/current" \
  APP_IMAGE="$rollback_app_image" \
  "$DEPLOY_SCRIPT" --runtime-cutover-app-only
source "$ENV_FILE"
wait_for_readyz
python3 "$HOST_STATE_SCRIPT" mark-active --state-dir "$STATE_DIR" --release-id "$release_id" >/dev/null
trap - ERR
printf '{"releaseId":"%s","previousActiveRelease":"%s","runtimeDeliveryMode":"ossfs-blob-view"}\n' "$release_id" "$old_active"
