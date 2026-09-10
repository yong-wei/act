#!/usr/bin/env bash
set -Eeuo pipefail

# Transfer an already-qualified c5 candidate and execute its single remote
# stopped-service transaction. Publication/materialization must have completed
# before this command; it never builds a Runtime release or reopens c4 review.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SSH_TARGET="${SSH_TARGET:-root@121.40.124.135}"
KNOWN_HOSTS_FILE="${ACT_RUNTIME_SSH_KNOWN_HOSTS_FILE:-}"
REMOTE_PROJECT_DIR="${REMOTE_PROJECT_DIR:-/home/projects/act}"
REMOTE_CANDIDATE_ROOT="${REMOTE_CANDIDATE_ROOT:-$REMOTE_PROJECT_DIR/data/runtime/knowledge-cutover/candidates}"
RAM_ROLE="${ACT_RUNTIME_OSS_RAM_ROLE:-act-runtime-oss-read}"

candidate_dir=""
runtime_artifact_dir=""
while [[ $# -gt 0 ]]; do
  case "$1" in
    --candidate-dir) candidate_dir="$2"; shift 2 ;;
    --runtime-artifact-dir) runtime_artifact_dir="$2"; shift 2 ;;
    --ram-role) RAM_ROLE="$2"; shift 2 ;;
    *) echo "ERROR: unknown argument: $1" >&2; exit 1 ;;
  esac
done
[[ "$candidate_dir" = /* && -d "$candidate_dir" && ! -L "$candidate_dir" ]] || { echo "ERROR: --candidate-dir must be an absolute real directory" >&2; exit 1; }
[[ "$runtime_artifact_dir" = /* && -d "$runtime_artifact_dir" && ! -L "$runtime_artifact_dir" ]] || { echo "ERROR: --runtime-artifact-dir must be an absolute real directory" >&2; exit 1; }
[[ -f "$KNOWN_HOSTS_FILE" ]] || { echo "ERROR: ACT_RUNTIME_SSH_KNOWN_HOSTS_FILE is required" >&2; exit 1; }
[[ "$RAM_ROLE" =~ ^[A-Za-z0-9_+=,.@-]{1,128}$ ]] || { echo "ERROR: invalid RAM role" >&2; exit 1; }

for file in candidate-receipt.json authority-current.json runtime-stage.json predecessor-observation.json lifecycle-predecessor.json prepare-input.json allocation.json formal-resource-envelope.json derivation-receipt.json reuse-receipt.json continuity-receipt.json teaching-closure-receipt.json teaching-reclosure-receipt.json projection-adjustments.json projection-scope-binding.json successor-runtime-manifest-extension.json successor-manifest.json denominator.json outer-artifacts.json presentation-label-qualification.json verification-policy.json composed-domain-fragment-manifest.json; do
  [[ -f "$candidate_dir/$file" && ! -L "$candidate_dir/$file" ]] || { echo "ERROR: qualified candidate file is missing: $file" >&2; exit 1; }
done
fragment_files="$(python3 - "$candidate_dir" <<'PY'
import json, os, re, sys
root = sys.argv[1]
composed = json.load(open(os.path.join(root, 'composed-domain-fragment-manifest.json'), encoding='utf-8'))
refs = composed.get('fragments')
if not isinstance(refs, list) or not refs:
    raise SystemExit('composed domain-fragment manifest has no fragments')
seen = set()
paths = []
for ref in refs:
    fragment_id = ref.get('fragmentId')
    if not isinstance(fragment_id, str) or not re.fullmatch(r'dtf-[0-9a-f]{64}', fragment_id):
        raise SystemExit('composed domain-fragment manifest fragment identity is invalid')
    if fragment_id in seen:
        raise SystemExit('composed domain-fragment manifest has duplicate fragment identities')
    seen.add(fragment_id)
    relative = os.path.join('domain-fragments', f'{fragment_id}.json')
    full = os.path.join(root, relative)
    if not os.path.isfile(full) or os.path.islink(full):
        raise SystemExit(f'referenced domain fragment is not present: {fragment_id}')
    paths.append(relative)
print('\n'.join(paths))
PY
)"
for file in manifest.json release-receipt.json publisher-verification.json lifecycle-identity.json materialization-receipt.json staged-runtime.json; do
  [[ -f "$runtime_artifact_dir/$file" && ! -L "$runtime_artifact_dir/$file" ]] || { echo "ERROR: staged Runtime artifact is missing: $file" >&2; exit 1; }
done

release_id="$(python3 - "$candidate_dir/runtime-stage.json" <<'PY'
import json, re, sys
value=json.load(open(sys.argv[1], encoding='utf-8'))
release=value.get('runtimeRelease',{}).get('releaseId')
if not isinstance(release,str) or not re.fullmatch(r'[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?',release): raise SystemExit(1)
print(release)
PY
)"
candidate_id="$(python3 - "$candidate_dir/candidate-receipt.json" <<'PY'
import json, re, sys
value=json.load(open(sys.argv[1], encoding='utf-8')); ident=value.get('candidateId')
if not isinstance(ident,str) or not re.fullmatch(r'cand-[0-9a-f-]{36}',ident): raise SystemExit(1)
print(ident)
PY
)"
remote_dir="$REMOTE_CANDIDATE_ROOT/$candidate_id"

remote() {
  ssh -o BatchMode=yes -o UserKnownHostsFile="$KNOWN_HOSTS_FILE" -o StrictHostKeyChecking=yes "$SSH_TARGET" "$@"
}

copy_immutable() {
  local source="$1"
  local target="$2"
  local expected
  expected="$(sha256sum "$source" | awk '{print $1}')"
  scp -q -o BatchMode=yes -o UserKnownHostsFile="$KNOWN_HOSTS_FILE" -o StrictHostKeyChecking=yes "$source" "$SSH_TARGET:${target}.tmp"
  remote "test \"\$(sha256sum '${target}.tmp' | awk '{print \$1}')\" = '$expected' && chmod 0600 '${target}.tmp' && mv '${target}.tmp' '${target}'"
}

remote "test ! -e '$remote_dir' && mkdir -p '$remote_dir/domain-fragments'"
for file in candidate-receipt.json authority-current.json runtime-stage.json predecessor-observation.json lifecycle-predecessor.json prepare-input.json allocation.json formal-resource-envelope.json derivation-receipt.json reuse-receipt.json continuity-receipt.json teaching-closure-receipt.json teaching-reclosure-receipt.json projection-adjustments.json projection-scope-binding.json successor-runtime-manifest-extension.json successor-manifest.json denominator.json outer-artifacts.json presentation-label-qualification.json verification-policy.json composed-domain-fragment-manifest.json; do
  copy_immutable "$candidate_dir/$file" "$remote_dir/$file"
done
if [[ -f "$candidate_dir/resource-qualification.json" && ! -L "$candidate_dir/resource-qualification.json" ]]; then
  copy_immutable "$candidate_dir/resource-qualification.json" "$remote_dir/resource-qualification.json"
fi
while IFS= read -r rel; do
  [[ -n "$rel" ]] || continue
  copy_immutable "$candidate_dir/$rel" "$remote_dir/$rel"
done <<< "$fragment_files"
for file in manifest.json release-receipt.json publisher-verification.json lifecycle-identity.json materialization-receipt.json staged-runtime.json; do
  copy_immutable "$runtime_artifact_dir/$file" "$remote_dir/$file"
done
copy_immutable "$ROOT_DIR/scripts/knowledge-cutover/remote-activate-r4-coordinated-cutover.sh" "$remote_dir/remote-activate-r4-coordinated-cutover.sh"
remote "chmod 0755 '$remote_dir/remote-activate-r4-coordinated-cutover.sh'"

snapshot="$(python3 - "$candidate_dir/authority-current.json" <<'PY'
import json, re, sys
value=json.load(open(sys.argv[1], encoding='utf-8'))
snapshot=value.get('snapshotId'); digest=value.get('snapshotHash')
if not isinstance(snapshot,str) or not re.fullmatch(r'snap-[0-9a-f]{64}',snapshot) or digest != snapshot[5:]: raise SystemExit(1)
print(snapshot)
PY
)"
source_snapshot="$ROOT_DIR/course-content/authoring/knowledge/authority/releases/$snapshot"
[[ -d "$source_snapshot" && ! -L "$source_snapshot" ]] || { echo "ERROR: r4 Authority snapshot is unavailable" >&2; exit 1; }
python3 - "$candidate_dir/authority-current.json" "$source_snapshot/manifest.json" <<'PY'
import json, sys
successor=json.load(open(sys.argv[1], encoding='utf-8')); manifest=json.load(open(sys.argv[2], encoding='utf-8'))
for key in ('snapshotId','snapshotHash','releaseId','releaseSetId'):
    if successor.get(key) != manifest.get(key): raise SystemExit('Authority snapshot manifest does not match the sealed successor')
PY
remote "test ! -e '$REMOTE_PROJECT_DIR/course-content/authoring/knowledge/authority/releases/$snapshot'"
tar -C "$(dirname "$source_snapshot")" -cf - "$snapshot" | remote "mkdir -p '$REMOTE_PROJECT_DIR/course-content/authoring/knowledge/authority/releases' && tar -C '$REMOTE_PROJECT_DIR/course-content/authoring/knowledge/authority/releases' -xf -"
remote "test -f '$REMOTE_PROJECT_DIR/course-content/authoring/knowledge/authority/releases/$snapshot/manifest.json' && ! test -L '$REMOTE_PROJECT_DIR/course-content/authoring/knowledge/authority/releases/$snapshot/manifest.json'"

remote "'$remote_dir/remote-activate-r4-coordinated-cutover.sh' --candidate-dir '$remote_dir' --ram-role '$RAM_ROLE'"
printf '{"candidateId":"%s","runtimeRelease":"%s","status":"COMMITTED"}\n' "$candidate_id" "$release_id"
