#!/usr/bin/env bash
set -euo pipefail

# Bind the shared read-only blob FUSE onto the current materialized view
# helper. Blob root must already be mounted by act-runtime-blob-ossfs.service.

BLOB_ROOT="${ACT_RUNTIME_BLOB_ROOT:-/home/projects/act/data/runtime/ossfs/blobs}"
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
helper="$view/.act-runtime-blobs"
[[ -d "$helper" && ! -L "$helper" ]] || {
  echo "ERROR: blob-view helper is missing: $helper" >&2
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

if findmnt -rn -M "$helper" -o TARGET | grep -Fxq "$helper"; then
  findmnt -rn -M "$helper" -o FSTYPE | grep -Eq '^fuse(\.|$)' || {
    echo "ERROR: helper is mounted but is not FUSE: $helper" >&2
    exit 1
  }
  findmnt -rn -M "$helper" -o OPTIONS | grep -Eq '(^|,)ro(,|$)' || {
    echo "ERROR: helper bind mount must be read-only: $helper" >&2
    exit 1
  }
  exit 0
fi

chmod 0755 "$helper"
mount --bind "$BLOB_ROOT" "$helper"
mount -o remount,bind,ro "$helper"
chmod 0555 "$helper" || true

findmnt -rn -M "$helper" -o FSTYPE | grep -Eq '^fuse(\.|$)' || {
  echo "ERROR: helper is not an ossfs FUSE bind mount: $helper" >&2
  exit 1
}
findmnt -rn -M "$helper" -o OPTIONS | grep -Eq '(^|,)ro(,|$)' || {
  echo "ERROR: helper bind mount must be read-only: $helper" >&2
  exit 1
}
