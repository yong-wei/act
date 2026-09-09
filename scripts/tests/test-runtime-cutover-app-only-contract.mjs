import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const root = process.cwd();
const deploy = fs.readFileSync(path.join(root, 'deploy/podman/deploy.sh'), 'utf8');

const coordinatorFd = fs.openSync(path.join(root, 'deploy/podman/deploy.sh'), 'r');
try {
  const prelude = deploy.slice(0, deploy.indexOf('SCRIPT_DIR='));
  const result = spawnSync('bash', ['-c', `${prelude}\nbash -c 'test ! -e /dev/fd/9'`], {
    stdio: ['ignore', 'pipe', 'pipe', 'ignore', 'ignore', 'ignore', 'ignore', 'ignore', 'ignore', coordinatorFd],
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, `container subprocess must not inherit the coordinator lock: ${result.stderr}`);
  assert.ok(fs.fstatSync(coordinatorFd).isFile(), 'the parent coordinator descriptor must remain open');
} finally {
  fs.closeSync(coordinatorFd);
}

assert.match(deploy, /--runtime-cutover-app-only/, 'deployment must expose a dedicated runtime cutover mode');
assert.match(deploy, /RUNTIME_CUTOVER_APP_ONLY=1/, 'runtime cutover mode must be explicit');
assert.match(deploy, /RUN_MIGRATIONS_ON_START=0/, 'runtime cutover must disable migrations');
assert.match(deploy, /runtime cutover 跳过 Prisma 迁移、策略物化和作业存储健康检查/, 'runtime cutover must skip every database-writing or storage-probing preflight');
assert.match(deploy, /runtime cutover 跳过 scheduler 初始化/, 'runtime cutover must skip scheduler writes');
assert.match(deploy, /保留既有 Redis 容器/, 'runtime cutover must preserve Redis');
assert.match(deploy, /runtime cutover requires existing network/, 'runtime cutover must not create an infrastructure network');
const removalBranch = deploy.match(/elif \[ "\$RUNTIME_CUTOVER_APP_ONLY" = "1" \]; then\n([\s\S]*?)\nelse\n  remove_if_exists "\$SUBMISSION_SCANNER_CONTAINER"/)?.[1];
assert.ok(removalBranch, 'runtime cutover must have an isolated application-container removal branch');
assert.doesNotMatch(removalBranch, /REDIS_CONTAINER/, 'runtime cutover must not remove Redis');
const storageBranch = deploy.match(/APP_STORAGE_ENV_ARGS=\(\)\nSCANNER_ENV_ARGS=\(\)\nGC_ENV_ARGS=\(\)\n([\s\S]*?)\nif \[ -n "\$\{KONLING_SERVER_MODE_CONTEXT_SECRET:-\}" \]/)?.[1];
assert.ok(storageBranch, 'runtime cutover must construct storage arguments before its zero-database-write branch');
assert.doesNotMatch(storageBranch, /RUNTIME_CUTOVER_APP_ONLY/, 'runtime cutover must retain app, scanner, and GC storage credentials');

console.log('runtime cutover app-only contract passed');
