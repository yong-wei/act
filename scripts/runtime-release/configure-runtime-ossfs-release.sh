#!/usr/bin/env bash
set -euo pipefail

CONFIG_DIR="${ACT_RUNTIME_OSSFS_CONFIG_DIR:-/etc/act-runtime-ossfs}"
release_id=""
ram_role=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --release-id) release_id="$2"; shift 2 ;;
    --ram-role) ram_role="$2"; shift 2 ;;
    *) echo "ERROR: unknown argument: $1" >&2; exit 1 ;;
  esac
done

[[ "$release_id" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]] || { echo "ERROR: invalid release id" >&2; exit 1; }
[[ "$ram_role" =~ ^[A-Za-z0-9_+=,.@-]{1,128}$ ]] || { echo "ERROR: invalid RAM role name" >&2; exit 1; }

install -d -m 0700 "$CONFIG_DIR"
temporary="$(mktemp "$CONFIG_DIR/.${release_id}.XXXXXX")"
trap 'rm -f "$temporary"' EXIT
printf '%s\n' \
  '--oss_endpoint=https://oss-cn-hangzhou-internal.aliyuncs.com' \
  '--oss_bucket=act-course-assets' \
  '--oss_region=cn-hangzhou' \
  "--ram_role=${ram_role}" \
  "--oss_bucket_prefix=runtime/releases/${release_id}/" \
  '--ro=true' \
  '--allow_other=true' \
  '--uid=1001' \
  '--gid=1001' \
  '--file_mode=0644' \
  '--dir_mode=0755' >"$temporary"
chmod 0600 "$temporary"
mv -f "$temporary" "$CONFIG_DIR/${release_id}.conf"
trap - EXIT
