#!/usr/bin/env bash
set -euo pipefail

# Production sidecar for #1412. Copies new cutover modules onto the host, binds
# live Authority + blob-view knowledge stores, then runs the official CLI.

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SSH_TARGET="${1:-root@121.40.124.135}"
ACTION="${2:-activate}"
REMOTE_WORK="${REMOTE_WORK:-/tmp/v018-production-cutover}"
IMAGE="${IMAGE:-localhost/act-obe-platform:v018-94d585ae63a6}"
PUBLIC_URL="${PUBLIC_URL:-https://act.adapt-learn.online}"

die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

ssh_run() {
  ssh -o BatchMode=yes "$SSH_TARGET" "$@"
}

collect_observation() {
  ssh_run 'python3 - <<'"'"'PY'"'"'
import json, subprocess, hashlib, os
def sh(cmd):
    return subprocess.check_output(cmd, shell=True, universal_newlines=True).strip()
def digest(path):
    return hashlib.sha256(open(path, "rb").read()).hexdigest()
app = sh("podman inspect -f {{.ImageName}} act-obe-app")
worker = sh("podman inspect -f {{.ImageName}} act-obe-worker")
app_id = sh("podman inspect -f {{.Image}} act-obe-app").replace("sha256:", "")
worker_id = sh("podman inspect -f {{.Image}} act-obe-worker").replace("sha256:", "")
view = "/home/projects/act/data/runtime/blob-views/current/knowledge"
auth = "/home/projects/act/course-content/authoring/knowledge/authority/current.json"
print(json.dumps({
  "appImage": app,
  "appImageId": app_id,
  "workerImage": worker,
  "workerImageId": worker_id,
  "hashes": {
    "authority": digest(auth),
    "projection": digest(view + "/projection/current.json"),
    "prerequisite": digest(view + "/prerequisites/current.json"),
    "authority-domain-shards": digest(view + "/authority-domain-shards/current.json"),
    "consumer-activation": digest(view + "/consumer-activation/current.json"),
  },
  "firstActivation": os.path.exists(view + "/consumer-activation/first-activation-transactions/first-cutover-7f4cdd1084af419a3e837876.json"),
}))
PY'
}

echo "=== host observation ==="
collect_observation

echo "=== stage operator modules ==="
ssh_run "mkdir -p '$REMOTE_WORK/src/lib/teaching-projection/publish' '$REMOTE_WORK/scripts/knowledge-cutover' '$REMOTE_WORK/live/course-content/authoring/knowledge' '$REMOTE_WORK/live/course-content/runtime' '$REMOTE_WORK/out'
chmod 0777 '$REMOTE_WORK/out'"
rsync -a "$ROOT/src/lib/teaching-projection/publish/" \
  "$SSH_TARGET:$REMOTE_WORK/src/lib/teaching-projection/publish/"
rsync -a "$ROOT/scripts/knowledge-cutover/activate-actkg-v018-production-cutover.ts" \
  "$SSH_TARGET:$REMOTE_WORK/scripts/knowledge-cutover/"
rsync -a \
  "$ROOT/course-content/authoring/knowledge/cutover/runtime-releases/control-theory-engineering-v0.18/" \
  "$SSH_TARGET:$REMOTE_WORK/runtime-releases/"
rsync -a \
  "$ROOT/course-content/authoring/knowledge/authority-domain-catalog/" \
  "$SSH_TARGET:$REMOTE_WORK/catalog-authoring/"

echo "=== bind live stores ==="
ssh_run "mkdir -p $REMOTE_WORK/live/course-content/authoring/knowledge $REMOTE_WORK/live/course-content/runtime $REMOTE_WORK/catalog-authoring $REMOTE_WORK/out
chmod 0777 $REMOTE_WORK/out
ln -sfn /home/projects/act/course-content/authoring/knowledge/authority $REMOTE_WORK/live/course-content/authoring/knowledge/authority
ln -sfn /home/projects/act/data/runtime/blob-views/current/knowledge $REMOTE_WORK/live/course-content/runtime/knowledge
"

echo "=== sidecar $ACTION ==="
# shellcheck disable=SC2029
ssh_run "podman run --rm --network host --user 0:0 \
  --entrypoint ./node_modules/.bin/tsx \
  -v $REMOTE_WORK/src/lib/teaching-projection/publish:/app/src/lib/teaching-projection/publish:ro \
  -v $REMOTE_WORK/scripts/knowledge-cutover/activate-actkg-v018-production-cutover.ts:/app/scripts/knowledge-cutover/activate-actkg-v018-production-cutover.ts:ro \
  -v $REMOTE_WORK/live/course-content/authoring/knowledge/authority:/app/course-content/authoring/knowledge/authority \
  -v /home/projects/act/data/runtime/blob-views/current:/app/course-content/runtime \
  -v /home/projects/act/data/runtime/knowledge-cutover/candidates/control-theory-engineering-v0.18/qualification:/app/course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.18:ro \
  -v $REMOTE_WORK/runtime-releases:/app/course-content/authoring/knowledge/cutover/runtime-releases/control-theory-engineering-v0.18:ro \
  -v /home/projects/act/data/runtime/knowledge-cutover/candidates/control-theory-engineering-v0.18/authority:/app/course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18:ro \
  -v /home/projects/act/data/runtime/knowledge-cutover/candidates/control-theory-engineering-v0.18/teaching-projection:/app/course-content/authoring/knowledge/teaching-projection/candidates/control-theory-engineering-v0.18:ro \
  -v $REMOTE_WORK/catalog-authoring:/app/course-content/authoring/knowledge/authority-domain-catalog:ro \
  -v $REMOTE_WORK/out:/out \
  $IMAGE \
  /app/scripts/knowledge-cutover/activate-actkg-v018-production-cutover.ts $ACTION \
  --root /app \
  --out /out \
  --predecessor-source host \
  --first-activation-committed true"

echo "=== done ==="
