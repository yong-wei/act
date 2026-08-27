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
collect_observation

echo "=== stage operator modules ==="
ssh_run "mkdir -p '$REMOTE_WORK/tools/teaching-projection-publishing/publish' '$REMOTE_WORK/tools/teaching-projection-publishing/qualify' '$REMOTE_WORK/scripts/knowledge-cutover' '$REMOTE_WORK/live/course-content/authoring/knowledge' '$REMOTE_WORK/live/course-content/runtime' '$REMOTE_WORK/out'
chmod 0777 '$REMOTE_WORK/out'"
rsync -a "$ROOT/tools/teaching-projection-publishing/publish/" \
  "$SSH_TARGET:$REMOTE_WORK/tools/teaching-projection-publishing/publish/"
rsync -a "$ROOT/tools/teaching-projection-publishing/qualify/" \
  "$SSH_TARGET:$REMOTE_WORK/tools/teaching-projection-publishing/qualify/"
rsync -a "$ROOT/scripts/knowledge-cutover/activate-actkg-v018-production-cutover.ts" \
  "$SSH_TARGET:$REMOTE_WORK/scripts/knowledge-cutover/"
rsync -a "$ROOT/scripts/db/verified-test-accounts.mjs" \
  "$SSH_TARGET:$REMOTE_WORK/accounts.mjs"
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

OBS_JSON="$(collect_observation)"
printf '%s\n' "$OBS_JSON"
printf '%s\n' "$OBS_JSON" | ssh -o BatchMode=yes "$SSH_TARGET" "cat > '$REMOTE_WORK/obs.json'"

echo "=== sidecar $ACTION ==="
export REMOTE_WORK IMAGE PUBLIC_URL
python3 - <<'PY'
import json, os, shlex
from pathlib import Path
remote_work = os.environ.get("REMOTE_WORK", "/tmp/v018-production-cutover")
image = os.environ.get("IMAGE", "localhost/act-obe-platform:v018-94d585ae63a6")
public_url = os.environ.get("PUBLIC_URL", "https://act.adapt-learn.online")
text = f'''#!/usr/bin/env bash
set -euo pipefail
ACTION="${{1:?action}}"
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
run_sidecar() {{
  local action="$1"
  podman run --rm --network host --user 0:0 \\
    --entrypoint ./node_modules/.bin/tsx \\
    -v "$REMOTE_WORK/tools/teaching-projection-publishing/publish:/app/tools/teaching-projection-publishing/publish:ro" \\
    -v "$REMOTE_WORK/scripts/knowledge-cutover/activate-actkg-v018-production-cutover.ts:/app/scripts/knowledge-cutover/activate-actkg-v018-production-cutover.ts:ro" \\
    -v "$REMOTE_WORK/tools/teaching-projection-publishing/qualify:/app/tools/teaching-projection-publishing/qualify:ro" \\
    -v "$REMOTE_WORK/live/course-content/authoring/knowledge/authority:/app/course-content/authoring/knowledge/authority" \\
    -v /home/projects/act/data/runtime/blob-views/current:/app/course-content/runtime \\
    -v /home/projects/act/data/runtime/knowledge-cutover/candidates/control-theory-engineering-v0.18/qualification:/app/course-content/authoring/knowledge/cutover/candidates/control-theory-engineering-v0.18:ro \\
    -v "$REMOTE_WORK/runtime-releases:/app/course-content/authoring/knowledge/cutover/runtime-releases/control-theory-engineering-v0.18:ro" \\
    -v /home/projects/act/data/runtime/knowledge-cutover/candidates/control-theory-engineering-v0.18/authority:/app/course-content/authoring/knowledge/authority/candidates/control-theory-engineering-v0.18:ro \\
    -v /home/projects/act/data/runtime/knowledge-cutover/candidates/control-theory-engineering-v0.18/teaching-projection:/app/course-content/authoring/knowledge/teaching-projection/candidates/control-theory-engineering-v0.18:ro \\
    -v "$REMOTE_WORK/catalog-authoring:/app/course-content/authoring/knowledge/authority-domain-catalog:ro" \\
    -v "$REMOTE_WORK/accounts.mjs:/app/scripts/db/verified-test-accounts.mjs:ro" \\
    -v "$REMOTE_WORK/out:/out" \\
    "$IMAGE" \\
    /app/scripts/knowledge-cutover/activate-actkg-v018-production-cutover.ts "$action" \\
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
    --public-url "$PUBLIC_URL"
}}
if [ "$ACTION" = rollback ] && [ ! -s "$REMOTE_WORK/out/production-cutover-journal.json" ]; then
  cp -f "$REMOTE_WORK/runtime-releases/production-cutover-journal.json" "$REMOTE_WORK/out/production-cutover-journal.json"
  cp -f "$REMOTE_WORK/runtime-releases/predecessor-bytes/"* "$REMOTE_WORK/out/predecessor-bytes/" 2>/dev/null || true
  chmod -R 0777 "$REMOTE_WORK/out"
fi
run_sidecar "$ACTION"
post_worker=$(podman inspect -f '{{{{.State.Health.Status}}}}' act-obe-worker 2>/dev/null || echo unknown)
printf '%s\\n' "$post_worker" > "$REMOTE_WORK/out/post-worker-health.txt"
if [ "$ACTION" = activate ] && [ "$post_worker" != healthy ] && [ "$post_worker" != running ]; then
  echo "post-switch worker not healthy: $post_worker; journaled rollback" >&2
  run_sidecar rollback
  exit 2
fi
'''
text = text.replace('{{{{.State.Health.Status}}}}', '{{.State.Health.Status}}')
Path('/tmp/v018-run-sidecar.sh').write_text(text)
print('wrote /tmp/v018-run-sidecar.sh')
PY
rsync -a /tmp/v018-run-sidecar.sh "$SSH_TARGET:$REMOTE_WORK/run-sidecar.sh"
ssh_run "chmod +x '$REMOTE_WORK/run-sidecar.sh'
mkdir -p /home/projects/act/data/runtime/knowledge-cutover '$REMOTE_WORK/out/predecessor-bytes'
flock -n /home/projects/act/data/runtime/knowledge-cutover/.v018-cutover.lock '$REMOTE_WORK/run-sidecar.sh' '$ACTION'"

echo "=== done ==="
