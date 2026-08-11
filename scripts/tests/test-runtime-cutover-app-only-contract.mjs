import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const deploy = fs.readFileSync(path.join(root, 'deploy/podman/deploy.sh'), 'utf8');

assert.match(deploy, /--runtime-cutover-app-only/, 'deployment must expose a dedicated runtime cutover mode');
assert.match(deploy, /RUNTIME_CUTOVER_APP_ONLY=1/, 'runtime cutover mode must be explicit');
assert.match(deploy, /RUN_MIGRATIONS_ON_START=0/, 'runtime cutover must disable migrations');
assert.match(deploy, /runtime cutover 跳过 Prisma 迁移和策略物化/, 'runtime cutover must skip policy writes');
assert.match(deploy, /runtime cutover 跳过 scheduler 初始化/, 'runtime cutover must skip scheduler writes');
assert.match(deploy, /保留既有 Redis 容器/, 'runtime cutover must preserve Redis');
assert.match(deploy, /runtime cutover requires existing network/, 'runtime cutover must not create an infrastructure network');
const removalBranch = deploy.match(/elif \[ "\$RUNTIME_CUTOVER_APP_ONLY" = "1" \]; then\n([\s\S]*?)\nelse\n  remove_if_exists "\$SUBMISSION_SCANNER_CONTAINER"/)?.[1];
assert.ok(removalBranch, 'runtime cutover must have an isolated application-container removal branch');
assert.doesNotMatch(removalBranch, /REDIS_CONTAINER/, 'runtime cutover must not remove Redis');

console.log('runtime cutover app-only contract passed');
