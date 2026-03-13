import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const dockerignore = read('.dockerignore');
const buildScript = read('scripts/build.sh');
const serviceScript = read('deploy/podman/configure-service.sh');
const deployScript = read('deploy/podman/deploy.sh');
const remoteDeployScript = read('scripts/remote-deploy.sh');

assert.equal(
  dockerignore.includes('course-content/runtime'),
  true,
  'Docker 构建上下文应排除 course-content/runtime，避免把运行时资源打进镜像',
);

assert.equal(
  buildScript.includes('course-content/runtime') && buildScript.includes('.dockerignore'),
  true,
  '构建脚本应显式校验 course-content/runtime 已被 .dockerignore 排除',
);

assert.equal(
  deployScript.includes('-v "${RUNTIME_CONTENT_DIR}:/app/course-content/runtime:ro"'),
  true,
  'Podman 部署脚本应把外部 runtime 目录只读挂载到容器内 /app/course-content/runtime',
);

assert.equal(
  deployScript.includes('RUNTIME_CONTENT_DIR="${RUNTIME_CONTENT_DIR:-'),
  true,
  'Podman 部署脚本应允许通过 RUNTIME_CONTENT_DIR 配置外部 runtime 目录',
);

assert.equal(
  remoteDeployScript.includes('rsync -az --delete') &&
    remoteDeployScript.includes('course-content/runtime') &&
    (remoteDeployScript.includes('${REMOTE_PROJECT_DIR}/course-content/runtime') ||
      remoteDeployScript.includes('${REMOTE_RUNTIME_DIR}/')),
  true,
  '远端部署脚本应使用 rsync 将本地 course-content/runtime 同步到服务器同名目录',
);

assert.equal(
  remoteDeployScript.includes('deploy/podman/deploy.sh') &&
    remoteDeployScript.includes('${REMOTE_PROJECT_DIR}/scripts/4-deploy.sh'),
  true,
  '远端部署脚本应同步最新的 4-deploy.sh 到服务器，确保应用容器挂载外部 runtime 目录',
);

assert.equal(
  serviceScript.includes('pg_isready') &&
    serviceScript.includes('until') &&
    serviceScript.includes('ExecStart=/usr/bin/podman start ${APP_CONTAINER}'),
  true,
  'systemd 配置脚本应在启动应用容器前等待数据库就绪，避免 Prisma 首次启动抢跑',
);

assert.equal(
  remoteDeployScript.includes('deploy/podman/configure-service.sh') &&
    remoteDeployScript.includes('${REMOTE_PROJECT_DIR}/scripts/5-configure-service.sh'),
  true,
  '远端部署脚本应同步最新的 5-configure-service.sh 到服务器，确保 systemd 启动顺序与仓库一致',
);

assert.equal(
  remoteDeployScript.includes("test -d '${REMOTE_PROJECT_DIR}/course-content/runtime'"),
  true,
  '远端部署脚本应校验远端 runtime 目录存在后再执行部署验证',
);

console.log('runtime externalized deploy test passed');
