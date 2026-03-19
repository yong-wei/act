import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function main() {
  const dockerfile = read('Dockerfile');
  const migrationSql = fs
    .readdirSync(path.join(root, 'prisma', 'migrations'), { withFileTypes: true })
    .filter((entry) => entry.isDirectory())
    .map((entry) => read(path.join('prisma', 'migrations', entry.name, 'migration.sql')))
    .join('\n');

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

  assert.match(
    dockerfile,
    /COPY --from=builder \/app\/scripts\/workers \.\/scripts\/workers/,
    'Dockerfile 必须把 worker 所需脚本复制到运行镜像'
  );

  assert.match(
    dockerfile,
    /COPY --from=builder \/app\/src \.\/src/,
    'Dockerfile 必须把 worker 所需源码复制到运行镜像'
  );

  const entrypointPath = path.join(root, 'docker-entrypoint.sh');
  assert.ok(fs.existsSync(entrypointPath), '项目根目录必须存在 docker-entrypoint.sh');

  const deployScript = read('deploy/podman/deploy.sh');
  assert.match(
    deployScript,
    /RUN_MIGRATIONS_ON_START="1"/,
    'Podman 部署脚本应显式开启启动迁移开关'
  );

  assert.match(
    deployScript,
    /data-governance-worker\.ts/,
    'Podman 部署脚本必须启动数据治理 worker'
  );

  assert.match(
    deployScript,
    /redis-server --appendonly yes/,
    'Podman 部署脚本必须启动 Redis 容器'
  );

  for (const tableName of [
    'KonlingSession',
    'LearningEventBatch',
    'EventDictionary',
    'LearningFact',
    'StudentCompetencySnapshot',
    'StudentProfileSummary',
    'ClassCompetencySnapshot',
    'StudentRiskFlag',
    'GrowthRecord',
    'LearningRecommendation',
  ]) {
    assert.match(
      migrationSql,
      new RegExp(`CREATE TABLE "${tableName}"`),
      `Prisma 迁移必须包含数据治理表 ${tableName}`
    );
  }

  assert.match(
    migrationSql,
    /ALTER TABLE "ClassSession" ADD COLUMN\s+"updatedAt" TIMESTAMP\(3\)/,
    'Prisma 迁移必须包含 ClassSession.updatedAt 变更'
  );

  assert.match(
    migrationSql,
    /ALTER TABLE "InteractionLog" ALTER COLUMN "resourceKey" DROP NOT NULL/,
    'Prisma 迁移必须包含 InteractionLog.resourceKey 可空变更'
  );

  console.log('docker migration readiness test passed');
}

main();
