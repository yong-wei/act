import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function main() {
  const dockerfile = read('Dockerfile');
  const dockerignore = read('.dockerignore');
  const wasmBuildScript = read('scripts/wasm/build-control-engine.mjs');
  const packageJson = JSON.parse(read('package.json'));
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
    /COPY --from=builder \/app\/scripts\/db \.\/scripts\/db/,
    'Dockerfile 必须把生产数据回填脚本复制到运行镜像'
  );

  assert.match(
    dockerfile,
    /COPY --from=builder \/app\/src \.\/src/,
    'Dockerfile 必须把 worker 所需源码复制到运行镜像'
  );

  assert.match(
    dockerfile,
    /ENV SKIP_WASM_BUILD=1/,
    'Dockerfile 必须复用 scripts/build.sh 已预生成的控制分析 Wasm 产物，避免容器内重复访问 crates.io'
  );

  assert.ok(
    !/cargo install wasm-pack/.test(dockerfile),
    'Dockerfile 不得在容器内 cargo install wasm-pack，避免部署构建依赖 crates.io 网络'
  );

  assert.match(
    wasmBuildScript,
    /SKIP_WASM_BUILD === '1'/,
    'Wasm 构建脚本必须支持 Docker 构建阶段跳过重复编译'
  );

  assert.match(
    wasmBuildScript,
    /index_bg\.wasm/,
    'Wasm 构建脚本跳过编译时必须校验已生成的 wasm 文件存在'
  );

  assert.ok(
    !/curl https:\/\/sh\.rustup\.rs/.test(dockerfile),
    'Dockerfile 不得再依赖 sh.rustup.rs，避免远端构建因脚本入口不可达而卡死'
  );

  assert.match(
    dockerfile,
    /RUN npm run build/,
    'Dockerfile 必须在容器内执行 npm run build，确保走统一构建链路'
  );

  assert.match(
    packageJson.scripts.build,
    /wasm:build:control-engine/,
    '统一 build 脚本必须先构建控制分析内核的 Wasm 产物'
  );

  assert.match(
    dockerignore,
    /!scripts\/wasm\//,
    '.dockerignore 必须保留 scripts/wasm 构建脚本进入镜像构建上下文'
  );

  assert.match(
    dockerignore,
    /!scripts\/db\//,
    '.dockerignore 必须保留 scripts/db 回填脚本进入镜像构建上下文'
  );

  const entrypointPath = path.join(root, 'docker-entrypoint.sh');
  assert.ok(fs.existsSync(entrypointPath), '项目根目录必须存在 docker-entrypoint.sh');

  const deployScript = read('deploy/podman/deploy.sh');
  const buildScript = read('scripts/build.sh');
  const startWrapperScript = read('deploy/podman/container-start-wrapper.sh');
  assert.match(
    deployScript,
    /RUN_MIGRATIONS_ON_START="1"/,
    'Podman 部署脚本应显式开启启动迁移开关'
  );

  assert.match(
    deployScript,
    /\/app-container-start-wrapper\.sh worker/,
    'Podman 部署脚本必须以 worker 角色启动容器启动包装脚本'
  );

  assert.match(
    startWrapperScript,
    /data-governance-worker\.ts/,
    '容器启动包装脚本必须最终启动数据治理 worker'
  );

  assert.match(
    deployScript,
    /redis-server --appendonly yes/,
    'Podman 部署脚本必须启动 Redis 容器'
  );

  assert.doesNotMatch(
    buildScript,
    /RUSTUP_DIST_SERVER|RUSTUP_UPDATE_ROOT/,
    '构建脚本不应再向 Docker 构建传入 Rust 下载源；Docker 阶段不负责重复编译 Wasm'
  );

  assert.match(
    buildScript,
    /rm -rf "\$\{ROOT_DIR\}\/\.next"/,
    '构建脚本应在本地 Next 构建前清理 .next，避免增量产物导致部署构建卡住'
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
