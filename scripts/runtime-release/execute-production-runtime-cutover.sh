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
    *) echo "ERROR: unknown argument: $1" >&2; exit 1 ;;
  esac
done

[[ "$release_id" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]] || { echo 'ERROR: invalid release id' >&2; exit 1; }
[[ "$ssh_target" =~ ^[A-Za-z0-9._@:-]+$ ]] || { echo 'ERROR: invalid SSH target' >&2; exit 1; }
[[ "$image_reference" =~ ^[A-Za-z0-9._/:@-]+$ ]] || { echo 'ERROR: invalid image reference' >&2; exit 1; }
for path in "$known_hosts" "$identity_file" "$verification_receipt" "$release_locator" "$media_closure" "$image_tar"; do
  [[ -n "$path" && -f "$path" && ! -L "$path" ]] || { echo "ERROR: required local file is unavailable: $path" >&2; exit 1; }
done
for command in git ssh scp python3 node; do command -v "$command" >/dev/null 2>&1 || { echo "ERROR: required command unavailable: $command" >&2; exit 1; }; done

git fetch origin integration --quiet
integration_revision="$(git rev-parse origin/integration)"
head_revision="$(git rev-parse HEAD)"
[[ -z "$(git status --porcelain=v1 --untracked-files=normal)" ]] || { echo 'ERROR: production image build input must be clean' >&2; exit 1; }
[[ "$head_revision" == "$integration_revision" ]] || { echo 'ERROR: local checkout must exactly match origin/integration' >&2; exit 1; }
provenance="${image_tar}.provenance.json"
node scripts/release/textbook-runtime-v2-provenance.mjs verify-image --sidecar "$provenance" --image-tar "$image_tar" >/dev/null
python3 - "$integration_revision" "$release_id" "$verification_receipt" "$release_locator" "$media_closure" <<'PY'
import json
import sys
revision, release_id, receipt_path, locator_path, closure_path = sys.argv[1:]
def load(path):
    with open(path, encoding='utf-8') as handle:
        return json.load(handle)
receipt, locator, closure = load(receipt_path), load(locator_path), load(closure_path)
if receipt.get('releaseId') != release_id or locator.get('releaseId') != release_id:
    raise SystemExit('release proof does not match --release-id')
if locator.get('sourceRevision') != revision:
    raise SystemExit('release locator source revision is not origin/integration')
if locator.get('manifestSha256') != receipt.get('manifestSha256') or locator.get('treeSha256') != receipt.get('treeSha256'):
    raise SystemExit('release locator does not match the verification receipt')
if closure.get('releaseId') != release_id or closure.get('ready') is not True or closure.get('failures'):
    raise SystemExit('published-media closure is not ready')
PY

stage_dir="/home/projects/act/runtime-cutover/${release_id}-${integration_revision:0:12}"
ssh_args=(-o BatchMode=yes -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=${known_hosts}" -o IdentitiesOnly=yes -i "$identity_file")
scp_args=(-o BatchMode=yes -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=${known_hosts}" -o IdentitiesOnly=yes -i "$identity_file")
remote() { ssh "${ssh_args[@]}" -- "$ssh_target" "$@"; }
remote "install -d -m 0700 '$stage_dir'"
for file in perform-production-runtime-cutover.sh activate-runtime-release.sh runtime-release-host-state.py configure-runtime-ossfs-release.sh act-runtime-ossfs@.service; do
  scp -q "${scp_args[@]}" "${ROOT_DIR}/scripts/runtime-release/${file}" "${ssh_target}:${stage_dir}/${file}.tmp"
  remote "chmod 0700 '$stage_dir/${file}.tmp' && mv '$stage_dir/${file}.tmp' '$stage_dir/${file}'"
done
for local_file in "${ROOT_DIR}/deploy/podman/deploy.sh" "${ROOT_DIR}/deploy/podman/container-start-wrapper.sh" "$image_tar" "$provenance" "$verification_receipt" "$release_locator"; do
  name="$(basename "$local_file")"
  [[ "$name" =~ ^[A-Za-z0-9._-]+$ ]] || { echo "ERROR: staged filename is invalid: $name" >&2; exit 1; }
  scp -q "${scp_args[@]}" "$local_file" "${ssh_target}:${stage_dir}/${name}.tmp"
  remote "chmod 0600 '$stage_dir/${name}.tmp' && mv '$stage_dir/${name}.tmp' '$stage_dir/${name}'"
done
remote "chmod 0700 '$stage_dir/perform-production-runtime-cutover.sh' '$stage_dir/activate-runtime-release.sh' '$stage_dir/configure-runtime-ossfs-release.sh' '$stage_dir/deploy.sh' && chmod 0644 '$stage_dir/act-runtime-ossfs@.service' '$stage_dir/container-start-wrapper.sh' && install -m 0644 '$stage_dir/act-runtime-ossfs@.service' /etc/systemd/system/act-runtime-ossfs@.service && systemctl daemon-reload"
remote "'$stage_dir/perform-production-runtime-cutover.sh' --release-id '$release_id' --integration-revision '$integration_revision' --image-tar '$stage_dir/$(basename "$image_tar")' --image-reference '$image_reference' --provenance '$stage_dir/$(basename "$provenance")' --verification-receipt '$stage_dir/$(basename "$verification_receipt")' --release-locator '$stage_dir/$(basename "$release_locator")' --ram-role act-runtime-oss-read --stage-dir '$stage_dir'"
