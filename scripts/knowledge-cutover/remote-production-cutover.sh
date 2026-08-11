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

  podman image exists "$image_tag" || die "固定镜像不存在: $image_tag"
  local image_id
  image_id="$(normalize_oci_digest "$(podman image inspect "$image_tag" --format '{{.Id}}')")"
  [ "$image_id" = "$image_config_digest" ] \
    || die "固定镜像 OCI config digest 不一致: $image_id"
  local label_revision
  label_revision="$(podman image inspect "$image_tag" --format '{{ index .Labels "org.opencontainers.image.revision" }}')"
  [ "$label_revision" = "$image_revision" ] \
    || die "固定镜像 OCI revision 不一致: $label_revision"
  local container
  for container in act-obe-app act-obe-worker; do
    podman container exists "$container" || die "运行容器不存在: $container"
    [ "$(podman inspect "$container" --format '{{.State.Running}}')" = true ] \
      || die "运行容器未启动: $container"
    [ "$(normalize_oci_digest "$(podman inspect "$container" --format '{{.Image}}')")" = "$image_id" ] \
      || die "运行容器未使用固定镜像: $container"
    [ "$(podman exec "$container" cat /app/.app-revision)" = "$image_revision" ] \
      || die "运行容器 app revision 不一致: $container"
  done

  printf 'remote_preflight=passed available_bytes=%s image_config_digest=%s\n' "$available_bytes" "$image_id"
}

run_stage() {
  [ "$#" -eq 5 ] || die 'stage requires stage plan_sha tool_sha archive_sha deploy_sha'
  local stage="$1"
  local plan_sha="$2"
  local tool_sha="$3"
  local archive_sha="$4"
  local deploy_sha="$5"
  local pair file expected

  for pair in "plan.json.tmp:$plan_sha" "production-cutover.ts.tmp:$tool_sha" "authority.tar.gz.tmp:$archive_sha" "4-deploy.sh.tmp:$deploy_sha"; do
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
' "${stage}/plan.json.tmp" "$deploy_sha" || {
    echo 'ERROR: sealed plan deployment script hash mismatch' >&2
    exit 1
  }
  mv "${stage}/plan.json.tmp" "${stage}/plan.json"
  mv "${stage}/production-cutover.ts.tmp" "${stage}/production-cutover.ts"
  mv "${stage}/authority.tar.gz.tmp" "${stage}/authority.tar.gz"
  mv "${stage}/4-deploy.sh.tmp" "${stage}/4-deploy.sh"
  chmod 600 "${stage}/plan.json" "${stage}/production-cutover.ts" "${stage}/authority.tar.gz" "${stage}/4-deploy.sh"
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
  local pointer_paths=(
    "${authority_root}/current.json"
    "${runtime_root}/knowledge/projection/current.json"
    "${runtime_root}/knowledge/prerequisites/current.json"
    "${runtime_root}/knowledge/consumer-activation/current.json"
  )

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
    for container in act-obe-app act-obe-worker act-obe-submission-gc act-obe-submission-scanner; do
      if podman container exists "$container"; then
        podman stop -t 30 "$container" >/dev/null || return 1
      fi
    done
    for container in act-obe-app act-obe-worker act-obe-submission-gc act-obe-submission-scanner; do
      if podman ps --format '{{.Names}}' | grep -Fx "$container" >/dev/null; then
        die "图谱消费者仍在运行: $container"
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
      -v "${stage}/production-cutover.ts:/app/scripts/knowledge-cutover/production-cutover.ts:ro,Z" \
      -v "${stage}/plan.json:/activation-plan.json:ro,Z" \
      --entrypoint ./node_modules/.bin/tsx \
      "$image_tag" \
      scripts/knowledge-cutover/production-cutover.ts "$driver_action" \
      --root /activation-root \
      --plan /activation-plan.json
  }

  restore_legacy_after_failure() {
    local status="$1"
    local recovery_ok=0
    trap - ERR INT TERM
    set +e
    printf '切换失败，停止消费者并执行身份约束恢复。\n' >&2
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
      APP_IMAGE="$image_tag" ACT_KNOWLEDGE_DEPLOYMENT_MODE=legacy "$deploy_script" --app-only
    else
      printf 'ERROR: 自动恢复未完成；消费者保持停止，保留 stage/journal 供显式恢复。\n' >&2
    fi
    exit "$status"
  }

  trap 'restore_legacy_after_failure $?' ERR
  trap 'restore_legacy_after_failure 130' INT
  trap 'restore_legacy_after_failure 143' TERM

  [ -x "$deploy_script" ] || die "缺少远端部署脚本: $deploy_script"
  all_pointers_absent || die 'transaction 开始时不再是 all-ABSENT'
  [ -d "$authority_root" ] || die 'Authority host store 不存在'
  local authority_entry
  authority_entry="$(find "$authority_root" -mindepth 1 -maxdepth 1 -print -quit)"
  if [ -n "$authority_entry" ]; then
    die 'Authority host store 在 transaction 开始时不为空'
  fi
  podman image exists "$image_tag" || die '固定镜像在 transaction 前不可用'
  [ "$(normalize_oci_digest "$(podman image inspect "$image_tag" --format '{{.Id}}')")" = "$image_config_digest" ] \
    || die '固定镜像 OCI config digest 在 transaction 前不一致'
  [ "$(podman image inspect "$image_tag" --format '{{ index .Labels "org.opencontainers.image.revision" }}')" = "$image_revision" ] \
    || die '固定镜像 revision 在 transaction 前不一致'
  podman run --rm --network none --entrypoint /bin/sh "$image_tag" -lc \
    'test -x ./node_modules/.bin/tsx && test -d ./src/lib/knowledge-cutover'

  local expected_deploy_sha
  expected_deploy_sha="$(node -e 'const fs=require("node:fs"); process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).source.deploymentScriptSha256)' "${stage}/plan.json")"
  [ "$(hash_file "${stage}/4-deploy.sh")" = "$expected_deploy_sha" ] \
    || die 'staged 4-deploy.sh 不匹配 sealed plan'
  local expected_image_config_digest
  expected_image_config_digest="$(node -e 'const fs=require("node:fs"); process.stdout.write(JSON.parse(fs.readFileSync(process.argv[1], "utf8")).source.imageConfigDigest)' "${stage}/plan.json")"
  [ "$expected_image_config_digest" = "$image_config_digest" ] \
    || die 'sealed plan 与固定镜像 OCI config digest 不一致'

  stop_consumers
  tar -tzf "${stage}/authority.tar.gz" | while IFS= read -r entry; do
    if [[ "$entry" == /* || "$entry" == ../* || "$entry" == *"/../"* ]]; then
      die "Authority archive 含不安全路径: $entry"
    fi
  done
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

  printf 'production knowledge cutover committed: transaction=%s image=%s\n' "$transaction_id" "$image_tag"
}

case "$action" in
  preflight) run_preflight "$@" ;;
  stage) run_stage "$@" ;;
  activate) run_activate "$@" ;;
  *) die 'expected one of: preflight, stage, activate' ;;
esac
