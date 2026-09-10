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
REMOTE_READ_BRIDGE="${REMOTE_RUNTIME_READ_BRIDGE:-$REMOTE_RUNTIME_RELEASE_DIR/runtime-release-oss-publisher-bridge.py}"
REMOTE_ARTIFACT_ROOT="${REMOTE_RUNTIME_ARTIFACT_ROOT:-$REMOTE_PROJECT_DIR/data/runtime/releases}"
REMOTE_RUNTIME_VIEW_ROOT="${REMOTE_RUNTIME_BLOB_VIEW_ROOT:-$REMOTE_PROJECT_DIR/data/runtime/blob-views}"
REMOTE_HOST_STATE="${REMOTE_RUNTIME_HOST_STATE_SCRIPT:-$REMOTE_PROJECT_DIR/scripts/runtime-release-host-state.py}"
REMOTE_MATERIALIZER="${REMOTE_RUNTIME_BLOB_MATERIALIZER:-$REMOTE_PROJECT_DIR/scripts/materialize-runtime-blob-release.py}"
REMOTE_LIFECYCLE="${REMOTE_RUNTIME_BLOB_LIFECYCLE_SCRIPT:-$REMOTE_PROJECT_DIR/scripts/runtime-release/runtime-blob-release-lifecycle.py}"
REMOTE_ACTIVATION_TRANSACTION="${REMOTE_RUNTIME_BLOB_ACTIVATION_TRANSACTION:-$REMOTE_PROJECT_DIR/scripts/runtime-release/runtime-blob-activation-transaction.py}"
REMOTE_ACTIVATOR="${REMOTE_RUNTIME_BLOB_ACTIVATOR:-$REMOTE_PROJECT_DIR/scripts/activate-runtime-blob-release.sh}"
REMOTE_APP_DEPLOY="${REMOTE_APP_DEPLOY_SCRIPT:-$REMOTE_PROJECT_DIR/scripts/4-deploy.sh}"
BUCKET="${ACT_OSS_BUCKET:-act-course-assets}"

source_revision=""
parent_manifest=""
external_bundle=""
external_bundle_root=""
generated_resources_root=""
artifact_dir=""
resume_artifact_dir=""
expected_active_release=""
matching_parent_release_id=""
ram_role="${ACT_RUNTIME_OSS_RAM_ROLE:-act-runtime-oss-read}"
coordinated_cutover_declaration=""
coordinated_runtime_authorization=""
coordinated_runtime_binding=""
formal_resource_envelope_hash=""
stage_only=0
publishing_identity_started=0
publishing_generation=""
resuming_published_release=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --source-revision) source_revision="$2"; shift 2 ;;
    --parent-manifest) parent_manifest="$2"; shift 2 ;;
    --external-bundle) external_bundle="$2"; shift 2 ;;
    --external-bundle-root) external_bundle_root="$2"; shift 2 ;;
    --generated-resources-root) generated_resources_root="$2"; shift 2 ;;
    --artifact-dir) artifact_dir="$2"; shift 2 ;;
    --resume-published-artifact-dir) resume_artifact_dir="$2"; shift 2 ;;
    --expected-active-release) expected_active_release="$2"; shift 2 ;;
    --ram-role) ram_role="$2"; shift 2 ;;
    --coordinated-cutover-declaration) coordinated_cutover_declaration="$2"; shift 2 ;;
    --coordinated-runtime-authorization) coordinated_runtime_authorization="$2"; shift 2 ;;
    --coordinated-runtime-binding) coordinated_runtime_binding="$2"; shift 2 ;;
    --formal-resource-envelope-hash) formal_resource_envelope_hash="$2"; shift 2 ;;
    --stage-only) stage_only=1; shift ;;
    *) echo "ERROR: unknown argument: $1" >&2; exit 1 ;;
  esac
done

if [[ -n "$resume_artifact_dir" ]]; then
  [[ "$resume_artifact_dir" = /* && -d "$resume_artifact_dir" && ! -L "$resume_artifact_dir" ]] || {
    echo "ERROR: --resume-published-artifact-dir must be an absolute real directory" >&2
    exit 1
  }
  for value in "$source_revision" "$parent_manifest" "$external_bundle" "$external_bundle_root" "$generated_resources_root" "$artifact_dir" "$formal_resource_envelope_hash"; do
    [[ -z "$value" ]] || {
      echo "ERROR: --resume-published-artifact-dir cannot be combined with planning or publication inputs" >&2
      exit 1
    }
  done
  resuming_published_release=1
else
  [[ "$source_revision" =~ ^[a-f0-9]{40}$ ]] || { echo "ERROR: --source-revision must be a full Git SHA" >&2; exit 1; }
  [[ -n "$artifact_dir" && "$artifact_dir" = /* ]] || { echo "ERROR: --artifact-dir must be an absolute local directory" >&2; exit 1; }
fi
if [[ "$stage_only" == "1" && "$resuming_published_release" == "1" ]]; then
  echo "ERROR: --stage-only cannot resume an already published Runtime release" >&2
  exit 1
fi
[[ "$expected_active_release" == "none" || "$expected_active_release" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]] || { echo "ERROR: invalid --expected-active-release" >&2; exit 1; }
[[ "$ram_role" =~ ^[A-Za-z0-9_+=,.@-]{1,128}$ ]] || { echo "ERROR: invalid --ram-role" >&2; exit 1; }
[[ -z "$parent_manifest" || -f "$parent_manifest" ]] || { echo "ERROR: --parent-manifest does not exist" >&2; exit 1; }
[[ -z "$external_bundle" || -f "$external_bundle" ]] || { echo "ERROR: --external-bundle does not exist" >&2; exit 1; }
[[ -z "$external_bundle_root" || -d "$external_bundle_root" ]] || { echo "ERROR: --external-bundle-root does not exist" >&2; exit 1; }
[[ -z "$generated_resources_root" || -d "$generated_resources_root" ]] || { echo "ERROR: --generated-resources-root does not exist" >&2; exit 1; }
if [[ -n "$external_bundle_root" || -n "$generated_resources_root" ]]; then
  [[ -n "$external_bundle" ]] || { echo "ERROR: generated/bundle roots require --external-bundle" >&2; exit 1; }
fi
# Coordinated cutover inputs (#1509) are validated before any publish side
# effect: all three artifacts must be provided together and exist locally.
coordinated_inputs_provided=0
for value in "$coordinated_cutover_declaration" "$coordinated_runtime_authorization" "$coordinated_runtime_binding"; do
  [[ -z "$value" ]] || coordinated_inputs_provided=$((coordinated_inputs_provided + 1))
done
if [[ "$coordinated_inputs_provided" -ne 0 && "$coordinated_inputs_provided" -ne 3 ]]; then
  echo "ERROR: --coordinated-cutover-declaration, --coordinated-runtime-authorization, and --coordinated-runtime-binding must be provided together" >&2
  exit 1
fi
if [[ "$stage_only" == "1" && "$coordinated_inputs_provided" -ne 0 ]]; then
  echo "ERROR: --stage-only publishes a non-selectable Runtime candidate and cannot accept committed coordinated activation artifacts" >&2
  exit 1
fi
if [[ "$coordinated_inputs_provided" -ne 0 ]]; then
  echo "ERROR: coordinated Runtime activation must run inside the stopped-service outer transaction; this publisher only stages non-selectable releases" >&2
  exit 1
fi
if [[ -n "$formal_resource_envelope_hash" && ! "$formal_resource_envelope_hash" =~ ^[a-f0-9]{64}$ ]]; then
  echo "ERROR: --formal-resource-envelope-hash must be a lowercase SHA-256 digest" >&2
  exit 1
fi
for value in "$coordinated_cutover_declaration" "$coordinated_runtime_authorization" "$coordinated_runtime_binding"; do
  [[ -z "$value" || -f "$value" ]] || { echo "ERROR: coordinated cutover input does not exist: $value" >&2; exit 1; }
done
[[ -n "$KNOWN_HOSTS_FILE" && -f "$KNOWN_HOSTS_FILE" ]] || { echo "ERROR: ACT_RUNTIME_SSH_KNOWN_HOSTS_FILE is required" >&2; exit 1; }
[[ "$BUCKET" =~ ^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$ ]] || { echo "ERROR: invalid ACT_OSS_BUCKET" >&2; exit 1; }
for remote_path in \
  "$REMOTE_PROJECT_DIR" \
  "$REMOTE_RUNTIME_RELEASE_DIR" \
  "$REMOTE_READ_BRIDGE" \
  "$REMOTE_ARTIFACT_ROOT" \
  "$REMOTE_RUNTIME_VIEW_ROOT" \
  "$REMOTE_HOST_STATE" \
  "$REMOTE_MATERIALIZER" \
  "$REMOTE_LIFECYCLE" \
  "$REMOTE_ACTIVATION_TRANSACTION" \
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

remote() {
  ssh -o BatchMode=yes -o UserKnownHostsFile="$KNOWN_HOSTS_FILE" -o StrictHostKeyChecking=yes "$SSH_TARGET" "$@"
}

copy_atomic() {
  local local_path="$1"
  local remote_path="$2"
  scp -q -o BatchMode=yes -o UserKnownHostsFile="$KNOWN_HOSTS_FILE" -o StrictHostKeyChecking=yes "$local_path" "$SSH_TARGET:${remote_path}.tmp"
  remote "chmod 0755 '${remote_path}.tmp' && mv '${remote_path}.tmp' '${remote_path}'"
}

if [[ "$resuming_published_release" == "1" ]]; then
  artifact_dir="$resume_artifact_dir"
  manifest="$artifact_dir/manifest.json"
  release_receipt="$artifact_dir/release-receipt.json"
  source_provenance_proof="$artifact_dir/source-provenance-proof.json"
  verification_receipt="$artifact_dir/publisher-verification.json"
  for artifact in "$manifest" "$release_receipt" "$source_provenance_proof" "$verification_receipt"; do
    [[ -f "$artifact" && ! -L "$artifact" ]] || {
      echo "ERROR: published runtime resume artifact is missing or unsafe: $artifact" >&2
      exit 1
    }
  done
  # Learning-content closure gate applies to resumed releases too (#2045): an
  # uploaded-but-unactivated release must not bypass the asset-closure check.
  python3 "$ROOT_DIR/scripts/knowledge/export-authority-learning-content-v2.py" >/dev/null
  node "$ROOT_DIR/scripts/knowledge/check-release-learning-content-closure.mjs" \
    --release-manifest "$manifest" \
    --learning-manifest "$ROOT_DIR/course-content/runtime/knowledge/authority-learning-content-manifest.json"
  source_revision="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["sourceRevision"])' "$manifest")"
  build_elapsed_milliseconds=0
  publish_elapsed_milliseconds=0
else
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
  source_provenance_proof="$artifact_dir/source-provenance-proof.json"
  verification_receipt="$artifact_dir/publisher-verification.json"
  daily_report="$artifact_dir/daily-publication-report.json"
  # Learning-content release gate (#2045): the sealed v2 export must match the
  # committed manifest at the source revision and pass the authority-surface
  # linkage check before any release is built. Failure aborts the publish; the
  # previously activated release is untouched.
  LC_MANIFEST_REL="course-content/runtime/knowledge/authority-learning-content-manifest.json"
  python3 "$ROOT_DIR/scripts/knowledge/export-authority-learning-content-v2.py" >/dev/null
  LC_TMP="$(mktemp "${TMPDIR:-/tmp}/learning-content-manifest.XXXXXX.json")"
  git -C "$ROOT_DIR" show "$source_revision:$LC_MANIFEST_REL" > "$LC_TMP" \
    || { echo "ERROR: $LC_MANIFEST_REL is missing from $source_revision" >&2; rm -f "$LC_TMP"; exit 1; }
  if ! cmp -s "$LC_TMP" "$ROOT_DIR/$LC_MANIFEST_REL"; then
    echo "ERROR: committed $LC_MANIFEST_REL at $source_revision drifted from the fresh sealed export; commit the re-exported manifest before deploying" >&2
    rm -f "$LC_TMP"
    exit 1
  fi
  rm -f "$LC_TMP"
  node "$ROOT_DIR/scripts/knowledge/check-authority-surface-linkage.mjs" >/dev/null
  build_started_seconds=$SECONDS
  build_args=(build-manifest --repo-root "$ROOT_DIR" --source-revision "$source_revision" --format v2 --output "$manifest" --receipt-output "$release_receipt" --source-provenance-proof-output "$source_provenance_proof")
  build_args+=(--daily-report-output "$daily_report")
  if [[ -n "$parent_manifest" ]]; then
    build_args+=(--parent-manifest "$parent_manifest")
  fi
  if [[ -n "$external_bundle" ]]; then
    build_args+=(--external-bundle "$external_bundle")
  fi
  if [[ -n "$external_bundle_root" ]]; then
    build_args+=(--external-bundle-root "$external_bundle_root")
  fi
  if [[ -n "$generated_resources_root" ]]; then
    build_args+=(--generated-resources-root "$generated_resources_root")
  fi
  if [[ -n "$formal_resource_envelope_hash" ]]; then
    build_args+=(--formal-resource-envelope-hash "$formal_resource_envelope_hash")
  fi
  npx tsx "$CLI" "${build_args[@]}" >/dev/null
  # The release closure must carry every asset the sealed manifest promises,
  # whatever --external-bundle the operator supplied (#2045 task 2.3).
  node "$ROOT_DIR/scripts/knowledge/check-release-learning-content-closure.mjs" \
    --release-manifest "$manifest" \
    --learning-manifest "$ROOT_DIR/course-content/runtime/knowledge/authority-learning-content-manifest.json"
  build_elapsed_milliseconds=$(( (SECONDS - build_started_seconds) * 1000 ))
fi
release_id="$(python3 - "$manifest" <<'PY'
import json
import re
import sys

with open(sys.argv[1], encoding='utf-8') as handle:
    manifest = json.load(handle)
release_id = manifest.get('releaseId')
if manifest.get('schemaVersion') != 'act-runtime-release.v2' or not isinstance(release_id, str) or not re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?', release_id):
    raise SystemExit('runtime manifest is not a valid v2 release')
print(release_id)
PY
)"
lifecycle_identity="$artifact_dir/lifecycle-identity.json"
python3 - "$manifest" "$release_id" > "$lifecycle_identity" <<'PY'
import hashlib
import json
import re
import sys

manifest_path, expected_release_id = sys.argv[1:]
wire = open(manifest_path, "rb").read()
manifest = json.loads(wire.decode("utf-8"))
if manifest.get("schemaVersion") != "act-runtime-release.v2" or manifest.get("releaseId") != expected_release_id:
    raise SystemExit("planned manifest does not bind the candidate release")
for field in ("manifestSha256", "treeSha256"):
    if not isinstance(manifest.get(field), str) or not re.fullmatch(r"[a-f0-9]{64}", manifest[field]):
        raise SystemExit("planned manifest %s is invalid" % field)
print(json.dumps({
    "schemaVersion": "runtime-blob-release-identity.v1",
    "releaseId": expected_release_id,
    "manifestVersion": "act-runtime-release.v2",
    "manifestSha256": manifest["manifestSha256"],
    "manifestWireSha256": hashlib.sha256(wire).hexdigest(),
    "manifestWireSizeBytes": len(wire),
    "treeSha256": manifest["treeSha256"],
}, separators=(",", ":"), sort_keys=True))
PY
chmod 0600 "$lifecycle_identity"

if [[ "$resuming_published_release" != "1" && -n "$parent_manifest" ]]; then
  matching_parent_release_id="$(python3 - "$manifest" "$parent_manifest" <<'PY'
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
  if [[ -z "$formal_resource_envelope_hash" && -n "$matching_parent_release_id" && "$matching_parent_release_id" == "$expected_active_release" ]]; then
    remote_active="$(remote "python3 '$REMOTE_HOST_STATE' active --state-dir '$REMOTE_PROJECT_DIR/data/runtime'")"
    python3 - "$parent_manifest" "$expected_active_release" "$remote_active" <<'PY'
import json
import sys

with open(sys.argv[1], encoding="utf-8") as handle:
    parent = json.load(handle)
active = json.loads(sys.argv[3])
selection = active.get("selection")
if not isinstance(selection, dict):
    raise SystemExit("active runtime selection is missing")
for field in ("releaseId", "manifestSha256", "treeSha256"):
    if selection.get(field) != parent.get(field):
        raise SystemExit("active runtime selection does not match the unchanged parent manifest")
if selection.get("releaseId") != sys.argv[2]:
    raise SystemExit("active runtime selection does not match --expected-active-release")
PY
    python3 - "$daily_report" "$build_elapsed_milliseconds" <<'PY'
import json
import sys

path, build_ms = sys.argv[1:]
with open(path, encoding="utf-8") as handle:
    report = json.load(handle)
if report.get("phase") != "planned":
    raise SystemExit("daily publication report is not in the planned phase")
report["phase"] = "no-runtime-change"
report["transfer"] = {"putCount": 0, "inheritedBlobCount": 0, "metadataCheckCount": 0, "uploadedBlobBytes": 0}
report["timingMilliseconds"] = {"manifestPlanning": int(build_ms), "publication": 0, "materializationAndSmoke": 0}
with open(path, "w", encoding="utf-8") as handle:
    json.dump(report, handle, indent=2, sort_keys=True)
    handle.write("\n")
PY
    printf '{"releaseId":"%s","noRuntimeChange":true}\n' "$matching_parent_release_id"
    exit 0
  fi
fi

# A successful terminal manifest makes a release selectable, but its blobs
# must become a lifecycle root before local publication can write them.  This
# prevents a concurrent GC from collecting unique candidate blobs between the
# local publish and the later host materialization step.
remote_lifecycle_identity="$REMOTE_ARTIFACT_ROOT/$release_id/lifecycle-identity.json"
remote "mkdir -p '$REMOTE_RUNTIME_RELEASE_DIR' '$(dirname "$REMOTE_READ_BRIDGE")' '$REMOTE_ARTIFACT_ROOT/$release_id' '$(dirname "$REMOTE_LIFECYCLE")' '$(dirname "$REMOTE_ACTIVATION_TRANSACTION")' '$(dirname "$REMOTE_ACTIVATOR")'"
copy_atomic "$LOCAL_BRIDGE" "$REMOTE_READ_BRIDGE"
remote "python3 -m py_compile '$REMOTE_READ_BRIDGE'"
copy_atomic "$ROOT_DIR/scripts/runtime-release/runtime-blob-release-lifecycle.py" "$REMOTE_LIFECYCLE"
copy_atomic "$ROOT_DIR/scripts/runtime-release/runtime-blob-activation-transaction.py" "$REMOTE_ACTIVATION_TRANSACTION"
copy_atomic "$ROOT_DIR/scripts/runtime-release/activate-runtime-blob-release.sh" "$REMOTE_ACTIVATOR"
scp -q -o BatchMode=yes -o UserKnownHostsFile="$KNOWN_HOSTS_FILE" -o StrictHostKeyChecking=yes "$lifecycle_identity" "$SSH_TARGET:$remote_lifecycle_identity.tmp"
remote "chmod 0600 '$remote_lifecycle_identity.tmp' && mv '$remote_lifecycle_identity.tmp' '$remote_lifecycle_identity'"
pre_publish_lifecycle="$(remote "python3 '$REMOTE_LIFECYCLE' inspect --state-dir '$REMOTE_PROJECT_DIR/data/runtime'")"
pre_publish_action="$(printf '%s' "$pre_publish_lifecycle" | python3 -c '
import json
import sys

candidate = json.load(open(sys.argv[1], encoding="utf-8"))
state = json.load(sys.stdin)
expected_active = sys.argv[2]
resume = sys.argv[3] == "1"
if expected_active == "none" or state.get("active", {}).get("releaseId") != expected_active:
    raise SystemExit("v2 lifecycle active release does not match --expected-active-release")
desired = state.get("desired")
publishing = state.get("publishing")
if not isinstance(publishing, list) or not isinstance(state.get("generation"), int):
    raise SystemExit("v2 lifecycle inspection is malformed")
if resume:
    if desired == candidate:
        print("resume:%d" % state["generation"])
        raise SystemExit(0)
    if state.get("active") == candidate:
        print("repair:%d" % state["generation"])
        raise SystemExit(0)
    if any(item == candidate for item in publishing):
        print("staged:%d" % state["generation"])
        raise SystemExit(0)
    raise SystemExit("published runtime resume requires the exact release to remain publishing, desired or active")
if desired is not None and desired != candidate:
    raise SystemExit("v2 lifecycle already records a different desired release")
if desired == candidate:
    print("protected:%d" % state["generation"])
    raise SystemExit(0)
if any(item == candidate for item in publishing):
    print("protected:%d" % state["generation"])
    raise SystemExit(0)
if publishing:
    raise SystemExit("v2 lifecycle already records another publishing release")
print("begin:%d" % state["generation"])
' "$lifecycle_identity" "$expected_active_release" "$resuming_published_release")"
if [[ "$pre_publish_action" == begin:* ]]; then
  pre_publish_generation="${pre_publish_action#begin:}"
  [[ "$pre_publish_generation" =~ ^[1-9][0-9]*$ ]] || { echo "ERROR: invalid lifecycle generation" >&2; exit 1; }
  begin_publish_result="$(remote "python3 '$REMOTE_LIFECYCLE' begin-publish --state-dir '$REMOTE_PROJECT_DIR/data/runtime' --expected-generation '$pre_publish_generation' --identity '$remote_lifecycle_identity'")"
  publishing_generation="$(printf '%s' "$begin_publish_result" | python3 -c 'import json,sys; print(json.load(sys.stdin)["generation"])')"
  [[ "$publishing_generation" =~ ^[1-9][0-9]*$ ]] || { echo "ERROR: invalid lifecycle generation after begin-publish; publishing root ownership is uncertain" >&2; exit 1; }
  publishing_identity_started=1
elif [[ "$pre_publish_action" != protected:* && "$pre_publish_action" != repair:* && "$pre_publish_action" != staged:* ]]; then
  if [[ "$pre_publish_action" != resume:* ]]; then
    echo "ERROR: invalid lifecycle publication state" >&2
    exit 1
  fi
fi
if [[ "$resuming_published_release" == "1" && "$pre_publish_action" != resume:* && "$pre_publish_action" != repair:* && "$pre_publish_action" != staged:* ]]; then
  echo "ERROR: published runtime resume did not preserve the requested desired candidate or active release" >&2
  exit 1
fi
if [[ "$resuming_published_release" != "1" ]]; then
  publish_started_seconds=$SECONDS
  publish_args=(
  publish-streaming --repo-root "$ROOT_DIR" --source-revision "$source_revision" --release-id "$release_id" --format v2 --manifest "$manifest" --receipt "$release_receipt" --source-provenance-proof "$source_provenance_proof" --bucket "$BUCKET"
  --local-bridge-path "$LOCAL_BRIDGE" --python-binary "$ACT_RUNTIME_LOCAL_PYTHON"
  --ossutil-path "$ACT_RUNTIME_LOCAL_OSSUTIL" --ossutil-sha256 "$ACT_RUNTIME_LOCAL_OSSUTIL_SHA256"
  --identity-command-path "$ACT_RUNTIME_LOCAL_IDENTITY_COMMAND" --identity-command-sha256 "$ACT_RUNTIME_LOCAL_IDENTITY_COMMAND_SHA256"
  --operator-account-id "$ACT_RUNTIME_OPERATOR_ACCOUNT_ID" --operator-principal-arn "$ACT_RUNTIME_OPERATOR_PRINCIPAL_ARN"
  --lock-dir "$ACT_RUNTIME_PUBLISH_LOCK_DIR" --spool-dir "$ACT_RUNTIME_PUBLISH_SPOOL_DIR" --daily-report-output "$daily_report" --output "$verification_receipt"
  --read-bridge-ssh-target "$SSH_TARGET" --read-bridge-path "$REMOTE_READ_BRIDGE" --read-bridge-known-hosts-file "$KNOWN_HOSTS_FILE"
  )
  if [[ -n "$parent_manifest" ]]; then
    publish_args+=(--parent-manifest "$parent_manifest")
  fi
  if [[ -n "$external_bundle" ]]; then
    publish_args+=(--external-bundle "$external_bundle")
  fi
  if [[ -n "$external_bundle_root" ]]; then
    publish_args+=(--external-bundle-root "$external_bundle_root")
  fi
  if [[ -n "$generated_resources_root" ]]; then
    publish_args+=(--generated-resources-root "$generated_resources_root")
  fi
  if [[ -n "${ACT_RUNTIME_CREDENTIAL_PROFILE:-}" ]]; then
    publish_args+=(--credential-profile "$ACT_RUNTIME_CREDENTIAL_PROFILE")
  fi
  if [[ -n "${ACT_RUNTIME_BLOB_PARENT_RELEASE_ID:-}" ]]; then
    [[ -n "${ACT_RUNTIME_BLOB_PARENT_MANIFEST_SHA256:-}" ]] || { echo "ERROR: ACT_RUNTIME_BLOB_PARENT_MANIFEST_SHA256 is required with ACT_RUNTIME_BLOB_PARENT_RELEASE_ID" >&2; exit 1; }
    publish_args+=(--blob-parent-release-id "$ACT_RUNTIME_BLOB_PARENT_RELEASE_ID" --blob-parent-manifest-sha256 "$ACT_RUNTIME_BLOB_PARENT_MANIFEST_SHA256")
  fi
  set +e
  npx tsx "$CLI" "${publish_args[@]}" >/dev/null
  publish_status=$?
  set -e
  if (( publish_status != 0 )); then
    if [[ "${publishing_identity_started:-0}" == "1" ]]; then
      cleanup_status=0
      if cleanup_output="$(remote "python3 '$REMOTE_LIFECYCLE' cancel-publishing --state-dir '$REMOTE_PROJECT_DIR/data/runtime' --expected-generation '$publishing_generation' --identity '$remote_lifecycle_identity'")"; then
        echo "ERROR: publish-streaming failed (status=$publish_status); publishing root cancelled for $release_id" >&2
      else
        cleanup_status=$?
        echo "ERROR: publish-streaming failed (status=$publish_status); publishing root cleanup failed (status=$cleanup_status) and remains protected: $release_id" >&2
      fi
    else
      echo "ERROR: publish-streaming failed (status=$publish_status); no owned publishing root was cancelled" >&2
    fi
    exit "$publish_status"
  fi
  publish_elapsed_milliseconds=$(( (SECONDS - publish_started_seconds) * 1000 ))
fi

remote "mkdir -p '$REMOTE_RUNTIME_RELEASE_DIR' '$REMOTE_ARTIFACT_ROOT/$release_id' '$(dirname "$REMOTE_HOST_STATE")' '$(dirname "$REMOTE_MATERIALIZER")' '$(dirname "$REMOTE_LIFECYCLE")' '$(dirname "$REMOTE_ACTIVATION_TRANSACTION")' '$(dirname "$REMOTE_ACTIVATOR")' '$(dirname "$REMOTE_APP_DEPLOY")'"
copy_atomic "$ROOT_DIR/scripts/runtime-release/runtime-release-host-state.py" "$REMOTE_HOST_STATE"
copy_atomic "$ROOT_DIR/scripts/runtime-release/materialize-runtime-blob-release.py" "$REMOTE_MATERIALIZER"
copy_atomic "$ROOT_DIR/scripts/runtime-release/runtime-blob-release-lifecycle.py" "$REMOTE_LIFECYCLE"
copy_atomic "$ROOT_DIR/scripts/runtime-release/runtime-blob-activation-transaction.py" "$REMOTE_ACTIVATION_TRANSACTION"
copy_atomic "$ROOT_DIR/scripts/runtime-release/activate-runtime-blob-release.sh" "$REMOTE_ACTIVATOR"
copy_atomic "$ROOT_DIR/deploy/podman/deploy.sh" "$REMOTE_APP_DEPLOY"
for name in manifest.json release-receipt.json source-provenance-proof.json publisher-verification.json; do
  scp -q -o BatchMode=yes -o UserKnownHostsFile="$KNOWN_HOSTS_FILE" -o StrictHostKeyChecking=yes "$artifact_dir/$name" "$SSH_TARGET:$REMOTE_ARTIFACT_ROOT/$release_id/$name.tmp"
  remote "chmod 0600 '$REMOTE_ARTIFACT_ROOT/$release_id/$name.tmp' && mv '$REMOTE_ARTIFACT_ROOT/$release_id/$name.tmp' '$REMOTE_ARTIFACT_ROOT/$release_id/$name'"
done

# Coordinated cutover (#1509): copy the declaration, committed graph receipt,
# and runtime binding so the remote lifecycle gate can enforce them. The
# argument set was validated before any publish side effect above.
remote_coordinated_env=""
if [[ "$coordinated_inputs_provided" -eq 3 ]]; then
  for pair in "coordinated-cutover.json:$coordinated_cutover_declaration" "coordinated-runtime-authorization.json:$coordinated_runtime_authorization" "coordinated-runtime-binding.json:$coordinated_runtime_binding"; do
    remote_name="${pair%%:*}"
    local_path="${pair#*:}"
    scp -q -o BatchMode=yes -o UserKnownHostsFile="$KNOWN_HOSTS_FILE" -o StrictHostKeyChecking=yes "$local_path" "$SSH_TARGET:$REMOTE_ARTIFACT_ROOT/$release_id/$remote_name.tmp"
    remote "chmod 0600 '$REMOTE_ARTIFACT_ROOT/$release_id/$remote_name.tmp' && mv '$REMOTE_ARTIFACT_ROOT/$release_id/$remote_name.tmp' '$REMOTE_ARTIFACT_ROOT/$release_id/$remote_name'"
  done
  remote_coordinated_env="ACT_RUNTIME_COORDINATED_CUTOVER_DECLARATION='$REMOTE_ARTIFACT_ROOT/$release_id/coordinated-cutover.json' ACT_RUNTIME_COORDINATED_RUNTIME_AUTHORIZATION='$REMOTE_ARTIFACT_ROOT/$release_id/coordinated-runtime-authorization.json' ACT_RUNTIME_COORDINATED_RUNTIME_BINDING='$REMOTE_ARTIFACT_ROOT/$release_id/coordinated-runtime-binding.json' "
fi

activation_started_seconds=$SECONDS
stage_only_arg=""
if [[ "$stage_only" == "1" ]]; then
  stage_only_arg=" --stage-only"
fi
remote "ACT_RUNTIME_BLOB_LIFECYCLE_SCRIPT='$REMOTE_LIFECYCLE' $remote_coordinated_env$REMOTE_ACTIVATOR --release-id '$release_id' --expected-active-release '$expected_active_release' --manifest '$REMOTE_ARTIFACT_ROOT/$release_id/manifest.json' --release-receipt '$REMOTE_ARTIFACT_ROOT/$release_id/release-receipt.json' --verification-receipt '$REMOTE_ARTIFACT_ROOT/$release_id/publisher-verification.json' --ram-role '$ram_role'$stage_only_arg"
activation_elapsed_milliseconds=$(( (SECONDS - activation_started_seconds) * 1000 ))
if [[ "$stage_only" == "1" ]]; then
  materialization_receipt="$artifact_dir/materialization-receipt.json"
  scp -q -o BatchMode=yes -o UserKnownHostsFile="$KNOWN_HOSTS_FILE" -o StrictHostKeyChecking=yes "$SSH_TARGET:$REMOTE_RUNTIME_VIEW_ROOT/views/$release_id/.act-runtime-release-materialization.v1.json" "$materialization_receipt.tmp"
  mv "$materialization_receipt.tmp" "$materialization_receipt"
  python3 - "$manifest" "$lifecycle_identity" "$materialization_receipt" "$artifact_dir/staged-runtime.json" <<'PY'
import hashlib
import json
import sys

manifest_path, identity_path, receipt_path, output_path = sys.argv[1:]
manifest_wire = open(manifest_path, "rb").read()
manifest = json.loads(manifest_wire.decode("utf-8"))
identity = json.load(open(identity_path, encoding="utf-8"))
identity_keys = {"schemaVersion", "releaseId", "manifestVersion", "manifestSha256", "manifestWireSha256", "manifestWireSizeBytes", "treeSha256"}
if set(identity) != identity_keys or identity.get("schemaVersion") != "runtime-blob-release-identity.v1" or identity.get("manifestVersion") != "act-runtime-release.v2":
    raise SystemExit("staged Runtime lifecycle identity is invalid")
if identity.get("releaseId") != manifest.get("releaseId") or identity.get("manifestSha256") != manifest.get("manifestSha256") or identity.get("treeSha256") != manifest.get("treeSha256"):
    raise SystemExit("staged Runtime lifecycle identity does not match the manifest")
if identity.get("manifestWireSha256") != hashlib.sha256(manifest_wire).hexdigest() or identity.get("manifestWireSizeBytes") != len(manifest_wire):
    raise SystemExit("staged Runtime lifecycle identity does not bind the manifest wire")
wire = open(receipt_path, "rb").read()
receipt = json.loads(wire.decode("utf-8"))
if receipt.get("schemaVersion") not in {"runtime-blob-materialization.v1", "runtime-blob-materialization.v2"}:
    raise SystemExit("staged Runtime materialization receipt schema is invalid")
if receipt.get("releaseId") != manifest.get("releaseId"):
    raise SystemExit("staged Runtime materialization receipt binds a different release")
result = {
    "contract": "coordinated-runtime-stage/v1",
    "runtimeRelease": identity,
    "materializationReceiptSha256": hashlib.sha256(wire).hexdigest(),
}
with open(output_path, "w", encoding="utf-8") as handle:
    json.dump(result, handle, indent=2, sort_keys=True)
    handle.write("\n")
PY
  python3 - "$daily_report" "$build_elapsed_milliseconds" "$publish_elapsed_milliseconds" "$activation_elapsed_milliseconds" <<'PY'
import json
import sys

path, build_ms, publish_ms, materialization_ms = sys.argv[1:]
with open(path, encoding="utf-8") as handle:
    report = json.load(handle)
if report.get("phase") != "published" or not isinstance(report.get("transfer"), dict):
    raise SystemExit("daily publication report is not a completed local publication")
report["timingMilliseconds"] = {
    "manifestPlanning": int(build_ms),
    "publication": int(publish_ms),
    "materializationAndSmoke": int(materialization_ms),
}
report["runtimeStage"] = "NON_SELECTABLE"
with open(path, "w", encoding="utf-8") as handle:
    json.dump(report, handle, indent=2, sort_keys=True)
    handle.write("\n")
PY
  printf '{"releaseId":"%s","artifactDir":"%s","stagedRuntimeRelease":true,"runtimeDeliveryMode":"ossfs-blob-view"}\n' "$release_id" "$artifact_dir"
  exit 0
fi
if [[ "$resuming_published_release" == "1" ]]; then
  if [[ "$pre_publish_action" == repair:* ]]; then
    printf '{"releaseId":"%s","artifactDir":"%s","repairedActiveRelease":true,"runtimeDeliveryMode":"ossfs-blob-view"}\n' "$release_id" "$artifact_dir"
  else
    printf '{"releaseId":"%s","artifactDir":"%s","resumedPublishedRelease":true,"runtimeDeliveryMode":"ossfs-blob-view"}\n' "$release_id" "$artifact_dir"
  fi
  exit 0
fi
python3 - "$daily_report" "$build_elapsed_milliseconds" "$publish_elapsed_milliseconds" "$activation_elapsed_milliseconds" <<'PY'
import json
import sys

path, build_ms, publish_ms, activation_ms = sys.argv[1:]
with open(path, encoding="utf-8") as handle:
    report = json.load(handle)
if report.get("phase") != "published" or not isinstance(report.get("transfer"), dict):
    raise SystemExit("daily publication report is not a completed local publication")
report["timingMilliseconds"] = {
    "manifestPlanning": int(build_ms),
    "publication": int(publish_ms),
    "materializationAndSmoke": int(activation_ms),
}
with open(path, "w", encoding="utf-8") as handle:
    json.dump(report, handle, indent=2, sort_keys=True)
    handle.write("\n")
PY
printf '{"releaseId":"%s","artifactDir":"%s","runtimeDeliveryMode":"ossfs-blob-view"}\n' "$release_id" "$artifact_dir"
