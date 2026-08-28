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

function runImageWolframSmoke() {
  const image = process.env.MATH_CALC_TEST_IMAGE;
  if (!image) return;
  const passThrough = [
    'WOLFRAM_CLOUD_MCP_URL',
    'WOLFRAM_CLOUD_MCP_TOKEN',
    'WOLFRAM_MCP_SERVICE_API_KEY',
  ].filter((name) => process.env[name] !== undefined);
  const dockerArgs = [
    'run',
    '--rm',
    ...passThrough.flatMap((name) => ['-e', name]),
    image,
    './scripts/math-calc/check-wolfram-ready.sh',
  ];
  try {
    const output = execFileSync('docker', dockerArgs, {
      cwd: root,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    assert.match(
      output,
      /Wolfram Cloud MCP 公式计算运行时可用/,
      '生产等价镜像必须通过容器内真实 Wolfram Cloud MCP smoke',
    );
  } catch (error) {
    throw new Error(`生产镜像 Wolfram Cloud MCP smoke 失败：${error.message}`);
  }
}

function runImageKnowledgeDeployContract() {
  const image = process.env.MATH_CALC_TEST_IMAGE;
  if (!image) return;
  try {
    execFileSync(
      'docker',
      [
        'run',
        '--rm',
        '--entrypoint',
        'sh',
        image,
        '-lc',
        'test -s /app/course-content/contracts/knowledge-relation-coverage-audit.json && test -x /app/node_modules/.bin/tsx',
      ],
      {
        cwd: root,
        encoding: 'utf8',
        stdio: 'pipe',
      },
    );
  } catch (error) {
    throw new Error(`生产镜像知识同步契约不可执行：${error.message}`);
  }
}

function assertMissingWolframImageFailsClosed() {
  const image = process.env.MATH_CALC_TEST_NEGATIVE_IMAGE;
  if (!image) return;
  let failedClosed = false;
  try {
    execFileSync(
      'docker',
      ['run', '--rm', image, 'node', '-e', 'process.stdout.write("unexpected-start")'],
      {
        cwd: root,
        encoding: 'utf8',
        stdio: 'pipe',
      },
    );
  } catch {
    failedClosed = true;
  }
  assert.ok(
    failedClosed,
    '无法访问 Wolfram Cloud MCP 的镜像必须被 entrypoint 拒绝启动',
  );
}

function main() {
  const dockerfile = read('Dockerfile');
  const dockerignore = read('.dockerignore');
  const wasmBuildScript = read('scripts/wasm/build-control-engine.mjs');
  const appPrismaClientFactory = read('src/lib/prisma-client.ts');
  const scriptPrismaClientFactory = read('scripts/lib/prisma-client.mjs');
  const prismaConfig = read('prisma.config.ts');
  const prismaSchema = read('prisma/schema.prisma');
  const packageJson = JSON.parse(read('package.json'));
  const entrypointScript = read('docker-entrypoint.sh');
  const releaseImportCli = read('scripts/db/import-authoritative-actkg-release.ts');
  const standardBundleImportCli = read('scripts/db/import-compatible-actkg-public-bundle.ts');
  const standardBundleImporter = read('scripts/actkg-release/standard-bundle-import.ts');
  const coverageImportCli = read('scripts/db/import-course-coverage-overlay.ts');
  const resourceBindingImportCli = read('scripts/db/import-canonical-resource-binding-shadow.ts');
  const remoteDeployScript = read('scripts/remote-deploy.sh');
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

  for (const requiredCopy of [
    '/app/scripts/actkg-release ./scripts/actkg-release',
    '/app/scripts/course-coverage ./scripts/course-coverage',
    '/app/course-content/authoring/knowledge/releases ./course-content/authoring/knowledge/releases',
    '/app/course-content/authoring/knowledge/course-coverage ./course-content/authoring/knowledge/course-coverage',
    '/app/course-content/contracts/knowledge-relation-coverage-audit.json ./course-content/contracts/knowledge-relation-coverage-audit.json',
    '/app/course-content/runtime/resource-governance/runtime-resource-projections.jsonl ./course-content/runtime/resource-governance/runtime-resource-projections.jsonl',
    '/app/.app-revision ./.app-revision',
  ]) {
    assert.ok(
      dockerfile.includes(requiredCopy),
      `Docker runner 必须包含权威知识部署输入: ${requiredCopy}`,
    );
  }
  const runnerStage = dockerfile.slice(
    dockerfile.indexOf('FROM runner-os AS runner'),
  );
  assert.match(
    runnerStage,
    /COPY --from=builder \/app\/course-content\/authoring\/knowledge\/authority[\s\S]*RUN rm -f[\s\S]*course-content\/authoring\/knowledge\/authority\/current\.json[\s\S]*course-content\/runtime\/knowledge\/projection\/current\.json/,
    'Docker runner 必须在复制候选 authority/projection 工件后删除 production current pointer',
  );
  assert.ok(
    dockerignore.includes('!course-content/runtime/knowledge/authority-domain-shards/**'),
    'Docker ignore 必须放行 immutable Authority domain shard set',
  );
  for (const allowedRuntimeAsset of [
    '!course-content/runtime/knowledge/authority-learning-content-manifest.json',
    '!course-content/runtime/knowledge/cards/authority/**',
    '!course-content/runtime/knowledge/infographs/authority/**',
  ]) {
    assert.ok(
      dockerignore.includes(allowedRuntimeAsset),
      `Docker ignore 必须放行 Authority 学习内容: ${allowedRuntimeAsset}`,
    );
  }
  assert.match(
    dockerfile,
    /course-content\/runtime\/knowledge\/authority-domain-shards[\s\S]*COPY --from=builder \/app\/course-content\/runtime\/knowledge\/authority-domain-shards \.\/course-content\/runtime\/knowledge\/authority-domain-shards[\s\S]*course-content\/runtime\/knowledge\/authority-domain-shards\/current\.json/,
    'Docker builder/runner 必须覆盖 Authority domain shard set，并删除 runtime current pointer',
  );
  assert.ok(
    runnerStage.indexOf('course-content/authoring/knowledge/releases') >= 0,
    'Docker runner 必须保留 authority candidate release assets',
  );
  assert.ok(
    runnerStage.indexOf('RUN rm -f') >
      runnerStage.indexOf('COPY --from=builder /app/course-content/runtime/knowledge/projection'),
    'Docker runner 的 current pointer 删除必须发生在 projection COPY 之后',
  );
  for (const requiredLearningCopy of [
    '/app/course-content/runtime/knowledge/authority-learning-content-manifest.json ./course-content/runtime/knowledge/authority-learning-content-manifest.json',
    '/app/course-content/runtime/knowledge/cards/authority ./course-content/runtime/knowledge/cards/authority',
    '/app/course-content/runtime/knowledge/infographs/authority ./course-content/runtime/knowledge/infographs/authority',
  ]) {
    assert.ok(
      runnerStage.includes(requiredLearningCopy),
      `Docker runner 必须包含 Authority 学习内容: ${requiredLearningCopy}`,
    );
  }
  assert.match(
    remoteDeployScript,
    /REMOTE_AUTHORITY_CURRENT_POINTER="\$\{REMOTE_AUTHORITY_CURRENT_POINTER:-\$\{REMOTE_PROJECT_DIR\}\/course-content\/authoring\/knowledge\/authority\/current\.json\}"/,
    'remote deploy 必须固定检查远端 host authoring Authority current pointer',
  );
  assert.match(
    remoteDeployScript,
    /legacy-rsync 已退役/,
    'legacy-rsync 已退役后不得再作为可执行 runtime 同步路径',
  );
  assert.match(
    dockerfile,
    /ARG APP_REVISION[\s\S]*printf '%s\\n' "\$\{APP_REVISION\}" > \/app\/\.app-revision/,
    'Docker builder 必须把 APP_REVISION 写入不可变镜像修订文件',
  );
  assert.match(
    dockerfile,
    /ENV APP_REVISION=\$\{APP_REVISION\}/,
    'Docker runner 必须公开与不可变修订文件一致的 APP_REVISION',
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
    /COPY --from=builder \/app\/scripts\/math-calc \.\/scripts\/math-calc/,
    'Dockerfile 必须把 math-calc 计算脚本从 builder 复制到运行镜像',
  );
  assert.match(
    dockerfile,
    /FROM \$\{NODE_IMAGE\} AS base/,
    'Docker 依赖/构建阶段必须与 runner 使用同一 glibc 发行版，避免 musl 原生模块进入生产镜像',
  );
  assert.doesNotMatch(
    dockerfile,
    /FROM node:20-alpine/,
    'Docker 构建链不得从 Alpine 生成生产依赖或 standalone 产物',
  );
  assert.match(
    dockerfile,
    /ENV WOLFRAM_CLOUD_MCP_URL=https:\/\/agenttools\.wolfram\.com\/mcp/,
    'Dockerfile runner 必须默认连接官方 Wolfram Cloud MCP',
  );
  assert.doesNotMatch(
    dockerfile,
    /wolframresearch\/wolframengine|COPY --from=wolfram-provider|\/usr\/local\/Wolfram/,
    'Dockerfile 不得再把本地 Wolfram Engine 烤进生产 runner；公式计算走 Wolfram Cloud MCP',
  );
  assert.doesNotMatch(
    dockerfile,
    /WOLFRAM_ACTIVATION_PASSWORD|WOLFRAM_ID_PASSWORD|WOLFRAM_ACTIVATION_EMAIL|WOLFRAM_CLOUD_MCP_TOKEN/i,
    'Dockerfile 不得嵌入 Wolfram 激活凭据或 Cloud MCP token',
  );
  assert.doesNotMatch(
    dockerfile,
    /scripts\/math-calc\/calc\.py|scripts\/math-calc\/requirements\.txt|sympy|parse_latex/i,
    'Dockerfile 不得继续声明已移除的 SymPy 公式计算后端',
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
    /ARG NODE_MAX_OLD_SPACE_SIZE=12288/,
    'Dockerfile builder 阶段必须提供可传入的 Node heap 默认值，避免容器内 Next 构建因默认堆内存不足失败'
  );

  assert.match(
    dockerfile,
    /ENV NODE_OPTIONS=--max-old-space-size=\$\{NODE_MAX_OLD_SPACE_SIZE\}/,
    'Dockerfile builder 阶段必须将 Node heap build arg 应用于 NODE_OPTIONS'
  );

  assert.match(
    dockerfile,
    /ENV NODE_MAX_OLD_SPACE_SIZE=\$\{NODE_MAX_OLD_SPACE_SIZE\}/,
    'Dockerfile builder 阶段必须将 Node heap build arg 传给统一构建脚本'
  );

  const packageBuildScript = packageJson.scripts.build;
  const wasmBuildIndex = Math.min(
    ...[
      packageBuildScript.indexOf('wasm:build:control-engine'),
      packageBuildScript.indexOf('scripts/wasm/build-control-engine.mjs'),
    ].filter((index) => index >= 0),
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

  const prismaGenerateIndex = packageBuildScript.indexOf('prisma generate');
  const nextBuildIndex = packageBuildScript.indexOf('scripts/build-next-with-trace-check.mjs');
  assert.ok(
    wasmBuildIndex >= 0
      && prismaGenerateIndex > wasmBuildIndex
      && nextBuildIndex > wasmBuildIndex,
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
  assert.match(
    dockerignore,
    /!scripts\/math-calc\//,
    '.dockerignore 必须保留 scripts/math-calc 目录进入镜像构建上下文',
  );
  assert.match(
    dockerignore,
    /!scripts\/math-calc\/\*\*/,
    '.dockerignore 必须保留 scripts/math-calc 下的计算脚本与依赖清单进入镜像构建上下文',
  );
  for (const requiredPath of [
    '!scripts/actkg-release/**',
    '!scripts/course-coverage/**',
    '!course-content/runtime/resource-governance/runtime-resource-projections.jsonl',
  ]) {
    assert.ok(
      dockerignore.includes(requiredPath),
      `.dockerignore 必须放行 ${requiredPath}`,
    );
  }

  const entrypointPath = path.join(root, 'docker-entrypoint.sh');
  assert.ok(fs.existsSync(entrypointPath), '项目根目录必须存在 docker-entrypoint.sh');
  assert.match(
    entrypointScript,
    /check-wolfram-ready\.sh/,
    'docker-entrypoint.sh 必须调用 Wolfram Cloud MCP 就绪检查',
  );
  assert.match(
    entrypointScript,
    /exit 1/,
    'docker-entrypoint.sh 必须在 Wolfram Cloud MCP 不可达或 smoke 失败时拒绝启动',
  );
  assert.match(
    remoteDeployScript,
    /check-wolfram-ready\.sh/,
    'remote-deploy 最终阶段必须核验容器内 Wolfram Cloud MCP 就绪',
  );
  assert.match(
    entrypointScript,
    /migrate deploy --config \.\/prisma\.config\.ts/,
    'docker-entrypoint.sh 必须通过 Prisma 7 config 执行 migrate deploy'
  );
  const migrateIndex = entrypointScript.indexOf('migrate deploy --config ./prisma.config.ts');
  const releaseImportIndex = entrypointScript.indexOf('import-authoritative-actkg-release.ts');
  const coverageImportIndex = entrypointScript.indexOf('import-course-coverage-overlay.ts');
  const resourceBindingImportIndex = entrypointScript.indexOf(
    'import-canonical-resource-binding-shadow.ts',
  );
  assert.ok(
    migrateIndex >= 0
      && releaseImportIndex > migrateIndex
      && coverageImportIndex > releaseImportIndex
      && resourceBindingImportIndex > coverageImportIndex,
    'entrypoint 必须仅在启动迁移分支内按 migrate → Release → Overlay → 资源绑定影子清单顺序执行',
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
  const localImageBuildScript = read('scripts/build.sh');
  const startWrapperScript = read('deploy/podman/container-start-wrapper.sh');
  assert.match(
    startWrapperScript,
    /SKIP_WOLFRAM_READY_CHECK=1/,
    '作业扫描/GC 不得在循环里重复探测 Wolfram Cloud MCP',
  );
  assert.match(
    entrypointScript,
    /SKIP_WOLFRAM_READY_CHECK/,
    'entrypoint 必须允许跳过 Wolfram Cloud MCP 启动探测',
  );

  // Caller-pinned APP_IMAGE / ACT_KNOWLEDGE_DEPLOYMENT_MODE must win over .env.server.
  {
    const operatorCaptureIdx = deployScript.indexOf('operator_app_image_was_set=0');
    const envFileLoopIdx = deployScript.indexOf(
      'for env_file in "$PROJECT_DIR/.env.server" "$SCRIPT_DIR/.env.server"',
    );
    const modeCaptureIdx = deployScript.indexOf('operator_knowledge_mode_was_set=0');
    assert.ok(operatorCaptureIdx >= 0, 'deploy.sh 必须捕获调用方 APP_IMAGE');
    assert.ok(modeCaptureIdx >= 0, 'deploy.sh 必须捕获调用方 ACT_KNOWLEDGE_DEPLOYMENT_MODE');
    assert.ok(
      envFileLoopIdx > operatorCaptureIdx && envFileLoopIdx > modeCaptureIdx,
      '调用方 APP_IMAGE/MODE 捕获必须发生在 source .env.server 之前',
    );
    assert.match(
      deployScript,
      /if \[ "\$operator_app_image_was_set" = "1" \]; then\s*\n\s*APP_IMAGE="\$operator_app_image"/,
      'deploy.sh 必须在全部 env source 后恢复调用方 APP_IMAGE',
    );
    assert.match(
      deployScript,
      /if \[ "\$operator_knowledge_mode_was_set" = "1" \]; then\s*\n\s*ACT_KNOWLEDGE_DEPLOYMENT_MODE="\$operator_knowledge_mode"/,
      'deploy.sh 必须在全部 env source 后恢复调用方 ACT_KNOWLEDGE_DEPLOYMENT_MODE',
    );
    assert.match(
      deployScript,
      /-e ACT_KNOWLEDGE_DEPLOYMENT_MODE="\$ACT_KNOWLEDGE_DEPLOYMENT_MODE"/,
      'app/worker 共享环境必须传递同一 ACT_KNOWLEDGE_DEPLOYMENT_MODE',
    );
    const appImageUses = deployScript.match(/"\$APP_IMAGE"/g) ?? [];
    assert.ok(
      appImageUses.length >= 2,
      'app 与 worker 必须使用同一 \$APP_IMAGE 变量启动',
    );

    const fixtureRoot = fs.mkdtempSync(path.join(root, '.tmp-deploy-env-priority-'));
    try {
      const deployDir = path.join(fixtureRoot, 'deploy', 'podman');
      fs.mkdirSync(deployDir, { recursive: true });
      fs.mkdirSync(path.join(fixtureRoot, 'data', 'runtime'), { recursive: true });
      fs.writeFileSync(
        path.join(fixtureRoot, '.env.server'),
        [
          'APP_IMAGE=from-env-server',
          'ACT_KNOWLEDGE_DEPLOYMENT_MODE=legacy',
          'SECRET_SHOULD_NOT_LEAK=super-secret-value',
          '',
        ].join('\n'),
      );
      fs.writeFileSync(
        path.join(fixtureRoot, 'data', 'runtime', 'act-obe.env'),
        [
          'APP_IMAGE=from-runtime-env',
          'ACT_KNOWLEDGE_DEPLOYMENT_MODE=legacy',
          '',
        ].join('\n'),
      );
      const marker = 'ACT_KNOWLEDGE_DEPLOYMENT_MODE="${ACT_KNOWLEDGE_DEPLOYMENT_MODE:-legacy}"';
      assert.ok(deployScript.includes(marker), 'deploy.sh 必须保留 MODE 默认赋值点');
      const instrumented = deployScript.replace(
        marker,
        `${marker}\nprintf 'RESOLVED_APP_IMAGE=%s\\nRESOLVED_MODE=%s\\n' "$APP_IMAGE" "$ACT_KNOWLEDGE_DEPLOYMENT_MODE"\nexit 0`,
      );
      const instrumentedPath = path.join(deployDir, 'deploy.sh');
      fs.writeFileSync(instrumentedPath, instrumented);
      fs.chmodSync(instrumentedPath, 0o700);

      const callerPinned = execFileSync(
        'bash',
        [instrumentedPath, '--app-only'],
        {
          cwd: fixtureRoot,
          encoding: 'utf8',
          env: {
            ...process.env,
            APP_IMAGE: 'caller-fixed-image',
            ACT_KNOWLEDGE_DEPLOYMENT_MODE: 'cutover',
          },
        },
      );
      assert.match(callerPinned, /RESOLVED_APP_IMAGE=caller-fixed-image/, '调用方 APP_IMAGE 必须覆盖 .env.server');
      assert.match(callerPinned, /RESOLVED_MODE=cutover/, '调用方 MODE 必须覆盖 .env.server');
      assert.doesNotMatch(
        callerPinned,
        /super-secret-value/,
        'deploy env 解析输出不得泄露 .env.server 中的 secret',
      );

      const fileDefault = execFileSync(
        'bash',
        [instrumentedPath, '--app-only'],
        {
          cwd: fixtureRoot,
          encoding: 'utf8',
          env: Object.fromEntries(
            Object.entries(process.env).filter(
              ([key]) => key !== 'APP_IMAGE' && key !== 'ACT_KNOWLEDGE_DEPLOYMENT_MODE',
            ),
          ),
        },
      );
      assert.match(fileDefault, /RESOLVED_APP_IMAGE=from-env-server/, '未指定调用方时必须保留 .env.server APP_IMAGE');
      assert.match(fileDefault, /RESOLVED_MODE=legacy/, '未指定调用方时必须保留 .env.server MODE');
      assert.doesNotMatch(fileDefault, /super-secret-value/, '默认路径也不得打印 secret');
      assert.doesNotMatch(
        fileDefault,
        /RESOLVED_APP_IMAGE=from-runtime-env/,
        'runtime env 不得覆盖 .env.server 中的 APP_IMAGE',
      );
    } finally {
      fs.rmSync(fixtureRoot, { recursive: true, force: true });
    }
  }

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

  runImageWolframSmoke();
  runImageKnowledgeDeployContract();
  assertMissingWolframImageFailsClosed();

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
    deployScript,
    /WOLFRAM_LICENSE_VOLUME|act-obe-wolfram-license|WOLFRAM_ACTIVATION_EMAIL|WOLFRAMSCRIPT_ENTITLEMENTID/,
    'deploy.sh 不得再创建或挂载本地 Wolfram Engine 许可卷',
  );
  assert.match(
    deployScript,
    /WOLFRAM_CLOUD_MCP_URL="\$\{WOLFRAM_CLOUD_MCP_URL:-https:\/\/agenttools\.wolfram\.com\/mcp\}"/,
    'deploy.sh 必须默认连接官方 Wolfram Cloud MCP',
  );
  assert.match(
    deployScript,
    /check-wolfram-ready\.sh/,
    'deploy.sh 必须用生产镜像执行真实 Wolfram Cloud MCP smoke 后再启动应用',
  );
  assert.match(
    deployScript,
    /if podman run --rm --entrypoint \/bin\/sh "\$APP_IMAGE" -c 'test -x \/app\/scripts\/math-calc\/check-wolfram-ready\.sh'; then/,
    'deploy.sh 必须先确认镜像包含 Wolfram smoke 脚本',
  );
  assert.match(
    deployScript,
    /elif \[ "\$RUNTIME_CUTOVER_APP_ONLY" = "1" \]; then/,
    '仅 runtime cutover 可以兼容既有缺少 Wolfram smoke 的镜像',
  );
  assert.match(
    deployScript,
    /WOLFRAM_CLOUD_MCP_URL="\$WOLFRAM_CLOUD_MCP_URL"/,
    'deploy.sh 必须把 Cloud MCP URL 传入容器',
  );

  assert.doesNotMatch(
    localImageBuildScript,
    /RUSTUP_DIST_SERVER|RUSTUP_UPDATE_ROOT/,
    '构建脚本不应再向 Docker 构建传入 Rust 下载源；Docker 阶段不负责重复编译 Wasm'
  );

  assert.match(
    localImageBuildScript,
    /rm -rf "\$\{ROOT_DIR\}\/\.next"/,
    '构建脚本应在本地 Next 构建前清理 .next，避免增量产物导致部署构建卡住'
  );
  assert.match(
    localImageBuildScript,
    /import-course-coverage-overlay\.ts --validate-only/,
    'release build 必须在干净 Git HEAD 上预校验 CourseCoverage Overlay',
  );
  assert.match(
    localImageBuildScript,
    /SKIP_WASM_BUILD=1 npm run build/,
    'release build 宿主 Next 校验必须复用已提交的控制分析 Wasm 包，不得重写 tracked Wasm 输出',
  );
  const localNpmBuildIndex = localImageBuildScript.indexOf('\nSKIP_WASM_BUILD=1 npm run build\n');
  const postLocalNpmBuildCleanCheckIndex = localImageBuildScript.indexOf(
    'assert_clean_release_worktree',
    localNpmBuildIndex,
  );
  const dockerBuildIndex = localImageBuildScript.indexOf('docker buildx build');
  assert.ok(
    localNpmBuildIndex >= 0
      && postLocalNpmBuildCleanCheckIndex > localNpmBuildIndex
      && dockerBuildIndex > postLocalNpmBuildCleanCheckIndex,
    'release build 必须在宿主 npm build 后再次 fail-closed 检查可见工作树',
  );
  assert.match(
    localImageBuildScript,
    /--build-arg "APP_REVISION=\$\{APP_REVISION\}"/,
    'release build 必须向镜像传递已验证的 APP_REVISION',
  );

  assert.match(
    localImageBuildScript,
    /NODE_MAX_OLD_SPACE_SIZE="\$\{NODE_MAX_OLD_SPACE_SIZE:-12288\}"/,
    'release build 必须为本地与容器构建设置一致的默认 Node heap',
  );

  assert.match(
    localImageBuildScript,
    /--build-arg "NODE_MAX_OLD_SPACE_SIZE=\$\{NODE_MAX_OLD_SPACE_SIZE\}"/,
    'release build 必须向 Docker builder 传递 Node heap build arg',
  );

  assert.match(
    localImageBuildScript,
    /docker info --format '\{\{\.MemTotal\}\}'/,
    'release build 必须在构建前读取 Docker VM 内存',
  );

  assert.match(
    localImageBuildScript,
    /DOCKER_MIN_MEMORY_BYTES=\$\(\(20 \* 1024 \* 1024 \* 1024\)\)/,
    'release build 必须以 20 GiB 作为 Docker VM 最低内存门槛',
  );

  assert.match(
    localImageBuildScript,
    /DOCKER_MEMORY_BYTES.*\^\[1-9\]\[0-9\]\*\$/,
    'release build 必须严格校验 Docker VM 内存为正整数',
  );

  assert.match(
    localImageBuildScript,
    /Docker Desktop 配置为至少 24 GiB/,
    'Docker VM 内存门禁失败时必须提示 Docker Desktop 至少配置 24 GiB',
  );

  const dockerMemoryCheckIndex = localImageBuildScript.indexOf(
    "docker info --format '{{.MemTotal}}'",
  );
  assert.ok(
    dockerMemoryCheckIndex >= 0
      && localNpmBuildIndex >= 0
      && dockerMemoryCheckIndex < localNpmBuildIndex
      && dockerMemoryCheckIndex < localImageBuildScript.indexOf('docker buildx build'),
    'Docker VM 内存门禁必须早于本地 npm build 与 Docker build',
  );

  assert.match(
    localImageBuildScript,
    /BUILD_ARGS=\(/,
    '构建脚本必须集中维护 Docker build args'
  );

  assert.match(
    localImageBuildScript,
    /DATABASE_URL_FOR_BUILD="\$\{DATABASE_URL:-\}"/,
    '构建脚本必须优先使用已导出的宿主 DATABASE_URL'
  );

  assert.match(
    localImageBuildScript,
    /require\("dotenv"\)\.config\(\{ path: "\.env", quiet: true \}\)/,
    '构建脚本必须在宿主 DATABASE_URL 未导出时从 .env 读取构建期数据库 URL'
  );

  assert.match(
    localImageBuildScript,
    /if \[\[ -n "\$\{DATABASE_URL_FOR_BUILD\}" \]\]; then/,
    '构建脚本必须在解析到构建期 DATABASE_URL 后传入 Docker 构建 secret'
  );

  assert.match(
    localImageBuildScript,
    /BUILD_ARGS\+=\(--secret "id=database_url,env=DATABASE_URL"\)/,
    '构建脚本必须把构建期 DATABASE_URL 作为 BuildKit secret 传给 builder'
  );

  assert.match(
    localImageBuildScript,
    /DATABASE_URL="\$\{DATABASE_URL_FOR_BUILD\}" docker buildx build/,
    '构建脚本必须只在 docker buildx 调用环境中暴露 DATABASE_URL secret 来源'
  );

  assert.doesNotMatch(
    localImageBuildScript,
    /--build-arg "DATABASE_URL=/,
    '构建脚本不得把真实 DATABASE_URL 作为 Docker build arg 传递'
  );
  for (const [name, source] of [
    ['Release CLI', releaseImportCli],
    ['Overlay CLI', coverageImportCli],
  ]) {
    assert.match(
      source,
      /APP_REVISION_FILE \?\? '\.app-revision'/,
      `${name} 必须在无 .git 的容器中读取不可变镜像修订文件`,
    );
    assert.match(
      source,
      /select: \{ captureRevision: true \}/,
      `${name} 必须优先读取既有数据库投影的 captureRevision 进行幂等核验`,
    );
    assert.match(
      source,
      /--verify-only/,
      `${name} 必须支持只读部署后核验`,
    );
  }
  assert.match(
    releaseImportCli,
    /persisted ActKG Release round-trip hash mismatch/,
    'Release CLI 必须核验 canonical round-trip hash',
  );
  assert.match(
    releaseImportCli,
    /result\.status !== 'available' \|\| result\.diagnostics\.length !== 0/,
    'Release CLI 必须核验 receipt/count/hash Repository 诊断为空',
  );
  assert.match(
    coverageImportCli,
    /readCourseCoverage\(selector\(validated\.overlay\)\)/,
    'Overlay CLI 必须通过显式 selector 读取 CourseCoverage',
  );
  assert.match(
    coverageImportCli,
    /result\.status !== 'available' \|\| result\.diagnostics\.length !== 0/,
    'Overlay CLI 必须要求 available 且无 diagnostics',
  );
  assert.match(
    resourceBindingImportCli,
    /buildCurrentInventory\(db\)/,
    '资源绑定 CLI 必须使用共享实现从同一捕获身份生成完整逐项清单',
  );
  assert.match(
    prismaSchema,
    /release\s+ActkgRelease\s+@relation\(fields: \[releaseSetId, releaseId\], references: \[releaseSetId, id\]/,
    'binding decision 的 Prisma Release relation 必须与迁移中的复合外键一致',
  );
  assert.match(
    prismaSchema,
    /evidence\s+ActkgEvidenceSegment\?\s+@relation\(fields: \[releaseId, evidenceId\], references: \[releaseId, evidenceId\]/,
    'binding decision 的 Prisma Evidence relation 必须与迁移中的可选复合外键一致',
  );
  assert.match(
    migrationSql,
    /"CanonicalResourceBindingDecision_releaseSetId_releaseId_fkey"[\s\S]*FOREIGN KEY \("releaseSetId", "releaseId"\)[\s\S]*REFERENCES "ActkgRelease"\("releaseSetId", "id"\)/,
    'binding decision migration 必须声明复合 Release 外键',
  );
  assert.match(
    migrationSql,
    /"CanonicalResourceBindingDecision_releaseId_evidenceId_fkey"[\s\S]*FOREIGN KEY \("releaseId", "evidenceId"\)[\s\S]*REFERENCES "ActkgEvidenceSegment"\("releaseId", "evidenceId"\)/,
    'binding decision migration 必须声明复合 Evidence 外键',
  );
  assert.match(
    resourceBindingImportCli,
    /cutoverReady:\s*false/,
    '资源绑定部署核验必须保持 Canonical cutover fail closed',
  );
  assert.match(
    remoteDeployScript,
    /podman exec '\$\{APP_NAME_HINT\}' \.\/node_modules\/\.bin\/tsx scripts\/db\/import-authoritative-actkg-release\.ts --verify-only/,
    'remote-deploy 最终阶段必须以只读模式核验 Release roundtrip/receipt/count/hash 与 Overlay selector/receipt',
  );
  assert.ok(
    remoteDeployScript.includes('podman exec \\"${APP_NAME_HINT}\\" node scripts/db/seed-all-knowledge.mjs'),
    'remote-deploy 必须在受控发布路径中实际同步 runtime 知识图谱，不能调用仅拒绝执行的 package gate',
  );
  assert.ok(
    remoteDeployScript.includes('podman exec \\"${APP_NAME_HINT}\\" test -s course-content/contracts/knowledge-relation-coverage-audit.json'),
    'remote-deploy 必须在容器内确认关系审计契约可用后再同步知识图谱',
  );
  for (const verifier of [
    'scripts/db/import-authoritative-actkg-release.ts --verify-only',
    'scripts/db/import-course-coverage-overlay.ts --verify-only',
    'scripts/db/import-canonical-resource-binding-shadow.ts --verify-only',
  ]) {
    assert.ok(
      remoteDeployScript.includes(`./node_modules/.bin/tsx ${verifier}`),
      `remote-deploy 必须执行只读部署核验: ${verifier}`,
    );
  }

  assert.match(
    localImageBuildScript,
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

  for (const tableName of [
    'ActkgReleaseArtifact',
    'ActkgReleaseComponent',
    'ActkgReleaseEntry',
    'ActkgProjectionNode',
    'ActkgProjectionLink',
    'ActkgUpstreamRagReference',
  ]) {
    assert.match(
      migrationSql,
      new RegExp(`CREATE TABLE "${tableName}"`),
      `Prisma 迁移必须包含 CTKG 0.2 聚合发布表 ${tableName}`
    );
    assert.match(
      migrationSql,
      new RegExp(`CREATE TRIGGER "${tableName}_immutable"`),
      `Prisma 迁移必须为 ${tableName} 声明 immutable 触发器`
    );
    assert.match(
      migrationSql,
      new RegExp(`CREATE TRIGGER "${tableName}_sealed_insert"`),
      `Prisma 迁移必须为 ${tableName} 声明 sealed_insert 触发器`
    );
  }

  assert.match(
    releaseImportCli,
    /importValidatedAggregateRelease/u,
    'Release CLI 必须通过聚合 adapter 导入 CTKG 0.2 发布'
  );
  assert.match(
    releaseImportCli,
    /reconstructAggregateArtifacts/u,
    'Release CLI 必须核验聚合公开 artifact 的字节级往返',
  );

  for (const tableName of [
    'ActkgBundleReceipt',
    'ActkgBundleArtifact',
    'ActkgProjectionIdentity',
    'ActkgProjectionLinkMetadata',
  ]) {
    assert.match(
      migrationSql,
      new RegExp(`CREATE TABLE "${tableName}"`),
      `Prisma 迁移必须包含标准 Bundle 候选表 ${tableName}`,
    );
  }
  // Bundle receipt allows the sole STAGED→ACCEPTED transition; other tables are fully immutable.
  assert.match(
    migrationSql,
    /CREATE TRIGGER "ActkgBundleReceipt_mutation_guard"/,
    'Prisma 迁移必须为 ActkgBundleReceipt 声明 mutation_guard 触发器',
  );
  for (const tableName of [
    'ActkgBundleArtifact',
    'ActkgProjectionIdentity',
    'ActkgProjectionLinkMetadata',
  ]) {
    assert.match(
      migrationSql,
      new RegExp(`CREATE TRIGGER "${tableName}_immutable"`),
      `Prisma 迁移必须为 ${tableName} 声明 immutable 触发器`,
    );
  }
  assert.match(
    migrationSql,
    /ADD COLUMN "bundleContractVersion" TEXT/,
    'Prisma 迁移必须扩展 ActkgImportReceipt 的标准 Bundle 合同字段',
  );
  assert.match(
    migrationSql,
    /ADD COLUMN "role" TEXT/,
    'Prisma 迁移必须扩展 ActkgReleaseArtifact 的标准 Artifact 角色字段',
  );
  assert.match(
    standardBundleImporter,
    /assertValidatedActKGBundleInput|importValidatedActKGBundle|STAGED_CANDIDATE_STATE|ACCEPTED_CANDIDATE_STATE/u,
    '标准 Bundle importer 必须只消费 ValidatedActKGBundle，并经 STAGED→ACCEPTED 转换',
  );
  assert.match(
    migrationSql,
    /candidateState.*STAGED.*ACCEPTED_CANDIDATE|STAGED.*ACCEPTED_CANDIDATE/u,
    'Prisma 迁移必须允许 Bundle receipt STAGED 与 ACCEPTED_CANDIDATE',
  );
  assert.match(
    migrationSql,
    /artifactCount/u,
    'Prisma 迁移必须为 Bundle receipt 声明 packaging artifactCount',
  );
  assert.match(
    migrationSql,
    /actkg_bundle_receipt_mutation_guard|STAGED→ACCEPTED/u,
    'Prisma 迁移必须限制 Bundle receipt 只能 STAGED→ACCEPTED',
  );
  assert.match(
    migrationSql,
    /CREATE TRIGGER "ActkgBundleReceipt_insert_guard"/,
    'Prisma 迁移必须为 ActkgBundleReceipt 声明 INSERT guard',
  );
  assert.match(
    migrationSql,
    /actkg_bundle_receipt_insert_guard|INSERT requires candidateState=STAGED/u,
    'Prisma 迁移必须拒绝直接 INSERT ACCEPTED_CANDIDATE Bundle receipt',
  );
  assert.doesNotMatch(
    standardBundleImporter,
    /loadAndValidatePublicBundleV1|bundle-manifest\.json|readdir/u,
    '标准 Bundle 数据库层不得重新发现文件或解析 Manifest',
  );
  assert.match(
    standardBundleImportCli,
    /importValidatedActKGBundle|loadAndValidatePublicBundleV1/u,
    '标准 Bundle CLI 必须先走兼容层验证再导入',
  );
  assert.match(
    prismaSchema,
    /model ActkgBundleReceipt/,
    'Prisma schema 必须声明 ActkgBundleReceipt',
  );
  assert.match(
    packageJson.scripts?.['db:import-compatible-actkg-public-bundle'] ?? '',
    /import-compatible-actkg-public-bundle/,
    'package.json 必须暴露标准 Bundle 导入脚本',
  );

  console.log('docker migration readiness test passed');
}

main();
