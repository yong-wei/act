import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const entryRoute = fs.readFileSync(
  path.join(root, 'src/app/interactive-learning/courses/unit-1-1-laplace-transfer-function/page.tsx'),
  'utf8',
);
const entryPage = fs.readFileSync(
  path.join(root, 'src/features/interactive/unit-1-1-laplace/entry-page.tsx'),
  'utf8',
);
const entryRuntimeSections = fs.readFileSync(
  path.join(root, 'src/features/interactive/shared/lesson-entry-runtime-sections.tsx'),
  'utf8',
);

assert.equal(
  entryRoute.includes("loadLessonRuntimeEntry('1-1')"),
  true,
  '1-1 入口路由应加载 runtime lesson 数据并传给首页组件',
);

assert.equal(
  entryPage.includes('lessonRuntime'),
  true,
  '1-1 首页组件应接收 runtime lesson bundle',
);

assert.equal(
  entryPage.indexOf('教师入口') < entryPage.indexOf('<LessonEntryRuntimeSections'),
  true,
  '1-1 教师入口、自由浏览、学生入口模块应位于 runtime 导学模块之前',
);

assert.equal(
  entryPage.includes('L-sum') && entryPage.includes('1-1'),
  true,
  '1-1 首页摘要应明确承接 L-sum 到 1-1 的课程链',
);

assert.equal(
  entryRuntimeSections.includes('本课知识点网络'),
  true,
  '共享首页 runtime 模块应包含知识点网络区域',
);

assert.equal(
  entryRuntimeSections.includes('知识卡片预览') && entryRuntimeSections.includes('讲义入口'),
  true,
  '共享首页 runtime 模块应包含知识卡片预览与讲义入口',
);

assert.equal(
  entryRuntimeSections.includes('导出 PDF'),
  true,
  '讲义入口与讲义详情都应提供导出 PDF 功能',
);

console.log('test-1-1-entry-runtime-content passed');
