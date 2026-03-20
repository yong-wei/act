import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

const root = process.cwd();

function read(file) {
  return fs.readFileSync(path.join(root, file), 'utf8');
}

const dockerignore = read('.dockerignore');
const deployScript = read('deploy/podman/deploy.sh');
const dockerfile = read('Dockerfile');
const handoutPdfExport = read('src/lib/handout-pdf-export.ts');
const teacherInsights = read('src/features/teacher/teacher-insights.ts');
const legacyAnalyticsPage = read('src/app/teacher/classes/[classId]/analytics/page.tsx');
const analyticsV2Page = read('src/app/(main)/teacher/classes/[classId]/analytics-v2/page.tsx');
const scheduler = read('scripts/workers/scheduler.ts');
const worker = read('scripts/workers/data-governance-worker.ts');

assert.equal(
  dockerignore.includes('course-content/runtime'),
  true,
  '运行时课程资源应继续保持外置，不应重新打进镜像',
);

assert.equal(
  deployScript.includes('-v "${RUNTIME_CONTENT_DIR}:/app/course-content/runtime:ro"'),
  true,
  '部署脚本应继续把外部 runtime 目录挂载到容器中',
);

assert.equal(
  teacherInsights.includes('return `/teacher/classes/${classId}/analytics-v2`;'),
  true,
  '班级学情入口应继续指向 analytics-v2 班级学情页',
);

assert.equal(
  legacyAnalyticsPage.includes('redirect(`/teacher/classes/${classId}/analytics-v2`);'),
  true,
  '旧 analytics 路由应跳转到 analytics-v2 学情页',
);

assert.equal(
  analyticsV2Page.includes('export default function ClassAnalyticsV2Page()'),
  true,
  'analytics-v2 页面应真实存在，避免把有效路由误判为 404',
);

assert.equal(
  dockerfile.includes('chromium'),
  true,
  '生产镜像需要安装 Chromium，供讲义 PDF 导出使用',
);

assert.equal(
  handoutPdfExport.includes('executablePath'),
  true,
  '讲义 PDF 导出应显式支持系统 Chromium 可执行文件路径',
);

assert.equal(
  scheduler.includes("new Date().toISOString().split('T')[0]"),
  false,
  'repeatable job 不应在调度注册时冻结 batchDate',
);

assert.equal(
  worker.includes('studentRiskFlag.updateMany'),
  true,
  '生成新风险标记前应先 resolve 旧的未解决标记',
);

console.log('test-pr-review-followups passed');
