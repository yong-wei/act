import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const teacherPage = fs.readFileSync(
  path.join(root, 'src/features/interactive/unit-1-1-laplace/teacher-page.tsx'),
  'utf8',
);
const studentPage = fs.readFileSync(
  path.join(root, 'src/features/interactive/unit-1-1-laplace/student-page.tsx'),
  'utf8',
);
const stepPanels = fs.readFileSync(
  path.join(root, 'src/features/interactive/unit-1-1-laplace/step-panels.tsx'),
  'utf8',
);
const workspace = fs.readFileSync(
  path.join(root, 'src/features/interactive/unit-1-1-laplace/workspace.tsx'),
  'utf8',
);

assert.equal(
  teacherPage.includes('当前在线学生'),
  true,
  '1-1 教师页应提供默认折叠的在线学生清单入口',
);

assert.equal(
  teacherPage.includes('TeacherActivitySummary') || stepPanels.includes('教师端汇总'),
  true,
  '1-1 教师端应提供教师汇总区域',
);

assert.equal(
  studentPage.includes('StudentActivityForm') || stepPanels.includes('SubmissionStatus'),
  true,
  '1-1 学生端应接入提交区或明确的提交状态反馈',
);

assert.equal(
  stepPanels.includes('释放投票') || stepPanels.includes('释放练习') || stepPanels.includes('释放后测'),
  true,
  '1-1 教师端应提供活动释放控制',
);

assert.equal(
  stepPanels.includes('显示答案'),
  true,
  '1-1 教师端在测验题存在答案时应提供显示答案按钮',
);

assert.equal(
  stepPanels.includes('词云') && stepPanels.includes('学生回复列表'),
  true,
  '1-1 文本型互动应提供词云与默认折叠的学生回复列表',
);

assert.equal(
  stepPanels.includes('向AI验证') && stepPanels.includes('先写下自己的判断'),
  true,
  '1-1 AI 协作页应明确先手算/先判断，再做 AI 对照',
);

assert.equal(
  workspace.includes('极点') && workspace.includes('零点') && workspace.includes('阻尼'),
  true,
  '1-1 工作区应覆盖极点联动、零点影响与典型环节参数调节',
);

console.log('test-1-1-assessment-controls passed');
