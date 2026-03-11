import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const l2aTeacherPage = fs.readFileSync(path.join(root, 'src/features/interactive/l2a-time-domain/teacher-page.tsx'), 'utf8');
const l2aStudentPage = fs.readFileSync(path.join(root, 'src/features/interactive/l2a-time-domain/student-page.tsx'), 'utf8');
const cruiseTeacherPage = fs.readFileSync(path.join(root, 'src/features/interactive/cruise-classroom/teacher-page.tsx'), 'utf8');
const cruiseStudentPage = fs.readFileSync(path.join(root, 'src/features/interactive/cruise-classroom/student-page.tsx'), 'utf8');

for (const [label, content] of [
  ['L-2a 教师页', l2aTeacherPage],
  ['邮轮教师页', cruiseTeacherPage],
] as const) {
  assert.equal(
    content.includes('pendingStepIdRef') && content.includes('useRef'),
    true,
    `${label} 应保留待确认翻页状态，避免轮询把教师页回写到旧页`,
  );
}

for (const [label, content] of [
  ['L-2a 学生页', l2aStudentPage],
  ['邮轮学生页', cruiseStudentPage],
] as const) {
  assert.equal(
    content.includes('当前页面与教师不同步') && content.includes('点击跳转'),
    true,
    `${label} 应在学生页显示与教师不同步的提示与跳转按钮`,
  );
}

console.log('classroom session sync test passed');
