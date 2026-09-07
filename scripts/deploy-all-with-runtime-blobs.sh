#!/usr/bin/env bash
set -euo pipefail

# Combined deploys must not select a new Runtime while the previous
# application is still running. Fresh publishes stage a NON_SELECTABLE
# Runtime against the upcoming git HEAD (the same capture build.sh stamps),
# replace the app, then resume/select that staged release against the live
# container. Resume-only combined deploys replace the app first, then select
# the already published Runtime.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

target_app_revision="$(git -C "$ROOT_DIR" rev-parse HEAD)"
target_app_revision="$(printf '%s' "$target_app_revision" | tr -d '[:space:]')"
[[ "$target_app_revision" =~ ^[a-f0-9]{40}$ ]] || {
  echo "ERROR: coordinated application revision is invalid" >&2
  exit 1
}

source_revision=""
resume_artifact_dir=""
artifact_dir=""
args=("$@")
for ((i = 0; i < ${#args[@]}; i++)); do
  case "${args[$i]}" in
    --source-revision)
      source_revision="${args[$((i + 1))]:-}"
      ;;
    --resume-published-artifact-dir)
      resume_artifact_dir="${args[$((i + 1))]:-}"
      ;;
    --artifact-dir)
      artifact_dir="${args[$((i + 1))]:-}"
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

assert_after_activation() {
  npx tsx "$ROOT_DIR/scripts/knowledge/assert-teaching-projection-app-revision.ts" \
    --repo-root "$ROOT_DIR" \
    --source-revision "$source_revision" \
    --app-revision "$target_app_revision"
}

if [[ -z "$resume_artifact_dir" ]]; then
  [[ -n "$artifact_dir" && "$artifact_dir" = /* ]] || {
    echo "ERROR: deploy:all requires --artifact-dir so the staged Runtime can be selected after the app deploy" >&2
    exit 1
  }
  if [[ -e "$artifact_dir" ]]; then
    [[ -d "$artifact_dir" && ! -L "$artifact_dir" ]] || {
      echo "ERROR: --artifact-dir must be an absolute real directory" >&2
      exit 1
    }
  fi
  export ACT_RUNTIME_TARGET_APP_REVISION="$target_app_revision"
  bash "$ROOT_DIR/scripts/deploy-runtime-blob-release.sh" "$@" --stage-only
  unset ACT_RUNTIME_TARGET_APP_REVISION
  bash "$ROOT_DIR/scripts/remote-deploy.sh" --app-only
  bash "$ROOT_DIR/scripts/deploy-runtime-blob-release.sh" \
    --resume-published-artifact-dir "$artifact_dir"
  assert_after_activation
  exit 0
fi

# Resume-only: preflight the already published candidate against the upcoming
# app HEAD before any irreversible application replace.
assert_after_activation
bash "$ROOT_DIR/scripts/remote-deploy.sh" --app-only
bash "$ROOT_DIR/scripts/deploy-runtime-blob-release.sh" \
  --resume-published-artifact-dir "$resume_artifact_dir"
assert_after_activation
