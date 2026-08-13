#!/usr/bin/env bash
set -euo pipefail

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

normalize_oci_digest() {
  local raw="$1"
  if [[ "$raw" =~ ^sha256:[a-f0-9]{64}$ ]]; then
    printf '%s\n' "$raw"
  elif [[ "$raw" =~ ^[a-f0-9]{64}$ ]]; then
    printf 'sha256:%s\n' "$raw"
  else
    die "无效 OCI config digest: $raw"
  fi
}

run_preflight() {
  [ "$#" -eq 5 ] || die 'preflight requires project_dir image_tag image_revision minimum_free_bytes image_config_digest'
  local project_dir="$1"
  local image_tag="$2"
  local image_revision="$3"
  local minimum_free_bytes="$4"
  local image_config_digest="$5"
  local runtime_root="${project_dir}/course-content/runtime"
  local authority_root="${project_dir}/course-content/authoring/knowledge/authority"
  local marker="${runtime_root}/knowledge/production-cutover-transactions/current.json"
  local pointer

  for pointer in \
    "${authority_root}/current.json" \
    "${runtime_root}/knowledge/projection/current.json" \
    "${runtime_root}/knowledge/prerequisites/current.json" \
    "${runtime_root}/knowledge/authority-domain-shards/current.json" \
    "${runtime_root}/knowledge/consumer-activation/current.json" \
    "$marker"; do
    if [ -e "$pointer" ] || [ -L "$pointer" ]; then
      die "生产切换要求 Legacy all-ABSENT，检测到: $pointer"
    fi
  done

  [ -d "$authority_root" ] || die "Authority host store 不存在: $authority_root"
  local authority_entry
  authority_entry="$(find "$authority_root" -mindepth 1 -maxdepth 1 -print -quit)"
  if [ -n "$authority_entry" ]; then
    die 'Authority host store 必须为空，检测到已有工件'
  fi
  if [ -e "${project_dir}/.env.server" ] && [ ! -f "${project_dir}/.env.server" ]; then
    die '.env.server 存在但不是常规环境文件'
  fi

  local available_kib
  available_kib="$(df -Pk "$project_dir" | awk 'NR == 2 { print $4 }')"
  [[ "$available_kib" =~ ^[0-9]+$ ]] || die '无法读取远端可用磁盘空间'
  local available_bytes=$((available_kib * 1024))
  [ "$available_bytes" -ge "$minimum_free_bytes" ] \
    || die "远端可用空间不足 1 GiB: ${available_bytes} bytes"

  # The target image is uploaded and loaded only after this preflight. The
  # running Legacy containers may therefore legitimately use the previous
  # image. Capture that identity and require the two consumers to agree; the
  # target digest/revision/product proof is enforced in run_activate before
  # the first stop attempt.
  local running_image_id=''
  local container
  for container in act-obe-app act-obe-worker; do
    podman container exists "$container" || die "运行容器不存在: $container"
    [ "$(podman inspect "$container" --format '{{.State.Running}}')" = true ] \
      || die "运行容器未启动: $container"
    local container_image_id
    container_image_id="$(normalize_oci_digest "$(podman inspect "$container" --format '{{.Image}}')")"
    if [ -z "$running_image_id" ]; then
      running_image_id="$container_image_id"
    elif [ "$container_image_id" != "$running_image_id" ]; then
      die "运行消费者未使用同一旧镜像: $container"
    fi
    [ -n "$(podman exec "$container" cat /app/.app-revision)" ] \
      || die "运行容器缺少 app revision: $container"
  done

  printf 'remote_preflight=passed available_bytes=%s running_image_config_digest=%s target_image_config_digest=%s\n' "$available_bytes" "$running_image_id" "$image_config_digest"
}

run_stage() {
  [ "$#" -eq 9 ] || die 'stage requires stage plan_sha bundle_archive_sha bundle_manifest_sha image_tar_sha image_provenance_sha archive_sha deploy_sha cleanup_engine_sha'
  local stage="$1"
  local plan_sha="$2"
  local bundle_archive_sha="$3"
  local bundle_manifest_sha="$4"
  local image_tar_sha="$5"
  local image_provenance_sha="$6"
  local archive_sha="$7"
  local deploy_sha="$8"
  local cleanup_engine_sha="$9"
  local pair file expected

  for pair in "plan.json.tmp:$plan_sha" "operator-bundle.tar.gz.tmp:$bundle_archive_sha" "operator-bundle.manifest.json.tmp:$bundle_manifest_sha" "image.tar.tmp:$image_tar_sha" "image.tar.provenance.json.tmp:$image_provenance_sha" "authority.tar.gz.tmp:$archive_sha" "4-deploy.sh.tmp:$deploy_sha" "cleanup-failed-authority-identity.cjs.tmp:$cleanup_engine_sha"; do
    file="${pair%%:*}"
    expected="${pair#*:}"
    [ "$(hash_file "${stage}/${file}")" = "$expected" ] || {
      echo "ERROR: staged file hash mismatch: $file" >&2
      exit 1
    }
  done
  node -e '
const fs = require("node:fs");
const plan = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (plan.source?.deploymentScriptSha256 !== process.argv[2]) process.exit(1);
if (plan.source?.cleanupEngineSha256 !== process.argv[3]) process.exit(1);
if (plan.operatorBundle?.archiveSha256 !== process.argv[4]) process.exit(1);
if (plan.operatorBundle?.manifestSha256 !== process.argv[5]) process.exit(1);
if (plan.source?.imageTarSha256 !== process.argv[6]) process.exit(1);
if (plan.source?.imageProvenanceSha256 !== process.argv[7]) process.exit(1);
' "${stage}/plan.json.tmp" "$deploy_sha" "$cleanup_engine_sha" "$bundle_archive_sha" "$bundle_manifest_sha" "$image_tar_sha" "$image_provenance_sha" || {
    echo 'ERROR: sealed plan deployment, cleanup engine, or operator bundle hash mismatch' >&2
    exit 1
  }
  mv "${stage}/plan.json.tmp" "${stage}/plan.json"
  mv "${stage}/operator-bundle.tar.gz.tmp" "${stage}/operator-bundle.tar.gz"
  mv "${stage}/operator-bundle.manifest.json.tmp" "${stage}/operator-bundle.manifest.json"
  mv "${stage}/image.tar.tmp" "${stage}/image.tar"
  mv "${stage}/image.tar.provenance.json.tmp" "${stage}/image.tar.provenance.json"
  mv "${stage}/authority.tar.gz.tmp" "${stage}/authority.tar.gz"
  mv "${stage}/4-deploy.sh.tmp" "${stage}/4-deploy.sh"
  mv "${stage}/cleanup-failed-authority-identity.cjs.tmp" "${stage}/cleanup-failed-authority-identity.cjs"
  chmod 600 "${stage}/plan.json" "${stage}/operator-bundle.tar.gz" "${stage}/operator-bundle.manifest.json" "${stage}/image.tar" "${stage}/image.tar.provenance.json" "${stage}/authority.tar.gz" "${stage}/4-deploy.sh" "${stage}/cleanup-failed-authority-identity.cjs"
}

run_stage_cleanup_engine() {
  [ "$#" -eq 4 ] || die 'stage-cleanup-engine requires project_dir stage transaction_id cleanup_engine_sha'
  local project_dir="$1"
  local stage="$2"
  local transaction_id="$3"
  local cleanup_engine_sha="$4"
  local expected_stage="${project_dir}/data/runtime/knowledge-cutover/staging/${transaction_id}"
  local engine_path="${stage}/cleanup-failed-authority-identity.cjs"
  local engine_tmp="${engine_path}.tmp"

  [[ "$transaction_id" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] \
    || die "invalid cleanup engine transaction id: $transaction_id"
  [[ "$cleanup_engine_sha" =~ ^[a-f0-9]{64}$ ]] \
    || die 'invalid cleanup engine hash'
  [ "$stage" = "$expected_stage" ] \
    || die "cleanup engine requires canonical stage path: $expected_stage"
  [ -f "${stage}/plan.json" ] && [ -f "${stage}/authority.tar.gz" ] \
    || die 'cleanup engine requires an existing sealed failed transaction stage'

  if [ -e "$engine_path" ] || [ -L "$engine_path" ]; then
    [ -f "$engine_path" ] && [ ! -L "$engine_path" ] \
      || die 'existing cleanup engine is not a regular file'
    [ "$(hash_file "$engine_path")" = "$cleanup_engine_sha" ] \
      || die 'existing cleanup engine hash mismatch'
    if [ -e "$engine_tmp" ] || [ -L "$engine_tmp" ]; then
      [ -f "$engine_tmp" ] && [ ! -L "$engine_tmp" ] \
        || die 'staged cleanup engine temporary residue is not a regular file'
      [ "$(hash_file "$engine_tmp")" = "$cleanup_engine_sha" ] \
        || die 'staged cleanup engine temporary residue hash mismatch'
      # A retry can upload the exact immutable engine after the first upload
      # already promoted it. Remove only that hash-verified duplicate.
      rm -- "$engine_tmp" || die 'failed to clear hash-verified cleanup engine temporary duplicate'
    fi
  else
    [ -f "$engine_tmp" ] && [ ! -L "$engine_tmp" ] \
      || die 'staged cleanup engine is missing or invalid'
    [ "$(hash_file "$engine_tmp")" = "$cleanup_engine_sha" ] \
      || die 'staged cleanup engine hash mismatch'
    mv "$engine_tmp" "$engine_path"
    chmod 600 "$engine_path"
  fi
  printf '{"contract":"act-production-knowledge-cutover-cleanup-engine/v1","transactionId":"%s","cleanupEngineSha256":"%s"}\n' \
    "$transaction_id" "$cleanup_engine_sha" > "${stage}/cleanup-engine.json"
  chmod 600 "${stage}/cleanup-engine.json"
}

OPERATOR_LOCK_BASENAME='.production-cutover-operator.lock'

production_operator_lock_dir() {
  local project_dir="$1"
  printf '%s\n' "${project_dir}/course-content/runtime/knowledge/${OPERATOR_LOCK_BASENAME}"
}

# Exclusive operator lock shared by cleanup and activate mutation windows.
# Uses mkdir atomic create; never steals or rewrites a preexisting lock.
acquire_production_operator_lock() {
  local project_dir="$1"
  local knowledge_root="${project_dir}/course-content/runtime/knowledge"
  local lock_dir
  lock_dir="$(production_operator_lock_dir "$project_dir")"
  mkdir -p "$knowledge_root" || die "无法创建 knowledge runtime 目录: $knowledge_root"
  if ! mkdir "$lock_dir" 2>/dev/null; then
    die "production cutover operator exclusive lock unavailable: $lock_dir"
  fi
  # Best-effort ownership marker only; absence must not break lock release.
  printf '%s\n' "$$" >"${lock_dir}/owner.pid" 2>/dev/null || true
  printf '%s\n' "$lock_dir"
}

release_production_operator_lock() {
  local lock_dir="${1:-}"
  [ -n "$lock_dir" ] || return 0
  [ -d "$lock_dir" ] || return 0
  rm -f "${lock_dir}/owner.pid" 2>/dev/null || true
  rmdir "$lock_dir" 2>/dev/null || true
}

validate_authority_archive_listing() {
  local archive="$1"
  [ -f "$archive" ] || die "Authority archive missing: $archive"
  if ! COPYFILE_DISABLE=1 tar -tzf "$archive" | awk '
    /(^|\/)current\.json$/ || /(^|\/)\._/ || /(^|\/)\.DS_Store$/ || /^\// || /(^|\/)\.\.\// { invalid = 1 }
    END { exit invalid }
  '; then
    die 'Authority archive 包含 selector、macOS metadata 或不安全路径'
  fi
}

validate_operator_bundle_archive() {
  local archive="$1"
  [ -f "$archive" ] && [ ! -L "$archive" ] \
    || die "operator bundle archive must be a regular staged file: $archive"
  if ! COPYFILE_DISABLE=1 tar -tzf "$archive" | awk '
    {
      path = $0
      sub(/^\.\//, "", path)
      sub(/\/+$/, "", path)
      if (path == "") next
      if (path ~ /^\// || path ~ /(^|\/)\.\.?($|\/)/ || path ~ /(^|\/)\._/ || path ~ /(^|\/)\.DS_Store$/) invalid = 1
    }
    END { exit invalid }
  '; then
    die 'operator bundle archive contains an unsafe path'
  fi
  # The verbose listing is the archive type check. Only directories and
  # regular files may enter the isolated bundle root; symlink/device/fifo/
  # hard-link members are rejected before extraction.
  if ! COPYFILE_DISABLE=1 tar -tvzf "$archive" | awk '
    NF == 0 { next }
    $1 ~ /^d/ || $1 ~ /^-/ { next }
    { invalid = 1 }
    END { exit invalid }
  '; then
    die 'operator bundle archive contains a symlink or non-regular entry'
  fi
}

# Exact recursive identity validation + per-file unlink / reverse rmdir.
# Never uses recursive directory removal.
cleanup_failed_authority_identity_delete() {
  [ "$#" -eq 5 ] || die 'cleanup identity delete requires plan archive transaction_id authority_root engine_path'
  local plan_path="$1"
  local archive_path="$2"
  local transaction_id="$3"
  local authority_root="$4"
  local engine_path="$5"

  [ -f "$engine_path" ] || die "cleanup identity engine is missing: $engine_path"
  node "$engine_path" "$plan_path" "$archive_path" "$transaction_id" "$authority_root"
}
run_cleanup_failed_authority() {
  [ "$#" -eq 4 ] || die 'cleanup-failed-authority requires project_dir stage transaction_id cleanup_engine_sha'
  local project_dir="$1"
  local stage="$2"
  local transaction_id="$3"
  local cleanup_engine_sha="$4"
  local runtime_root="${project_dir}/course-content/runtime"
  local authority_root="${project_dir}/course-content/authoring/knowledge/authority"
  local marker="${runtime_root}/knowledge/production-cutover-transactions/current.json"
  local transaction_dir="${runtime_root}/knowledge/production-cutover-transactions"
  local journal_dir="${runtime_root}/knowledge/consumer-activation/first-activation-transactions"
  local expected_stage="${project_dir}/data/runtime/knowledge-cutover/staging/${transaction_id}"
  local cleanup_engine_path="${stage}/cleanup-failed-authority-identity.cjs"
  local pointer leftover lock_dir=""

  [[ "$transaction_id" =~ ^[A-Za-z0-9][A-Za-z0-9._-]*$ ]] \
    || die "invalid cleanup transaction id: $transaction_id"
  [[ "$cleanup_engine_sha" =~ ^[a-f0-9]{64}$ ]] \
    || die 'invalid cleanup engine hash'
  [ "$stage" = "$expected_stage" ] \
    || die "failed Authority cleanup requires canonical stage path: $expected_stage"
  [ -d "$stage" ] || die "failed transaction stage is missing: $stage"
  [ -f "${stage}/plan.json" ] || die 'failed Authority cleanup requires sealed plan.json in stage'
  [ -f "${stage}/authority.tar.gz" ] || die 'failed Authority cleanup requires authority.tar.gz in stage'
  [ -f "$cleanup_engine_path" ] && [ ! -L "$cleanup_engine_path" ] \
    || die 'failed Authority cleanup requires a regular staged cleanup engine'
  [ "$(hash_file "$cleanup_engine_path")" = "$cleanup_engine_sha" ] \
    || die 'failed Authority cleanup engine hash mismatch'
  [ -d "$authority_root" ] || die "Authority host store 不存在: $authority_root"

  lock_dir="$(acquire_production_operator_lock "$project_dir")"
  trap "release_production_operator_lock $(printf '%q' "$lock_dir")" EXIT

  for pointer in \
    "${authority_root}/current.json" \
    "${runtime_root}/knowledge/projection/current.json" \
    "${runtime_root}/knowledge/prerequisites/current.json" \
    "${runtime_root}/knowledge/authority-domain-shards/current.json" \
    "${runtime_root}/knowledge/consumer-activation/current.json" \
    "$marker"; do
    if [ -e "$pointer" ] || [ -L "$pointer" ]; then
      die "failed Authority cleanup requires no committed transaction state: $pointer"
    fi
  done

  # Runtime release history is retained during Legacy deployment. It may
  # legitimately contain another transaction's journal or receipt while all
  # selectors are absent. Only state attributed to this failed transaction can
  # make its Authority extraction unsafe to remove.
  for leftover in \
    "${transaction_dir}/${transaction_id}.json" \
    "${transaction_dir}/${transaction_id}.rollback.json" \
    "${transaction_dir}/${transaction_id}.recovery.json" \
    "${journal_dir}/${transaction_id}.json" \
    "${journal_dir}/${transaction_id}-migration-receipt.json" \
    "${journal_dir}/${transaction_id}-state-correction-receipt.json"; do
    if [ -e "$leftover" ] || [ -L "$leftover" ]; then
      die "failed Authority cleanup refuses same-transaction residue: $leftover"
    fi
  done

  cleanup_failed_authority_identity_delete \
    "${stage}/plan.json" \
    "${stage}/authority.tar.gz" \
    "$transaction_id" \
    "$authority_root" \
    "$cleanup_engine_path" \
    || die 'failed Authority cleanup exact identity validation or per-file delete failed'

  printf '{"contract":"act-production-knowledge-cutover-failed-authority-cleanup/v1","transactionId":"%s","status":"CLEARED","clearedAt":"%s"}\n' \
    "$transaction_id" "$(date -u +%Y-%m-%dT%H:%M:%SZ)" > "${stage}/failed-authority-cleanup.json"
  chmod 600 "${stage}/failed-authority-cleanup.json"
  release_production_operator_lock "$lock_dir"
  trap - EXIT
  lock_dir=""
  printf 'failed_authority_cleanup=cleared transaction=%s\n' "$transaction_id"
}

run_activate() {
  [ "$#" -eq 7 ] || die 'activate requires project_dir stage image_tag image_revision transaction_id public_url image_config_digest'
  set -E
  local project_dir="$1"
  local stage="$2"
  local image_tag="$3"
  local image_revision="$4"
  local transaction_id="$5"
  local public_url="$6"
  local image_config_digest="$7"
  local course_content="${project_dir}/course-content"
  local runtime_root="${course_content}/runtime"
  local authority_root="${course_content}/authoring/knowledge/authority"
  local deploy_script="${project_dir}/scripts/4-deploy.sh"
  local marker="${runtime_root}/knowledge/production-cutover-transactions/current.json"
  local journal="${runtime_root}/knowledge/consumer-activation/first-activation-transactions/${transaction_id}.json"
  local command_log="${stage}/command.log"
  local image_tar="${stage}/image.tar"
  local image_provenance="${stage}/image.tar.provenance.json"
  local operator_bundle_archive="${stage}/operator-bundle.tar.gz"
  local operator_bundle_manifest="${stage}/operator-bundle.manifest.json"
  local operator_bundle_root="${stage}/operator-bundle"
  local pointer_paths=(
    "${authority_root}/current.json"
    "${runtime_root}/knowledge/projection/current.json"
    "${runtime_root}/knowledge/prerequisites/current.json"
    "${runtime_root}/knowledge/authority-domain-shards/current.json"
    "${runtime_root}/knowledge/consumer-activation/current.json"
  )
  local previous_image_digest=''
  local previous_image_revision=''

  capture_previous_image_identity() {
    local app_image_digest worker_image_digest app_image_revision worker_image_revision
    app_image_digest="$(normalize_oci_digest "$(podman inspect act-obe-app --format '{{.Image}}')")"
    worker_image_digest="$(normalize_oci_digest "$(podman inspect act-obe-worker --format '{{.Image}}')")"
    [ "$app_image_digest" = "$worker_image_digest" ] \
      || die '切换前 app/worker 未使用同一旧镜像'
    app_image_revision="$(podman exec act-obe-app cat /app/.app-revision)"
    worker_image_revision="$(podman exec act-obe-worker cat /app/.app-revision)"
    [ -n "$app_image_revision" ] && [ "$app_image_revision" = "$worker_image_revision" ] \
      || die '切换前 app/worker source revision 不一致'
    previous_image_digest="$app_image_digest"
    previous_image_revision="$app_image_revision"
    node -e '
const fs = require("node:fs");
const [output, digest, revision] = process.argv.slice(1);
fs.writeFileSync(output, `${JSON.stringify({ contract: "act-production-knowledge-cutover-previous-image/v1", imageConfigDigest: digest, applicationSourceRevision: revision })}\n`, { mode: 0o600, flag: "w" });
' "${stage}/previous-image.json" "$previous_image_digest" "$previous_image_revision"
  }

  normalize_runtime_env_to_legacy() {
    local env_file="${project_dir}/data/runtime/act-obe.env"
    [ -f "$env_file" ] || return 0
    local temporary="${env_file}.tmp.$$"
    awk -F= '$1 != "ACT_KNOWLEDGE_DEPLOYMENT_MODE"' "$env_file" > "$temporary"
    printf '%s\n' 'ACT_KNOWLEDGE_DEPLOYMENT_MODE=legacy' >> "$temporary"
    chmod --reference="$env_file" "$temporary" 2>/dev/null || chmod 600 "$temporary"
    mv -f "$temporary" "$env_file"
  }

  verify_staged_application_image() {
    [ -f "$image_tar" ] && [ ! -L "$image_tar" ] \
      || die 'staged application image tar must be a regular file'
    [ -f "$image_provenance" ] && [ ! -L "$image_provenance" ] \
      || die 'staged application image provenance must be a regular file'
    local expected_tar_sha expected_provenance_sha
    expected_tar_sha="$(node -e 'process.stdout.write(JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).source?.imageTarSha256 ?? "")' "${stage}/plan.json")"
    expected_provenance_sha="$(node -e 'process.stdout.write(JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).source?.imageProvenanceSha256 ?? "")' "${stage}/plan.json")"
    [[ "$expected_tar_sha" =~ ^[a-f0-9]{64}$ ]] || die 'sealed plan image tar hash is invalid'
    [[ "$expected_provenance_sha" =~ ^[a-f0-9]{64}$ ]] || die 'sealed plan image provenance hash is invalid'
    [ "$(hash_file "$image_tar")" = "$expected_tar_sha" ] \
      || die 'staged application image tar hash mismatch with sealed plan'
    [ "$(hash_file "$image_provenance")" = "$expected_provenance_sha" ] \
      || die 'staged application image provenance hash mismatch with sealed plan'
    node -e '
const fs = require("node:fs");
const sidecar = JSON.parse(fs.readFileSync(process.argv[1], "utf8"));
if (sidecar.imageTarSha256 !== process.argv[2] || sidecar.appRevision !== process.argv[3]) process.exit(1);
if (typeof sidecar.runtimeSourceRevision !== "string" || !/^[a-f0-9]{40}$/.test(sidecar.runtimeSourceRevision)) process.exit(1);
if (sidecar.runtimeSourceRevision !== sidecar.indexSourceRevision) process.exit(1);
' "$image_provenance" "$expected_tar_sha" "$image_revision" \
      || die 'staged application image provenance does not bind target source revision'

    # Loading the tar and checking the resulting local image identity happens
    # while the old consumers are still serving. No pointer or container stop
    # is attempted until every identity and product proof below succeeds.
    podman load -i "$image_tar" >/dev/null
    podman image exists "$image_tag" || die 'staged application image tag is unavailable after load'
    local loaded_digest loaded_revision
    loaded_digest="$(normalize_oci_digest "$(podman image inspect "$image_tag" --format '{{.Id}}')")"
    [ "$loaded_digest" = "$image_config_digest" ] \
      || die 'loaded application image config digest mismatch'
    loaded_revision="$(podman image inspect "$image_tag" --format '{{ index .Labels "org.opencontainers.image.revision" }}')"
    [ "$loaded_revision" = "$image_revision" ] \
      || die 'loaded application image source revision label mismatch'
    podman run --rm --network none --entrypoint /bin/sh "$image_tag" -lc '
      set -eu
      expected_revision="$1"
      test "$(cat /app/.app-revision)" = "$expected_revision"
      test -f /app/.active-authority-shards-product
      grep -Fxq "$expected_revision" /app/.active-authority-shards-product
      test -f /app/src/features/knowledge/active-authority-graph.tsx
      test -f /app/src/features/knowledge/active-authority-shard-store.ts
      test -f /app/src/lib/authority-domain-shards/materialize.ts
      grep -q "/api/knowledge/shards/active" /app/src/features/knowledge/active-authority-graph.tsx
      test -f /app/src/app/api/knowledge/shards/active/route.ts
    ' sh "$image_revision" || die 'application image does not contain the active-shard product implementation'
  }

  exec > >(tee -a "$command_log") 2>&1

  all_pointers_absent() {
    local pointer
    for pointer in "${pointer_paths[@]}"; do
      if [ -e "$pointer" ] || [ -L "$pointer" ]; then
        return 1
      fi
    done
    return 0
  }

  stop_consumers() {
    local container
    # Return non-zero (never hard-exit) so the activate ERR trap can run
    # identity-bound recovery after a partial stop.
    for container in act-obe-app act-obe-worker act-obe-submission-gc act-obe-submission-scanner; do
      if podman container exists "$container"; then
        podman stop -t 30 "$container" >/dev/null || return 1
      fi
    done
    for container in act-obe-app act-obe-worker act-obe-submission-gc act-obe-submission-scanner; do
      if podman ps --format '{{.Names}}' | grep -Fx "$container" >/dev/null; then
        printf 'ERROR: 图谱消费者仍在运行: %s\n' "$container" >&2
        return 1
      fi
    done
  }

  run_driver() {
    local driver_action="$1"
    local access="$2"
    podman run --rm --user 0 --network none \
      -e APP_REVISION="$image_revision" \
      -e ACT_AUTHORITY_STORE_ROOT='/activation-root/course-content/authoring/knowledge/authority' \
      -e ACT_CONSUMER_ACTIVATION_ROOT='/activation-root/course-content/runtime/knowledge/consumer-activation' \
      -v "${course_content}:/activation-root/course-content:${access},Z" \
      -v "${operator_bundle_root}:/operator-bundle:ro,Z" \
      -v "${operator_bundle_manifest}:/operator-bundle-manifest.json:ro,Z" \
      -v "${stage}/plan.json:/activation-plan.json:ro,Z" \
      --workdir /operator-bundle \
      --entrypoint /app/node_modules/.bin/tsx \
      "$image_tag" \
      --tsconfig /operator-bundle/tsconfig.json \
      /operator-bundle/scripts/knowledge-cutover/production-cutover.ts "$driver_action" \
      --root /activation-root \
      --plan /activation-plan.json \
      --bundle-root /operator-bundle \
      --bundle-manifest /operator-bundle-manifest.json
  }

  prepare_operator_bundle() {
    [ -f "$operator_bundle_archive" ] && [ ! -L "$operator_bundle_archive" ] \
      || die 'operator bundle archive must be a regular staged file'
    [ -f "$operator_bundle_manifest" ] && [ ! -L "$operator_bundle_manifest" ] \
      || die 'operator bundle manifest must be a regular staged file'
    local expected_archive_sha expected_manifest_sha
    expected_archive_sha="$(node -e 'process.stdout.write(JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).operatorBundle?.archiveSha256 ?? "")' "${stage}/plan.json")"
    expected_manifest_sha="$(node -e 'process.stdout.write(JSON.parse(require("node:fs").readFileSync(process.argv[1], "utf8")).operatorBundle?.manifestSha256 ?? "")' "${stage}/plan.json")"
    [[ "$expected_archive_sha" =~ ^[a-f0-9]{64}$ ]] || die 'sealed plan operator bundle archive hash is invalid'
    [[ "$expected_manifest_sha" =~ ^[a-f0-9]{64}$ ]] || die 'sealed plan operator bundle manifest hash is invalid'
    [ "$(hash_file "$operator_bundle_archive")" = "$expected_archive_sha" ] \
      || die 'operator bundle archive hash mismatch with sealed plan'
    [ "$(hash_file "$operator_bundle_manifest")" = "$expected_manifest_sha" ] \
      || die 'operator bundle manifest hash mismatch with sealed plan'
    validate_operator_bundle_archive "$operator_bundle_archive"
    if [ -e "$operator_bundle_root" ] || [ -L "$operator_bundle_root" ]; then
      die 'operator bundle extraction root already exists'
    fi
    mkdir -p "$operator_bundle_root"
    COPYFILE_DISABLE=1 tar --no-same-owner -xzf "$operator_bundle_archive" -C "$operator_bundle_root"
    if find "$operator_bundle_root" \( -type l -o \( ! -type f -a ! -type d \) \) -print -quit | grep -q .; then
      die 'operator bundle extraction contains a symlink or non-regular entry'
    fi
    # This executes the actual bundle verifier inside the fixed image before
    # the first stop attempt. It validates every manifest file digest, the
    # capture revision and the sealed production tool identity.
    run_driver verify-bundle ro
  }

  # Intent flag: set immediately before the first stop attempt. Partial stop
  # failures must still enter recovery; pure pre-stop validation must not.
  local consumer_stop_started=0
  local operator_lock_dir=""
  restore_legacy_after_failure() {
    local status="$1"
    local recovery_ok=0
    trap - ERR INT TERM
    set +e
    if [ "$consumer_stop_started" -eq 1 ]; then
      printf '切换失败，停止消费者并执行身份约束恢复。\n' >&2
      # Finish any incomplete consumer stop, then identity-bound recovery.
      stop_consumers
      if [ -e "$marker" ] || [ -L "$marker" ]; then
        run_driver rollback rw
        recovery_ok=$?
      elif ! all_pointers_absent; then
        if [ -f "$journal" ]; then
          run_driver recover rw
          recovery_ok=$?
        else
          printf 'ERROR: 指针非空但 journal 缺失，拒绝猜测回滚。\n' >&2
          recovery_ok=1
        fi
      fi
      if [ "$recovery_ok" -eq 0 ]; then
        normalize_runtime_env_to_legacy
        APP_IMAGE="$previous_image_digest" ACT_KNOWLEDGE_DEPLOYMENT_MODE=legacy "$deploy_script" --app-only
        [ "$(normalize_oci_digest "$(podman inspect act-obe-app --format '{{.Image}}')")" = "$previous_image_digest" ] \
          || recovery_ok=1
        [ "$(normalize_oci_digest "$(podman inspect act-obe-worker --format '{{.Image}}')")" = "$previous_image_digest" ] \
          || recovery_ok=1
        [ "$(podman exec act-obe-app cat /app/.app-revision)" = "$previous_image_revision" ] \
          || recovery_ok=1
        [ "$(podman exec act-obe-worker cat /app/.app-revision)" = "$previous_image_revision" ] \
          || recovery_ok=1
      fi
      if [ "$recovery_ok" -ne 0 ]; then
        printf 'ERROR: 自动恢复未完成；消费者保持停止，保留 stage/journal 供显式恢复。\n' >&2
      fi
    else
      printf '切换在停止消费者前失败，未中断运行中的图谱消费者。\n' >&2
    fi
    release_production_operator_lock "$operator_lock_dir"
    operator_lock_dir=""
    exit "$status"
  }

  [ -x "$deploy_script" ] || die "缺少远端部署脚本: $deploy_script"
  all_pointers_absent || die 'transaction 开始时不再是 all-ABSENT'
  [ -d "$authority_root" ] || die 'Authority host store 不存在'
  local authority_entry
  authority_entry="$(find "$authority_root" -mindepth 1 -maxdepth 1 -print -quit)"
  if [ -n "$authority_entry" ]; then
    die 'Authority host store 在 transaction 开始时不为空'
  fi

  local expected_deploy_sha
  expected_deploy_sha="$(node -e 'const fs=require("node:fs"); process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).source.deploymentScriptSha256)' "${stage}/plan.json")"
  [ "$(hash_file "${stage}/4-deploy.sh")" = "$expected_deploy_sha" ] \
    || die 'staged 4-deploy.sh 不匹配 sealed plan'
  local expected_image_config_digest
  expected_image_config_digest="$(node -e 'const fs=require("node:fs"); process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).source.imageConfigDigest)' "${stage}/plan.json")"
  [ "$expected_image_config_digest" = "$image_config_digest" ] \
    || die 'sealed plan 与固定镜像 OCI config digest 不一致'

  # Content/security/metadata validation must fail closed before any consumer stop.
  validate_authority_archive_listing "${stage}/authority.tar.gz"
  prepare_operator_bundle
  capture_previous_image_identity
  verify_staged_application_image

  # Mutation window lock: shared with failed-authority cleanup, independent of the
  # TypeScript first-activation lock under consumer-activation/.
  operator_lock_dir="$(acquire_production_operator_lock "$project_dir")"

  if ! all_pointers_absent; then
    release_production_operator_lock "$operator_lock_dir"
    operator_lock_dir=""
    die 'transaction 在取得独占锁后不再是 all-ABSENT'
  fi
  authority_entry="$(find "$authority_root" -mindepth 1 -maxdepth 1 -print -quit)"
  if [ -n "$authority_entry" ]; then
    release_production_operator_lock "$operator_lock_dir"
    operator_lock_dir=""
    die 'Authority host store 在取得独占锁后不为空'
  fi

  trap 'restore_legacy_after_failure $?' ERR
  trap 'restore_legacy_after_failure 130' INT
  trap 'restore_legacy_after_failure 143' TERM

  consumer_stop_started=1
  stop_consumers
  tar -xzf "${stage}/authority.tar.gz" -C "$authority_root"
  all_pointers_absent || die 'Authority staging 不得写入 current pointer'

  run_driver activate rw

  cp "${stage}/4-deploy.sh" "${deploy_script}.tmp"
  chmod 700 "${deploy_script}.tmp"
  mv "${deploy_script}.tmp" "$deploy_script"
  APP_IMAGE="$image_tag" ACT_KNOWLEDGE_DEPLOYMENT_MODE=cutover "$deploy_script" --app-only

  run_driver verify ro

  local container
  for container in act-obe-app act-obe-worker act-obe-postgres act-obe-redis; do
    podman ps --format '{{.Names}}' | grep -Fx "$container" >/dev/null \
      || die "切换后容器未运行: $container"
  done
  for container in act-obe-app act-obe-worker; do
    [ "$(podman inspect "$container" --format '{{.ImageName}}')" = "$image_tag" ] \
      || die "切换后容器镜像不一致: $container"
    [ "$(normalize_oci_digest "$(podman inspect "$container" --format '{{.Image}}')")" = "$image_config_digest" ] \
      || die "切换后容器 OCI config digest 不一致: $container"
    [ "$(podman exec "$container" cat /app/.app-revision)" = "$image_revision" ] \
      || die "切换后容器 application source revision 不一致: $container"
    podman exec "$container" sh -c 'test -f /app/.active-authority-shards-product && grep -Fxq "$1" /app/.active-authority-shards-product' sh "$image_revision" \
      || die "切换后容器缺少 active-shard product proof: $container"
    [ "$(podman inspect "$container" --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -Fxc 'ACT_KNOWLEDGE_DEPLOYMENT_MODE=cutover')" = 1 ] \
      || die "切换后容器未收到 explicit cutover mode: $container"
  done

  local app_port
  app_port="$(sed -n 's/^APP_PORT=//p' "${project_dir}/data/runtime/act-obe.env" | tail -n 1)"
  app_port="${app_port:-8083}"
  local _
  for _ in $(seq 1 40); do
    if curl -fsS "http://127.0.0.1:${app_port}/api/readyz" >/dev/null; then
      break
    fi
    sleep 3
  done
  curl -fsS "http://127.0.0.1:${app_port}/api/readyz" >/dev/null \
    || die '本机 readyz 未在切换后恢复'
  curl -fsS "${public_url%/}/api/readyz" >/dev/null \
    || die '公网 readyz 未在切换后恢复'

  release_production_operator_lock "$operator_lock_dir"
  operator_lock_dir=""
  printf 'production knowledge cutover committed: transaction=%s image=%s\n' "$transaction_id" "$image_tag"
}

case "$action" in
  preflight) run_preflight "$@" ;;
  stage) run_stage "$@" ;;
  stage-cleanup-engine) run_stage_cleanup_engine "$@" ;;
  cleanup-failed-authority) run_cleanup_failed_authority "$@" ;;
  activate) run_activate "$@" ;;
  *) die 'expected one of: preflight, stage, stage-cleanup-engine, cleanup-failed-authority, activate' ;;
esac
