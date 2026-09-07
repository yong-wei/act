#!/usr/bin/env bash
set -euo pipefail

# Keep runtime and application deployment as two independent operations. The
# runtime command owns its immutable release arguments; application deployment
# uses the selected view without redistributing runtime content.
#
# Combined deploys publish runtime before replacing the app, so Teaching
# Projection assertions must target the application revision about to be
# installed (git HEAD, the same capture build.sh stamps), not the still-running
# previous container. After app deploy, the same candidate is re-asserted
# against that coordinated target.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

target_app_revision="$(git -C "$ROOT_DIR" rev-parse HEAD)"
target_app_revision="$(printf '%s' "$target_app_revision" | tr -d '[:space:]')"
[[ "$target_app_revision" =~ ^[a-f0-9]{40}$ ]] || {
  echo "ERROR: coordinated application revision is invalid" >&2
  exit 1
}

source_revision=""
resume_artifact_dir=""
args=("$@")
for ((i = 0; i < ${#args[@]}; i++)); do
  case "${args[$i]}" in
    --source-revision)
      source_revision="${args[$((i + 1))]:-}"
      ;;
    --resume-published-artifact-dir)
      resume_artifact_dir="${args[$((i + 1))]:-}"
      ;;
  esac
done
if [[ -z "$source_revision" && -n "$resume_artifact_dir" ]]; then
  source_revision="$(python3 -c 'import json,sys; print(json.load(open(sys.argv[1]))["sourceRevision"])' "$resume_artifact_dir/manifest.json")"
fi
source_revision="$(printf '%s' "$source_revision" | tr -d '[:space:]')"
[[ "$source_revision" =~ ^[a-f0-9]{40}$ ]] || {
  echo "ERROR: deploy:all requires --source-revision or a resume artifact with sourceRevision" >&2
  exit 1
}

export ACT_RUNTIME_TARGET_APP_REVISION="$target_app_revision"
bash "$ROOT_DIR/scripts/deploy-runtime-blob-release.sh" "$@"
bash "$ROOT_DIR/scripts/remote-deploy.sh" --app-only
npx tsx "$ROOT_DIR/scripts/knowledge/assert-teaching-projection-app-revision.ts" \
  --repo-root "$ROOT_DIR" \
  --source-revision "$source_revision" \
  --app-revision "$target_app_revision"
