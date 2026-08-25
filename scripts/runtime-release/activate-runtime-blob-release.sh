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
# Coordinated cutover (#1509): when set, the desired identity is declared as
# a coordinated successor and the activation must carry the matching
# committed coordinated graph receipt.
COORDINATED_CUTOVER_DECLARATION="${ACT_RUNTIME_COORDINATED_CUTOVER_DECLARATION:-}"
COORDINATED_GRAPH_RECEIPT="${ACT_RUNTIME_COORDINATED_GRAPH_RECEIPT:-}"
COORDINATED_RUNTIME_BINDING="${ACT_RUNTIME_COORDINATED_RUNTIME_BINDING:-}"

release_id=""
expected_active_release=""
manifest=""
release_receipt=""
verification_receipt=""
ram_role=""
replace_existing=0
old_active="none"
parent_view=""
overlay_stash=""
rebuild_staging=""
rebuild_backup=""
rebuild_failed=""
rollback_app_image=""
candidate_current_selected=0
candidate_deploy_attempted=0
lifecycle_identity=""
lifecycle_generation=""
candidate_media_runtime_path=""
activation_attempted=0
post_activation_media_smoke_passed=0
activation_generation=""
candidate_receipt_dir=""
candidate_receipt_path=""
candidate_receipt_rebound=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --release-id) release_id="$2"; shift 2 ;;
    --expected-active-release) expected_active_release="$2"; shift 2 ;;
    --manifest) manifest="$2"; shift 2 ;;
    --release-receipt) release_receipt="$2"; shift 2 ;;
    --verification-receipt) verification_receipt="$2"; shift 2 ;;
    --ram-role) ram_role="$2"; shift 2 ;;
    --replace-existing) replace_existing=1; shift ;;
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

for command in flock podman python3 findmnt mount umount curl mktemp; do
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
  if findmnt -rn -T "$helper" -o TARGET | grep -Fxq "$helper" && findmnt -rn -T "$helper" -o FSTYPE | grep -Eq '^fuse(\.|$)'; then
    :
  elif ! findmnt -rn -M "$helper" -o TARGET | grep -Fxq "$helper"; then
    chmod 0755 "$helper"
    mount --bind "$BLOB_ROOT" "$helper"
    mount -o remount,bind,ro "$helper"
    chmod 0555 "$helper" || true
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

run_candidate_consumer_smoke() {
  local candidate_result
  [[ -f "$candidate_view/lessons/1-1/lesson.json" ]] || {
    echo "ERROR: candidate canonical course runtime is missing" >&2
    return 1
  }
  curl --connect-timeout 2 --max-time 20 --fail --silent --show-error --location --max-redirs 3 \
    "http://127.0.0.1:${APP_PORT}/interactive-learning/courses/unit-1-1-see-the-full-picture" >/dev/null || {
      echo "ERROR: candidate course runtime consumer smoke failed" >&2
      return 1
    }
  if ! candidate_result="$(podman exec -i --workdir /app "$APP_CONTAINER" /bin/sh -eu -c '
    smoke_file="$(mktemp /tmp/act-runtime-blob-candidate-smoke.XXXXXX.ts)"
    trap "rm -f -- \"$smoke_file\"" EXIT HUP INT TERM
    cat > "$smoke_file"
    ./node_modules/.bin/tsx "$smoke_file"
  ' <<'TS'
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

async function main() {
const runtimeRoot = path.join(process.cwd(), 'course-content', 'runtime');
const importFromApp = (relativePath: string) => import(
  pathToFileURL(path.join(process.cwd(), relativePath)).href,
);
const { parseRuntimeLessonMediaDocument } = await importFromApp('src/lib/runtime-lesson-media-document.ts');
const { loadTextbookCatalog, loadTextbookReaderProjection } = await importFromApp('src/lib/textbook-reader.ts');
const { loadStructuredTextbookBook } = await importFromApp('src/lib/structured-textbook-runtime.ts');
const { smokeCandidateTextbookCorpus } = await importFromApp('src/lib/runtime-release-textbook-candidate-smoke.ts');
const { selectRelationsForDb, validateRuntimeNodes } = await importFromApp('scripts/db/seed-all-knowledge.mjs');
const lessonsRoot = path.join(runtimeRoot, 'lessons');
let mediaPath = '';
for (const lesson of await readdir(lessonsRoot, { withFileTypes: true })) {
  if (!lesson.isDirectory()) continue;
  const mediaDirectory = path.join(lessonsRoot, lesson.name, 'media');
  let mediaIndexes: string[];
  try {
    mediaIndexes = (await readdir(mediaDirectory))
      .filter((entry) => entry.endsWith('-media.md'))
      .sort();
  } catch {
    continue;
  }
  for (const mediaIndex of mediaIndexes) {
    const document = parseRuntimeLessonMediaDocument(
      await readFile(path.join(mediaDirectory, mediaIndex), 'utf8'),
    );
    for (const resource of document.mediaResources) {
      if (path.posix.basename(resource.filename) !== resource.filename || resource.filename.includes('\\')) {
        continue;
      }
      try {
        if (!(await stat(path.join(mediaDirectory, resource.filename))).isFile()) continue;
      } catch {
        continue;
      }
      mediaPath = `lessons/${lesson.name}/media/${resource.filename}`;
      break;
    }
    if (mediaPath) break;
  }
  if (mediaPath) break;
}
if (!mediaPath) throw new Error('candidate runtime has no parser-resolved media object');

const knowledgeRoot = path.join(runtimeRoot, 'knowledge', 'graph');
const nodes = JSON.parse(await readFile(path.join(knowledgeRoot, 'nodes.json'), 'utf8'));
const relations = (await readFile(path.join(knowledgeRoot, 'relations.jsonl'), 'utf8'))
  .split(/\r?\n/)
  .filter(Boolean)
  .map((line) => JSON.parse(line));
validateRuntimeNodes(nodes);
const relationSelection = selectRelationsForDb(
  relations,
  new Set(nodes.map((node: { id: string }) => node.id)),
);
if (relationSelection.selectedRelations.size === 0) {
  throw new Error('candidate runtime has no database-ready knowledge relations');
}

await smokeCandidateTextbookCorpus({
  runtimeRoot,
  textbookRoot: process.env.ACT_RUNTIME_CANDIDATE_TEXTBOOK_ROOT,
  indexRoot: process.env.ACT_RUNTIME_CANDIDATE_INDEX_ROOT,
});

console.log(JSON.stringify({ mediaPath }));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
TS
  )"; then
    echo "ERROR: candidate media, knowledge, or textbook consumer smoke failed" >&2
    return 1
  fi
  if ! candidate_media_runtime_path="$(python3 -c '
import json
import re
import sys
value = json.load(sys.stdin).get("mediaPath")
if not isinstance(value, str) or not re.fullmatch(r"lessons/[A-Za-z0-9][A-Za-z0-9._-]*/media/[A-Za-z0-9][A-Za-z0-9._-]*", value):
    raise SystemExit(1)
print(value)
' <<<"$candidate_result")"; then
    echo "ERROR: candidate media consumer smoke returned an invalid runtime path" >&2
    return 1
  fi
}

run_active_media_resolver_smoke() {
  local encoded_path response_status resolver_url
  [[ "$candidate_media_runtime_path" =~ ^lessons/[A-Za-z0-9][A-Za-z0-9._-]*/media/[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || {
    echo "ERROR: candidate media resolver smoke path is invalid" >&2
    return 1
  }
  [[ "${ACT_RUNTIME_BLOB_MEDIA_SMOKE_FAIL:-0}" != "1" ]] || {
    echo "ERROR: candidate media resolver smoke was fault-injected to fail" >&2
    return 1
  }
  encoded_path="$(python3 -c 'import sys; from urllib.parse import quote; print(quote(sys.argv[1], safe="/"))' "$candidate_media_runtime_path")"
  resolver_url="http://127.0.0.1:${APP_PORT}/api/course-runtime/assets/${encoded_path}"
  response_status="$(curl --connect-timeout 2 --max-time 20 --range 0-0 --silent --show-error --output /dev/null --write-out '%{http_code}' --max-redirs 0 "$resolver_url")" || {
    echo "ERROR: active media resolver smoke request failed" >&2
    return 1
  }
  [[ "$response_status" == "307" ]] || {
    echo "ERROR: active media resolver did not return a private signed redirect" >&2
    return 1
  }
  curl --connect-timeout 2 --max-time 20 --range 0-0 --fail --silent --show-error --location --max-redirs 3 \
    --output /dev/null "$resolver_url" || {
      echo "ERROR: active media signed redirect smoke failed" >&2
      return 1
    }
}

capture_rollback_image() {
  local image
  if podman container exists "$APP_CONTAINER"; then
    image="$(podman inspect --format '{{.Image}}' "$APP_CONTAINER")"
  else
    [[ -f "$ENV_FILE" && ! -L "$ENV_FILE" ]] || {
      echo "ERROR: existing app container and persisted runtime environment are both unavailable" >&2
      exit 1
    }
    image="$(grep -E '^APP_IMAGE=(sha256:)?[a-f0-9]{64}$' "$ENV_FILE" | sed -n '$s/^APP_IMAGE=//p')"
    [[ -n "$image" ]] || {
      echo "ERROR: persisted runtime environment does not contain a valid app image digest" >&2
      exit 1
    }
    echo "WARN: existing app container is unavailable; using persisted runtime image for recovery" >&2
  fi
  [[ "$image" =~ ^(sha256:)?([a-f0-9]{64})$ ]] || { echo "ERROR: existing app image digest is invalid" >&2; exit 1; }
  rollback_app_image="sha256:${BASH_REMATCH[2]}"
  podman image exists "$rollback_app_image" || {
    echo "ERROR: persisted app image is unavailable on this host" >&2
    exit 1
  }
}

# Host-side knowledge overlays (v0.18 current.json and cutover payloads) live
# as regular files on the active view. Rematerialize rebuilds the Git/blob
# forest and would otherwise replace those pointers with the Git v0.9 leaves.
# Copy the declared selector allowlist plus the sealed payload closure each
# selector binds, never textbook retrieval caches or other runtime data, then
# re-verify before consumers switch.
restore_parent_host_overlays() {
  local parent="$1"
  local candidate="$2"
  [[ -n "$parent" && -d "$parent" && ! -L "$parent" ]] || return 0
  [[ -n "$candidate" && -d "$candidate" && ! -L "$candidate" ]] || {
    echo "ERROR: candidate view is missing for overlay restore" >&2
    return 1
  }
  python3 "$HOST_STATE_SCRIPT" restore-overlays \
    --parent-runtime-root "$parent" \
    --candidate-runtime-root "$candidate" >/dev/null
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
  if [[ "$release_id" == "$old_active" ]]; then
    # Same-identity host view repair must not enter begin-publish/set-desired;
    # those transitions reject an identity that already occupies active.
    return 0
  fi
  desired_id="$(python3 -c 'import json,sys; print((json.load(sys.stdin)["desired"] or {}).get("releaseId", ""))' <<<"$snapshot")"
  if [[ -n "$desired_id" && "$desired_id" != "$release_id" ]]; then
    echo "ERROR: v2 lifecycle already records a different desired release" >&2
    exit 1
  fi
  if [[ "$desired_id" != "$release_id" ]]; then
    publishing_has_candidate="$(python3 -c 'import json,sys; state=json.load(sys.stdin); print("1" if any(item["releaseId"] == sys.argv[1] for item in state["publishing"]) else "0")' "$release_id" <<<"$snapshot")"
    coordinated_args=()
    if [[ -n "$COORDINATED_CUTOVER_DECLARATION" ]]; then
      coordinated_args+=(--coordinated-cutover "$COORDINATED_CUTOVER_DECLARATION")
    fi
    if [[ "$publishing_has_candidate" == "1" ]]; then
      snapshot="$(python3 "$LIFECYCLE_SCRIPT" set-desired \
        --state-dir "$STATE_DIR" \
        --expected-generation "$lifecycle_generation" \
        --identity "$lifecycle_identity" \
        "${coordinated_args[@]}")"
    else
      snapshot="$(python3 "$LIFECYCLE_SCRIPT" begin-publish \
        --state-dir "$STATE_DIR" \
        --expected-generation "$lifecycle_generation" \
        --identity "$lifecycle_identity")"
      next_generation="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["generation"])' <<<"$snapshot")"
      snapshot="$(python3 "$LIFECYCLE_SCRIPT" set-desired \
        --state-dir "$STATE_DIR" \
        --expected-generation "$next_generation" \
        --identity "$lifecycle_identity" \
        "${coordinated_args[@]}")"
    fi
  fi
  lifecycle_generation="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["generation"])' <<<"$snapshot")"
}

write_candidate_readyz_receipt() {
  local manifest_sha tree_sha
  if [[ "$release_id" == "$old_active" ]]; then
    candidate_receipt_path="$STATE_DIR/act-runtime-active-receipt.json"
    return 0
  fi
  manifest_sha="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8"))["manifestSha256"])' "$lifecycle_identity")"
  tree_sha="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1], encoding="utf-8"))["treeSha256"])' "$lifecycle_identity")"
  candidate_receipt_dir="$(mktemp -d "$STATE_DIR/.act-runtime-candidate-receipt.XXXXXX")"
  chmod 0755 "$candidate_receipt_dir"
  python3 "$HOST_STATE_SCRIPT" candidate-readyz-receipt \
    --state-dir "$STATE_DIR" \
    --release-id "$release_id" \
    --manifest-sha256 "$manifest_sha" \
    --tree-sha256 "$tree_sha" \
    --receipt-dir "$candidate_receipt_dir" >/dev/null
  candidate_receipt_path="$candidate_receipt_dir/act-runtime-active-receipt.json"
}

restore_rebuild_backup() {
  [[ -n "${rebuild_backup:-}" && -d "$rebuild_backup" ]] || return 0
  local final_view="$VIEW_ROOT/views/$release_id"
  local failed_view="$VIEW_ROOT/views/.$release_id.failed-rebuild"
  if findmnt -rn -M "$final_view/.act-runtime-blobs" >/dev/null 2>&1; then
    umount "$final_view/.act-runtime-blobs" >/dev/null 2>&1 || true
  fi
  if [[ -e "$final_view" || -L "$final_view" ]]; then
    if findmnt -rn -M "$failed_view/.act-runtime-blobs" >/dev/null 2>&1; then
      umount "$failed_view/.act-runtime-blobs" >/dev/null 2>&1 || true
    fi
    rm -rf -- "$failed_view"
    mv "$final_view" "$failed_view" || true
  fi
  mv "$rebuild_backup" "$final_view" || true
  rebuild_backup=""
  if [[ -d "$final_view" ]]; then
    ensure_helper_mount "$final_view/.act-runtime-blobs" || true
  fi
  if [[ "$candidate_deploy_attempted" == "1" && -d "$failed_view" ]]; then
    rebuild_failed="$failed_view"
  elif [[ -d "$failed_view" ]]; then
    if findmnt -rn -M "$failed_view/.act-runtime-blobs" >/dev/null 2>&1; then
      umount "$failed_view/.act-runtime-blobs" >/dev/null 2>&1 || true
    fi
    rm -rf -- "$failed_view"
  fi
}

cleanup_rebuild_failed() {
  [[ -n "${rebuild_failed:-}" && -d "$rebuild_failed" ]] || return 0
  if findmnt -rn -M "$rebuild_failed/.act-runtime-blobs" >/dev/null 2>&1; then
    umount "$rebuild_failed/.act-runtime-blobs" >/dev/null 2>&1 || true
  fi
  rm -rf -- "$rebuild_failed"
  rebuild_failed=""
}

cleanup_lifecycle_identity() {
  if [[ -n "$lifecycle_identity" && -f "$lifecycle_identity" ]]; then
    rm -f -- "$lifecycle_identity"
  fi
  if [[ -n "${overlay_stash:-}" && -d "$overlay_stash" ]]; then
    rm -rf -- "$overlay_stash"
  fi
  if [[ -n "${rebuild_staging:-}" && -d "$rebuild_staging" ]]; then
    if findmnt -rn -M "$rebuild_staging/.act-runtime-blobs" >/dev/null 2>&1; then
      umount "$rebuild_staging/.act-runtime-blobs" >/dev/null 2>&1 || true
    fi
    rm -rf -- "$rebuild_staging"
  fi
  if [[ -n "${rebuild_backup:-}" && -d "$rebuild_backup" && "$post_activation_media_smoke_passed" != "1" ]]; then
    restore_rebuild_backup
  fi
  if [[ -n "${candidate_receipt_dir:-}" && -d "$candidate_receipt_dir" ]] && \
    { [[ "$candidate_deploy_attempted" != "1" ]] || [[ "$candidate_receipt_rebound" == "1" ]]; }; then
    rm -rf -- "$candidate_receipt_dir"
    candidate_receipt_dir=""
  fi
}

trap cleanup_lifecycle_identity EXIT

restore_runtime_consumers() {
  local status=$?
  set +e
  local restored_rebuild=0
  local recovery_receipt_rebound=0
  if [[ -n "${rebuild_backup:-}" && -d "$rebuild_backup" ]]; then
    restore_rebuild_backup
    restored_rebuild=1
  fi
  python3 "$ACTIVATION_TRANSACTION" recover \
    --state-dir "$STATE_DIR" \
    --lifecycle-script "$LIFECYCLE_SCRIPT" \
    --host-state-script "$HOST_STATE_SCRIPT" >/dev/null 2>&1 || true
  local lifecycle_state lifecycle_active_release
  lifecycle_state="$(python3 "$LIFECYCLE_SCRIPT" inspect --state-dir "$STATE_DIR" 2>/dev/null || true)"
  lifecycle_active_release="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["active"]["releaseId"])' <<<"$lifecycle_state" 2>/dev/null || true)"
  if [[ "$candidate_deploy_attempted" == "1" && "$activation_attempted" == "1" && "$post_activation_media_smoke_passed" != "1" && "$lifecycle_active_release" == "$release_id" ]]; then
    local rollback_generation
    rollback_generation="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["generation"])' <<<"$lifecycle_state" 2>/dev/null || true)"
    if [[ "$rollback_generation" =~ ^[0-9]+$ ]]; then
      python3 "$ACTIVATION_TRANSACTION" rollback \
        --state-dir "$STATE_DIR" \
        --lifecycle-script "$LIFECYCLE_SCRIPT" \
        --host-state-script "$HOST_STATE_SCRIPT" \
        --expected-generation "$rollback_generation" >/dev/null 2>&1 || \
        echo "ERROR: candidate media smoke failed and lifecycle rollback could not complete" >&2
      lifecycle_state="$(python3 "$LIFECYCLE_SCRIPT" inspect --state-dir "$STATE_DIR" 2>/dev/null || true)"
      lifecycle_active_release="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["active"]["releaseId"])' <<<"$lifecycle_state" 2>/dev/null || true)"
    fi
  fi
  if [[ "$candidate_current_selected" == "1" && "$lifecycle_active_release" != "$release_id" && -n "$parent_view" && "$old_active" != "none" ]]; then
    python3 "$MATERIALIZER" select --release-id "$old_active" --view-root "$VIEW_ROOT" >/dev/null || \
      echo "ERROR: candidate current view could not be restored to the previous release" >&2
  fi
  if [[ "$candidate_deploy_attempted" == "1" ]]; then
    if [[ "$lifecycle_active_release" != "$release_id" && -n "$parent_view" ]]; then
      RUNTIME_DELIVERY_MODE=ossfs-blob-view \
        ACT_RUNTIME_OSS_RAM_ROLE="$ram_role" \
        ACT_RUNTIME_ACTIVE_RECEIPT_PATH="$STATE_DIR/act-runtime-active-receipt.json" \
        RUNTIME_CONTENT_DIR="$VIEW_ROOT/current" \
      APP_IMAGE="$rollback_app_image" \
        "$DEPLOY_SCRIPT" --runtime-cutover-app-only 9>&- && recovery_receipt_rebound=1
    elif [[ "$lifecycle_active_release" != "$release_id" ]]; then
      RUNTIME_DELIVERY_MODE=legacy-rsync \
        ACT_RUNTIME_ACTIVE_RECEIPT_PATH="$STATE_DIR/act-runtime-active-receipt.json" \
        RUNTIME_CONTENT_DIR="$LEGACY_RUNTIME_ROOT" \
      APP_IMAGE="$rollback_app_image" \
        "$DEPLOY_SCRIPT" --runtime-cutover-app-only 9>&- && recovery_receipt_rebound=1
    elif [[ "$restored_rebuild" == "1" ]]; then
      if RUNTIME_DELIVERY_MODE=ossfs-blob-view \
        ACT_RUNTIME_OSS_RAM_ROLE="$ram_role" \
        ACT_RUNTIME_ACTIVE_RECEIPT_PATH="$STATE_DIR/act-runtime-active-receipt.json" \
        RUNTIME_CONTENT_DIR="$VIEW_ROOT/current" \
        APP_IMAGE="$rollback_app_image" \
        "$DEPLOY_SCRIPT" --runtime-cutover-app-only 9>&-; then
        recovery_receipt_rebound=1
        cleanup_rebuild_failed
      fi
    fi
  fi
  if [[ "$recovery_receipt_rebound" == "1" ]]; then
    candidate_receipt_rebound=1
  elif [[ -n "${candidate_receipt_dir:-}" && -d "$candidate_receipt_dir" ]]; then
    echo "WARN: candidate readiness receipt is retained because canonical receipt rebind did not complete" >&2
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

if [[ -n "$parent_view" && "$parent_view" == "$VIEW_ROOT/views/$release_id" ]]; then
  replace_existing=1
fi
prepare_args=(prepare --manifest "$manifest" --receipt "$release_receipt" --blob-root "$BLOB_ROOT" --view-root "$VIEW_ROOT" --cache-textbook-retrieval)
if [[ "$replace_existing" == "1" ]]; then
  prepare_args+=(--replace-existing)
fi
overlay_source="$parent_view"
overlay_stash=""
if [[ -n "$parent_view" && "$parent_view" == "$VIEW_ROOT/views/$release_id" ]]; then
  overlay_stash="$(mktemp -d "$STATE_DIR/.act-runtime-overlay-stash.XXXXXX")"
  restore_parent_host_overlays "$parent_view" "$overlay_stash"
  overlay_source="$overlay_stash"
elif [[ -n "$parent_view" ]]; then
  prepare_args+=(--parent-view "$parent_view")
fi
prepare_result="$(python3 "$MATERIALIZER" "${prepare_args[@]}")"
candidate_view="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["viewPath"])' <<<"$prepare_result")"
if python3 -c 'import json,sys; raise SystemExit(0 if json.load(sys.stdin).get("rebuilt") else 1)' <<<"$prepare_result"; then
  rebuild_staging="$candidate_view"
fi
[[ -n "$candidate_view" && -d "$candidate_view" && ! -L "$candidate_view" ]] || {
  echo "ERROR: materializer did not return a candidate view" >&2
  exit 1
}
ensure_helper_mount "$candidate_view/.act-runtime-blobs"
if [[ -n "${overlay_source:-}" ]]; then
  restore_parent_host_overlays "$overlay_source" "$candidate_view"
fi
if [[ -n "$overlay_stash" ]]; then
  rm -rf -- "$overlay_stash"
fi

verify_args=(verify-mounted --format v2 --runtime-root "$candidate_view" --blob-root "$candidate_view/.act-runtime-blobs" --release-id "$release_id" --verification-receipt "$verification_receipt")
if [[ -n "$parent_view" && "$parent_view" != "$candidate_view" ]]; then
  verify_args+=(--parent-runtime-root "$parent_view")
fi
python3 "$HOST_STATE_SCRIPT" "${verify_args[@]}" >/dev/null
if [[ -n "$rebuild_staging" ]]; then
  final_view="$VIEW_ROOT/views/$release_id"
  backup_view="$VIEW_ROOT/views/.$release_id.replaced"
  [[ "$rebuild_staging" != "$final_view" && -d "$rebuild_staging" ]] || {
    echo "ERROR: rebuild staging view is invalid" >&2
    exit 1
  }
  if findmnt -rn -M "$final_view/.act-runtime-blobs" >/dev/null 2>&1; then
    umount "$final_view/.act-runtime-blobs" || {
      echo "ERROR: could not unmount the live runtime helper before rebuild swap" >&2
      exit 1
    }
  fi
  [[ ! -e "$backup_view" ]] || {
    echo "ERROR: rebuild backup view already exists" >&2
    exit 1
  }
  mv "$final_view" "$backup_view"
  rebuild_backup="$backup_view"
  mv "$rebuild_staging" "$final_view"
  rebuild_staging=""
  candidate_view="$final_view"
  ensure_helper_mount "$candidate_view/.act-runtime-blobs"
fi
write_lifecycle_identity "$candidate_view/.act-runtime-release.v2.json"
stage_lifecycle_desired
python3 "$HOST_STATE_SCRIPT" select \
  --state-dir "$STATE_DIR" \
  --expected-active-release "$expected_active_release" \
  --verification-receipt "$verification_receipt" >/dev/null
write_candidate_readyz_receipt
trap restore_runtime_consumers ERR
python3 "$MATERIALIZER" select --release-id "$release_id" --view-root "$VIEW_ROOT" >/dev/null
candidate_current_selected=1
candidate_deploy_attempted=1
RUNTIME_DELIVERY_MODE=ossfs-blob-view \
  ACT_RUNTIME_OSS_RAM_ROLE="$ram_role" \
  ACT_RUNTIME_ACTIVE_RECEIPT_PATH="$candidate_receipt_path" \
  RUNTIME_CONTENT_DIR="$VIEW_ROOT/current" \
  APP_IMAGE="$rollback_app_image" \
  "$DEPLOY_SCRIPT" --runtime-cutover-app-only 9>&-
source "$ENV_FILE"
wait_for_readyz
run_candidate_consumer_smoke
if [[ "$release_id" == "$old_active" ]]; then
  activation_state="$(python3 "$LIFECYCLE_SCRIPT" inspect --state-dir "$STATE_DIR")"
  activation_generation="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["generation"])' <<<"$activation_state")"
  activation_release="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["active"]["releaseId"])' <<<"$activation_state")"
  [[ "$activation_release" == "$release_id" && "$activation_generation" =~ ^[0-9]+$ ]] || {
    echo "ERROR: same-identity repair did not keep the active lifecycle identity" >&2
    exit 1
  }
else
  activation_attempted=1
  coordinated_activation_args=()
  if [[ -n "$COORDINATED_GRAPH_RECEIPT" ]]; then
    coordinated_activation_args+=(--coordinated-graph-receipt "$COORDINATED_GRAPH_RECEIPT")
  fi
  if [[ -n "$COORDINATED_RUNTIME_BINDING" ]]; then
    coordinated_activation_args+=(--coordinated-runtime-binding "$COORDINATED_RUNTIME_BINDING")
  fi
  python3 "$ACTIVATION_TRANSACTION" activate \
    --state-dir "$STATE_DIR" \
    --lifecycle-script "$LIFECYCLE_SCRIPT" \
    --host-state-script "$HOST_STATE_SCRIPT" \
    --expected-generation "$lifecycle_generation" \
    --identity "$lifecycle_identity" \
    "${coordinated_activation_args[@]}" >/dev/null
  activation_state="$(python3 "$LIFECYCLE_SCRIPT" inspect --state-dir "$STATE_DIR")"
  activation_generation="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["generation"])' <<<"$activation_state")"
  activation_release="$(python3 -c 'import json,sys; print(json.load(sys.stdin)["active"]["releaseId"])' <<<"$activation_state")"
  [[ "$activation_release" == "$release_id" && "$activation_generation" =~ ^[0-9]+$ ]] || {
    echo "ERROR: lifecycle activation did not commit the candidate release" >&2
    exit 1
  }
fi
if [[ -n "$candidate_receipt_dir" ]]; then
  RUNTIME_DELIVERY_MODE=ossfs-blob-view \
    ACT_RUNTIME_OSS_RAM_ROLE="$ram_role" \
    ACT_RUNTIME_ACTIVE_RECEIPT_PATH="$STATE_DIR/act-runtime-active-receipt.json" \
    RUNTIME_CONTENT_DIR="$VIEW_ROOT/current" \
    APP_IMAGE="$rollback_app_image" \
    "$DEPLOY_SCRIPT" --runtime-cutover-app-only 9>&-
  source "$ENV_FILE"
  wait_for_readyz
  candidate_receipt_rebound=1
fi
run_active_media_resolver_smoke
post_activation_media_smoke_passed=1
if [[ -n "${rebuild_backup:-}" && -d "$rebuild_backup" ]]; then
  rm -rf -- "$rebuild_backup"
  rebuild_backup=""
fi
trap - ERR
cleanup_lifecycle_identity
printf '{"releaseId":"%s","previousActiveRelease":"%s","runtimeDeliveryMode":"ossfs-blob-view"}\n' "$release_id" "$old_active"
