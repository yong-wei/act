#!/usr/bin/env bash
set -Eeuo pipefail

# Install successor Teaching overlays onto the already selected blob-view.
# Does not write Authority current.json, Runtime identity, or OSS objects.

PROJECT_DIR="${ACT_RUNTIME_PROJECT_DIR:-/home/projects/act}"
STATE_DIR="${ACT_RUNTIME_STATE_DIR:-$PROJECT_DIR/data/runtime}"
VIEW_ROOT="${ACT_RUNTIME_BLOB_VIEW_ROOT:-$STATE_DIR/blob-views}"
DEPLOY="${ACT_RUNTIME_APP_DEPLOY_SCRIPT:-$PROJECT_DIR/scripts/4-deploy.sh}"
INSTALLER="${ACT_RUNTIME_TEACHING_OVERLAY_INSTALLER:-$PROJECT_DIR/scripts/knowledge-cutover/install-successor-control-plane-overlays.py}"
MATERIALIZER="${ACT_RUNTIME_BLOB_MATERIALIZER:-$PROJECT_DIR/scripts/materialize-runtime-blob-release.py}"

source_dir=""
expected_authority=""
expected_teaching=""
expected_domain=""
release_id=""
apply=0
while [[ $# -gt 0 ]]; do
  case "$1" in
    --source) source_dir="$2"; shift 2 ;;
    --expected-authority-release-id) expected_authority="$2"; shift 2 ;;
    --expected-teaching-projection-hash) expected_teaching="$2"; shift 2 ;;
    --expected-domain-teaching-projection-hash) expected_domain="$2"; shift 2 ;;
    --release-id) release_id="$2"; shift 2 ;;
    --apply) apply=1; shift ;;
    *) echo "ERROR: unknown argument: $1" >&2; exit 1 ;;
  esac
done

[[ "$source_dir" = /* && -d "$source_dir" && ! -L "$source_dir" ]] || {
  echo "ERROR: --source must be an absolute real directory" >&2
  exit 1
}
[[ -n "$expected_authority" && -n "$expected_teaching" && -n "$expected_domain" && -n "$release_id" ]] || {
  echo "ERROR: successor identities are required" >&2
  exit 1
}
[[ -f "$INSTALLER" && ! -L "$INSTALLER" ]] || {
  echo "ERROR: installer is missing" >&2
  exit 1
}
[[ -f "$MATERIALIZER" && ! -L "$MATERIALIZER" ]] || {
  echo "ERROR: materializer is missing" >&2
  exit 1
}

lock_path="$STATE_DIR/.act-runtime-selection.lock"
mkdir -p "$STATE_DIR"
lock_holder=""
release_selection_lock() {
  if [[ -n "$lock_holder" ]]; then
    kill "$lock_holder" 2>/dev/null || true
    wait "$lock_holder" 2>/dev/null || true
    lock_holder=""
  fi
}
exec 9>"$lock_path"
if command -v flock >/dev/null 2>&1; then
  flock 9
else
  exec 8< <(python3 -c 'import fcntl, os, signal, sys
fcntl.flock(9, fcntl.LOCK_EX)
os.write(1, b"locked\n")
sys.stdout.flush()
signal.pause()
')
  lock_holder=$!
  IFS= read -r locked_line <&8 || true
  if [[ "$locked_line" != "locked" ]]; then
    echo "ERROR: file lock is unavailable" >&2
    release_selection_lock
    exit 1
  fi
  trap release_selection_lock EXIT
fi

current_link="$VIEW_ROOT/current"
[[ -L "$current_link" ]] || {
  echo "ERROR: selected blob-view pointer is missing" >&2
  exit 1
}
[[ -d "$VIEW_ROOT/views/$release_id" && ! -L "$VIEW_ROOT/views/$release_id" ]] || {
  echo "ERROR: requested blob-view is missing" >&2
  exit 1
}
active_json="$(python3 "$MATERIALIZER" active --view-root "$VIEW_ROOT")"
active_release="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["activeReleaseId"])' "$active_json")"
active_view="$(python3 -c 'import json,sys; print(json.loads(sys.argv[1])["viewPath"])' "$active_json")"
selected_view="$(python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$VIEW_ROOT/views/$release_id")"
current_view="$(python3 -c 'import os,sys; print(os.path.realpath(sys.argv[1]))' "$current_link")"
[[ "$active_release" == "$release_id" && "$current_view" == "$selected_view" && "$current_view" == "$active_view" ]] || {
  echo "ERROR: selected blob-view is not $release_id" >&2
  exit 1
}
view="$current_view"
[[ -d "$view" && ! -L "$view" ]] || {
  echo "ERROR: selected blob-view is missing" >&2
  exit 1
}

installer_args=(
  --view "$view"
  --source "$source_dir"
  --expected-authority-release-id "$expected_authority"
  --expected-teaching-projection-hash "$expected_teaching"
  --expected-domain-teaching-projection-hash "$expected_domain"
)
if [[ "$apply" != "1" ]]; then
  python3 "$INSTALLER" "${installer_args[@]}"
  exit 0
fi

stop_consumers() {
  local name
  command -v podman >/dev/null 2>&1 || return 0
  for name in act-obe-app act-obe-worker act-obe-submission-scanner act-obe-submission-gc; do
    if podman container exists "$name" && [[ "$(podman inspect --format '{{.State.Running}}' "$name")" == "true" ]]; then
      podman stop --time 45 "$name" >/dev/null
    fi
  done
}

restart_consumers() {
  "$DEPLOY" --runtime-cutover-app-only 9>&-
}

snapshot="$STATE_DIR/.successor-teaching-overlay-preapply"
pending_receipt="$STATE_DIR/.successor-teaching-overlay-pending.json"
receipt="$STATE_DIR/successor-teaching-overlay-receipt.json"
rm -rf "$snapshot"
rm -f "$pending_receipt"
python3 "$INSTALLER" --view "$view" --snapshot-to "$snapshot"

restore_and_restart() {
  trap - ERR
  python3 "$INSTALLER" --view "$view" --restore-from "$snapshot"
  rm -f "$pending_receipt"
  restart_consumers || true
}
trap restore_and_restart ERR

stop_consumers
python3 "$INSTALLER" "${installer_args[@]}" --apply --receipt "$pending_receipt"
# Overlay installer already require_control_plane_overlay_payloads. Full
# ossfs blob-view verify is too slow for the stopped-consumer window.
restart_consumers
python3 -c 'import os,sys; os.replace(sys.argv[1], sys.argv[2])' "$pending_receipt" "$receipt"
trap - ERR
rm -rf "$snapshot"
echo "successor teaching overlays installed"
