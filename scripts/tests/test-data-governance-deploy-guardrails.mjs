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

assert.equal(
  serviceSource.includes('ExecStart=/bin/sh -lc \'APP_IMAGE=${APP_IMAGE} ACT_KNOWLEDGE_DEPLOYMENT_MODE=${ACT_KNOWLEDGE_DEPLOYMENT_MODE} "${APP_DEPLOY_SCRIPT}" --app-only\''),
  true,
  'systemd 配置必须以冻结镜像通过 4-deploy.sh --app-only 继续重建并管理 worker 容器',
);

assert.equal(
  serviceSource.includes('ExecStart=/usr/bin/podman start ${WORKER_CONTAINER}'),
  false,
  'systemd 配置不得直接启动旧 worker 容器，避免复用过期静态主机映射',
);

console.log('data governance deploy guardrails contract passed');
