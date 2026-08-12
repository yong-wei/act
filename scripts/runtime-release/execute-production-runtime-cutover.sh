#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

release_id=''
verification_receipt=''
release_locator=''
media_closure=''
image_tar='deploy/images/act-obe.tar'
image_reference='localhost/act-obe-platform:20260301-amd64'
ssh_target='root@121.40.124.135'
known_hosts=''
identity_file=''
delete_legacy_runtime=0
rollback_release_id=''
rollback_verification_receipt=''

while [[ $# -gt 0 ]]; do
  case "$1" in
    --release-id) release_id="$2"; shift 2 ;;
    --verification-receipt) verification_receipt="$2"; shift 2 ;;
    --release-locator) release_locator="$2"; shift 2 ;;
    --media-closure) media_closure="$2"; shift 2 ;;
    --image-tar) image_tar="$2"; shift 2 ;;
    --image-reference) image_reference="$2"; shift 2 ;;
    --ssh-target) ssh_target="$2"; shift 2 ;;
    --known-hosts) known_hosts="$2"; shift 2 ;;
    --identity-file) identity_file="$2"; shift 2 ;;
    --delete-legacy-runtime) delete_legacy_runtime=1; shift ;;
    --rollback-release-id) rollback_release_id="$2"; shift 2 ;;
    --rollback-verification-receipt) rollback_verification_receipt="$2"; shift 2 ;;
    *) echo "ERROR: unknown argument: $1" >&2; exit 1 ;;
  esac
done

[[ "$release_id" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]] || { echo 'ERROR: invalid release id' >&2; exit 1; }
[[ "$ssh_target" =~ ^[A-Za-z0-9._@:-]+$ ]] || { echo 'ERROR: invalid SSH target' >&2; exit 1; }
[[ "$image_reference" =~ ^[A-Za-z0-9._/:@-]+$ ]] || { echo 'ERROR: invalid image reference' >&2; exit 1; }
if [[ "$delete_legacy_runtime" == '1' ]]; then
  [[ "$rollback_release_id" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]] || { echo 'ERROR: deleting legacy runtime requires --rollback-release-id' >&2; exit 1; }
  [[ -n "$rollback_verification_receipt" && -f "$rollback_verification_receipt" && ! -L "$rollback_verification_receipt" ]] || { echo 'ERROR: deleting legacy runtime requires --rollback-verification-receipt' >&2; exit 1; }
fi
for path in "$known_hosts" "$identity_file" "$verification_receipt" "$release_locator" "$media_closure" "$image_tar"; do
  [[ -n "$path" && -f "$path" && ! -L "$path" ]] || { echo "ERROR: required local file is unavailable: $path" >&2; exit 1; }
done
for command in git ssh scp python3 node; do command -v "$command" >/dev/null 2>&1 || { echo "ERROR: required command unavailable: $command" >&2; exit 1; }; done

git fetch origin integration --quiet
integration_revision="$(git rev-parse origin/integration)"
head_revision="$(git rev-parse HEAD)"
[[ -z "$(git status --porcelain=v1 --untracked-files=normal)" ]] || { echo 'ERROR: production image build input must be clean' >&2; exit 1; }
[[ "$head_revision" == "$integration_revision" ]] || { echo 'ERROR: local checkout must exactly match origin/integration' >&2; exit 1; }
release_locator_relative="$(python3 - "$ROOT_DIR" "$release_locator" <<'PY'
from pathlib import Path
import sys

root = Path(sys.argv[1]).resolve()
candidate = Path(sys.argv[2]).resolve()
try:
    print(candidate.relative_to(root).as_posix())
except ValueError:
    raise SystemExit('release locator must be inside the integration checkout')
PY
)"
require_integration_artifact() {
  local artifact_path="$1"
  local label="$2"
  local relative
  relative="$(python3 - "$ROOT_DIR" "$artifact_path" <<'PY'
from pathlib import Path
import sys

root = Path(sys.argv[1]).resolve()
candidate = Path(sys.argv[2]).resolve()
try:
    print(candidate.relative_to(root).as_posix())
except ValueError:
    raise SystemExit('artifact must be inside the integration checkout')
PY
)"
  git ls-files --error-unmatch -- "$relative" >/dev/null 2>&1 || { echo "ERROR: ${label} must be tracked by integration" >&2; exit 1; }
  git diff --quiet HEAD -- "$relative" || { echo "ERROR: ${label} differs from the integration checkout" >&2; exit 1; }
}
require_integration_artifact "$release_locator" 'release locator'
require_integration_artifact "$verification_receipt" 'verification receipt'
require_integration_artifact "$media_closure" 'published-media closure'
provenance="${image_tar}.provenance.json"
node scripts/release/textbook-runtime-v2-provenance.mjs verify-image --sidecar "$provenance" --image-tar "$image_tar" >/dev/null
release_source_revision="$(python3 - "$release_id" "$verification_receipt" "$release_locator" "$media_closure" <<'PY'
import hashlib
import json
import re
import sys
release_id, receipt_path, locator_path, closure_path = sys.argv[1:]
def load(path):
    with open(path, encoding='utf-8') as handle:
        return json.load(handle)
receipt, locator, closure = load(receipt_path), load(locator_path), load(closure_path)
source_revision = locator.get('sourceRevision')
tree_sha256 = locator.get('treeSha256')
if not isinstance(source_revision, str) or not re.fullmatch(r'[a-f0-9]{40}', source_revision):
    raise SystemExit('release locator source revision is invalid')
if not isinstance(tree_sha256, str) or not re.fullmatch(r'[a-f0-9]{64}', tree_sha256):
    raise SystemExit('release locator tree digest is invalid')
expected_release_id = 'runtime-' + hashlib.sha256(json.dumps({'sourceRevision': source_revision, 'treeSha256': tree_sha256}, sort_keys=True, separators=(',', ':')).encode('utf-8')).hexdigest()[:55]
if receipt.get('releaseId') != release_id or locator.get('releaseId') != release_id:
    raise SystemExit('release proof does not match --release-id')
if expected_release_id != release_id:
    raise SystemExit('release locator source revision and tree digest do not bind --release-id')
if locator.get('manifestSha256') != receipt.get('manifestSha256') or locator.get('treeSha256') != receipt.get('treeSha256'):
    raise SystemExit('release locator does not match the verification receipt')
if closure.get('releaseId') != release_id or closure.get('sourceRevision') != source_revision or closure.get('treeSha256') != tree_sha256 or closure.get('manifestSha256') != locator.get('manifestSha256') or closure.get('ready') is not True or closure.get('failures'):
    raise SystemExit('published-media closure is not ready')
print(source_revision)
PY
)"
git merge-base --is-ancestor "$release_source_revision" "$integration_revision" || { echo 'ERROR: release source revision is not an ancestor of origin/integration' >&2; exit 1; }

stage_dir="/home/projects/act/runtime-cutover/${release_id}-${integration_revision:0:12}"
ssh_args=(-o BatchMode=yes -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=${known_hosts}" -o IdentitiesOnly=yes -i "$identity_file")
scp_args=(-o BatchMode=yes -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=${known_hosts}" -o IdentitiesOnly=yes -i "$identity_file")
remote() { ssh "${ssh_args[@]}" -- "$ssh_target" "$@"; }
remote "install -d -m 0700 '$stage_dir'"
for file in perform-production-runtime-cutover.sh activate-runtime-release.sh runtime-release-host-state.py configure-runtime-ossfs-release.sh retire-legacy-runtime-after-oss-cutover.sh act-runtime-ossfs@.service; do
  scp -q "${scp_args[@]}" "${ROOT_DIR}/scripts/runtime-release/${file}" "${ssh_target}:${stage_dir}/${file}.tmp"
  remote "chmod 0700 '$stage_dir/${file}.tmp' && mv '$stage_dir/${file}.tmp' '$stage_dir/${file}'"
done
for local_file in "${ROOT_DIR}/deploy/podman/deploy.sh" "${ROOT_DIR}/deploy/podman/container-start-wrapper.sh" "$image_tar" "$provenance" "$verification_receipt" "$release_locator"; do
  name="$(basename "$local_file")"
  [[ "$name" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "ERROR: staged filename is invalid: $name" >&2; exit 1; }
  scp -q "${scp_args[@]}" "$local_file" "${ssh_target}:${stage_dir}/${name}.tmp"
  remote "chmod 0600 '$stage_dir/${name}.tmp' && mv '$stage_dir/${name}.tmp' '$stage_dir/${name}'"
done
if [[ "$delete_legacy_runtime" == '1' ]]; then
  scp -q "${scp_args[@]}" "$rollback_verification_receipt" "${ssh_target}:${stage_dir}/rollback-verification-receipt.json.tmp"
  remote "chmod 0600 '$stage_dir/rollback-verification-receipt.json.tmp' && mv '$stage_dir/rollback-verification-receipt.json.tmp' '$stage_dir/rollback-verification-receipt.json'"
fi
remote "chmod 0700 '$stage_dir/perform-production-runtime-cutover.sh' '$stage_dir/activate-runtime-release.sh' '$stage_dir/configure-runtime-ossfs-release.sh' '$stage_dir/retire-legacy-runtime-after-oss-cutover.sh' '$stage_dir/deploy.sh' && chmod 0644 '$stage_dir/act-runtime-ossfs@.service' '$stage_dir/container-start-wrapper.sh' && install -m 0644 '$stage_dir/act-runtime-ossfs@.service' /etc/systemd/system/act-runtime-ossfs@.service && systemctl daemon-reload"
remote "'$stage_dir/perform-production-runtime-cutover.sh' --release-id '$release_id' --integration-revision '$integration_revision' --image-tar '$stage_dir/$(basename "$image_tar")' --image-reference '$image_reference' --provenance '$stage_dir/$(basename "$provenance")' --verification-receipt '$stage_dir/$(basename "$verification_receipt")' --release-locator '$stage_dir/$(basename "$release_locator")' --ram-role act-runtime-oss-read --stage-dir '$stage_dir'"
if [[ "$delete_legacy_runtime" == '1' ]]; then
  remote "app_port=\$(awk -F= '/^APP_PORT=/{print \$2}' /home/projects/act/data/runtime/act-obe.env); '$stage_dir/retire-legacy-runtime-after-oss-cutover.sh' --release-id '$release_id' --rollback-release-id '$rollback_release_id' --rollback-verification-receipt '$stage_dir/rollback-verification-receipt.json' --ram-role act-runtime-oss-read --host-state-script '$stage_dir/runtime-release-host-state.py' --ossfs-config-script '$stage_dir/configure-runtime-ossfs-release.sh' --app-port \"\$app_port\" --report /home/projects/act/data/runtime/legacy-runtime-retirement-${release_id}.json"
fi
