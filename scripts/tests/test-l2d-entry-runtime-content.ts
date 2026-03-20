import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const entryRoute = fs.readFileSync(
  path.join(root, 'src/app/interactive-learning/courses/l2d-three-domain-linkage-practice/page.tsx'),
  'utf8',
);
const entryPage = fs.readFileSync(
  path.join(root, 'src/features/interactive/l2d-three-domain-linkage/entry-page.tsx'),
  'utf8',
);
const entryRuntimeSections = fs.readFileSync(
  path.join(root, 'src/features/interactive/shared/lesson-entry-runtime-sections.tsx'),
  'utf8',
);

assert.equal(
  entryRoute.includes('loadLessonRuntimeEntry'),
  true,
  'L-2d 入口路由应加载 runtime lesson 数据并传给首页组件',
);

assert.equal(
  entryPage.includes('lessonRuntime'),
  true,
  'L-2d 首页组件应接收 runtime lesson bundle',
);

assert.equal(
  entryPage.includes('实践任务书'),
  true,
  'L-2d 首页文案应明确讲义来自实践任务书',
);

assert.equal(
  entryPage.indexOf('教师入口') < entryPage.indexOf('<LessonEntryRuntimeSections'),
  true,
  'L-2d 教师入口、自由浏览、学生入口模块应位于 runtime 导学模块之前',
);

assert.equal(
  entryRuntimeSections.includes('本课知识点网络'),
  true,
  '共享首页 runtime 模块应包含知识点网络区域',
);

assert.equal(
  entryRuntimeSections.includes('展示本课知识卡片顺序，便于在进入课堂前先建立知识主线。'),
  true,
  '共享首页 runtime 模块应包含知识卡片预览',
);

assert.equal(
  entryRuntimeSections.includes('导出 PDF'),
  true,
  '共享首页 runtime 模块中的讲义区域应提供导出 PDF 功能',
);

console.log('l2d entry runtime content test passed');
