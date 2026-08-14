#!/usr/bin/env bash
set -euo pipefail

# Publish an immutable v2 runtime release from the checked-in Git tree, then
# activate only its runtime consumers. Credentials remain in the caller's
# local credential provider; this script accepts no access-key material.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
CLI="${ACT_RUNTIME_RELEASE_CLI:-$ROOT_DIR/scripts/runtime-release/act-runtime-release.ts}"
LOCAL_BRIDGE="${ACT_RUNTIME_LOCAL_PUBLISH_BRIDGE:-$ROOT_DIR/scripts/runtime-release/runtime-release-oss-publisher-bridge.py}"
SSH_TARGET="${SSH_TARGET:-root@121.40.124.135}"
KNOWN_HOSTS_FILE="${ACT_RUNTIME_SSH_KNOWN_HOSTS_FILE:-}"
REMOTE_PROJECT_DIR="${REMOTE_PROJECT_DIR:-/home/projects/act}"
REMOTE_RUNTIME_RELEASE_DIR="${REMOTE_RUNTIME_RELEASE_DIR:-$REMOTE_PROJECT_DIR/scripts/runtime-release}"
REMOTE_ARTIFACT_ROOT="${REMOTE_RUNTIME_ARTIFACT_ROOT:-$REMOTE_PROJECT_DIR/data/runtime/releases}"
REMOTE_HOST_STATE="${REMOTE_RUNTIME_HOST_STATE_SCRIPT:-$REMOTE_PROJECT_DIR/scripts/runtime-release-host-state.py}"
REMOTE_MATERIALIZER="${REMOTE_RUNTIME_BLOB_MATERIALIZER:-$REMOTE_PROJECT_DIR/scripts/materialize-runtime-blob-release.py}"
REMOTE_ACTIVATOR="${REMOTE_RUNTIME_BLOB_ACTIVATOR:-$REMOTE_PROJECT_DIR/scripts/activate-runtime-blob-release.sh}"
REMOTE_APP_DEPLOY="${REMOTE_APP_DEPLOY_SCRIPT:-$REMOTE_PROJECT_DIR/scripts/4-deploy.sh}"
BUCKET="${ACT_OSS_BUCKET:-act-course-assets}"

source_revision=""
parent_manifest=""
artifact_dir=""
expected_active_release=""
ram_role="${ACT_RUNTIME_OSS_RAM_ROLE:-act-runtime-oss-read}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source-revision) source_revision="$2"; shift 2 ;;
    --parent-manifest) parent_manifest="$2"; shift 2 ;;
    --artifact-dir) artifact_dir="$2"; shift 2 ;;
    --expected-active-release) expected_active_release="$2"; shift 2 ;;
    --ram-role) ram_role="$2"; shift 2 ;;
    *) echo "ERROR: unknown argument: $1" >&2; exit 1 ;;
  esac
done

[[ "$source_revision" =~ ^[a-f0-9]{40}$ ]] || { echo "ERROR: --source-revision must be a full Git SHA" >&2; exit 1; }
[[ -n "$artifact_dir" && "$artifact_dir" = /* ]] || { echo "ERROR: --artifact-dir must be an absolute local directory" >&2; exit 1; }
[[ "$expected_active_release" == "none" || "$expected_active_release" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]] || { echo "ERROR: invalid --expected-active-release" >&2; exit 1; }
[[ "$ram_role" =~ ^[A-Za-z0-9_+=,.@-]{1,128}$ ]] || { echo "ERROR: invalid --ram-role" >&2; exit 1; }
[[ -z "$parent_manifest" || -f "$parent_manifest" ]] || { echo "ERROR: --parent-manifest does not exist" >&2; exit 1; }
[[ -n "$KNOWN_HOSTS_FILE" && -f "$KNOWN_HOSTS_FILE" ]] || { echo "ERROR: ACT_RUNTIME_SSH_KNOWN_HOSTS_FILE is required" >&2; exit 1; }
[[ "$BUCKET" =~ ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$ ]] || { echo "ERROR: invalid ACT_OSS_BUCKET" >&2; exit 1; }
for remote_path in \
  "$REMOTE_PROJECT_DIR" \
  "$REMOTE_RUNTIME_RELEASE_DIR" \
  "$REMOTE_ARTIFACT_ROOT" \
  "$REMOTE_HOST_STATE" \
  "$REMOTE_MATERIALIZER" \
  "$REMOTE_ACTIVATOR" \
  "$REMOTE_APP_DEPLOY"; do
  [[ "$remote_path" =~ ^/[A-Za-z0-9._/-]+$ ]] || { echo "ERROR: remote path is unsafe: $remote_path" >&2; exit 1; }
done
for command in git npx python3 ssh scp; do
  command -v "$command" >/dev/null 2>&1 || { echo "ERROR: missing command: $command" >&2; exit 1; }
done
for file in "$CLI" "$LOCAL_BRIDGE"; do
  [[ -f "$file" && ! -L "$file" ]] || { echo "ERROR: required local tool is missing: $file" >&2; exit 1; }
done
for variable in \
  ACT_RUNTIME_LOCAL_PYTHON \
  ACT_RUNTIME_LOCAL_OSSUTIL \
  ACT_RUNTIME_LOCAL_OSSUTIL_SHA256 \
  ACT_RUNTIME_LOCAL_IDENTITY_COMMAND \
  ACT_RUNTIME_LOCAL_IDENTITY_COMMAND_SHA256 \
  ACT_RUNTIME_OPERATOR_ACCOUNT_ID \
  ACT_RUNTIME_OPERATOR_PRINCIPAL_ARN \
  ACT_RUNTIME_PUBLISH_LOCK_DIR \
  ACT_RUNTIME_PUBLISH_SPOOL_DIR; do
  [[ -n "${!variable:-}" ]] || { echo "ERROR: local publisher configuration is missing: $variable" >&2; exit 1; }
done

mkdir -p "$artifact_dir"
manifest="$artifact_dir/manifest.json"
release_receipt="$artifact_dir/release-receipt.json"
verification_receipt="$artifact_dir/publisher-verification.json"
build_args=(build-manifest --repo-root "$ROOT_DIR" --source-revision "$source_revision" --format v2 --output "$manifest" --receipt-output "$release_receipt")
if [[ -n "$parent_manifest" ]]; then
  build_args+=(--parent-manifest "$parent_manifest")
fi
npx tsx "$CLI" "${build_args[@]}" >/dev/null
release_id="$(python3 - "$manifest" <<'PY'
import json
import sys

with open(sys.argv[1], encoding='utf-8') as handle:
    print(json.load(handle)['releaseId'])
PY
)"

if [[ -n "$parent_manifest" ]]; then
  parent_release_id="$(python3 - "$manifest" "$parent_manifest" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as candidate_handle:
    candidate = json.load(candidate_handle)
with open(sys.argv[2], encoding="utf-8") as parent_handle:
    parent = json.load(parent_handle)
for field in ("treeSha256", "fileCount", "totalBytes"):
    if candidate.get(field) != parent.get(field):
        sys.exit(0)
print(parent["releaseId"])
PY
  )"
  if [[ -n "$parent_release_id" ]]; then
    printf '{"releaseId":"%s","noRuntimeChange":true}\n' "$parent_release_id"
    exit 0
  fi
fi

publish_args=(
  publish-streaming --repo-root "$ROOT_DIR" --source-revision "$source_revision" --release-id "$release_id" --format v2 --bucket "$BUCKET"
  --local-bridge-path "$LOCAL_BRIDGE" --python-binary "$ACT_RUNTIME_LOCAL_PYTHON"
  --ossutil-path "$ACT_RUNTIME_LOCAL_OSSUTIL" --ossutil-sha256 "$ACT_RUNTIME_LOCAL_OSSUTIL_SHA256"
  --identity-command-path "$ACT_RUNTIME_LOCAL_IDENTITY_COMMAND" --identity-command-sha256 "$ACT_RUNTIME_LOCAL_IDENTITY_COMMAND_SHA256"
  --operator-account-id "$ACT_RUNTIME_OPERATOR_ACCOUNT_ID" --operator-principal-arn "$ACT_RUNTIME_OPERATOR_PRINCIPAL_ARN"
  --lock-dir "$ACT_RUNTIME_PUBLISH_LOCK_DIR" --spool-dir "$ACT_RUNTIME_PUBLISH_SPOOL_DIR" --output "$verification_receipt"
)
if [[ -n "$parent_manifest" ]]; then
  publish_args+=(--parent-manifest "$parent_manifest")
fi
if [[ -n "${ACT_RUNTIME_CREDENTIAL_PROFILE:-}" ]]; then
  publish_args+=(--credential-profile "$ACT_RUNTIME_CREDENTIAL_PROFILE")
fi
npx tsx "$CLI" "${publish_args[@]}" >/dev/null

remote() {
  ssh -o BatchMode=yes -o UserKnownHostsFile="$KNOWN_HOSTS_FILE" -o StrictHostKeyChecking=yes "$SSH_TARGET" "$@"
}
copy_atomic() {
  local local_path="$1"
  local remote_path="$2"
  scp -q -o BatchMode=yes -o UserKnownHostsFile="$KNOWN_HOSTS_FILE" -o StrictHostKeyChecking=yes "$local_path" "$SSH_TARGET:${remote_path}.tmp"
  remote "chmod 0755 '${remote_path}.tmp' && mv '${remote_path}.tmp' '${remote_path}'"
}

remote "mkdir -p '$REMOTE_RUNTIME_RELEASE_DIR' '$REMOTE_ARTIFACT_ROOT/$release_id' '$(dirname "$REMOTE_HOST_STATE")' '$(dirname "$REMOTE_MATERIALIZER")' '$(dirname "$REMOTE_ACTIVATOR")' '$(dirname "$REMOTE_APP_DEPLOY")'"
copy_atomic "$ROOT_DIR/scripts/runtime-release/runtime-release-host-state.py" "$REMOTE_HOST_STATE"
copy_atomic "$ROOT_DIR/scripts/runtime-release/materialize-runtime-blob-release.py" "$REMOTE_MATERIALIZER"
copy_atomic "$ROOT_DIR/scripts/runtime-release/activate-runtime-blob-release.sh" "$REMOTE_ACTIVATOR"
copy_atomic "$ROOT_DIR/deploy/podman/deploy.sh" "$REMOTE_APP_DEPLOY"
for name in manifest.json release-receipt.json publisher-verification.json; do
  scp -q -o BatchMode=yes -o UserKnownHostsFile="$KNOWN_HOSTS_FILE" -o StrictHostKeyChecking=yes "$artifact_dir/$name" "$SSH_TARGET:$REMOTE_ARTIFACT_ROOT/$release_id/$name.tmp"
  remote "chmod 0600 '$REMOTE_ARTIFACT_ROOT/$release_id/$name.tmp' && mv '$REMOTE_ARTIFACT_ROOT/$release_id/$name.tmp' '$REMOTE_ARTIFACT_ROOT/$release_id/$name'"
done

remote "'$REMOTE_ACTIVATOR' --release-id '$release_id' --expected-active-release '$expected_active_release' --manifest '$REMOTE_ARTIFACT_ROOT/$release_id/manifest.json' --release-receipt '$REMOTE_ARTIFACT_ROOT/$release_id/release-receipt.json' --verification-receipt '$REMOTE_ARTIFACT_ROOT/$release_id/publisher-verification.json' --ram-role '$ram_role'"
printf '{"releaseId":"%s","artifactDir":"%s","runtimeDeliveryMode":"ossfs-blob-view"}\n' "$release_id" "$artifact_dir"
