#!/usr/bin/env bash
set -euo pipefail

CONFIG_DIR="${ACT_RUNTIME_BLOB_OSSFS_CONFIG_DIR:-/etc/act-runtime-blob-ossfs}"
ram_role=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ram-role) ram_role="$2"; shift 2 ;;
    *) echo "ERROR: unknown argument: $1" >&2; exit 1 ;;
  esac
done

[[ "$ram_role" =~ ^[A-Za-z0-9_+=,.@-]{1,128}$ ]] || { echo "ERROR: invalid RAM role name" >&2; exit 1; }

install -d -m 0700 "$CONFIG_DIR"
temporary="$(mktemp "$CONFIG_DIR/.blobs.XXXXXX")"
trap 'rm -f "$temporary"' EXIT
printf '%s\n' \
  '--oss_endpoint=https://oss-cn-hangzhou-internal.aliyuncs.com' \
  '--oss_bucket=act-course-assets' \
  '--oss_region=cn-hangzhou' \
  "--ram_role=${ram_role}" \
  '--oss_bucket_prefix=runtime/blobs/sha256/' \
  '--ro=true' \
  '--allow_other=true' \
  '--uid=1001' \
  '--gid=1001' \
  '--file_mode=0644' \
  '--dir_mode=0755' >"$temporary"
chmod 0600 "$temporary"
mv -f "$temporary" "$CONFIG_DIR/blobs.conf"
trap - EXIT
