#!/usr/bin/env bash
set -euo pipefail

release_id=''
rollback_release_id=''
rollback_verification_receipt=''
ram_role=''
legacy_runtime_root='/home/projects/act/course-content/runtime'
mount_root='/home/projects/act/data/runtime/ossfs/releases'
state_dir='/home/projects/act/data/runtime'
host_state_script='/home/projects/act/scripts/runtime-release-host-state.py'
ossfs_config_script='/home/projects/act/scripts/configure-runtime-ossfs-release.sh'
app_container='act-obe-app'
worker_container='act-obe-worker'
app_port=''
report=''

while [[ $# -gt 0 ]]; do
  case "$1" in
    --release-id) release_id="$2"; shift 2 ;;
    --rollback-release-id) rollback_release_id="$2"; shift 2 ;;
    --rollback-verification-receipt) rollback_verification_receipt="$2"; shift 2 ;;
    --ram-role) ram_role="$2"; shift 2 ;;
    --legacy-runtime-root) legacy_runtime_root="$2"; shift 2 ;;
    --mount-root) mount_root="$2"; shift 2 ;;
    --state-dir) state_dir="$2"; shift 2 ;;
    --host-state-script) host_state_script="$2"; shift 2 ;;
    --ossfs-config-script) ossfs_config_script="$2"; shift 2 ;;
    --app-container) app_container="$2"; shift 2 ;;
    --worker-container) worker_container="$2"; shift 2 ;;
    --app-port) app_port="$2"; shift 2 ;;
    --report) report="$2"; shift 2 ;;
    *) echo "ERROR: unknown argument: $1" >&2; exit 1 ;;
  esac
done

for value in "$release_id" "$rollback_release_id"; do
  [[ "$value" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]] || { echo 'ERROR: invalid release id' >&2; exit 1; }
done
[[ "$legacy_runtime_root" == /* && "$legacy_runtime_root" != / && "$legacy_runtime_root" != *$'\n'* && "$legacy_runtime_root" != *'..'* ]] || { echo 'ERROR: invalid legacy runtime root' >&2; exit 1; }
[[ "$mount_root" == /* && "$mount_root" != / && "$mount_root" != *$'\n'* && "$mount_root" != *'..'* ]] || { echo 'ERROR: invalid mount root' >&2; exit 1; }
[[ "$state_dir" == /* && "$state_dir" != / && "$state_dir" != *$'\n'* && "$state_dir" != *'..'* ]] || { echo 'ERROR: invalid state directory' >&2; exit 1; }
[[ "$app_container" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ && "$worker_container" =~ ^[A-Za-z0-9][A-Za-z0-9_.-]*$ ]] || { echo 'ERROR: invalid container name' >&2; exit 1; }
[[ "$app_port" =~ ^[1-9][0-9]{0,4}$ && "$app_port" -le 65535 ]] || { echo 'ERROR: invalid application port' >&2; exit 1; }
[[ -x "$host_state_script" ]] || { echo 'ERROR: host state script is unavailable' >&2; exit 1; }
[[ -x "$ossfs_config_script" ]] || { echo 'ERROR: ossfs configuration script is unavailable' >&2; exit 1; }
[[ -f "$rollback_verification_receipt" && ! -L "$rollback_verification_receipt" ]] || { echo 'ERROR: rollback verification receipt is unavailable' >&2; exit 1; }
[[ "$ram_role" == 'act-runtime-oss-read' ]] || { echo 'ERROR: legacy retirement requires the read-only RAM role' >&2; exit 1; }
[[ -d "$legacy_runtime_root" && ! -L "$legacy_runtime_root" ]] || { echo 'ERROR: legacy runtime root must be a non-symlink directory' >&2; exit 1; }
[[ "$report" == /* && ! -L "$report" ]] || { echo 'ERROR: report path must be absolute and non-symlinked' >&2; exit 1; }

for command in curl du find findmnt podman python3 stat; do
  command -v "$command" >/dev/null 2>&1 || { echo "ERROR: required command unavailable: $command" >&2; exit 1; }
done

active_release="$(python3 "$host_state_script" active --state-dir "$state_dir" | python3 -c 'import json,sys; print(json.load(sys.stdin)["activeReleaseId"] or "")')"
[[ "$active_release" == "$release_id" ]] || { echo 'ERROR: active receipt does not select the requested OSS release' >&2; exit 1; }
candidate_root="${mount_root}/${release_id}"
findmnt -rn -T "$candidate_root" -o FSTYPE | grep -Eq '^fuse(\.|$)' || { echo 'ERROR: active runtime is not an ossfs FUSE mount' >&2; exit 1; }
findmnt -rn -T "$candidate_root" -o OPTIONS | grep -Eq '(^|,)ro(,|$)' || { echo 'ERROR: active runtime mount is not read-only' >&2; exit 1; }

assert_runtime_mount() {
  local container="$1"
  local mounts
  mounts="$(podman inspect --format '{{range .Mounts}}{{printf "%s\t%s\t%v\n" .Source .Destination .Options}}{{end}}' "$container")"
  printf '%s\n' "$mounts" | awk -F '\t' -v source="$candidate_root" '$1 == source && $2 == "/app/course-content/runtime" && $3 ~ /ro/ { found=1 } END { exit(found ? 0 : 1) }' || {
    echo "ERROR: ${container} does not bind the active OSS runtime read-only" >&2
    exit 1
  }
  if printf '%s\n' "$mounts" | awk -F '\t' -v legacy="$legacy_runtime_root" '$1 == legacy && index($2, "/app/course-content/runtime") == 1 { found=1 } END { exit(found ? 0 : 1) }'; then
    echo "ERROR: ${container} still references the legacy runtime" >&2
    exit 1
  fi
}

assert_runtime_mount "$app_container"
assert_runtime_mount "$worker_container"
curl --fail --silent --show-error "http://127.0.0.1:${app_port}/api/readyz" >/dev/null

rollback_mounted=0
cleanup_rollback_mount() {
  if [[ "$rollback_mounted" == '1' ]]; then
    systemctl stop "act-runtime-ossfs@${rollback_release_id}.service" >/dev/null 2>&1 || true
  fi
}
trap cleanup_rollback_mount EXIT
"$ossfs_config_script" --release-id "$rollback_release_id" --ram-role "$ram_role"
systemctl start "act-runtime-ossfs@${rollback_release_id}.service"
rollback_mounted=1
rollback_root="${mount_root}/${rollback_release_id}"
findmnt -rn -T "$rollback_root" -o FSTYPE | grep -Eq '^fuse(\.|$)' || { echo 'ERROR: rollback release is not an ossfs FUSE mount' >&2; exit 1; }
findmnt -rn -T "$rollback_root" -o OPTIONS | grep -Eq '(^|,)ro(,|$)' || { echo 'ERROR: rollback release mount is not read-only' >&2; exit 1; }
python3 "$host_state_script" verify-mounted --runtime-root "$rollback_root" --release-id "$rollback_release_id" --verification-receipt "$rollback_verification_receipt" >/dev/null
systemctl stop "act-runtime-ossfs@${rollback_release_id}.service"
rollback_mounted=0

root_before="$(df -B1 "$legacy_runtime_root" | awk 'NR == 2 { print $4 }')"
legacy_bytes_before="$(du -sb "$legacy_runtime_root" | awk '{print $1}')"
legacy_files_before="$(find -P "$legacy_runtime_root" -xdev -type f -print | wc -l | tr -d '[:space:]')"

# find -P/-xdev neither follows symlinks nor descends a different filesystem.
# A nested mount therefore leaves its mount point behind and makes rmdir fail.
find -P "$legacy_runtime_root" -xdev -depth -mindepth 1 -delete
rmdir -- "$legacy_runtime_root"
[[ ! -e "$legacy_runtime_root" && ! -L "$legacy_runtime_root" ]] || { echo 'ERROR: legacy runtime directory was not fully removed' >&2; exit 1; }
root_after="$(df -B1 "$(dirname "$legacy_runtime_root")" | awk 'NR == 2 { print $4 }')"

install -d -m 0700 "$(dirname "$report")"
temporary="$(mktemp "$(dirname "$report")/.${release_id}.XXXXXX")"
trap 'rm -f "$temporary"' EXIT
printf '{"schemaVersion":"runtime-legacy-retirement.v1","releaseId":"%s","rollbackReleaseId":"%s","activeReceiptVerified":true,"appAndWorkerUseOssfs":true,"readyz":"ok","rollbackMountVerified":true,"legacyRuntimeBytesBefore":%s,"legacyRuntimeFilesBefore":%s,"rootFilesystemBytesAvailableBefore":%s,"rootFilesystemBytesAvailableAfter":%s}\n' \
  "$release_id" "$rollback_release_id" "$legacy_bytes_before" "$legacy_files_before" "$root_before" "$root_after" >"$temporary"
chmod 0600 "$temporary"
sync "$temporary"
mv -f "$temporary" "$report"
sync "$(dirname "$report")"
trap - EXIT
