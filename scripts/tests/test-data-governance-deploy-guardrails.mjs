import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const deploySource = fs.readFileSync(
  path.join(root, 'deploy/podman/deploy.sh'),
  'utf8',
);
const serviceSource = fs.readFileSync(
  path.join(root, 'deploy/podman/configure-service.sh'),
  'utf8',
);

assert.match(
  deploySource,
  /REDIS_MAXMEMORY="\$\{REDIS_MAXMEMORY:-512mb\}"/,
  'Podman 部署默认 Redis maxmemory 必须提升到 512mb',
);

assert.match(
  deploySource,
  /REDIS_MAXMEMORY_POLICY="\$\{REDIS_MAXMEMORY_POLICY:-noeviction\}"/,
  'Podman 部署默认 Redis 策略必须保持 noeviction',
);

assert.match(
  serviceSource,
  /redis-cli ping/,
  'systemd 配置必须继续等待 Redis 就绪',
);

assert.match(
  serviceSource,
  /podman start \$\{WORKER_CONTAINER\}/,
  'systemd 配置必须继续管理 worker 容器',
);

console.log('data governance deploy guardrails contract passed');
