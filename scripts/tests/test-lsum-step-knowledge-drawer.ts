import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const studentRoute = fs.readFileSync(
  path.join(root, 'src/app/interactive-learning/courses/lsum-design-feasible-domain/student/[sessionId]/page.tsx'),
  'utf8',
);
const teacherRoute = fs.readFileSync(
  path.join(root, 'src/app/interactive-learning/courses/lsum-design-feasible-domain/teacher/[sessionId]/page.tsx'),
  'utf8',
);
const studentPage = fs.readFileSync(
  path.join(root, 'src/features/interactive/lsum-design-feasible-domain/student-page.tsx'),
  'utf8',
);
const teacherPage = fs.readFileSync(
  path.join(root, 'src/features/interactive/lsum-design-feasible-domain/teacher-page.tsx'),
  'utf8',
);
const stepPanels = fs.readFileSync(
  path.join(root, 'src/features/interactive/lsum-design-feasible-domain/step-panels.tsx'),
  'utf8',
);

assert.equal(
  studentRoute.includes('loadLessonRuntimeEntry'),
  true,
  'L-sum 学生页路由应加载 runtime lesson 数据，用于按课次编排注入知识卡',
);

assert.equal(
  teacherRoute.includes('loadLessonRuntimeEntry'),
  true,
  'L-sum 教师页路由应加载 runtime lesson 数据，用于按课次编排注入知识卡',
);

assert.equal(
  studentPage.includes('StepKnowledgeDrawer'),
  true,
  'L-sum 学生页应在存在知识卡时接入抽屉式知识卡入口',
);

assert.equal(
  teacherPage.includes('StepKnowledgeDrawer'),
  true,
  'L-sum 教师页应在存在知识卡时接入抽屉式知识卡入口',
);

assert.equal(
  studentPage.includes('step.id') && studentPage.includes('lessonRuntime'),
  true,
  'L-sum 学生页知识卡抽屉应根据当前 step 与 runtime 编排决定是否显示',
);

assert.equal(
  teacherPage.includes('step.id') && teacherPage.includes('lessonRuntime'),
  true,
  'L-sum 教师页知识卡抽屉应根据当前 step 与 runtime 编排决定是否显示',
);

assert.equal(
  studentPage.includes('rightSlot') && studentPage.includes('知识卡片'),
  true,
  'L-sum 学生页应把知识卡片入口放到页面顶部标题模块右上角，按钮文案为“知识卡片”',
);

assert.equal(
  teacherPage.includes('rightSlot') && teacherPage.includes('知识卡片'),
  true,
  'L-sum 教师页应把知识卡片入口放到页面顶部标题模块右上角，按钮文案为“知识卡片”',
);

assert.equal(
  stepPanels.includes('{rightSlot}'),
  true,
  'L-sum 步骤内容面板应为标题模块预留右上角插槽',
);

console.log('lsum step knowledge drawer test passed');
