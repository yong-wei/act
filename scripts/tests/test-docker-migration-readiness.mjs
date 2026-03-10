import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function main() {
  const dockerfile = read('Dockerfile');

  assert.match(
    dockerfile,
    /COPY --from=builder \/app\/prisma \.\/prisma/,
    'Dockerfile 必须把 prisma 迁移目录复制到运行镜像'
  );

  assert.match(
    dockerfile,
    /COPY --from=builder \/app\/node_modules\/@prisma \.\/node_modules\/@prisma/,
    'Dockerfile 必须把 @prisma 运行与迁移依赖复制到运行镜像'
  );

  assert.match(
    dockerfile,
    /ENTRYPOINT \["\.\/docker-entrypoint\.sh"\]/,
    'Dockerfile 必须使用 entrypoint 在启动时执行迁移'
  );

  const entrypointPath = path.join(root, 'docker-entrypoint.sh');
  assert.ok(fs.existsSync(entrypointPath), '项目根目录必须存在 docker-entrypoint.sh');

  const deployScript = read('deploy/podman/deploy.sh');
  assert.match(
    deployScript,
    /RUN_MIGRATIONS_ON_START="1"/,
    'Podman 部署脚本应显式开启启动迁移开关'
  );

  console.log('docker migration readiness test passed');
}

main();
