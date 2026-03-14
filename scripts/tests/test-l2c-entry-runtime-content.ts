import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const entryRoute = fs.readFileSync(
  path.join(root, 'src/app/interactive-learning/courses/l2c-frequency-bode-fasttrack/page.tsx'),
  'utf8',
);
const entryPage = fs.readFileSync(
  path.join(root, 'src/features/interactive/l2c-frequency-bode/entry-page.tsx'),
  'utf8',
);
const entryRuntimeSections = fs.readFileSync(
  path.join(root, 'src/features/interactive/shared/lesson-entry-runtime-sections.tsx'),
  'utf8',
);

assert.equal(
  entryRoute.includes('loadLessonRuntimeEntry'),
  true,
  'L-2c 入口路由应加载 runtime lesson 数据并传给首页组件',
);

assert.equal(
  entryPage.includes('lessonRuntime'),
  true,
  'L-2c 首页组件应接收 runtime lesson bundle',
);

assert.equal(
  entryRuntimeSections.includes('本课知识点网络'),
  true,
  '共享首页 runtime 模块应包含知识点网络区域',
);

assert.equal(
  entryRuntimeSections.includes('KnowledgeCard'),
  true,
  '共享首页 runtime 模块应复用统一知识卡渲染机制',
);

assert.equal(
  entryRuntimeSections.includes('知识卡片预览'),
  true,
  '共享首页 runtime 模块应包含知识卡片预览',
);

assert.equal(
  entryRuntimeSections.includes('讲义入口') && entryRuntimeSections.includes('MdxSlide'),
  true,
  '共享首页 runtime 模块应提供讲义入口与讲义详情渲染',
);

assert.equal(
  entryPage.indexOf('教师入口') < entryPage.indexOf('<LessonEntryRuntimeSections'),
  true,
  'L-2c 教师入口、自由浏览、学生入口模块应位于 runtime 导学模块之前',
);

assert.equal(
  entryRuntimeSections.includes('点击任意节点查看卡片正面内容，再用“详情”展开完整知识卡。'),
  true,
  '知识点网络模块文案应使用统一固定表述',
);

assert.equal(
  entryRuntimeSections.includes('箭头方向表示前置 → 后置关系。'),
  true,
  '本课知识网络应使用箭头表达前置与后置关系',
);

assert.equal(
  entryRuntimeSections.includes('展示本课知识卡片顺序，便于在进入课堂前先建立知识主线。'),
  true,
  '知识卡片预览模块文案应使用统一固定表述',
);

assert.equal(
  entryRuntimeSections.indexOf('知识卡片预览') < entryRuntimeSections.indexOf('讲义入口'),
  true,
  '讲义入口应位于知识卡片预览模块之后',
);

assert.equal(
  entryRuntimeSections.includes('导出 PDF'),
  true,
  '讲义入口与讲义详情都应提供导出 PDF 功能',
);

console.log('l2c entry runtime content test passed');
