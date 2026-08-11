#!/usr/bin/env bash
set -Eeuo pipefail

action="${1:-}"
shift || true

die() {
  printf 'ERROR: %s\n' "$*" >&2
  exit 1
}

hash_file() {
  if command -v sha256sum >/dev/null 2>&1; then
    sha256sum "$1" | awk '{print $1}'
  else
    shasum -a 256 "$1" | awk '{print $1}'
  fi
}

safe_token() {
  [[ "$1" =~ ^[A-Za-z0-9._:/@-]+$ ]] || die "invalid refresh argument"
}

normalize_digest() {
  local raw="$1"
  if [[ "$raw" =~ ^sha256:[a-f0-9]{64}$ ]]; then
    printf '%s\n' "$raw"
  elif [[ "$raw" =~ ^[a-f0-9]{64}$ ]]; then
    printf 'sha256:%s\n' "$raw"
  else
    die 'invalid OCI image digest'
  fi
}

regular_file() {
  [ -f "$1" ] && [ ! -L "$1" ]
}

file_size() {
  if stat -c '%s' "$1" >/dev/null 2>&1; then
    stat -c '%s' "$1"
  else
    stat -f '%z' "$1"
  fi
}

file_mode() {
  if stat -c '%a' "$1" >/dev/null 2>&1; then
    stat -c '%a' "$1"
  else
    stat -f '%Lp' "$1"
  fi
}

file_owner() {
  if stat -c '%u:%g' "$1" >/dev/null 2>&1; then
    stat -c '%u:%g' "$1"
  else
    stat -f '%u:%g' "$1"
  fi
}

json_value() {
  local json="$1"
  local expression="$2"
  node -e 'const value=JSON.parse(process.argv[1]); const result=Function("value", `return (${process.argv[2]})`)(value); if (result === undefined || result === null) process.stdout.write(""); else if (typeof result === "string") process.stdout.write(result); else process.stdout.write(JSON.stringify(result));' -- "$json" "$expression"
}

read_mode_status() {
  local env_file="$1"
  ENV_MODE_COUNT=0
  ENV_MODE_VALUE=''
  ENV_MODE_STATUS='missing'
  if ! regular_file "$env_file"; then
    return 0
  fi
  while IFS= read -r line; do
    case "$line" in
      ACT_KNOWLEDGE_DEPLOYMENT_MODE=*)
        ENV_MODE_COUNT=$((ENV_MODE_COUNT + 1))
        ENV_MODE_VALUE="${line#ACT_KNOWLEDGE_DEPLOYMENT_MODE=}"
        ;;
    esac
  done < "$env_file"
  if [ "$ENV_MODE_COUNT" -eq 0 ]; then
    ENV_MODE_STATUS='missing'
  elif [ "$ENV_MODE_COUNT" -gt 1 ]; then
    ENV_MODE_STATUS='duplicate'
  elif [ "$ENV_MODE_VALUE" = 'legacy' ]; then
    ENV_MODE_STATUS='legacy'
  elif [ "$ENV_MODE_VALUE" = 'cutover' ]; then
    ENV_MODE_STATUS='cutover'
  else
    ENV_MODE_STATUS='invalid'
  fi
}

env_hash_or_empty() {
  if regular_file "$1"; then
    hash_file "$1"
  else
    printf '%s\n' ''
  fi
}

normalize_runtime_env() {
  local env_file="$1"
  local parent mode owner temporary
  parent="$(dirname "$env_file")"
  mkdir -p "$parent" || return 1
  if [ -e "$env_file" ] || [ -L "$env_file" ]; then
    if ! regular_file "$env_file"; then
      printf 'ERROR: runtime env must be a regular file\n' >&2
      return 1
    fi
    mode="$(file_mode "$env_file")"
    owner="$(file_owner "$env_file")"
  else
    mode='600'
    owner=''
  fi
  temporary="${env_file}.refresh-tmp.$$"
  rm -f "$temporary"
  if regular_file "$env_file"; then
    awk -F= '$1 != "ACT_KNOWLEDGE_DEPLOYMENT_MODE"' "$env_file" > "$temporary" || return 1
  else
    : > "$temporary"
  fi
  printf '%s\n' 'ACT_KNOWLEDGE_DEPLOYMENT_MODE=cutover' >> "$temporary"
  chmod "$mode" "$temporary" || return 1
  if [ -n "$owner" ]; then
    chown "$owner" "$temporary" || return 1
  fi
  mv -f "$temporary" "$env_file" || return 1
}

install_deploy_script() {
  local staged="$1"
  local destination="$2"
  local temporary="${destination}.refresh-tmp.$$"
  local mode='700'
  local owner=''
  mkdir -p "$(dirname "$destination")" || return 1
  if [ -e "$destination" ] || [ -L "$destination" ]; then
    regular_file "$destination" || return 1
    mode="$(file_mode "$destination")"
    owner="$(file_owner "$destination")"
  fi
  cp "$staged" "$temporary" || return 1
  chmod "$mode" "$temporary" || return 1
  if [ -n "$owner" ]; then
    chown "$owner" "$temporary" || return 1
  fi
  mv -f "$temporary" "$destination" || return 1
}

container_image_digest() {
  local container="$1"
  normalize_digest "$(podman inspect "$container" --format '{{.Image}}')"
}

container_image_name() {
  podman inspect "$1" --format '{{.ImageName}}'
}

container_mode() {
  local container="$1"
  local values
  values="$(podman inspect "$container" --format '{{range .Config.Env}}{{println .}}{{end}}' | awk -F= '$1 == "ACT_KNOWLEDGE_DEPLOYMENT_MODE" { print $2 }')"
  if [ "$(printf '%s\n' "$values" | sed '/^$/d' | wc -l | tr -d ' ')" != '1' ]; then
    printf '%s\n' 'mixed'
  else
    printf '%s\n' "$(printf '%s\n' "$values" | sed '/^$/d' | tail -n 1)"
  fi
}

write_refresh_receipt() {
  local receipt_path="$1"
  local refresh_id="$2"
  local started_at="$3"
  local completed_at="$4"
  local previous_digest="$5"
  local target_digest="$6"
  local final_app_digest="$7"
  local final_worker_digest="$8"
  local mode_before="$9"
  local mode_after="${10}"
  local env_before_hash="${11}"
  local env_after_hash="${12}"
  local env_before_count="${13}"
  local env_after_count="${14}"
  local protected_pre="${15}"
  local protected_post="${16}"
  local result="${17}"
  local failure_phase="${18}"
  local identities="${19}"
  local temporary

  if [ -e "$receipt_path" ] || [ -L "$receipt_path" ]; then
    return 1
  fi
  mkdir -p "$(dirname "$receipt_path")"
  chmod 700 "$(dirname "$receipt_path")"
  temporary="${receipt_path}.tmp.$$"
  rm -f "$temporary"
  node -e '
const fs = require("node:fs");
const [temporary, refreshId, startedAt, completedAt, previousDigest, targetDigest, finalAppDigest, finalWorkerDigest, modeBefore, modeAfter, envBeforeHash, envAfterHash, envBeforeCount, envAfterCount, protectedPre, protectedPost, result, failurePhase, identities] = process.argv.slice(1);
const hashOrNull = (value) => /^[a-f0-9]{64}$/u.test(value) || /^sha256:[a-f0-9]{64}$/u.test(value) ? value : null;
const safeMode = (value) => ["missing", "legacy", "cutover", "duplicate", "invalid"].includes(value) ? value : "unknown";
const parseObject = (value) => { try { const parsed = JSON.parse(value); return parsed && typeof parsed === "object" ? parsed : null; } catch { return null; } };
const document = {
  schema: "act.cutover-aware-application-refresh/v1",
  refreshId,
  startedAt,
  completedAt,
  previousAppImageDigest: hashOrNull(previousDigest),
  previousWorkerImageDigest: hashOrNull(previousDigest),
  targetAppImageDigest: hashOrNull(targetDigest),
  targetWorkerImageDigest: hashOrNull(targetDigest),
  previousAppWorkerImageDigest: hashOrNull(previousDigest),
  targetAppWorkerImageDigest: hashOrNull(targetDigest),
  finalAppImageDigest: hashOrNull(finalAppDigest),
  finalWorkerImageDigest: hashOrNull(finalWorkerDigest),
  mode: { before: safeMode(modeBefore), after: safeMode(modeAfter) },
  runtimeEnv: {
    beforeSha256: hashOrNull(envBeforeHash),
    afterSha256: hashOrNull(envAfterHash),
    beforeKeyStatus: safeMode(modeBefore),
    beforeKeyCount: Number(envBeforeCount),
    afterKeyStatus: safeMode(modeAfter),
    afterKeyCount: Number(envAfterCount),
  },
  protectedControlPlane: {
    pre: parseObject(protectedPre),
    post: parseObject(protectedPost),
  },
  identities: parseObject(identities),
  result,
  failurePhase: failurePhase || null,
};
fs.writeFileSync(temporary, `${JSON.stringify(document, null, 2)}\n`, { flag: "wx", mode: 0o600 });
' -- "$temporary" "$refresh_id" "$started_at" "$completed_at" "$previous_digest" "$target_digest" "$final_app_digest" "$final_worker_digest" "$mode_before" "$mode_after" "$env_before_hash" "$env_after_hash" "$env_before_count" "$env_after_count" "$protected_pre" "$protected_post" "$result" "$failure_phase" "$identities"
  if ! ln "$temporary" "$receipt_path" 2>/dev/null; then
    rm -f "$temporary"
    return 1
  fi
  rm -f "$temporary"
}

run_refresh() {
  [ "$#" -eq 11 ] || die 'refresh requires project_dir stage refresh_id image_tag tar_sha config_digest image_revision public_url minimum_free_bytes helper_sha deploy_sha'
  local project_dir="$1"
  local stage="$2"
  local refresh_id="$3"
  local image_tag="$4"
  local tar_sha="$5"
  local config_digest="$6"
  local image_revision="$7"
  local public_url="$8"
  local minimum_free_bytes="$9"
  local helper_sha="${10}"
  local deploy_sha="${11}"
  local runtime_root="${project_dir}/course-content/runtime"
  local env_file="${project_dir}/data/runtime/act-obe.env"
  local refresh_receipt="${project_dir}/data/runtime/knowledge-cutover/app-refresh/${refresh_id}.json"
  local marker="${runtime_root}/knowledge/production-cutover-transactions/current.json"
  local deploy_script="${project_dir}/scripts/4-deploy.sh"
  local helper_path="${stage}/refresh-state.mjs"
  local image_tar="${stage}/image.tar"
  local provenance="${stage}/image.tar.provenance.json"
  local started_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  local completed_at=''
  local target_digest="$(normalize_digest "$config_digest")"
  local previous_digest=''
  local previous_image=''
  local final_app_digest=''
  local final_worker_digest=''
  local mode_before='missing'
  local mode_after='missing'
  local env_before_hash=''
  local env_after_hash=''
  local env_before_count=0
  local env_after_count=0
  local pre_state=''
  local post_state=''
  local identities='null'
  local result='FAILED'
  local failure_phase='preflight'
  local mutation_started=0
  local recovery_status=1
  local exit_status=1
  local lock_dir=''

  for value in "$refresh_id" "$image_tag" "$image_revision" "$public_url" "$minimum_free_bytes" "$helper_sha" "$deploy_sha"; do
    safe_token "$value"
  done
  [[ "$refresh_id" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] || die 'invalid refresh id'
  [[ "$tar_sha" =~ ^[a-f0-9]{64}$ ]] || die 'invalid image tar sha256'
  [[ "$helper_sha" =~ ^[a-f0-9]{64}$ ]] || die 'invalid helper sha256'
  [[ "$deploy_sha" =~ ^[a-f0-9]{64}$ ]] || die 'invalid deploy script sha256'
  [[ "$image_revision" =~ ^[a-f0-9]{40}$ ]] || die 'invalid image revision'
  [[ "$minimum_free_bytes" =~ ^[0-9]+$ ]] || die 'invalid minimum free bytes'
  regular_file "$image_tar" || die 'staged image tar missing'
  regular_file "$provenance" || die 'staged provenance missing'
  regular_file "$helper_path" || die 'staged refresh helper missing'
  regular_file "${stage}/4-deploy.sh" || die 'staged deploy script missing'
  [ "$(hash_file "$helper_path")" = "$helper_sha" ] || die 'staged refresh helper hash mismatch'
  [ "$(hash_file "${stage}/4-deploy.sh")" = "$deploy_sha" ] || die 'staged deploy script hash mismatch'
  [ "$(hash_file "$image_tar")" = "$tar_sha" ] || die 'staged image tar hash mismatch'
  node -e 'const fs=require("node:fs"); const value=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if (value.imageTarSha256 !== process.argv[2] || value.appRevision !== process.argv[3]) process.exit(1);' -- "$provenance" "$tar_sha" "$image_revision" || die 'staged image provenance mismatch'
  [ ! -e "$refresh_receipt" ] && [ ! -L "$refresh_receipt" ] || die 'refresh receipt path already exists'

  lock_dir="${runtime_root}/knowledge/.production-cutover-operator.lock"
  mkdir -p "${runtime_root}/knowledge"
  if ! mkdir "$lock_dir" 2>/dev/null; then
    die 'application refresh lock unavailable'
  fi
  trap on_exit EXIT

  # Every mutable-state read below is inside the shared deployment lock.
  command -v node >/dev/null 2>&1 || die 'node is required on the remote host'
  command -v podman >/dev/null 2>&1 || die 'podman is required on the remote host'
  command -v df >/dev/null 2>&1 || die 'df is required on the remote host'
  command -v awk >/dev/null 2>&1 || die 'awk is required on the remote host'
  command -v curl >/dev/null 2>&1 || die 'curl is required on the remote host'

  read_mode_status "$env_file"
  mode_before="$ENV_MODE_STATUS"
  env_before_count="$ENV_MODE_COUNT"
  env_before_hash="$(env_hash_or_empty "$env_file")"
  regular_file "$marker" || die 'committed production marker missing'
  pre_state="$(node "$helper_path" validate "$project_dir")" || die 'committed cutover control plane validation failed'
  identities="$pre_state"
  previous_image="$(container_image_name act-obe-app)"
  [ -n "$previous_image" ] || die 'previous app image identity missing'
  [ "$previous_image" = "$(container_image_name act-obe-worker)" ] || die 'app and worker previous image names differ'
  previous_digest="$(container_image_digest act-obe-app)"
  [ "$previous_digest" = "$(container_image_digest act-obe-worker)" ] || die 'app and worker previous image digests differ'
  # The committed marker records the image used for the first cutover as
  # immutable audit evidence. Later refreshes intentionally advance the
  # running digest, so recovery is bound to the two live containers above,
  # not to the historical marker digest.
  [ "$(podman inspect act-obe-app --format '{{.State.Running}}')" = 'true' ] || die 'app is not running'
  [ "$(podman inspect act-obe-worker --format '{{.State.Running}}')" = 'true' ] || die 'worker is not running'
  [ "$(container_mode act-obe-app)" = 'cutover' ] || die 'app is not running in cutover mode'
  [ "$(container_mode act-obe-worker)" = 'cutover' ] || die 'worker is not running in cutover mode'
  local available_kib available_bytes image_bytes required_bytes
  available_kib="$(df -Pk "$project_dir" | awk 'NR == 2 { print $4 }')"
  [[ "$available_kib" =~ ^[0-9]+$ ]] || die 'remote capacity could not be read'
  available_bytes=$((available_kib * 1024))
  image_bytes="$(file_size "$image_tar")"
  required_bytes=$((image_bytes + minimum_free_bytes))
  [ "$available_bytes" -ge "$required_bytes" ] || die 'remote capacity is insufficient before app stop'

  # Load and verify the image while the old containers are still serving.
  failure_phase='image-load'
  podman load -i "$image_tar" >/dev/null
  [ "$(podman image inspect "$image_tag" --format '{{.Id}}')" = "$target_digest" ] || die 'loaded image config digest mismatch'
  [ "$(podman image inspect "$image_tag" --format '{{ index .Labels "org.opencontainers.image.revision" }}')" = "$image_revision" ] || die 'loaded image revision mismatch'

  failure_phase='env-normalize'
  install_deploy_script "${stage}/4-deploy.sh" "$deploy_script" || die 'remote Podman deploy script installation failed'
  normalize_runtime_env "$env_file"
  read_mode_status "$env_file"
  mode_after="$ENV_MODE_STATUS"
  env_after_count="$ENV_MODE_COUNT"
  env_after_hash="$(env_hash_or_empty "$env_file")"
  [ "$mode_after" = 'cutover' ] && [ "$env_after_count" -eq 1 ] || die 'runtime env cutover normalization failed'

  failure_phase='replace'
  mutation_started=1
  set +e
  APP_IMAGE="$image_tag" ACT_KNOWLEDGE_DEPLOYMENT_MODE=cutover RUNTIME_ENV_FILE="$env_file" "$deploy_script" --app-only
  exit_status=$?
  set -e
  [ "$exit_status" -eq 0 ] || exit "$exit_status"

  failure_phase='postflight'
  [ "$(container_image_digest act-obe-app)" = "$target_digest" ] || die 'postflight app digest mismatch'
  [ "$(container_image_digest act-obe-worker)" = "$target_digest" ] || die 'postflight worker digest mismatch'
  [ "$(container_mode act-obe-app)" = 'cutover' ] || die 'postflight app mode mismatch'
  [ "$(container_mode act-obe-worker)" = 'cutover' ] || die 'postflight worker mode mismatch'
  final_app_digest="$(container_image_digest act-obe-app)"
  final_worker_digest="$(container_image_digest act-obe-worker)"
  post_state="$(node "$helper_path" validate "$project_dir")" || die 'postflight control plane validation failed'
  [ "$(json_value "$post_state" 'value.protectedDigest')" = "$(json_value "$pre_state" 'value.protectedDigest')" ] || die 'protected cutover control plane drifted'
  local app_port
  app_port="$(awk -F= '$1 == "APP_PORT" { value=$2 } END { print value }' "$env_file")"
  app_port="${app_port:-8083}"
  [[ "$app_port" =~ ^[0-9]+$ ]] || die 'runtime app port is invalid'
  curl -fsS "http://127.0.0.1:${app_port}/api/readyz" >/dev/null || die 'postflight local readyz failed'
  curl -fsS "${public_url%/}/api/readyz" >/dev/null || die 'postflight public readyz failed'
  result='SUCCEEDED'
  failure_phase=''
  on_exit
}

recover_previous() {
  local recovery_exit
  set +e
  if ! normalize_runtime_env "$env_file"; then
    return 1
  fi
  # Recover through the immutable image ID so a target that reuses the
  # preceding tag cannot erase the only reference to the prior digest.
  APP_IMAGE="$previous_digest" ACT_KNOWLEDGE_DEPLOYMENT_MODE=cutover RUNTIME_ENV_FILE="$env_file" "$deploy_script" --app-only
  recovery_exit=$?
  set -e
  if [ "$recovery_exit" -ne 0 ]; then
    return "$recovery_exit"
  fi
  [ "$(container_image_digest act-obe-app)" = "$previous_digest" ] || return 1
  [ "$(container_image_digest act-obe-worker)" = "$previous_digest" ] || return 1
  [ "$(container_mode act-obe-app)" = 'cutover' ] || return 1
  [ "$(container_mode act-obe-worker)" = 'cutover' ] || return 1
  return 0
}

on_exit() {
  local status=$?
  trap - EXIT
  set +e
  if [ "$status" -ne 0 ] && [ "$mutation_started" -eq 1 ] && [ -n "$previous_image" ]; then
    recovery_status=1
    recover_previous
    recovery_status=$?
    if [ "$recovery_status" -eq 0 ]; then
      final_app_digest="$previous_digest"
      final_worker_digest="$previous_digest"
      mode_after='cutover'
      env_after_count=1
      env_after_hash="$(env_hash_or_empty "$env_file")"
    fi
  fi
  if [ -n "$env_file" ]; then
    read_mode_status "$env_file"
    [ "$ENV_MODE_STATUS" = 'cutover' ] && mode_after='cutover'
    env_after_count="$ENV_MODE_COUNT"
    env_after_hash="$(env_hash_or_empty "$env_file")"
  fi
  if [ "$status" -eq 0 ] && [ "$result" = 'SUCCEEDED' ]; then
    result='SUCCEEDED'
  else
    result='FAILED'
  fi
  if [ "$result" = 'FAILED' ] && [ -z "$failure_phase" ]; then
    failure_phase='preflight'
  fi
  if [ "$mutation_started" -eq 1 ] && [ "$recovery_status" -ne 0 ] && [ "$failure_phase" != 'recovery' ]; then
    failure_phase="${failure_phase}:recovery"
  fi
  if [ -z "$post_state" ] && regular_file "$marker"; then
    post_state="$(node "$helper_path" validate "$project_dir" 2>/dev/null || true)"
  fi
  completed_at="$(date -u +%Y-%m-%dT%H:%M:%SZ)"
  write_refresh_receipt \
    "$refresh_receipt" "$refresh_id" "$started_at" "$completed_at" "$previous_digest" "$target_digest" \
    "$final_app_digest" "$final_worker_digest" "$mode_before" "$mode_after" "$env_before_hash" "$env_after_hash" \
    "$env_before_count" "$env_after_count" "${pre_state:-null}" "${post_state:-null}" "$result" "$failure_phase" "${identities:-null}"
  local receipt_status=$?
  rmdir "$lock_dir" 2>/dev/null || true
  if [ "$receipt_status" -ne 0 ]; then
    printf 'ERROR: refresh receipt could not be written without overwrite\n' >&2
    exit 1
  fi
  exit "$status"
}

case "$action" in
  refresh)
    # run_refresh installs the EXIT trap only after the canonical receipt path
    # and staged inputs have passed its local checks.
    run_refresh "$@"
    ;;
  *)
    die 'expected action: refresh'
    ;;
esac
