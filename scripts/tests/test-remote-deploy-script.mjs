import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function writeExecutable(directory, name, content) {
  const filePath = path.join(directory, name);
  fs.writeFileSync(filePath, content, { mode: 0o755 });
  return filePath;
}

function verifyCutoverFailureGate() {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'remote-deploy-cutover-gate-'));
  try {
    const fakeBin = path.join(fixtureRoot, 'bin');
    const sshLog = path.join(fixtureRoot, 'ssh.log');
    const rsyncLog = path.join(fixtureRoot, 'rsync.log');
    fs.mkdirSync(fakeBin);
    writeExecutable(fakeBin, 'ssh', [
      '#!/usr/bin/env bash',
      `printf '%s\\n' "$*" >> ${JSON.stringify(sshLog)}`,
      'if [[ "${CUTOVER_MARKER_PRESENT:-0}" == "1" && "$*" == *"production-cutover-transactions/current.json"* ]]; then',
      '  exit 1',
      'fi',
      'exit 0',
      '',
    ].join('\n'));
    for (const command of ['scp', 'curl']) {
      writeExecutable(fakeBin, command, '#!/usr/bin/env bash\nexit 0\n');
    }
    writeExecutable(fakeBin, 'node', [
      '#!/usr/bin/env bash',
      'field=""',
      'while [[ "$#" -gt 0 ]]; do',
      '  if [[ "$1" == "--field" ]]; then field="$2"; break; fi',
      '  shift',
      'done',
      'case "$field" in',
      '  appRevision|runtimeSourceRevision|indexSourceRevision)',
      '    printf "%s\\n" "1111111111111111111111111111111111111111"',
      '    ;;',
      '  runtimeDigest|indexDigest)',
      '    printf "%s\\n" "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa"',
      '    ;;',
      'esac',
      'exit 0',
      '',
    ].join('\n'));
    const baseEnv = {
      ...process.env,
      PATH: `${fakeBin}:${process.env.PATH}`,
      SKIP_BUILD: '1',
      SSH_TARGET: 'fixture.invalid',
      REMOTE_PROJECT_DIR: '/tmp/act-remote-deploy-fixture',
    };
    const missingImage = path.join(fixtureRoot, 'missing-image.tar');
    const preCutover = spawnSync(
      'bash',
      [path.join(root, 'scripts/remote-deploy.sh'), '--skip-build'],
      {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...baseEnv,
          LOCAL_IMAGE_TAR: missingImage,
          LOCAL_PROVENANCE_FILE: `${missingImage}.provenance.json`,
        },
      },
    );
    assert.notEqual(preCutover.status, 0, '缺少本地镜像的 pre-cutover 应失败');
    assert.equal(
      fs.existsSync(sshLog) ? fs.readFileSync(sshLog, 'utf8') : '',
      '',
      'pre-cutover 本地失败不得通过 SSH 停止或探测生产消费者',
    );

    const imageTar = path.join(fixtureRoot, 'image.tar');
    const provenance = `${imageTar}.provenance.json`;
    const runtimeRoot = path.join(fixtureRoot, 'runtime');
    fs.writeFileSync(imageTar, 'fixture-image');
    fs.writeFileSync(provenance, '{}\n');
    fs.mkdirSync(path.join(runtimeRoot, 'resources', 'textbook-retrieval'), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(runtimeRoot, 'resources', 'textbook-retrieval', 'manifest.json'),
      '{}\n',
    );
    writeExecutable(fakeBin, 'rsync', [
      '#!/usr/bin/env bash',
      `printf '%s\\n' "$*" >> ${JSON.stringify(rsyncLog)}`,
      'exit 73',
      '',
    ].join('\n'));
    const postCutover = spawnSync(
      'bash',
      [path.join(root, 'scripts/remote-deploy.sh'), '--skip-build'],
      {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...baseEnv,
          LOCAL_IMAGE_TAR: imageTar,
          LOCAL_PROVENANCE_FILE: provenance,
          LOCAL_RUNTIME_DIR: runtimeRoot,
        },
      },
    );
    assert.notEqual(postCutover.status, 0, 'runtime rsync 失败应终止 cutover');
    const rsyncArgs = fs.readFileSync(rsyncLog, 'utf8');
    for (const pointer of [
      'knowledge/consumer-activation/current.json',
      'knowledge/projection/current.json',
      'knowledge/prerequisites/current.json',
    ]) {
      assert.match(
        rsyncArgs,
        new RegExp(`--exclude=${pointer.replaceAll('/', '\\/')}(?: |$)`),
        `runtime rsync 必须精确排除 production pointer: ${pointer}`,
      );
    }
    assert.match(
      rsyncArgs,
      /--delete-excluded(?: |$)/,
      'runtime rsync 必须删除远端残留的 excluded pointer',
    );
    const stopCalls = (
      fs.readFileSync(sshLog, 'utf8').match(/runtime consumer still running/gu) ?? []
    ).length;
    assert.equal(
      stopCalls,
      0,
      'Legacy staging 在未持有 runtime 锁前失败时不得停止消费者',
    );

    fs.writeFileSync(sshLog, '');
    writeExecutable(fakeBin, 'rsync', '#!/usr/bin/env bash\nexit 0\n');
    const postCutoverExplicitExit = spawnSync(
      'bash',
      [path.join(root, 'scripts/remote-deploy.sh'), '--skip-build'],
      {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...baseEnv,
          LOCAL_IMAGE_TAR: imageTar,
          LOCAL_PROVENANCE_FILE: provenance,
          LOCAL_RUNTIME_DIR: runtimeRoot,
        },
      },
    );
    assert.notEqual(
      postCutoverExplicitExit.status,
      0,
      'cutover 开始后的远端镜像哈希显式 fail 应终止部署',
    );
    assert.match(
      postCutoverExplicitExit.stderr,
      /远端临时文件 SHA256 不一致/u,
      '合同夹具应到达 cutover 后的显式 fail 路径',
    );
    const explicitExitStopCalls = (
      fs.readFileSync(sshLog, 'utf8').match(/runtime consumer still running/gu) ?? []
    ).length;
    assert.equal(
      explicitExitStopCalls,
      0,
      '镜像上传阶段失败时不得停止消费者',
    );

    fs.writeFileSync(sshLog, '');
    fs.rmSync(rsyncLog, { force: true });
    const committedCutover = spawnSync(
      'bash',
      [path.join(root, 'scripts/remote-deploy.sh'), '--skip-build'],
      {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...baseEnv,
          CUTOVER_MARKER_PRESENT: '1',
          LOCAL_IMAGE_TAR: imageTar,
          LOCAL_PROVENANCE_FILE: provenance,
          LOCAL_RUNTIME_DIR: runtimeRoot,
        },
      },
    );
    assert.notEqual(committedCutover.status, 0, '已提交切换 marker 必须阻止 Legacy 部署');
    assert.match(
      committedCutover.stderr,
      /已提交的生产图谱切换/u,
      'marker 阻断必须明确指向切换感知流程或显式回滚',
    );
    assert.equal(
      fs.existsSync(rsyncLog),
      false,
      '已提交切换 marker 必须在 runtime rsync 前中止 Legacy 部署',
    );
    assert.equal(
      (fs.readFileSync(sshLog, 'utf8').match(/runtime consumer still running/gu) ?? []).length,
      0,
      '已提交切换 marker 必须在停止消费者前中止 Legacy 部署',
    );
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

function main() {
  const script = read('scripts/remote-deploy.sh');
  const buildScript = read('scripts/build.sh');
  const remoteRuntimeCheck = script.slice(
    script.indexOf('check_remote_textbook_v2_files()'),
    script.indexOf('check_container_textbook_v2_files()'),
  );
  const containerRuntimeCheck = script.slice(
    script.indexOf('check_container_textbook_v2_files()'),
    script.indexOf('stop_remote_runtime_consumers()'),
  );

  assert.equal(
    remoteRuntimeCheck.includes("grep -q '") || containerRuntimeCheck.includes("grep -q '"),
    false,
    'bash -lc 单引号脚本内的 runtime grep 不得再嵌套单引号，否则远端 shell 会提前截断',
  );

  assert.equal(
    buildScript.includes('IMAGE_TAG="${IMAGE_TAG:-localhost/act-obe-platform:20260301-amd64}"'),
    true,
    '本地镜像导出必须保留 Podman 部署脚本使用的 localhost 标签，避免远端继续复用同名旧镜像',
  );

  assert.match(
    script,
    /bash "\$\{ROOT_DIR\}\/scripts\/build\.sh"/,
    '远端部署脚本必须先调用本地 build.sh'
  );

  assert.match(
    script,
    /SKIP_BUILD="\$\{SKIP_BUILD:-0\}"/,
    '远端部署脚本必须支持通过 SKIP_BUILD 控制是否跳过构建'
  );

  assert.equal(
    script.includes('--skip-build'),
    true,
    '远端部署脚本必须支持 --skip-build 选项'
  );

  assert.equal(
    script.includes('flock -x 9') &&
      script.includes('REMOTE_RUNTIME_SELECTION_LOCK') &&
      script.indexOf('rsync "${runtime_rsync_args[@]}"') <
        script.indexOf('Step 0/8: 在 runtime 锁内替换 Legacy runtime') &&
      script.includes('REMOTE_RUNTIME_STAGING_DIR') &&
      script.includes('保持教材 runtime 消费者停止') &&
      script.includes('trap on_exit EXIT'),
    true,
    'Legacy 部署必须先隔离 staging，再在同一 runtime 锁内停止消费者、替换 runtime 与重建容器',
  );

  assert.equal(
    script.includes('REMOTE_RUNTIME_PARENT_DIR="$(dirname "${REMOTE_RUNTIME_DIR}")"') &&
      script.includes(
        'remote "mkdir -p \'${REMOTE_IMAGES_DIR}\' \'${REMOTE_RUNTIME_PARENT_DIR}\'',
      ) &&
      script.includes('runtime_rsync_args=(') &&
      script.includes('if remote "test -d \'${REMOTE_RUNTIME_DIR}\'"; then') &&
      script.includes('runtime_rsync_args+=(--link-dest="${REMOTE_RUNTIME_DIR}")') &&
      script.includes('rsync "${runtime_rsync_args[@]}"'),
    true,
    'runtime rsync 只有在远端当前目录存在时才启用 link-dest，首次同步保持完整复制且参数通过数组传递',
  );

  for (const pointer of [
    'knowledge/consumer-activation/current.json',
    'knowledge/projection/current.json',
    'knowledge/prerequisites/current.json',
  ]) {
    assert.match(
      script,
      new RegExp(`--exclude=${pointer.replaceAll('/', '\\/')}`),
      `runtime rsync 必须精确排除 ${pointer}`,
    );
  }
  assert.match(
    script,
    /--delete-excluded/,
    'runtime rsync 必须删除 excluded pointer 的远端残留',
  );
  assert.doesNotMatch(
    script,
    /--exclude=[^\n]*knowledge\/(?:consumer-activation|projection|prerequisites)\/releases/,
    'runtime rsync 必须保留 candidate release assets，不得排除 releases 目录',
  );
  assert.match(
    script,
    /check_remote_runtime_pointer_absence "\$\{REMOTE_RUNTIME_STAGING_DIR\}"/,
    'runtime staging 同步后必须验证三个 production pointer 均不存在',
  );
  assert.match(
    script,
    /REMOTE_PRODUCTION_CUTOVER_MARKER="\$\{REMOTE_PRODUCTION_CUTOVER_MARKER:-\$\{REMOTE_RUNTIME_DIR\}\/knowledge\/production-cutover-transactions\/current\.json\}"/,
    'Legacy 部署必须定位已提交的生产切换 marker',
  );
  assert.ok(
    script.includes('guard_no_committed_production_cutover')
      && script.indexOf('guard_no_committed_production_cutover')
        < script.indexOf('[2/5] 同步运行时资源与部署脚本'),
    'Legacy 部署必须在远端 runtime 同步和停止消费者之前拒绝已提交切换',
  );
  assert.ok(
    (script.match(/check_remote_runtime_pointer_absence\n\s*(?:check_remote_authority_current_pointer_absence\n\s*)?remote "node /g) ?? []).length >= 2,
    'runtime 切换后及最终 remote runtime 验证都必须断言三个 production pointer 均不存在',
  );

  assert.match(
    script,
    /if \[\[ "\$\{SKIP_BUILD\}" == "1" \]\]/,
    '远端部署脚本必须在显式开启时跳过构建'
  );

  assert.match(
    script,
    /REMOTE_TMP_TAR="\$\{REMOTE_IMAGE_TAR\}\.tmp"/,
    '远端部署脚本必须使用临时文件上传'
  );

  assert.equal(
    script.includes('REMOTE_EXISTING_SHA=""') &&
      script.includes('test -f') &&
      script.includes('REMOTE_IMAGE_TAR'),
    true,
    '远端部署脚本必须先探测远端正式镜像文件是否已存在',
  );

  assert.equal(
    script.includes('REMOTE_EXISTING_SHA="$(remote_sha256 "${REMOTE_IMAGE_TAR}")"'),
    true,
    '远端部署脚本必须在远端镜像已存在时计算其 SHA256',
  );

  assert.equal(
    script.includes('if [[ "${REMOTE_EXISTING_SHA}" == "${LOCAL_SHA}" ]]; then'),
    true,
    '远端部署脚本必须在上传前判断远端镜像是否已与本地一致',
  );

  assert.equal(
    script.includes('远端镜像已是相同 SHA256，跳过重复上传'),
    true,
    '远端部署脚本必须在镜像一致时输出跳过重复上传的日志',
  );

  assert.match(
    script,
    /scp -q "\$\{LOCAL_IMAGE_TAR\}" "\$\{SSH_TARGET\}:\$\{REMOTE_TMP_TAR\}"/,
    '远端部署脚本必须把本地镜像上传到远端临时文件'
  );

  assert.match(
    script,
    /mv '\$\{REMOTE_TMP_TAR\}' '\$\{REMOTE_IMAGE_TAR\}'/,
    '远端部署脚本必须在远端使用原子替换覆盖正式镜像'
  );

  assert.equal(
    script.includes('0-one-key.sh'),
    false,
    '远端部署脚本不得依赖服务器残留的 0-one-key.sh'
  );

  assert.equal(
    script.includes('8-verify-deploy.sh'),
    false,
    '远端部署脚本不得依赖服务器残留的 8-verify-deploy.sh'
  );

  assert.equal(
    script.includes('REMOTE_EXPORT_DB_SCRIPT="${REMOTE_EXPORT_DB_SCRIPT:-${REMOTE_PROJECT_DIR}/scripts/1-export-db.sh}"') &&
      script.includes('\\"${REMOTE_EXPORT_DB_SCRIPT}\\"'),
    true,
    '远端部署脚本必须直接编排数据库导出脚本'
  );

  assert.equal(
    script.includes('REMOTE_LOAD_IMAGES_SCRIPT="${REMOTE_LOAD_IMAGES_SCRIPT:-${REMOTE_PROJECT_DIR}/scripts/2-load-images.sh}"') &&
      script.includes('\\"${REMOTE_LOAD_IMAGES_SCRIPT}\\"'),
    true,
    '远端部署脚本必须直接编排镜像装载脚本'
  );

  assert.equal(
    script.includes('REMOTE_IMPORT_DB_SCRIPT="${REMOTE_IMPORT_DB_SCRIPT:-${REMOTE_PROJECT_DIR}/scripts/3-import-db.sh}"') &&
      script.includes('\\"${REMOTE_IMPORT_DB_SCRIPT}\\"'),
    true,
    '远端部署脚本必须直接编排数据库导入脚本'
  );

  assert.equal(
    script.includes('\\"${REMOTE_APP_DEPLOY_SCRIPT}\\" --db-only'),
    true,
    '远端部署脚本必须直接调用已同步的 4-deploy.sh 启动数据库'
  );

  assert.equal(
    script.includes('\\"${REMOTE_APP_DEPLOY_SCRIPT}\\" --app-only'),
    true,
    '远端部署脚本必须直接调用已同步的 4-deploy.sh 启动应用'
  );

  assert.equal(
    script.includes('REMOTE_NGINX_SCRIPT="${REMOTE_NGINX_SCRIPT:-${REMOTE_PROJECT_DIR}/scripts/6-configure-nginx.sh}"') &&
      script.includes('\\"${REMOTE_NGINX_SCRIPT}\\"'),
    true,
    '远端部署脚本必须直接编排 Nginx 配置脚本'
  );

  assert.equal(
    script.includes('\\"${REMOTE_SERVICE_SCRIPT}\\"'),
    true,
    '远端部署脚本必须直接调用已同步的 5-configure-service.sh'
  );

  assert.equal(
    script.includes('tee \\"${REMOTE_LOG_FILE}\\"'),
    true,
    '远端部署脚本必须记录远端一键部署日志'
  );

  assert.match(
    script,
    /systemctl is-active nginx/,
    '远端部署脚本必须验证 Nginx 服务状态'
  );

  assert.match(
    script,
    /systemctl is-active act-obe-stack\.service/,
    '远端部署脚本必须验证 act-obe-stack.service 状态'
  );

  assert.match(
    script,
    /REDIS_NAME_HINT="\$\{REDIS_NAME_HINT:-act-obe-redis\}"/,
    '远端部署脚本必须约定 Redis 容器名提示'
  );

  assert.match(
    script,
    /WORKER_NAME_HINT="\$\{WORKER_NAME_HINT:-act-obe-worker\}"/,
    '远端部署脚本必须约定 worker 容器名提示'
  );

  assert.equal(
    script.includes('psql -U \\"\\${DB_USER_REAL}\\" -d \\"\\${DB_NAME_REAL}\\" -tAc \\"select 1;\\"'),
    true,
    '远端部署脚本必须验证数据库 select 1'
  );

  assert.equal(
    script.includes('curl -fsS "${PUBLIC_URL%/}/api/auth/session"'),
    true,
    '远端部署脚本必须验证公网认证会话接口'
  );

  assert.equal(
    script.includes('curl -fsS "${PUBLIC_URL%/}/api/readyz"'),
    true,
    '远端部署脚本必须验证公网 readyz 健康接口'
  );

  assert.equal(
    script.includes('wait_for_remote_http'),
    true,
    '远端部署脚本必须包含应用就绪重试逻辑'
  );

  assert.equal(
    script.includes('recover_prisma_migration_state'),
    true,
    '远端部署脚本必须包含 Prisma 失败迁移自愈逻辑'
  );

  assert.equal(
    script.includes('migrate resolve --rolled-back'),
    false,
    '远端部署脚本不得自动回滚失败的 Prisma 迁移记录'
  );

  assert.equal(
    script.includes('migrate resolve --applied 20260303142500_add_platform_settings'),
    false,
    '远端部署脚本不得在未核对 schema 时自动补记迁移'
  );
  assert.equal(
    script.includes('PlatformSetting 表已存在但 Prisma 迁移记录缺失'),
    true,
    '远端部署脚本必须在迁移记录漂移时停止并要求人工核对'
  );

  assert.match(
    script,
    /\[ -f \\"\$\{REMOTE_PROJECT_DIR\}\/\.env\.server\\" \] && \. \\"\$\{REMOTE_PROJECT_DIR\}\/\.env\.server\\"/,
    '远端部署脚本读取 .env.server 前必须先判断文件存在，避免当前远端只保留 runtime env 时验收失败'
  );

  assert.match(
    script,
    /\[ -f \\"\$\{REMOTE_PROJECT_DIR\}\/\.env\\" \] && \. \\"\$\{REMOTE_PROJECT_DIR\}\/\.env\\"/,
    '远端部署脚本必须在 .env.server 不存在时允许读取远端 .env 作为基础部署环境'
  );

  assert.equal(
    script.includes("/app-container-start-wrapper.sh worker"),
    true,
    '远端部署脚本必须校验远端部署脚本通过容器启动包装脚本纳入 worker'
  );

  assert.match(
    script,
    /grep -q '.*APP_DEPLOY_SCRIPT.*--app-only'.*REMOTE_SERVICE_SCRIPT/,
    '远端部署脚本必须验证 systemd 配置脚本在数据库就绪后重新执行 4-deploy.sh --app-only'
  );

  assert.equal(
    script.includes("grep -q 'scheduler.ts' '${REMOTE_SERVICE_SCRIPT}'"),
    false,
    '远端部署脚本不得再要求 systemd 配置脚本单独执行 scheduler.ts'
  );

  assert.equal(
    script.includes('container-start-wrapper.sh'),
    true,
    '远端部署脚本必须同步容器启动包装脚本，确保服务器端应用与 worker 使用等待式启动包装'
  );

  assert.equal(
    script.includes("redis-cli ping | grep -qx PONG"),
    true,
    '远端部署脚本必须验证 Redis PING'
  );

  assert.equal(
    script.includes("CONFIG GET maxmemory-policy"),
    true,
    '远端部署脚本必须验证 Redis 使用 noeviction 策略'
  );

  assert.equal(
    script.includes("podman logs --tail 120 '${WORKER_NAME_HINT}' | grep -q '\\\\[Worker\\\\] Data governance worker started'"),
    true,
    '远端部署脚本必须验证 worker 启动日志'
  );

  assert.equal(
    script.includes("podman inspect '${APP_NAME_HINT}' --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -q '^REDIS_URL=redis://${REDIS_NAME_HINT}\\\\.dns\\\\.podman:6379$'"),
    true,
    '远端部署脚本必须验证应用容器的 REDIS_URL 已归一化为 dns.podman 主机名',
  );

  assert.equal(
    script.includes("podman inspect '${WORKER_NAME_HINT}' --format '{{range .Config.Env}}{{println .}}{{end}}' | grep -q '^REDIS_URL=redis://${REDIS_NAME_HINT}\\\\.dns\\\\.podman:6379$'"),
    true,
    '远端部署脚本必须验证 worker 容器的 REDIS_URL 已归一化为 dns.podman 主机名',
  );

  assert.equal(
    script.includes("redis-cli --scan --pattern 'bull:*'"),
    true,
    '远端部署脚本必须验证 BullMQ 队列 key'
  );

  verifyCutoverFailureGate();

  console.log('remote deploy script test passed');
}

main();
