import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

function runNode(script, options = {}) {
  return execFileSync(
    process.execPath,
    ['-e', script],
    {
      cwd: options.cwd ?? root,
      env: options.env ?? process.env,
      encoding: 'utf8',
    },
  );
}

function main() {
  const dockerfile = read('Dockerfile');
  const dockerignore = read('.dockerignore');
  const wasmBuildScript = read('scripts/wasm/build-control-engine.mjs');
  const appPrismaClientFactory = read('src/lib/prisma-client.ts');
  const scriptPrismaClientFactory = read('scripts/lib/prisma-client.mjs');
  const prismaConfig = read('prisma.config.ts');
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
    /COPY --from=builder \/app\/prisma\.config\.ts \.\/prisma\.config\.ts/,
    'Dockerfile 必须把 Prisma 7 配置文件复制到运行镜像'
  );

  assert.match(
    dockerfile,
    /COPY --from=builder \/app\/node_modules\/@prisma \.\/node_modules\/@prisma/,
    'Dockerfile 必须把 @prisma 运行与迁移依赖复制到运行镜像'
  );

  assert.match(
    dockerfile,
    /npm ci --omit=dev --prefer-offline/,
    'Dockerfile 运行镜像依赖阶段必须支持 production-only install'
  );

  assert.match(
    dockerfile,
    /npm config set registry https:\/\/registry\.npmjs\.org && npm ci --omit=dev --prefer-offline/,
    'Dockerfile production-only install 必须在镜像源缺包时回退到官方 npm registry'
  );

  assert.match(
    dockerfile,
    /COPY --from=prod-deps \/app\/node_modules \.\/node_modules/,
    'Dockerfile 运行镜像必须复制 production-only node_modules，而不是完整开发依赖树'
  );

  assert.match(
    dockerfile,
    /ENTRYPOINT \["\.\/docker-entrypoint\.sh"\]/,
    'Dockerfile 必须使用 entrypoint 在启动时执行迁移'
  );

  assert.match(
    dockerfile,
    /COPY --chown=nextjs:nodejs --chmod=755 docker-entrypoint\.sh \.\/docker-entrypoint\.sh/,
    'Dockerfile 必须把 docker-entrypoint.sh 复制为可执行文件，避免 standalone 覆盖权限'
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
    /COPY --from=builder \/app\/scripts\/lib \.\/scripts\/lib/,
    'Dockerfile 必须把脚本共用 Prisma 工厂复制到运行镜像'
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
    /RUN[\s\S]*npm run build/,
    'Dockerfile 必须在容器内执行 npm run build，确保走统一构建链路'
  );

  assert.match(
    dockerfile,
    /RUN --mount=type=secret,id=database_url,required=false/,
    'Dockerfile builder 阶段必须通过 BuildKit secret 接收真实构建期 DATABASE_URL'
  );

  assert.match(
    dockerfile,
    /cat \/run\/secrets\/database_url 2>\/dev\/null \|\| true/,
    'Dockerfile 必须从 BuildKit secret 读取构建期 DATABASE_URL'
  );

  assert.match(
    dockerfile,
    /DATABASE_URL="\$\{DATABASE_URL:-postgresql:\/\/prisma-generate:prisma-generate@localhost:5432\/prisma_generate\}" npm run build/,
    'Dockerfile 只能在 secret 缺失时为 npm run build 提供 Prisma generate 占位 DATABASE_URL'
  );

  assert.doesNotMatch(
    dockerfile,
    /ARG DATABASE_URL/,
    'Dockerfile 不得通过 ARG 接收真实 DATABASE_URL，避免凭据进入镜像构建元数据'
  );

  assert.doesNotMatch(
    dockerfile,
    /ENV DATABASE_URL=postgresql:\/\/prisma-generate:prisma-generate@localhost:5432\/prisma_generate/,
    'Dockerfile 不得用 ENV 固化假 DATABASE_URL，避免覆盖真实构建期数据库'
  );

  assert.match(
    packageJson.scripts.build,
    /(?:wasm:build:control-engine|scripts\/wasm\/build-control-engine\.mjs)/,
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

  assert.match(
    dockerignore,
    /!scripts\/lib\//,
    '.dockerignore 必须保留 scripts/lib Prisma 工厂进入镜像构建上下文'
  );

  const entrypointPath = path.join(root, 'docker-entrypoint.sh');
  assert.ok(fs.existsSync(entrypointPath), '项目根目录必须存在 docker-entrypoint.sh');
  const entrypointScript = read('docker-entrypoint.sh');
  assert.match(
    entrypointScript,
    /migrate deploy --config \.\/prisma\.config\.ts/,
    'docker-entrypoint.sh 必须通过 Prisma 7 config 执行 migrate deploy'
  );

  assert.match(
    prismaConfig,
    /process\.env\.DATABASE_URL \|\|\s+'postgresql:\/\/prisma-generate:prisma-generate@localhost:5432\/prisma_generate'/,
    'prisma.config.ts 必须在 CI/Prisma generate 缺少 DATABASE_URL 时使用安全占位 URL'
  );

  assert.doesNotMatch(
    prismaConfig,
    /env\('DATABASE_URL'\)/,
    'prisma.config.ts 不得无条件要求 DATABASE_URL，否则 CI 的 prisma generate 会失败'
  );

  for (const [factoryName, factorySource] of [
    ['src/lib/prisma-client.ts', appPrismaClientFactory],
    ['scripts/lib/prisma-client.mjs', scriptPrismaClientFactory],
  ]) {
    assert.match(
      factorySource,
      /new PrismaPg\(poolConfig, adapterOptions\)/,
      `${factoryName} 必须通过 pg PoolConfig 和 PrismaPg adapter options 创建客户端，不能只传裸连接串`
    );
    assert.match(
      factorySource,
      /createPgAdapterConfig\(process\.env\.DATABASE_URL\)/,
      `${factoryName} 必须通过 DATABASE_URL 构建 pg pool config 与 adapter options`
    );
    assert.match(
      factorySource,
      /Environment variable not found: DATABASE_URL/,
      `${factoryName} 必须在 DATABASE_URL 缺失时保持 Prisma 旧错误语义，避免 pg 回落到本地默认连接`
    );
    assert.match(
      factorySource,
      /poolConfig\.max = connectionLimit/,
      `${factoryName} 必须把旧 Prisma connection_limit 参数映射为 pg pool max`
    );
    assert.match(
      factorySource,
      /poolConfig\.connectionTimeoutMillis = poolTimeoutSeconds \* 1000/,
      `${factoryName} 必须把旧 Prisma pool_timeout 秒数映射为 pg connectionTimeoutMillis`
    );
    assert.match(
      factorySource,
      /adapterOptions\.schema = schema/,
      `${factoryName} 必须把旧 Prisma schema 参数传给 PrismaPg adapter options`
    );
    assert.match(
      factorySource,
      /url\.searchParams\.delete\('connection_limit'\)/,
      `${factoryName} 必须从传给 pg 的 connectionString 中移除 connection_limit`
    );
    assert.match(
      factorySource,
      /url\.searchParams\.delete\('pool_timeout'\)/,
      `${factoryName} 必须从传给 pg 的 connectionString 中移除 pool_timeout`
    );
    assert.match(
      factorySource,
      /url\.searchParams\.delete\('schema'\)/,
      `${factoryName} 必须从传给 pg 的 connectionString 中移除 schema`
    );
  }

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
    startWrapperScript,
    /\.\/node_modules\/\.bin\/tsx scripts\/workers\/data-governance-worker\.ts/,
    'worker 生产入口使用 tsx 时必须走镜像内显式生产依赖'
  );

  assert.match(
    deployScript,
    /\.\/node_modules\/\.bin\/tsx scripts\/workers\/scheduler\.ts/,
    'scheduler 初始化使用 tsx 时必须走镜像内显式生产依赖'
  );

  assert.equal(
    packageJson.dependencies.tsx,
    '^4.22.4',
    'tsx 被生产 worker 与 scheduler 入口使用，必须归类为 dependencies'
  );

  assert.equal(
    packageJson.dependencies.prisma,
    '^7.8.0',
    'docker-entrypoint.sh 运行 Prisma 7 migrate deploy，prisma CLI 必须归类为 dependencies'
  );

  assert.equal(
    packageJson.dependencies['@prisma/adapter-pg'],
    '^7.8.0',
    'Prisma 7 PostgreSQL adapter 必须归类为 dependencies，production-only install 才能创建客户端'
  );

  assert.equal(
    packageJson.dependencies.dotenv,
    '^17.4.2',
    'prisma.config.ts 在生产迁移入口加载 dotenv，dotenv 必须归类为 dependencies'
  );

  assert.equal(
    packageJson.devDependencies?.tsx,
    undefined,
    'tsx 不得留在 devDependencies，否则 production-only install 会缺少 worker 入口'
  );

  assert.equal(
    packageJson.devDependencies?.prisma,
    undefined,
    'prisma 不得留在 devDependencies，否则 production-only install 会缺少迁移入口'
  );

  assert.equal(
    packageJson.devDependencies?.['@prisma/adapter-pg'],
    undefined,
    '@prisma/adapter-pg 不得留在 devDependencies，否则 production-only install 会缺少 Prisma adapter'
  );

  assert.equal(
    packageJson.devDependencies?.dotenv,
    undefined,
    'dotenv 不得留在 devDependencies，否则 production-only install 会缺少 Prisma config 依赖'
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

  assert.match(
    buildScript,
    /BUILD_ARGS=\(/,
    '构建脚本必须集中维护 Docker build args'
  );

  assert.match(
    buildScript,
    /DATABASE_URL_FOR_BUILD="\$\{DATABASE_URL:-\}"/,
    '构建脚本必须优先使用已导出的宿主 DATABASE_URL'
  );

  assert.match(
    buildScript,
    /require\("dotenv"\)\.config\(\{ path: "\.env", quiet: true \}\)/,
    '构建脚本必须在宿主 DATABASE_URL 未导出时从 .env 读取构建期数据库 URL'
  );

  assert.match(
    buildScript,
    /if \[\[ -n "\$\{DATABASE_URL_FOR_BUILD\}" \]\]; then/,
    '构建脚本必须在解析到构建期 DATABASE_URL 后传入 Docker 构建 secret'
  );

  assert.match(
    buildScript,
    /BUILD_ARGS\+=\(--secret "id=database_url,env=DATABASE_URL"\)/,
    '构建脚本必须把构建期 DATABASE_URL 作为 BuildKit secret 传给 builder'
  );

  assert.match(
    buildScript,
    /DATABASE_URL="\$\{DATABASE_URL_FOR_BUILD\}" docker buildx build/,
    '构建脚本必须只在 docker buildx 调用环境中暴露 DATABASE_URL secret 来源'
  );

  assert.doesNotMatch(
    buildScript,
    /--build-arg "DATABASE_URL=/,
    '构建脚本不得把真实 DATABASE_URL 作为 Docker build arg 传递'
  );

  assert.match(
    buildScript,
    /"\$\{BUILD_ARGS\[@\]\}"/,
    'docker buildx build 必须使用集中维护的 BUILD_ARGS'
  );

  const dotenvCheckDir = fs.mkdtempSync(path.join(root, '.tmp-docker-readiness-'));
  try {
    const expectedDatabaseUrl = 'postgresql://user:pass@db.example.invalid:5432/app?schema=custom';
    fs.writeFileSync(path.join(dotenvCheckDir, '.env'), `DATABASE_URL=${expectedDatabaseUrl}\n`);
    const output = runNode(
      'require("dotenv").config({ path: ".env", quiet: true }); process.stdout.write(process.env.DATABASE_URL || "");',
      {
        cwd: dotenvCheckDir,
        env: { ...process.env, DATABASE_URL: undefined },
      },
    );
    assert.equal(
      output,
      expectedDatabaseUrl,
      '从 .env 读取 Docker 构建期 DATABASE_URL 时不得把 dotenv 日志写入 build arg'
    );
  } finally {
    fs.rmSync(dotenvCheckDir, { recursive: true, force: true });
  }

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
