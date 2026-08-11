#!/usr/bin/env bash
set -euo pipefail

STATE_DIR="${ACT_RUNTIME_STATE_DIR:-/home/projects/act/data/runtime}"
MOUNT_ROOT="${ACT_RUNTIME_MOUNT_ROOT:-/home/projects/act/data/runtime/ossfs/releases}"
HOST_STATE_SCRIPT="${ACT_RUNTIME_HOST_STATE_SCRIPT:-/home/projects/act/scripts/runtime-release-host-state.py}"
OSSFS_CONFIG_SCRIPT="${ACT_RUNTIME_OSSFS_CONFIG_SCRIPT:-/home/projects/act/scripts/configure-runtime-ossfs-release.sh}"
DEPLOY_SCRIPT="${ACT_RUNTIME_DEPLOY_SCRIPT:-/home/projects/act/scripts/4-deploy.sh}"
ENV_FILE="${ACT_RUNTIME_ENV_FILE:-/home/projects/act/data/runtime/act-obe.env}"
LEGACY_RUNTIME_ROOT="${ACT_RUNTIME_LEGACY_ROOT:-/home/projects/act/course-content/runtime}"

release_id=""
expected_active_release=""
verification_receipt=""
ram_role=""
old_active="none"
candidate_deploy_attempted=0

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
[[ -x "$(command -v flock)" ]] || { echo "ERROR: flock is required" >&2; exit 1; }
[[ -x "$(command -v python3)" ]] || { echo "ERROR: python3 is required" >&2; exit 1; }

mkdir -p "$STATE_DIR"
exec 9>"$STATE_DIR/.act-runtime-selection.lock"
flock -x 9

old_active="$(python3 "$HOST_STATE_SCRIPT" active --state-dir "$STATE_DIR" | python3 -c 'import json,sys; print(json.load(sys.stdin)["activeReleaseId"] or "none")')"
rollback() {
  local failed_status=$?
  set +e
  if [[ "$candidate_deploy_attempted" == "1" ]]; then
    if [[ "$old_active" != "none" ]]; then
      systemctl start "act-runtime-ossfs@${old_active}.service"
      RUNTIME_DELIVERY_MODE=ossfs-release \
        ACT_RUNTIME_OSS_RAM_ROLE="$ram_role" \
        RUNTIME_CONTENT_DIR="$MOUNT_ROOT/$old_active" \
        "$DEPLOY_SCRIPT" --app-only
    else
      RUNTIME_DELIVERY_MODE=legacy-rsync \
        RUNTIME_CONTENT_DIR="$LEGACY_RUNTIME_ROOT" \
        "$DEPLOY_SCRIPT" --app-only
    fi
  fi
  systemctl stop "act-runtime-ossfs@${release_id}.service" || true
  exit "$failed_status"
}
trap rollback ERR

if [[ "$old_active" == "none" && ! -d "$LEGACY_RUNTIME_ROOT" ]]; then
  echo "ERROR: legacy runtime root is required for first activation rollback" >&2
  exit 1
fi

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
  "$DEPLOY_SCRIPT" --app-only
source "$ENV_FILE"
curl --fail --silent --show-error "http://127.0.0.1:${APP_PORT}/api/readyz" >/dev/null
python3 "$HOST_STATE_SCRIPT" mark-active --state-dir "$STATE_DIR" --release-id "$release_id" >/dev/null
trap - ERR
