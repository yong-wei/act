import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const dockerignore = read('.dockerignore');
const dockerfile = read('Dockerfile');
const buildScript = read('scripts/build.sh');
const textbookV2Preflight = read('scripts/release/validate-textbook-runtime-v2.mjs');
const packageJson = JSON.parse(read('package.json'));
const serviceScript = read('deploy/podman/configure-service.sh');
const deployScript = read('deploy/podman/deploy.sh');
const remoteDeployScript = read('scripts/remote-deploy.sh');
const graphCenterSources = read('src/lib/data-governance/graph-center-sources.ts');
const learningGoalBaselineRuntime = read('src/lib/learning-goal-resource-baseline-runtime.ts');

assert.equal(
  dockerignore.includes('course-content/runtime'),
  true,
  'Docker 构建上下文应排除 course-content/runtime，避免把运行时资源打进镜像',
);

assert.equal(
  /from ['"].*resource-field-completion-summary\.json['"]/.test(graphCenterSources) ||
    /from ['"].*learning-goal-resource-baseline-matrix\.json['"]/.test(learningGoalBaselineRuntime),
  false,
  '源码不得静态 import 外置 runtime governance JSON，否则 Docker 构建上下文排除 runtime 后会失败',
);

assert.equal(
  dockerignore.includes('!course-content/runtime/resource-governance/adaptive-assessment-item-catalog-items.jsonl') &&
    dockerignore.includes('!course-content/runtime/resource-governance/assessment-item-semantic-review-snapshots.jsonl'),
  true,
  'Docker 构建上下文应只放行自适应测评 catalog 运行态 JSONL，避免 path-owned 选题在 standalone 容器缺失真源',
);

assert.equal(
  buildScript.includes('course-content/runtime') && buildScript.includes('.dockerignore'),
  true,
  '构建脚本应显式校验 course-content/runtime 已被 .dockerignore 排除',
);

const textbookV2BookIds = [
  'control-encyclopedia',
  'dorf-modern-control-systems',
  'feedback-control-of-dynamic-systems',
  'hu-shousong-auto-control-7th',
  'hu-shousong-auto-control-8th',
  'hu-shousong-exercise-analysis-3rd',
  'liu-sheng-auto-control-2015',
];
const textbookV2RequiredFiles = [
  'manifest.json',
  'navigation.json',
  'units.jsonl',
  'anchors.jsonl',
  'windows.jsonl',
  'anomalies.jsonl',
  'samples.jsonl',
];

assert.equal(
  textbookV2BookIds.every((bookId) => textbookV2Preflight.includes(`'${bookId}'`)) &&
    textbookV2RequiredFiles.every((fileName) => textbookV2Preflight.includes(`'${fileName}'`)) &&
    textbookV2Preflight.includes('validate_structured_textbook_runtime_v2.mjs') &&
    textbookV2Preflight.includes("'--runtime-dir'") &&
    textbookV2Preflight.includes('failures.slice(0, 20)') &&
    textbookV2Preflight.includes('failuresTruncated'),
  true,
  '共享 release preflight 应精确校验七本教材的完整 v2 文件集并调用结构化 runtime validator',
);

assert.equal(
  buildScript.indexOf('scripts/release/validate-textbook-runtime-v2.mjs') <
    buildScript.indexOf('\nnpm run build\n'),
  true,
  'release build 必须在应用构建前执行七书教材 v2 preflight',
);

assert.equal(
  packageJson.scripts['db:export-textbook-resources'] ===
    'python3 course-content/scripts/export_textbook_resources.py --book hu-shousong-exercise-analysis-3rd',
  true,
  'package.json 必须提供可复现的教材 runtime 导出脚本',
);

assert.equal(
  packageJson.scripts.build.includes('npm run db:export-textbook-resources') &&
    packageJson.scripts.build.indexOf('npm run db:export-textbook-resources') <
      packageJson.scripts.build.indexOf('node ./scripts/build-next-with-trace-check.mjs'),
  true,
  'npm run build 必须在 Next 构建前导出教材 runtime 资源',
);

assert.equal(
  packageJson.scripts['db:textbook-media-grounding'].startsWith('npm run db:export-textbook-resources &&'),
  true,
  '教材 media grounding 生成必须先刷新教材 runtime 导出',
);

assert.equal(
  dockerfile.includes('FROM base AS builder') && dockerfile.includes('RUN apk add --no-cache python3'),
  true,
  'Docker builder 阶段必须安装 python3 以执行教材 runtime 导出脚本',
);

assert.equal(
  dockerignore.includes('!scripts/knowledge/**') &&
    dockerfile.includes('COPY --from=builder /app/scripts/knowledge ./scripts/knowledge'),
  true,
  '生产镜像必须包含知识图谱同步使用的严格关系校验脚本',
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
  deployScript.includes('APP_IMAGE="${APP_IMAGE:-localhost/act-obe-platform:20260301-amd64}"') &&
    serviceScript.includes('APP_IMAGE="${APP_IMAGE:-localhost/act-obe-platform:20260301-amd64}"'),
  true,
  '部署脚本应默认使用 podman load 产生的 localhost 应用镜像，避免误选旧的 docker.io/library 标签',
);

assert.equal(
  deployScript.includes('run_detached_container()') &&
    deployScript.includes('podman start "$name"') &&
    deployScript.includes('WARNING: 容器 ${name} 当前状态为 ${state}，尝试重新启动') &&
    deployScript.includes('run_detached_container "$APP_CONTAINER" podman run -d') &&
    deployScript.includes('run_detached_container "$WORKER_CONTAINER" podman run -d'),
  true,
  'Podman 部署脚本应对 app/worker 创建后停留在 created/exited 的瞬时 runc 启动失败做有限重试',
);

assert.equal(
  remoteDeployScript.includes('rsync -az --delete') &&
    remoteDeployScript.includes('course-content/runtime') &&
    (remoteDeployScript.includes('${REMOTE_PROJECT_DIR}/course-content/runtime') ||
      remoteDeployScript.includes('${REMOTE_RUNTIME_DIR}/')),
  true,
  '远端部署脚本应使用 rsync 将本地 course-content/runtime 同步到服务器同名目录',
);

const remotePreflightIndex = remoteDeployScript.indexOf(
  'scripts/release/validate-textbook-runtime-v2.mjs',
);
const runtimeRsyncIndex = remoteDeployScript.indexOf('rsync -az --delete');
const remoteHostCheckIndex = remoteDeployScript.indexOf(
  'check_remote_textbook_v2_files',
  runtimeRsyncIndex,
);
assert.equal(
  remotePreflightIndex >= 0 &&
    remotePreflightIndex < runtimeRsyncIndex &&
    remoteHostCheckIndex > runtimeRsyncIndex,
  true,
  '远端部署即使 skip-build 也必须在 rsync 前执行本地 preflight，并在 rsync 后检查远端宿主文件集',
);

assert.equal(
  textbookV2BookIds.every((bookId) => remoteDeployScript.includes(bookId)) &&
    textbookV2RequiredFiles.every((fileName) => remoteDeployScript.includes(fileName)) &&
    remoteDeployScript.includes('check_container_textbook_v2_files') &&
    remoteDeployScript.includes('/app/course-content/runtime/resources/textbooks-v2') &&
    (remoteDeployScript.match(/-eq 7/g)?.length ?? 0) >= 2,
  true,
  '远端宿主与已启动 app 容器必须逐书校验精确七目录和完整 v2 文件集',
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
    serviceScript.includes('ExecStart=/usr/bin/podman start ${DB_CONTAINER}') &&
    serviceScript.includes("ExecStart=/bin/sh -lc 'until /usr/bin/podman exec") &&
    serviceScript.includes('ExecStart=/bin/sh -lc \'"${APP_DEPLOY_SCRIPT}" --app-only\''),
  true,
  'systemd 配置脚本应先启动数据库并等待 pg_isready，再部署应用与 worker，避免 Prisma 首次启动抢跑',
);

assert.equal(
  serviceScript.includes('if [[ "$MATH_DOCUMENT_GRADING_WORKER_REQUIRED" =~ ^(1|true|yes)$ ]]') &&
    serviceScript.includes('SUBMISSION_EXEC_STOP_LINES=""') &&
    serviceScript.includes('podman ps --format') &&
    serviceScript.includes('$SUBMISSION_SCANNER_CONTAINER') &&
    serviceScript.includes('$SUBMISSION_GC_CONTAINER'),
  true,
  'systemd 配置脚本仅在数学文档批改 worker 启用时要求并停止作业扫描与 GC 容器',
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

assert.equal(
  remoteDeployScript.includes('TEXTBOOK_RUNTIME_BOOK_ID') &&
    remoteDeployScript.includes('LOCAL_TEXTBOOK_RUNTIME_DIR') &&
    remoteDeployScript.includes('REMOTE_TEXTBOOK_RUNTIME_DIR') &&
    remoteDeployScript.includes('manifest.json') &&
    remoteDeployScript.includes('search-documents.jsonl'),
  true,
  '远端部署脚本应校验教材 runtime 导出文件已同步',
);

console.log('runtime externalized deploy test passed');
