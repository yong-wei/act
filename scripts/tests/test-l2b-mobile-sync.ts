import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const teacherPage = read('src/features/interactive/l2b-root-locus/teacher-page.tsx');
const studentPage = read('src/features/interactive/l2b-root-locus/student-page.tsx');
const stepPanels = read('src/features/interactive/l2b-root-locus/step-panels.tsx');
const workspace = read('src/features/interactive/l2b-root-locus/workspace.tsx');

assert.equal(
  teacherPage.includes('fetch(`/api/session/${sessionId}`)') &&
    teacherPage.includes('fetch(`/api/session/${sessionId}/state`)') &&
    teacherPage.includes('buildSessionEndReturnHref'),
  true,
  'L-2b 教师端应复用课堂读取、状态汇总和结束课堂回跳链路',
);

assert.equal(
  studentPage.includes('fetch(`/api/session/${sessionId}`)') &&
    studentPage.includes('fetch(`/api/session/${sessionId}/state?scope=student-view`)') &&
    studentPage.includes("itemId: 'student:l2b:state'"),
  true,
  'L-2b 学生端应同步课堂状态并持久化自己的课程记录',
);

assert.equal(
  studentPage.includes('当前页面与教师不同步') &&
    studentPage.includes('点击跳转') &&
    studentPage.includes('max-w-[1080px]') &&
    studentPage.includes('px-3 py-3 sm:px-4 sm:py-4'),
  true,
  'L-2b 学生端应保留不同步提示与紧凑移动端布局',
);

assert.equal(
  stepPanels.includes('premium-lesson-panel') &&
    stepPanels.includes('premium-lesson-accent-panel') &&
    stepPanels.includes('premium-lesson-input') &&
    stepPanels.includes('复制提示词') &&
    stepPanels.includes('AI 给出的 K') &&
    stepPanels.includes('navigator.clipboard.writeText') &&
    stepPanels.includes('回到课前的三个目标') &&
    studentPage.includes('courseState={courseState}') &&
    studentPage.includes('responses[step.id]') &&
    workspace.includes('记录：K ='),
  true,
  'L-2b 步骤面板应包含提示词复制、记录回显、总结回看与 step-14 记录链路',
);

console.log('l2b mobile sync test passed');
