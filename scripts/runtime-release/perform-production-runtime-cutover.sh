#!/usr/bin/env bash
set -euo pipefail

release_id=''
integration_revision=''
image_tar=''
image_reference=''
provenance=''
verification_receipt=''
release_locator=''
ram_role=''
stage_dir=''

while [[ $# -gt 0 ]]; do
  case "$1" in
    --release-id) release_id="$2"; shift 2 ;;
    --integration-revision) integration_revision="$2"; shift 2 ;;
    --image-tar) image_tar="$2"; shift 2 ;;
    --image-reference) image_reference="$2"; shift 2 ;;
    --provenance) provenance="$2"; shift 2 ;;
    --verification-receipt) verification_receipt="$2"; shift 2 ;;
    --release-locator) release_locator="$2"; shift 2 ;;
    --ram-role) ram_role="$2"; shift 2 ;;
    --stage-dir) stage_dir="$2"; shift 2 ;;
    *) echo "ERROR: unknown argument: $1" >&2; exit 1 ;;
  esac
done

[[ "$release_id" =~ ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$ ]] || { echo 'ERROR: invalid release id' >&2; exit 1; }
[[ "$integration_revision" =~ ^[a-f0-9]{40}$ ]] || { echo 'ERROR: invalid integration revision' >&2; exit 1; }
[[ "$ram_role" == 'act-runtime-oss-read' ]] || { echo 'ERROR: production cutover requires act-runtime-oss-read' >&2; exit 1; }
[[ "$image_reference" =~ ^[A-Za-z0-9._/:@-]+$ ]] || { echo 'ERROR: invalid image reference' >&2; exit 1; }
[[ "$stage_dir" =~ ^/[A-Za-z0-9._/-]+$ ]] || { echo 'ERROR: invalid stage directory' >&2; exit 1; }
for required in "$image_tar" "$provenance" "$verification_receipt" "$release_locator"; do
  [[ -f "$required" && ! -L "$required" ]] || { echo "ERROR: required staged file is unavailable: $required" >&2; exit 1; }
done

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "ERROR: required command unavailable: $1" >&2; exit 1; }; }
for command in curl podman python3 sha256sum; do require_cmd "$command"; done

role="$(curl --fail --silent --show-error --connect-timeout 2 --max-time 5 http://100.100.100.200/latest/meta-data/ram/security-credentials/ | tr -d '\r\n')"
[[ "$role" == "$ram_role" ]] || { echo 'ERROR: ECS RAM role is not the required read-only role' >&2; exit 1; }

python3 - "$integration_revision" "$release_id" "$image_tar" "$provenance" "$verification_receipt" "$release_locator" <<'PY'
import hashlib
import json
import pathlib
import re
import sys

revision, release_id, image_tar, provenance, receipt, locator = sys.argv[1:]
sha256 = re.compile(r'^[a-f0-9]{64}$')
def load(path):
    with open(path, encoding='utf-8') as handle:
        return json.load(handle)
def digest(path):
    value = hashlib.sha256()
    with open(path, 'rb') as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b''):
            value.update(chunk)
    return value.hexdigest()
prov = load(provenance)
verified = load(receipt)
release = load(locator)
if prov.get('appRevision') != revision or prov.get('imageTarSha256') != digest(image_tar):
    raise SystemExit('image provenance does not bind the staged integration image')
if verified.get('releaseId') != release_id or not sha256.fullmatch(str(verified.get('manifestSha256'))) or not sha256.fullmatch(str(verified.get('treeSha256'))):
    raise SystemExit('runtime verification receipt is invalid')
if release.get('releaseId') != release_id or release.get('sourceRevision') != revision:
    raise SystemExit('release locator does not bind the staged integration revision')
if release.get('manifestSha256') != verified.get('manifestSha256') or release.get('treeSha256') != verified.get('treeSha256'):
    raise SystemExit('release locator differs from runtime verification receipt')
print(json.dumps({'releaseId': release_id, 'appRevision': revision, 'imageTarSha256': prov['imageTarSha256']}, separators=(',', ':')))
PY

image_tar_sha256="$(sha256sum "$image_tar" | awk '{print $1}')"
podman load -i "$image_tar" >/dev/null
image_digest="$(podman image inspect --format '{{.Id}}' "$image_reference")"
image_revision="$(podman image inspect --format '{{ index .Labels \"org.opencontainers.image.revision\" }}' "$image_digest")"
[[ "$image_digest" =~ ^sha256:[a-f0-9]{64}$ && "$image_revision" == "$integration_revision" ]] || { echo 'ERROR: loaded image does not bind the required integration revision' >&2; exit 1; }
locator_sha256="$(sha256sum "$release_locator" | awk '{print $1}')"

APP_IMAGE="$image_digest" \
ACT_RUNTIME_DEPLOY_SCRIPT="$stage_dir/deploy.sh" \
ACT_RUNTIME_DEPLOY_MODE='--runtime-cutover-app-only' \
ACT_RUNTIME_HOST_STATE_SCRIPT="$stage_dir/runtime-release-host-state.py" \
ACT_RUNTIME_OSSFS_CONFIG_SCRIPT="$stage_dir/configure-runtime-ossfs-release.sh" \
START_WRAPPER_PATH="$stage_dir/container-start-wrapper.sh" \
ACT_RUNTIME_APP_REVISION="$integration_revision" \
ACT_RUNTIME_IMAGE_DIGEST="$image_digest" \
ACT_RUNTIME_RELEASE_LOCATOR_SHA256="$locator_sha256" \
"$stage_dir/activate-runtime-release.sh" \
  --release-id "$release_id" \
  --expected-active-release none \
  --verification-receipt "$verification_receipt" \
  --ram-role "$ram_role"

python3 - "$stage_dir/runtime-release-host-state.py" "$release_id" "$integration_revision" "$image_digest" "$locator_sha256" <<'PY'
import json
import subprocess
import sys

script, release_id, revision, image_digest, locator_sha256 = sys.argv[1:]
active = json.loads(subprocess.check_output(["python3", script, "active", "--state-dir", "/home/projects/act/data/runtime"], text=True))
if active.get('activeReleaseId') != release_id:
    raise SystemExit('active receipt does not select the required release')
for container in ('act-obe-app', 'act-obe-worker'):
    actual = subprocess.check_output(['podman', 'inspect', '--format', '{{.Image}}', container], text=True).strip()
    if actual != image_digest:
        raise SystemExit('%s image does not equal activation image digest' % container)
receipt_path = '/home/projects/act/data/runtime/act-runtime-active-receipt.json'
with open(receipt_path, encoding='utf-8') as handle:
    receipt = json.load(handle)
deployment = receipt.get('deployment') or {}
if deployment != {'appRevision': revision, 'imageDigest': image_digest, 'releaseLocatorSha256': locator_sha256}:
    raise SystemExit('active receipt deployment proof is incomplete')
print(json.dumps({'releaseId': release_id, 'appRevision': revision, 'imageDigest': image_digest}, separators=(',', ':')))
PY

printf '%s\n' "runtime-cutover-complete release=${release_id} revision=${integration_revision} imageTarSha256=${image_tar_sha256}"
