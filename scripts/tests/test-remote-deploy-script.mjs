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

function toBashPath(filePath) {
  if (process.platform !== 'win32') {
    return filePath;
  }
  const converted = spawnSync(
    'bash',
    ['-lc', `cygpath -u '${filePath.replace(/'/g, "'\\''")}'`],
    { encoding: 'utf8' },
  );
  if (converted.status !== 0 || !converted.stdout.trim()) {
    throw new Error(`cannot convert Windows path to bash path: ${filePath}`);
  }
  return converted.stdout.trim();
}

function verifyLegacyRsyncRetired() {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'remote-deploy-legacy-rsync-retired-'));
  try {
    const fakeBin = path.join(fixtureRoot, 'bin');
    const sshLog = path.join(fixtureRoot, 'ssh.log');
    const rsyncLog = path.join(fixtureRoot, 'rsync.log');
    fs.mkdirSync(fakeBin);
    const bashEnvFile = path.join(fixtureRoot, 'bash-env.sh');
    fs.writeFileSync(
      bashEnvFile,
      `export PATH="${toBashPath(fakeBin)}:$PATH"\n`,
      'utf8',
    );
    writeExecutable(fakeBin, 'ssh', [
      '#!/usr/bin/env bash',
      `printf '%s\\n' "$*" >> ${JSON.stringify(sshLog)}`,
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
    writeExecutable(fakeBin, 'rsync', [
      '#!/usr/bin/env bash',
      `printf '%s\\n' "$*" >> ${JSON.stringify(rsyncLog)}`,
      'exit 0',
      '',
    ].join('\n'));
    const imageTar = path.join(fixtureRoot, 'image.tar');
    const provenance = `${imageTar}.provenance.json`;
    const runtimeRoot = path.join(fixtureRoot, 'runtime');
    fs.writeFileSync(imageTar, 'fixture-image');
    fs.writeFileSync(provenance, '{}\n');
    fs.mkdirSync(path.join(runtimeRoot, 'resources', 'textbook-hybrid-retrieval', 'bge-m3'), {
      recursive: true,
    });
    fs.writeFileSync(
      path.join(runtimeRoot, 'resources', 'textbook-hybrid-retrieval', 'bge-m3', 'manifest.json'),
      '{}\n',
    );
    const retired = spawnSync(
      'bash',
      [path.join(root, 'scripts/remote-deploy.sh'), '--skip-build'],
      {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${fakeBin}:${process.env.PATH}`,
          BASH_ENV: bashEnvFile,
          SKIP_BUILD: '1',
          SSH_TARGET: 'fixture.invalid',
          REMOTE_PROJECT_DIR: '/tmp/act-remote-deploy-fixture',
          RUNTIME_DELIVERY_MODE: 'legacy-rsync',
          LOCAL_IMAGE_TAR: imageTar,
          LOCAL_PROVENANCE_FILE: provenance,
          LOCAL_RUNTIME_DIR: runtimeRoot,
        },
      },
    );
    assert.notEqual(retired.status, 0, 'legacy-rsync 必须失败关闭');
    assert.match(
      retired.stderr,
      /legacy-rsync 已退役/u,
      'legacy-rsync 必须明确提示改用 deploy:runtime',
    );
    assert.equal(
      fs.existsSync(rsyncLog),
      false,
      '已退役的 legacy-rsync 不得调用 rsync',
    );
    assert.equal(
      fs.existsSync(sshLog) ? fs.readFileSync(sshLog, 'utf8') : '',
      '',
      '已退役的 legacy-rsync 不得打开 SSH 同步 runtime',
    );
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

function verifyDefaultDoesNotRsync() {
  const fixtureRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'remote-deploy-blob-view-default-'));
  try {
    const fakeBin = path.join(fixtureRoot, 'bin');
    const rsyncLog = path.join(fixtureRoot, 'rsync.log');
    fs.mkdirSync(fakeBin);
    const bashEnvFile = path.join(fixtureRoot, 'bash-env.sh');
    fs.writeFileSync(bashEnvFile, `export PATH="${toBashPath(fakeBin)}:$PATH"\n`, 'utf8');
    writeExecutable(fakeBin, 'ssh', '#!/usr/bin/env bash\nexit 0\n');
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
    writeExecutable(fakeBin, 'rsync', [
      '#!/usr/bin/env bash',
      `printf '%s\\n' "$*" >> ${JSON.stringify(rsyncLog)}`,
      'exit 73',
      '',
    ].join('\n'));
    const imageTar = path.join(fixtureRoot, 'image.tar');
    const provenance = `${imageTar}.provenance.json`;
    fs.writeFileSync(imageTar, 'fixture-image');
    fs.writeFileSync(provenance, '{}\n');
    const result = spawnSync(
      'bash',
      [path.join(root, 'scripts/remote-deploy.sh'), '--skip-build'],
      {
        cwd: root,
        encoding: 'utf8',
        env: {
          ...process.env,
          PATH: `${fakeBin}:${process.env.PATH}`,
          BASH_ENV: bashEnvFile,
          SKIP_BUILD: '1',
          SSH_TARGET: 'fixture.invalid',
          REMOTE_PROJECT_DIR: '/tmp/act-remote-deploy-fixture',
          LOCAL_IMAGE_TAR: imageTar,
          LOCAL_PROVENANCE_FILE: provenance,
        },
      },
    );
    assert.notEqual(result.status, 0, '默认 blob-view 在夹具中应失败关闭');
    assert.equal(
      fs.existsSync(rsyncLog),
      false,
      '默认 RUNTIME_DELIVERY_MODE 不得调用 rsync 传输 runtime',
    );
  } finally {
    fs.rmSync(fixtureRoot, { recursive: true, force: true });
  }
}

function verifyLegacyRemoteTransactionQuoting(script) {
  const start = script.indexOf(`remote "bash -lc 'set -euo pipefail`);
  const end = script.indexOf('\n\nlog "[5/5] 部署验证"', start);
  assert.ok(start >= 0 && end > start, '远端部署必须保留单一 Step 4 事务');
  const transaction = script.slice(start, end);
  assert.doesNotMatch(
    transaction,
    /RUNTIME_DELIVERY_MODE=legacy-rsync/,
    'Step 4 不得再把已退役的 legacy-rsync 传入 4-deploy',
  );
  const result = spawnSync('bash', ['-c', `
set -euo pipefail
remote() { printf 'argc=%s\\n' "$#"; printf '%s\\n' "$1" | bash -n; }
DEPLOY_SCOPE=all
RUNTIME_DELIVERY_MODE=ossfs-blob-view
REMOTE_PROJECT_DIR=/tmp/act
APP_NAME_HINT=app
WORKER_NAME_HINT=worker
GC_NAME_HINT=gc
REMOTE_RUNTIME_DIR=/tmp/act/course-content/runtime
REMOTE_BLOB_VIEW_ROOT=/tmp/act/data/runtime/blob-views
REMOTE_PROVENANCE_HELPER=/tmp/act/provenance.mjs
REMOTE_TEXTBOOK_V2_RUNTIME_DIR=/tmp/act/course-content/runtime/resources/textbooks-v2
REMOTE_TEXTBOOK_RETRIEVAL_INDEX_DIR=/tmp/act/course-content/runtime/resources/textbook-hybrid-retrieval/bge-m3
REMOTE_PROVENANCE_FILE=/tmp/act/provenance.json
REMOTE_EXPORT_DB_SCRIPT=/tmp/act/export-db.sh
REMOTE_LOAD_IMAGES_SCRIPT=/tmp/act/load-images.sh
REMOTE_APP_IMAGE=localhost/test:latest
PROVENANCE_APP_REVISION=${'a'.repeat(40)}
REMOTE_APP_DEPLOY_SCRIPT=/tmp/act/deploy.sh
REMOTE_IMPORT_DB_SCRIPT=/tmp/act/import-db.sh
REMOTE_RUNTIME_ACTIVATE_SCRIPT=/tmp/act/activate.sh
RUNTIME_OSS_RAM_ROLE=act-runtime-oss-read
RUNTIME_RELEASE_ID=runtime-test
RUNTIME_EXPECTED_ACTIVE_RELEASE=none
REMOTE_RUNTIME_VERIFICATION_RECEIPT=/tmp/act/receipt.json
REMOTE_NGINX_SCRIPT=/tmp/act/nginx.sh
REMOTE_SERVICE_SCRIPT=/tmp/act/service.sh
REMOTE_LOG_FILE=/tmp/act/deploy.log
${transaction}
`], { cwd: root, encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /^argc=1$/m, 'Step 4 must send one syntactically valid remote command rather than split local shell words');
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
  verifyDefaultDoesNotRsync();
  verifyLegacyRsyncRetired();
  verifyLegacyRemoteTransactionQuoting(script);
  assert.match(
    script,
    /legacy-rsync 已退役/,
    'legacy-rsync 必须失败关闭并提示改用 deploy:runtime',
  );
  assert.equal(
    script.includes('rsync "${runtime_rsync_args[@]}"'),
    false,
    'remote-deploy.sh 不得再包含 course-content/runtime rsync',
  );

  assert.match(
    script,
    /RUNTIME_DELIVERY_MODE="\$\{RUNTIME_DELIVERY_MODE:-ossfs-blob-view\}"/,
    '远端部署默认必须绑定已物化 OSS blob-view，而不是 rsync runtime',
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
    script.includes('trap on_exit EXIT') &&
      script.includes('REMOTE_RUNTIME_SELECTION_LOCK') &&
      script.includes('ossfs-blob-view：不传输 runtime 内容'),
    true,
    '远端部署必须保留失败处理，并默认绑定已物化 blob-view',
  );

  assert.equal(
    script.includes('REMOTE_RUNTIME_PARENT_DIR="$(dirname "${REMOTE_RUNTIME_DIR}")"') &&
      script.includes(
        'remote "mkdir -p \'${REMOTE_IMAGES_DIR}\' \'${REMOTE_RUNTIME_PARENT_DIR}\'',
      ),
    true,
    '远端部署仍需准备 runtime 父目录，但不得再 rsync 本地 tree',
  );
  assert.match(
    script,
    /REMOTE_PRODUCTION_CUTOVER_MARKER="\$\{REMOTE_PRODUCTION_CUTOVER_MARKER:-\$\{REMOTE_BLOB_VIEW_ROOT\}\/current\/knowledge\/production-cutover-transactions\/current\.json\}"/,
    '默认 blob-view 必须定位已物化 view 上的生产切换 marker',
  );
  const blobViewVerify = script.slice(
    script.indexOf('log "- 校验远端已物化 blob-view'),
    script.indexOf('log "- 校验远端 runtime 目录"'),
  );
  assert.match(blobViewVerify, /check_remote_blob_view/);
  assert.doesNotMatch(
    blobViewVerify,
    /guard_no_committed_production_cutover|check_remote_authority_current_pointer_absence/,
    '默认 ossfs-blob-view 验收不得因 Legacy cutover/authority 门禁失败',
  );
  assert.match(
    script,
    /check_remote_runtime_pointer_absence/,
    'ossfs-release 验收仍须检查 production pointer 不存在',
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

  verifyLegacyRsyncRetired();

  console.log('remote deploy script test passed');
}

main();
