#!/usr/bin/env bash
set -euo pipefail

STATE_DIR="${ACT_RUNTIME_STATE_DIR:-/home/projects/act/data/runtime}"
MOUNT_ROOT="${ACT_RUNTIME_MOUNT_ROOT:-/home/projects/act/data/runtime/ossfs/releases}"
HOST_STATE_SCRIPT="${ACT_RUNTIME_HOST_STATE_SCRIPT:-/home/projects/act/scripts/runtime-release-host-state.py}"
OSSFS_CONFIG_SCRIPT="${ACT_RUNTIME_OSSFS_CONFIG_SCRIPT:-/home/projects/act/scripts/configure-runtime-ossfs-release.sh}"
DEPLOY_SCRIPT="${ACT_RUNTIME_DEPLOY_SCRIPT:-/home/projects/act/scripts/4-deploy.sh}"
DEPLOY_MODE="${ACT_RUNTIME_DEPLOY_MODE:---app-only}"
ENV_FILE="${ACT_RUNTIME_ENV_FILE:-/home/projects/act/data/runtime/act-obe.env}"
LEGACY_RUNTIME_ROOT="${ACT_RUNTIME_LEGACY_ROOT:-/home/projects/act/course-content/runtime}"
APP_CONTAINER="${ACT_RUNTIME_APP_CONTAINER:-act-obe-app}"
WORKER_CONTAINER="${ACT_RUNTIME_WORKER_CONTAINER:-act-obe-worker}"
APP_SERVICE_NAME="${ACT_RUNTIME_APP_SERVICE_NAME:-act-obe-stack.service}"
APP_SERVICE_DROPIN_PATH="${ACT_RUNTIME_APP_SERVICE_DROPIN_PATH:-/etc/systemd/system/${APP_SERVICE_NAME}.d/20-runtime-ossfs.conf}"
READYZ_TIMEOUT_SECONDS="${ACT_RUNTIME_READYZ_TIMEOUT_SECONDS:-180}"

release_id=""
expected_active_release=""
verification_receipt=""
ram_role=""
old_active="none"
rollback_app_image=""
candidate_deploy_attempted=0
activation_proof_args=()
startup_dropin_backup=""
startup_dropin_was_absent=0
startup_dropin_prepared=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --release-id) release_id="$2"; shift 2 ;;
    --expected-active-release) expected_active_release="$2"; shift 2 ;;
    --verification-receipt) verification_receipt="$2"; shift 2 ;;
    --ram-role) ram_role="$2"; shift 2 ;;
    *) echo "ERROR: unknown argument: $1" >&2; exit 1 ;;
  esac
done

[[ "$release_id" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]] || { echo "ERROR: invalid release id" >&2; exit 1; }
[[ "$expected_active_release" == "none" || "$expected_active_release" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]] || { echo "ERROR: invalid expected active release" >&2; exit 1; }
[[ -f "$verification_receipt" ]] || { echo "ERROR: verification receipt is required" >&2; exit 1; }
[[ "$ram_role" =~ ^[A-Za-z0-9_+=,.@-]{1,128}$ ]] || { echo "ERROR: invalid RAM role name" >&2; exit 1; }
[[ "$DEPLOY_MODE" == "--app-only" || "$DEPLOY_MODE" == "--runtime-cutover-app-only" ]] || { echo "ERROR: invalid runtime deploy mode" >&2; exit 1; }
[[ "$APP_SERVICE_NAME" =~ ^[A-Za-z0-9_.@-]+\.service$ ]] || { echo "ERROR: invalid application service name" >&2; exit 1; }
[[ "$READYZ_TIMEOUT_SECONDS" =~ ^[1-9][0-9]{0,2}$ && "$READYZ_TIMEOUT_SECONDS" -le 600 ]] || { echo "ERROR: runtime readiness timeout is invalid" >&2; exit 1; }
[[ -x "$(command -v flock)" ]] || { echo "ERROR: flock is required" >&2; exit 1; }
[[ -x "$(command -v podman)" ]] || { echo "ERROR: podman is required" >&2; exit 1; }
[[ -x "$(command -v python3)" ]] || { echo "ERROR: python3 is required" >&2; exit 1; }

if [[ -n "${ACT_RUNTIME_APP_REVISION:-}" || -n "${ACT_RUNTIME_IMAGE_DIGEST:-}" || -n "${ACT_RUNTIME_RELEASE_LOCATOR_SHA256:-}" ]]; then
  [[ "${ACT_RUNTIME_APP_REVISION:-}" =~ ^[a-f0-9]{40}$ ]] || { echo "ERROR: runtime activation app revision is invalid" >&2; exit 1; }
  [[ "${ACT_RUNTIME_IMAGE_DIGEST:-}" =~ ^sha256:[a-f0-9]{64}$ ]] || { echo "ERROR: runtime activation image digest is invalid" >&2; exit 1; }
  [[ "${ACT_RUNTIME_RELEASE_LOCATOR_SHA256:-}" =~ ^[a-f0-9]{64}$ ]] || { echo "ERROR: runtime activation release locator digest is invalid" >&2; exit 1; }
  activation_proof_args=(
    --app-revision "$ACT_RUNTIME_APP_REVISION"
    --image-digest "$ACT_RUNTIME_IMAGE_DIGEST"
    --release-locator-sha256 "$ACT_RUNTIME_RELEASE_LOCATOR_SHA256"
  )
fi

mkdir -p "$STATE_DIR"
exec 9>"$STATE_DIR/.act-runtime-selection.lock"
flock -x 9

old_active="$(python3 "$HOST_STATE_SCRIPT" active --state-dir "$STATE_DIR" | python3 -c 'import json,sys; print(json.load(sys.stdin)["activeReleaseId"] or "none")')"

capture_rollback_image() {
  local app_image
  local worker_image
  local app_image_id
  local worker_image_id
  app_image_id="$(podman inspect --format '{{.Image}}' "$APP_CONTAINER")"
  worker_image_id="$(podman inspect --format '{{.Image}}' "$WORKER_CONTAINER")"
  [[ "$app_image_id" =~ ^(sha256:)?([a-f0-9]{64})$ ]] || { echo "ERROR: existing app image digest is invalid" >&2; exit 1; }
  app_image="sha256:${BASH_REMATCH[2]}"
  [[ "$worker_image_id" =~ ^(sha256:)?([a-f0-9]{64})$ ]] || { echo "ERROR: existing worker image digest is invalid" >&2; exit 1; }
  worker_image="sha256:${BASH_REMATCH[2]}"
  [[ "$worker_image" == "$app_image" ]] || { echo "ERROR: app and worker must use the same image before runtime cutover" >&2; exit 1; }
  rollback_app_image="$app_image"
}

configure_startup_order() {
  local dropin_dir
  local temporary
  dropin_dir="$(dirname "$APP_SERVICE_DROPIN_PATH")"
  [[ ! -L "$APP_SERVICE_DROPIN_PATH" ]] || { echo "ERROR: application runtime startup drop-in must not be a symlink" >&2; exit 1; }
  mkdir -p "$dropin_dir"
  startup_dropin_backup="$(mktemp "$STATE_DIR/.act-runtime-startup-dropin.XXXXXX")"
  if [[ -e "$APP_SERVICE_DROPIN_PATH" ]]; then
    cp -- "$APP_SERVICE_DROPIN_PATH" "$startup_dropin_backup"
  else
    startup_dropin_was_absent=1
  fi
  temporary="$(mktemp "$dropin_dir/.20-runtime-ossfs.XXXXXX")"
  printf '%s\n' \
    '[Unit]' \
    "Requires=act-runtime-ossfs@${release_id}.service" \
    "After=act-runtime-ossfs@${release_id}.service" >"$temporary"
  chmod 0644 "$temporary"
  mv -f "$temporary" "$APP_SERVICE_DROPIN_PATH"
  startup_dropin_prepared=1
  systemctl daemon-reload
  systemctl enable "act-runtime-ossfs@${release_id}.service" >/dev/null
}

restore_startup_order() {
  if [[ "$startup_dropin_prepared" != "1" ]]; then
    return
  fi
  if [[ "$startup_dropin_was_absent" == "1" ]]; then
    rm -f "$APP_SERVICE_DROPIN_PATH"
  else
    install -m 0644 "$startup_dropin_backup" "$APP_SERVICE_DROPIN_PATH"
  fi
  systemctl daemon-reload || true
  systemctl disable "act-runtime-ossfs@${release_id}.service" >/dev/null 2>&1 || true
}

wait_for_readyz() {
  local deadline
  local now
  local remaining
  local sleep_seconds
  local readyz_url="http://127.0.0.1:${APP_PORT}/api/readyz"

  deadline="$(python3 - "$READYZ_TIMEOUT_SECONDS" <<'PY'
import sys
import time

print(int(time.monotonic()) + int(sys.argv[1]))
PY
)"

  while true; do
    now="$(python3 - <<'PY'
import time

print(int(time.monotonic()))
PY
)"
    remaining=$((deadline - now))
    if [[ "$remaining" -le 0 ]]; then
      break
    fi
    if curl --connect-timeout 2 --max-time "$remaining" --fail --silent --show-error "$readyz_url" >/dev/null; then
      return 0
    fi
    now="$(python3 - <<'PY'
import time

print(int(time.monotonic()))
PY
)"
    remaining=$((deadline - now))
    if [[ "$remaining" -gt 0 ]]; then
      sleep_seconds=3
      if [[ "$remaining" -lt "$sleep_seconds" ]]; then
        sleep_seconds="$remaining"
      fi
      sleep "$sleep_seconds"
    fi
  done

  echo "ERROR: application readiness did not succeed within ${READYZ_TIMEOUT_SECONDS}s" >&2
  return 1
}

rollback() {
  local failed_status=$?
  set +e
  if [[ "$candidate_deploy_attempted" == "1" ]]; then
    if [[ "$old_active" != "none" ]]; then
      systemctl start "act-runtime-ossfs@${old_active}.service"
      RUNTIME_DELIVERY_MODE=ossfs-release \
        ACT_RUNTIME_OSS_RAM_ROLE="$ram_role" \
        RUNTIME_CONTENT_DIR="$MOUNT_ROOT/$old_active" \
        APP_IMAGE="$rollback_app_image" \
        "$DEPLOY_SCRIPT" "$DEPLOY_MODE"
    else
      RUNTIME_DELIVERY_MODE=legacy-rsync \
        RUNTIME_CONTENT_DIR="$LEGACY_RUNTIME_ROOT" \
        APP_IMAGE="$rollback_app_image" \
        "$DEPLOY_SCRIPT" "$DEPLOY_MODE"
    fi
  fi
  restore_startup_order
  systemctl stop "act-runtime-ossfs@${release_id}.service" || true
  exit "$failed_status"
}
trap rollback ERR

if [[ "$old_active" == "none" && ! -d "$LEGACY_RUNTIME_ROOT" ]]; then
  echo "ERROR: legacy runtime root is required for first activation rollback" >&2
  exit 1
fi

capture_rollback_image

python3 "$HOST_STATE_SCRIPT" select \
  --state-dir "$STATE_DIR" \
  --expected-active-release "$expected_active_release" \
  --verification-receipt "$verification_receipt" >/dev/null

"$OSSFS_CONFIG_SCRIPT" --release-id "$release_id" --ram-role "$ram_role"
systemctl start "act-runtime-ossfs@${release_id}.service"
findmnt -rn -T "$MOUNT_ROOT/$release_id" -o FSTYPE | grep -Eq '^fuse(\.|$)'
findmnt -rn -T "$MOUNT_ROOT/$release_id" -o OPTIONS | grep -Eq '(^|,)ro(,|$)'
python3 "$HOST_STATE_SCRIPT" verify-mounted \
  --runtime-root "$MOUNT_ROOT/$release_id" \
  --release-id "$release_id" \
  --verification-receipt "$verification_receipt" >/dev/null

candidate_deploy_attempted=1
RUNTIME_DELIVERY_MODE=ossfs-release \
  ACT_RUNTIME_OSS_RAM_ROLE="$ram_role" \
  RUNTIME_CONTENT_DIR="$MOUNT_ROOT/$release_id" \
  "$DEPLOY_SCRIPT" "$DEPLOY_MODE"
source "$ENV_FILE"
wait_for_readyz
configure_startup_order
python3 "$HOST_STATE_SCRIPT" mark-active --state-dir "$STATE_DIR" --release-id "$release_id" "${activation_proof_args[@]}" >/dev/null
trap - ERR
rm -f "$startup_dropin_backup" || true
