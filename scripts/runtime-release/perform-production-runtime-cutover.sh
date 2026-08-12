#!/usr/bin/env bash
set -euo pipefail

release_id=''
integration_revision=''
image_tar=''
image_stdin=0
expected_image_tar_sha256=''
expected_image_digest=''
minimum_available_bytes=''
image_reference=''
provenance=''
verification_receipt=''
release_locator=''
ram_role=''
stage_dir=''
state_dir="${ACT_RUNTIME_STATE_DIR:-/home/projects/act/data/runtime}"

while [[ $# -gt 0 ]]; do
  case "$1" in
    --release-id) release_id="$2"; shift 2 ;;
    --integration-revision) integration_revision="$2"; shift 2 ;;
    --image-tar) image_tar="$2"; shift 2 ;;
    --image-stdin) image_stdin=1; shift ;;
    --expected-image-tar-sha256) expected_image_tar_sha256="$2"; shift 2 ;;
    --expected-image-digest) expected_image_digest="$2"; shift 2 ;;
    --minimum-available-bytes) minimum_available_bytes="$2"; shift 2 ;;
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
[[ "$state_dir" =~ ^/[A-Za-z0-9._/-]+$ ]] || { echo 'ERROR: invalid runtime state directory' >&2; exit 1; }
[[ "$image_stdin" == '0' || "$image_tar" == '' ]] || { echo 'ERROR: image tar and image stdin are mutually exclusive' >&2; exit 1; }
if [[ "$image_stdin" == '1' ]]; then
  [[ "$expected_image_tar_sha256" =~ ^[a-f0-9]{64}$ ]] || { echo 'ERROR: streamed image digest is invalid' >&2; exit 1; }
  [[ "$expected_image_digest" =~ ^sha256:[a-f0-9]{64}$ ]] || { echo 'ERROR: streamed image ID is invalid' >&2; exit 1; }
  [[ "$minimum_available_bytes" =~ ^[1-9][0-9]*$ ]] || { echo 'ERROR: streamed image minimum capacity is invalid' >&2; exit 1; }
else
  [[ -f "$image_tar" && ! -L "$image_tar" ]] || { echo 'ERROR: staged image tar is unavailable' >&2; exit 1; }
fi
for required in "$provenance" "$verification_receipt" "$release_locator"; do
  [[ -f "$required" && ! -L "$required" ]] || { echo "ERROR: required staged file is unavailable: $required" >&2; exit 1; }
done

require_cmd() { command -v "$1" >/dev/null 2>&1 || { echo "ERROR: required command unavailable: $1" >&2; exit 1; }; }
for command in curl df mkfifo podman python3 sha256sum tee; do require_cmd "$command"; done

role="$(curl --fail --silent --show-error --connect-timeout 2 --max-time 5 http://100.100.100.200/latest/meta-data/ram/security-credentials/ | tr -d '\r\n')"
[[ "$role" == "$ram_role" ]] || { echo 'ERROR: ECS RAM role is not the required read-only role' >&2; exit 1; }

python3 - "$integration_revision" "$release_id" "$image_tar" "$expected_image_tar_sha256" "$provenance" "$verification_receipt" "$release_locator" <<'PY'
import hashlib
import json
import pathlib
import re
import sys

revision, release_id, image_tar, expected_image_tar_sha256, provenance, receipt, locator = sys.argv[1:]
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
actual_image_tar_sha256 = expected_image_tar_sha256 if not image_tar else digest(image_tar)
if prov.get('appRevision') != revision or prov.get('imageTarSha256') != actual_image_tar_sha256:
    raise SystemExit('image provenance does not bind the staged integration image')
if verified.get('releaseId') != release_id or not sha256.fullmatch(str(verified.get('manifestSha256'))) or not sha256.fullmatch(str(verified.get('treeSha256'))):
    raise SystemExit('runtime verification receipt is invalid')
source_revision = release.get('sourceRevision')
tree_sha256 = release.get('treeSha256')
if not isinstance(source_revision, str) or not re.fullmatch(r'[a-f0-9]{40}', source_revision):
    raise SystemExit('release locator source revision is invalid')
if not isinstance(tree_sha256, str) or not sha256.fullmatch(tree_sha256):
    raise SystemExit('release locator tree digest is invalid')
expected_release_id = 'runtime-' + hashlib.sha256(json.dumps({'sourceRevision': source_revision, 'treeSha256': tree_sha256}, sort_keys=True, separators=(',', ':')).encode('utf-8')).hexdigest()[:55]
if release.get('releaseId') != release_id or expected_release_id != release_id:
    raise SystemExit('release locator does not bind the immutable runtime release')
if release.get('manifestSha256') != verified.get('manifestSha256') or release.get('treeSha256') != verified.get('treeSha256'):
    raise SystemExit('release locator differs from runtime verification receipt')
print(json.dumps({'releaseId': release_id, 'appRevision': revision, 'imageTarSha256': actual_image_tar_sha256}, separators=(',', ':')))
PY

if [[ "$image_stdin" == '1' ]]; then
  graph_root="$(podman info --format '{{.Store.GraphRoot}}')"
  [[ "$graph_root" == /* && -d "$graph_root" ]] || { echo 'ERROR: Podman graph root is invalid' >&2; exit 1; }
  available_bytes="$(df -B1 "$graph_root" | awk 'NR == 2 { print $4 }')"
  [[ "$available_bytes" =~ ^[0-9]+$ && "$available_bytes" -ge "$minimum_available_bytes" ]] || { echo 'ERROR: insufficient Podman storage for streamed image import' >&2; exit 1; }
  stream_dir="$(mktemp -d "$stage_dir/.image-stream.XXXXXX")"
  stream_fifo="$stream_dir/image.tar.fifo"
  stream_digest="$stream_dir/image.tar.sha256"
  cleanup_stream() { rm -rf "$stream_dir"; }
  trap cleanup_stream EXIT
  mkfifo -m 0600 "$stream_fifo"
  sha256sum < "$stream_fifo" | awk '{print $1}' > "$stream_digest" &
  hash_pid=$!
  set -o pipefail
  tee "$stream_fifo" | podman load -q >/dev/null
  wait "$hash_pid"
  image_tar_sha256="$(cat "$stream_digest")"
  [[ "$image_tar_sha256" == "$expected_image_tar_sha256" ]] || { echo 'ERROR: streamed image digest does not match provenance' >&2; exit 1; }
  trap - EXIT
  cleanup_stream
else
  image_tar_sha256="$(sha256sum "$image_tar" | awk '{print $1}')"
  podman load -i "$image_tar" >/dev/null
fi
image_id="$(podman image inspect --format '{{.Id}}' "$image_reference")"
[[ "$image_id" =~ ^(sha256:)?([a-f0-9]{64})$ ]] || { echo 'ERROR: loaded image does not have a valid image ID' >&2; exit 1; }
image_digest="sha256:${BASH_REMATCH[2]}"
image_revision="$(podman image inspect --format '{{ index .Labels "org.opencontainers.image.revision" }}' "$image_digest")"
[[ "$image_revision" == "$integration_revision" ]] || { echo 'ERROR: loaded image does not bind the required integration revision' >&2; exit 1; }
[[ "$image_stdin" == '0' || "$image_digest" == "$expected_image_digest" ]] || { echo 'ERROR: streamed image ID does not match the verified local image' >&2; exit 1; }
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

python3 - "$stage_dir/runtime-release-host-state.py" "$release_id" "$integration_revision" "$image_digest" "$locator_sha256" "$state_dir" <<'PY'
import json
import re
import subprocess
import sys

script, release_id, revision, image_digest, locator_sha256, state_dir = sys.argv[1:]
active = json.loads(subprocess.check_output(["python3", script, "active", "--state-dir", state_dir], text=True))
if active.get('activeReleaseId') != release_id:
    raise SystemExit('active receipt does not select the required release')
for container in ('act-obe-app', 'act-obe-worker'):
    actual = subprocess.check_output(['podman', 'inspect', '--format', '{{.Image}}', container], text=True).strip()
    if re.fullmatch(r'(?:sha256:)?[a-f0-9]{64}', actual) and not actual.startswith('sha256:'):
        actual = 'sha256:' + actual
    if actual != image_digest:
        raise SystemExit('%s image does not equal activation image digest' % container)
receipt_path = state_dir + '/act-runtime-active-receipt.json'
with open(receipt_path, encoding='utf-8') as handle:
    receipt = json.load(handle)
deployment = receipt.get('deployment') or {}
if deployment != {'appRevision': revision, 'imageDigest': image_digest, 'releaseLocatorSha256': locator_sha256}:
    raise SystemExit('active receipt deployment proof is incomplete')
print(json.dumps({'releaseId': release_id, 'appRevision': revision, 'imageDigest': image_digest}, separators=(',', ':')))
PY

printf '%s\n' "runtime-cutover-complete release=${release_id} revision=${integration_revision} imageTarSha256=${image_tar_sha256}"
