#!/usr/bin/env bash
set -euo pipefail

# Bind the shared read-only blob FUSE onto the current materialized view
# helper. Blob root must already be mounted by act-runtime-blob-ossfs.service.

BLOB_ROOT="${ACT_RUNTIME_BLOB_ROOT:-/home/projects/act/data/runtime/ossfs/blobs}"
MEDIA_ROOT="${ACT_RUNTIME_PUBLIC_MEDIA_ROOT:-/home/projects/act/data/runtime/ossfs/public-media}"
MEDIA_DIRECTORY="${ACT_RUNTIME_PUBLIC_MEDIA_DIRECTORY:-/home/projects/act/data/runtime/public-teaching-media/current.json}"
VIEW="${ACT_RUNTIME_BLOB_VIEW:-}"
VIEW_CURRENT="${ACT_RUNTIME_BLOB_VIEW_CURRENT:-/home/projects/act/data/runtime/blob-views/current}"

if [[ -n "$VIEW" ]]; then
  [[ -d "$VIEW" && ! -L "$VIEW" ]] || {
    echo "ERROR: blob-view is not a real directory: $VIEW" >&2
    exit 1
  }
  view="$(readlink -f "$VIEW")"
else
  [[ -L "$VIEW_CURRENT" ]] || {
    echo "ERROR: blob-view current is not a symlink: $VIEW_CURRENT" >&2
    exit 1
  }
  view="$(readlink -f "$VIEW_CURRENT")"
fi
[[ -n "$view" && -d "$view" && ! -L "$view" ]] || {
  echo "ERROR: blob-view does not resolve to a real directory" >&2
  exit 1
}
bind_readonly_helper() {
  local source="$1" helper="$2"
  [[ -d "$helper" && ! -L "$helper" ]] || {
    echo "ERROR: blob-view helper is missing or unsafe: $helper" >&2
    return 1
  }
  findmnt -rn -M "$source" -o FSTYPE | grep -Eq '^fuse(\.|$)' || {
    echo "ERROR: blob root is not an ossfs FUSE mount: $source" >&2
    return 1
  }
  findmnt -rn -M "$source" -o OPTIONS | grep -Eq '(^|,)ro(,|$)' || {
    echo "ERROR: blob root must be mounted read-only: $source" >&2
    return 1
  }
  if ! findmnt -rn -M "$helper" -o TARGET | grep -Fxq "$helper"; then
    chmod 0755 "$helper"
    mount --bind "$source" "$helper"
    mount -o remount,bind,ro "$helper"
    chmod 0555 "$helper" || true
  fi
  findmnt -rn -M "$helper" -o FSTYPE | grep -Eq '^fuse(\.|$)' || return 1
  findmnt -rn -M "$helper" -o OPTIONS | grep -Eq '(^|,)ro(,|$)' || return 1
}

bind_readonly_helper "$BLOB_ROOT" "$view/.act-runtime-blobs"
media_required=0
if [[ -f "$MEDIA_DIRECTORY" ]]; then
  media_required="$(python3 -c 'import json,sys; d=json.load(open(sys.argv[1])); print(int(d.get("schemaVersion")=="act-public-teaching-media/v2" and bool(d.get("objects"))))' "$MEDIA_DIRECTORY")"
fi
if [[ "$media_required" == 1 ]] || findmnt -rn -M "$MEDIA_ROOT" -o FSTYPE | grep -Eq '^fuse(\.|$)'; then
  [[ ! -L "$view/.act-runtime-public-media" ]] || {
    echo "ERROR: public media helper must not be a symlink" >&2
    exit 1
  }
  mkdir -p "$view/.act-runtime-public-media"
  bind_readonly_helper "$MEDIA_ROOT" "$view/.act-runtime-public-media"
fi
