import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const studentRoute = fs.readFileSync(
  path.join(root, 'src/app/interactive-learning/courses/l2d-three-domain-linkage-practice/student/[sessionId]/page.tsx'),
  'utf8',
);
const teacherRoute = fs.readFileSync(
  path.join(root, 'src/app/interactive-learning/courses/l2d-three-domain-linkage-practice/teacher/[sessionId]/page.tsx'),
  'utf8',
);
const studentPage = fs.readFileSync(
  path.join(root, 'src/features/interactive/l2d-three-domain-linkage/student-page.tsx'),
  'utf8',
);
const teacherPage = fs.readFileSync(
  path.join(root, 'src/features/interactive/l2d-three-domain-linkage/teacher-page.tsx'),
  'utf8',
);
const stepPanels = fs.readFileSync(
  path.join(root, 'src/features/interactive/l2d-three-domain-linkage/step-panels.tsx'),
  'utf8',
);
const workspace = fs.readFileSync(
  path.join(root, 'src/features/interactive/l2d-three-domain-linkage/workspace.tsx'),
  'utf8',
);
const courseConfig = fs.readFileSync(
  path.join(root, 'src/lib/l2d-course.ts'),
  'utf8',
);

assert.equal(
  studentRoute.includes('loadLessonRuntimeEntry'),
  true,
  'L-2d 学生页路由应加载 runtime lesson 数据，用于按课次编排注入知识卡',
);

assert.equal(
  teacherRoute.includes('loadLessonRuntimeEntry'),
  true,
  'L-2d 教师页路由应加载 runtime lesson 数据，用于按课次编排注入知识卡',
);

assert.equal(
  studentPage.includes('StepKnowledgeDrawer'),
  true,
  'L-2d 学生页应在存在知识卡时接入抽屉式知识卡入口',
);

assert.equal(
  teacherPage.includes('StepKnowledgeDrawer'),
  true,
  'L-2d 教师页应在存在知识卡时接入抽屉式知识卡入口',
);

assert.equal(
  stepPanels.includes('{rightSlot}'),
  true,
  'L-2d 步骤内容面板应为标题模块预留右上角插槽',
);

assert.equal(
  workspace.includes('K_{cr} = 42') || workspace.includes('criticalGain: 42'),
  true,
  'L-2d 工作区应显式配置临界增益 42',
);

assert.equal(
  workspace.includes('0.01') && workspace.includes('80'),
  true,
  'L-2d 工作区应显式配置 K 范围 [0.01, 80]',
);

assert.equal(
  workspace.includes('相位裕度') && workspace.includes('超调量') && workspace.includes('调节时间'),
  true,
  'L-2d 工作区应同时输出三域指标',
);

assert.equal(
  courseConfig.includes('OBS-01') && courseConfig.includes('OBS-02') && courseConfig.includes('OBS-03'),
  true,
  'L-2d 课程配置应显式包含三项观测与评分入口',
);

assert.equal(
  stepPanels.includes('记录这一行') && stepPanels.includes('提交任务一') && stepPanels.includes('提交反思'),
  true,
  'L-2d 页面应落地任务一、任务二、任务三的提交控件文案',
);

console.log('l2d workspace and assessment test passed');
