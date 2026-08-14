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
LIFECYCLE_SCRIPT="${ACT_RUNTIME_BLOB_LIFECYCLE_SCRIPT:-/home/projects/act/scripts/runtime-release/runtime-blob-release-lifecycle.py}"
ACTIVATION_TRANSACTION="${ACT_RUNTIME_BLOB_ACTIVATION_TRANSACTION:-/home/projects/act/scripts/runtime-release/runtime-blob-activation-transaction.py}"
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
lifecycle_identity=""
lifecycle_generation=""

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

for command in flock podman python3 findmnt mount curl mktemp; do
  command -v "$command" >/dev/null 2>&1 || { echo "ERROR: missing command: $command" >&2; exit 1; }
done
for file in "$HOST_STATE_SCRIPT" "$MATERIALIZER" "$LIFECYCLE_SCRIPT" "$ACTIVATION_TRANSACTION" "$DEPLOY_SCRIPT"; do
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

write_lifecycle_identity() {
  local mounted_manifest="$1"
  lifecycle_identity="$(mktemp "$STATE_DIR/.act-runtime-blob-identity.XXXXXX")"
  python3 - "$mounted_manifest" "$release_id" > "$lifecycle_identity" <<'PY'
import hashlib
import json
import re
import sys

manifest_path, expected_release_id = sys.argv[1:]
wire = open(manifest_path, "rb").read()
manifest = json.loads(wire.decode("utf-8"))
if manifest.get("schemaVersion") != "act-runtime-release.v2":
    raise SystemExit("ERROR: mounted manifest is not v2")
if manifest.get("releaseId") != expected_release_id:
    raise SystemExit("ERROR: mounted manifest release does not match activation candidate")
for field in ("manifestSha256", "treeSha256"):
    value = manifest.get(field)
    if not isinstance(value, str) or not re.fullmatch(r"[a-f0-9]{64}", value):
        raise SystemExit("ERROR: mounted manifest %s is invalid" % field)
identity = {
    "schemaVersion": "runtime-blob-release-identity.v1",
    "releaseId": expected_release_id,
    "manifestVersion": "act-runtime-release.v2",
    "manifestSha256": manifest["manifestSha256"],
    "manifestWireSha256": hashlib.sha256(wire).hexdigest(),
    "manifestWireSizeBytes": len(wire),
    "treeSha256": manifest["treeSha256"],
}
print(json.dumps(identity, separators=(",", ":"), sort_keys=True))
PY
  chmod 0600 "$lifecycle_identity"
}

stage_lifecycle_desired() {
  local snapshot active_id desired_id publishing_has_candidate next_generation
  snapshot="$(python3 "$LIFECYCLE_SCRIPT" inspect --state-dir "$STATE_DIR")"
  active_id="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["active"]["releaseId"])' <<<"$snapshot")"
  [[ "$active_id" == "$old_active" ]] || {
    echo "ERROR: v2 lifecycle active release does not match the v1 active receipt" >&2
    exit 1
  }
  lifecycle_generation="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["generation"])' <<<"$snapshot")"
  desired_id="$(python3 -c 'import json,sys; print((json.load(sys.stdin)["desired"] or {}).get("releaseId", ""))' <<<"$snapshot")"
  if [[ -n "$desired_id" && "$desired_id" != "$release_id" ]]; then
    echo "ERROR: v2 lifecycle already records a different desired release" >&2
    exit 1
  fi
  if [[ "$desired_id" != "$release_id" ]]; then
    publishing_has_candidate="$(python3 -c 'import json,sys; state=json.load(sys.stdin); print("1" if any(item["releaseId"] == sys.argv[1] for item in state["publishing"]) else "0")' "$release_id" <<<"$snapshot")"
    if [[ "$publishing_has_candidate" == "1" ]]; then
      snapshot="$(python3 "$LIFECYCLE_SCRIPT" set-desired \
        --state-dir "$STATE_DIR" \
        --expected-generation "$lifecycle_generation" \
        --identity "$lifecycle_identity")"
    else
      snapshot="$(python3 "$LIFECYCLE_SCRIPT" begin-publish \
        --state-dir "$STATE_DIR" \
        --expected-generation "$lifecycle_generation" \
        --identity "$lifecycle_identity")"
      next_generation="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["generation"])' <<<"$snapshot")"
      snapshot="$(python3 "$LIFECYCLE_SCRIPT" set-desired \
        --state-dir "$STATE_DIR" \
        --expected-generation "$next_generation" \
        --identity "$lifecycle_identity")"
    fi
  fi
  lifecycle_generation="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["generation"])' <<<"$snapshot")"
}

cleanup_lifecycle_identity() {
  if [[ -n "$lifecycle_identity" && -f "$lifecycle_identity" ]]; then
    rm -f -- "$lifecycle_identity"
  fi
}

trap cleanup_lifecycle_identity EXIT

restore_runtime_consumers() {
  local status=$?
  set +e
  python3 "$ACTIVATION_TRANSACTION" recover \
    --state-dir "$STATE_DIR" \
    --lifecycle-script "$LIFECYCLE_SCRIPT" \
    --host-state-script "$HOST_STATE_SCRIPT" >/dev/null 2>&1 || true
  local lifecycle_state lifecycle_active_release
  lifecycle_state="$(python3 "$LIFECYCLE_SCRIPT" inspect --state-dir "$STATE_DIR" 2>/dev/null || true)"
  lifecycle_active_release="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["active"]["releaseId"])' <<<"$lifecycle_state" 2>/dev/null || true)"
  if [[ "$candidate_deploy_attempted" == "1" ]]; then
    if [[ "$lifecycle_active_release" != "$release_id" && -n "$parent_view" ]]; then
      python3 "$MATERIALIZER" select --release-id "$old_active" --view-root "$VIEW_ROOT" >/dev/null
      RUNTIME_DELIVERY_MODE=ossfs-blob-view \
        ACT_RUNTIME_OSS_RAM_ROLE="$ram_role" \
        ACT_RUNTIME_ACTIVE_RECEIPT_PATH="$STATE_DIR/act-runtime-active-receipt.json" \
        RUNTIME_CONTENT_DIR="$VIEW_ROOT/current" \
        APP_IMAGE="$rollback_app_image" \
        "$DEPLOY_SCRIPT" --runtime-cutover-app-only
    elif [[ "$lifecycle_active_release" != "$release_id" ]]; then
      RUNTIME_DELIVERY_MODE=legacy-rsync \
        ACT_RUNTIME_ACTIVE_RECEIPT_PATH="$STATE_DIR/act-runtime-active-receipt.json" \
        RUNTIME_CONTENT_DIR="$LEGACY_RUNTIME_ROOT" \
        APP_IMAGE="$rollback_app_image" \
        "$DEPLOY_SCRIPT" --runtime-cutover-app-only
    fi
  fi
  cleanup_lifecycle_identity
  exit "$status"
}

mkdir -p "$STATE_DIR"
exec 9>"$STATE_DIR/.act-runtime-selection.lock"
flock -x 9

python3 "$ACTIVATION_TRANSACTION" recover \
  --state-dir "$STATE_DIR" \
  --lifecycle-script "$LIFECYCLE_SCRIPT" \
  --host-state-script "$HOST_STATE_SCRIPT" >/dev/null
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
write_lifecycle_identity "$candidate_view/.act-runtime-release.v2.json"
stage_lifecycle_desired
python3 "$HOST_STATE_SCRIPT" select \
  --state-dir "$STATE_DIR" \
  --expected-active-release "$expected_active_release" \
  --verification-receipt "$verification_receipt" >/dev/null
python3 "$MATERIALIZER" select --release-id "$release_id" --view-root "$VIEW_ROOT" >/dev/null

trap restore_runtime_consumers ERR
candidate_deploy_attempted=1
RUNTIME_DELIVERY_MODE=ossfs-blob-view \
  ACT_RUNTIME_OSS_RAM_ROLE="$ram_role" \
  ACT_RUNTIME_ACTIVE_RECEIPT_PATH="$STATE_DIR/act-runtime-active-receipt.json" \
  RUNTIME_CONTENT_DIR="$VIEW_ROOT/current" \
  APP_IMAGE="$rollback_app_image" \
  "$DEPLOY_SCRIPT" --runtime-cutover-app-only
source "$ENV_FILE"
wait_for_readyz
python3 "$ACTIVATION_TRANSACTION" activate \
  --state-dir "$STATE_DIR" \
  --lifecycle-script "$LIFECYCLE_SCRIPT" \
  --host-state-script "$HOST_STATE_SCRIPT" \
  --expected-generation "$lifecycle_generation" \
  --identity "$lifecycle_identity" >/dev/null
trap - ERR
cleanup_lifecycle_identity
printf '{"releaseId":"%s","previousActiveRelease":"%s","runtimeDeliveryMode":"ossfs-blob-view"}\n' "$release_id" "$old_active"
