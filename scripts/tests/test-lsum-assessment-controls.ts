import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const teacherPage = fs.readFileSync(
  path.join(root, 'src/features/interactive/lsum-design-feasible-domain/teacher-page.tsx'),
  'utf8',
);
const studentPage = fs.readFileSync(
  path.join(root, 'src/features/interactive/lsum-design-feasible-domain/student-page.tsx'),
  'utf8',
);
const stepPanels = fs.readFileSync(
  path.join(root, 'src/features/interactive/lsum-design-feasible-domain/step-panels.tsx'),
  'utf8',
);

assert.equal(
  teacherPage.includes('当前在线学生'),
  true,
  'L-sum 教师页应提供默认折叠的在线学生清单入口',
);

assert.equal(
  teacherPage.includes('LSUMTeacherActivitySummary'),
  true,
  'L-sum 教师页应接入教师端汇总面板',
);

assert.equal(
  studentPage.includes('LSUMStudentActivityForm'),
  true,
  'L-sum 学生页应接入学生端任务提交区',
);

assert.equal(
  stepPanels.includes('释放前测'),
  true,
  'L-sum 教师端应提供前测释放控制',
);

assert.equal(
  stepPanels.includes('释放后测'),
  true,
  'L-sum 教师端应提供后测释放控制',
);

assert.equal(
  stepPanels.includes('显示答案'),
  true,
  'L-sum 教师端在测验题存在答案时应提供显示答案按钮',
);

assert.equal(
  stepPanels.includes('词云') && stepPanels.includes('学生回复列表'),
  true,
  'L-sum 文本型互动应提供词云与默认折叠的学生回复列表',
);

assert.equal(
  stepPanels.includes('教师端汇总'),
  true,
  'L-sum 应提供教师端汇总区域',
);

console.log('lsum assessment controls test passed');
