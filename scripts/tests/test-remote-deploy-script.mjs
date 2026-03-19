import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function main() {
  const script = read('scripts/remote-deploy.sh');

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

  assert.match(
    script,
    /REMOTE_DEPLOY_SCRIPT="\$\{REMOTE_DEPLOY_SCRIPT:-\$\{REMOTE_PROJECT_DIR\}\/scripts\/0-one-key\.sh\}"/,
    '远端部署脚本必须以 0-one-key.sh 作为默认远端部署入口'
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
    true,
    '远端部署脚本必须能回滚失败的 Prisma 迁移记录'
  );

  assert.equal(
    script.includes('migrate resolve --applied 20260303142500_add_platform_settings'),
    true,
    '远端部署脚本必须能在 PlatformSetting 已存在时补记最新迁移'
  );

  assert.equal(
    script.includes("data-governance-worker.ts"),
    true,
    '远端部署脚本必须校验远端部署脚本已纳入 worker'
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
    script.includes("redis-cli --scan --pattern 'bull:*'"),
    true,
    '远端部署脚本必须验证 BullMQ 队列 key'
  );

  console.log('remote deploy script test passed');
}

main();
