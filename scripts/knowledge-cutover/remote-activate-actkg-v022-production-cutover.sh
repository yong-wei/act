#!/usr/bin/env bash
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
SSH_TARGET="${1:-root@121.40.124.135}"
ACTION="${2:-activate}"
REMOTE_WORK="${REMOTE_WORK:-/tmp/v022-production-cutover}"
IMAGE="${IMAGE:-localhost/act-obe-platform:v022-774c72dd97}"
PUBLIC_URL="${PUBLIC_URL:-https://act.adapt-learn.online}"

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
def marker_committed(path):
    try:
        data = json.loads(open(path, encoding="utf-8").read())
        steps = data.get("steps") or []
        return (
            data.get("status") == "COMMITTED"
            and bool(steps)
            and all(step.get("status") == "APPLIED" for step in steps)
            and isinstance(data.get("journalHash"), str)
            and len(data.get("journalHash")) == 64
        )
    except Exception:
        return False
app = sh("podman inspect -f {{.ImageName}} act-obe-app")
worker = sh("podman inspect -f {{.ImageName}} act-obe-worker")
app_id = sh("podman inspect -f {{.Image}} act-obe-app").replace("sha256:", "")
worker_id = sh("podman inspect -f {{.Image}} act-obe-worker").replace("sha256:", "")
view = "/home/projects/act/data/runtime/blob-views/current/knowledge"
auth = "/home/projects/act/course-content/authoring/knowledge/authority/current.json"
worker_health = sh("podman inspect -f {{.State.Health.Status}} act-obe-worker || echo unknown")
readyz = json.loads(sh("curl -fsS http://127.0.0.1:8084/api/readyz"))
print(json.dumps({
  "appImage": app,
  "appImageId": app_id,
  "workerImage": worker,
  "workerImageId": worker_id,
  "workerHealth": worker_health,
  "readyz": {"app": bool(readyz.get("app")), "db": bool(readyz.get("db")), "redis": bool(readyz.get("redis"))},
  "hashes": {
    "authority": digest(auth),
    "projection": digest(view + "/projection/current.json"),
    "prerequisite": digest(view + "/prerequisites/current.json"),
    "authority-domain-shards": digest(view + "/authority-domain-shards/current.json"),
    "consumer-activation": digest(view + "/consumer-activation/current.json"),
  },
  "firstActivation": marker_committed(view + "/consumer-activation/first-activation-transactions/first-cutover-7f4cdd1084af419a3e837876.json"),
}))
PY'
}

echo "=== host observation ==="
OBS_JSON="$(collect_observation)"
printf '%s\n' "$OBS_JSON"

echo "=== stage operator modules ==="
ssh_run "mkdir -p '$REMOTE_WORK/src/lib/teaching-projection/publish' '$REMOTE_WORK/src/lib/teaching-projection/qualify' '$REMOTE_WORK/src/lib/actkg-envelope' '$REMOTE_WORK/scripts/knowledge-cutover' '$REMOTE_WORK/live/course-content/authoring/knowledge' '$REMOTE_WORK/out'
chmod 0777 '$REMOTE_WORK/out'"
rsync -a "$ROOT/src/lib/teaching-projection/publish/" \
  "$SSH_TARGET:$REMOTE_WORK/src/lib/teaching-projection/publish/"
rsync -a "$ROOT/src/lib/teaching-projection/qualify/" \
  "$SSH_TARGET:$REMOTE_WORK/src/lib/teaching-projection/qualify/"
rsync -a "$ROOT/src/lib/actkg-envelope/" \
  "$SSH_TARGET:$REMOTE_WORK/src/lib/actkg-envelope/"
rsync -a "$ROOT/scripts/knowledge-cutover/activate-actkg-v022-production-cutover.ts" \
  "$SSH_TARGET:$REMOTE_WORK/scripts/knowledge-cutover/"
rsync -a "$ROOT/scripts/db/verified-test-accounts.mjs" \
  "$SSH_TARGET:$REMOTE_WORK/accounts.mjs"
rsync -a \
  "$ROOT/course-content/authoring/knowledge/cutover/runtime-releases/control-theory-engineering-v0.22/" \
  "$SSH_TARGET:$REMOTE_WORK/runtime-releases/"
rsync -a \
  "$ROOT/course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.22/" \
  "$SSH_TARGET:$REMOTE_WORK/qualification/"
rsync -a \
  "$ROOT/course-content/authoring/knowledge/cutover/envelopes/" \
  "$SSH_TARGET:$REMOTE_WORK/envelopes/"
ssh_run "mkdir -p /home/projects/act/data/runtime/knowledge-cutover/candidates/control-theory-engineering-v0.22"
rsync -a \
  "$ROOT/course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.22/" \
  "$SSH_TARGET:/home/projects/act/data/runtime/knowledge-cutover/candidates/control-theory-engineering-v0.22/authority/"
rsync -a \
  "$ROOT/course-content/authoring/knowledge/teaching-projection/candidates/control-theory-engineering-v0.22/" \
  "$SSH_TARGET:/home/projects/act/data/runtime/knowledge-cutover/candidates/control-theory-engineering-v0.22/teaching-projection/"
rsync -a \
  "$ROOT/course-content/authoring/knowledge/authority-domain-catalog/candidates/control-theory-engineering-v0.22/" \
  "$SSH_TARGET:/home/projects/act/data/runtime/knowledge-cutover/candidates/control-theory-engineering-v0.22/catalog/"

echo "=== bind live stores ==="
ssh_run "ln -sfn /home/projects/act/course-content/authoring/knowledge/authority $REMOTE_WORK/live/course-content/authoring/knowledge/authority"
printf '%s\n' "$OBS_JSON" | ssh -o BatchMode=yes "$SSH_TARGET" "cat > '$REMOTE_WORK/obs.json'"

export REMOTE_WORK IMAGE PUBLIC_URL ACTION
python3 - <<'PY'
import json, os, shlex
remote_work = os.environ["REMOTE_WORK"]
image = os.environ["IMAGE"]
public_url = os.environ["PUBLIC_URL"]
action = os.environ["ACTION"]
text = f'''#!/usr/bin/env bash
set -euo pipefail
ACTION={shlex.quote(action)}
eval "$(python3 - <<'PY2'
import json, shlex
obs = json.load(open({json.dumps(remote_work + "/obs.json")}, encoding="utf-8"))
mapping = {{
  "appImage": obs["appImage"],
  "appImageId": obs["appImageId"],
  "workerImage": obs["workerImage"],
  "workerImageId": obs["workerImageId"],
  "workerHealth": obs.get("workerHealth", "unknown"),
  "readyz": json.dumps(obs["readyz"], separators=(",", ":")),
  "firstActivation": "true" if obs.get("firstActivation") else "false",
}}
for key, value in mapping.items():
    print(f"{{key}}={{shlex.quote(str(value))}}")
PY2
)"
REMOTE_WORK={shlex.quote(remote_work)}
IMAGE={shlex.quote(image)}
PUBLIC_URL={shlex.quote(public_url)}
podman run --rm --network host --user 0:0 \\
  --entrypoint ./node_modules/.bin/tsx \\
  -v "$REMOTE_WORK/src/lib/teaching-projection/publish:/app/src/lib/teaching-projection/publish:ro" \\
  -v "$REMOTE_WORK/src/lib/teaching-projection/qualify:/app/src/lib/teaching-projection/qualify:ro" \\
  -v "$REMOTE_WORK/src/lib/actkg-envelope:/app/src/lib/actkg-envelope:ro" \\
  -v "$REMOTE_WORK/scripts/knowledge-cutover/activate-actkg-v022-production-cutover.ts:/app/scripts/knowledge-cutover/activate-actkg-v022-production-cutover.ts:ro" \\
  -v "$REMOTE_WORK/live/course-content/authoring/knowledge/authority:/app/course-content/authoring/knowledge/authority" \\
  -v /home/projects/act/data/runtime/blob-views/current:/app/course-content/runtime \\
  -v "$REMOTE_WORK/qualification:/app/course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.22:ro" \\
  -v "$REMOTE_WORK/runtime-releases:/app/course-content/authoring/knowledge/cutover/runtime-releases/control-theory-engineering-v0.22" \\
  -v "$REMOTE_WORK/envelopes:/app/course-content/authoring/knowledge/cutover/envelopes:ro" \\
  -v /home/projects/act/data/runtime/knowledge-cutover/candidates/control-theory-engineering-v0.22/authority:/app/course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.22:ro \\
  -v /home/projects/act/data/runtime/knowledge-cutover/candidates/control-theory-engineering-v0.22/teaching-projection:/app/course-content/authoring/knowledge/teaching-projection/candidates/control-theory-engineering-v0.22:ro \\
  -v /home/projects/act/data/runtime/knowledge-cutover/candidates/control-theory-engineering-v0.22/catalog:/app/course-content/authoring/knowledge/authority-domain-catalog/candidates/control-theory-engineering-v0.22:ro \\
  -v "$REMOTE_WORK/accounts.mjs:/app/scripts/db/verified-test-accounts.mjs:ro" \\
  -v "$REMOTE_WORK/out:/out" \\
  "$IMAGE" \\
  /app/scripts/knowledge-cutover/activate-actkg-v022-production-cutover.ts "$ACTION" \\
  --root /app \\
  --out /out \\
  --predecessor-source host \\
  --first-activation-committed "$firstActivation" \\
  --marker-present "$firstActivation" \\
  --app-image "$appImage" \\
  --app-image-id "$appImageId" \\
  --worker-image "$workerImage" \\
  --worker-image-id "$workerImageId" \\
  --worker-health "$workerHealth" \\
  --readyz-json "$readyz" \\
  --public-url "$PUBLIC_URL" \\
  --candidate-root /app
post_worker=$(podman inspect -f '{{{{.State.Health.Status}}}}' act-obe-worker 2>/dev/null || echo unknown)
printf '%s\\n' "$post_worker" > "$REMOTE_WORK/out/post-worker-health.txt"
'''
from pathlib import Path
text = text.replace('{{{{.State.Health.Status}}}}', '{{.State.Health.Status}}')
Path('/tmp/v022-run-sidecar.sh').write_text(text)
print('wrote /tmp/v022-run-sidecar.sh')
PY
rsync -a /tmp/v022-run-sidecar.sh "$SSH_TARGET:$REMOTE_WORK/run-sidecar.sh"
ssh_run "chmod +x '$REMOTE_WORK/run-sidecar.sh'
mkdir -p /home/projects/act/data/runtime/knowledge-cutover '$REMOTE_WORK/out/predecessor-bytes'
flock -n /home/projects/act/data/runtime/knowledge-cutover/.v022-cutover.lock '$REMOTE_WORK/run-sidecar.sh'"

echo "=== done ==="
