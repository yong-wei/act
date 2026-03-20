import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const entryRoute = fs.readFileSync(
  path.join(root, 'src/app/interactive-learning/courses/l2b-root-locus-fasttrack/page.tsx'),
  'utf8',
);
const entryPage = fs.readFileSync(
  path.join(root, 'src/features/interactive/l2b-root-locus/entry-page.tsx'),
  'utf8',
);
const entryRuntimeSections = fs.readFileSync(
  path.join(root, 'src/features/interactive/shared/lesson-entry-runtime-sections.tsx'),
  'utf8',
);

assert.equal(
  entryRoute.includes('loadLessonRuntimeEntry') || entryRoute.includes('loadLessonRuntimeBundle'),
  true,
  'L-2b 入口路由应加载 runtime lesson 数据并传给首页组件',
);

assert.equal(
  entryPage.includes('lessonRuntime') || entryPage.includes('graphOverlay') || entryPage.includes('handoutPath'),
  true,
  'L-2b 首页组件应接收 runtime lesson/graph/handout 数据',
);

assert.equal(
  entryRuntimeSections.includes('知识点网络') || entryRuntimeSections.includes('知识地图') || entryRuntimeSections.includes('本课知识点'),
  true,
  'L-2b 首页应包含知识点网络模块',
);

assert.equal(
  entryRuntimeSections.includes('KnowledgeCard'),
  true,
  'L-2b 首页应使用统一卡片渲染机制，并支持详情/概览切换',
);

assert.equal(
  entryRuntimeSections.includes('卡片预览') || entryRuntimeSections.includes('知识卡片预览'),
  true,
  'L-2b 首页底部应包含按 sequence 排列的卡片预览',
);

assert.equal(
  entryRuntimeSections.includes('讲义') && entryRuntimeSections.includes('MdxSlide'),
  true,
  'L-2b 首页应提供讲义入口，并能在页面内查看讲义详情',
);

assert.equal(
  entryPage.indexOf('教师入口') < entryPage.indexOf('<L2BEntryRuntimeSections'),
  true,
  '教师入口、自由浏览、学生入口模块应放在首页 runtime 导学模块之前',
);

assert.equal(
  entryRuntimeSections.includes('点击任意节点查看卡片正面内容，再用“详情”展开完整知识卡。'),
  true,
  '知识点网络模块文案应固定为指定提示语',
);

assert.equal(
  entryRuntimeSections.includes('markerEnd=') || entryRuntimeSections.includes('marker-end') || entryRuntimeSections.includes('箭头方向'),
  true,
  '本课知识网络应使用箭头体现前置与后置关系',
);

assert.equal(
  entryRuntimeSections.includes('展示本课知识卡片顺序，便于在进入课堂前先建立知识主线。'),
  true,
  '知识卡片预览模块文案应更新为新的固定表述',
);

assert.equal(
  entryRuntimeSections.indexOf('知识卡片预览') < entryRuntimeSections.indexOf('讲义入口'),
  true,
  '讲义入口应移动到知识卡片预览模块下方',
);

assert.equal(
  entryRuntimeSections.includes('导出 PDF'),
  true,
  '讲义入口与讲义详情应提供导出 PDF 功能',
);

assert.equal(
  entryRuntimeSections.includes('dark:') || entryRuntimeSections.includes('bg-card') || entryRuntimeSections.includes('text-foreground'),
  true,
  'L-2b 首页 runtime 模块应同时适配深色模式，而不是只写死浅色样式',
);

console.log('l2b entry runtime content test passed');
