import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const studentPage = fs.readFileSync(
  path.join(root, 'src/features/interactive/lsum-design-feasible-domain/student-page.tsx'),
  'utf8',
);

assert.equal(
  studentPage.includes('useSession'),
  true,
  'L-sum 学生页应读取登录态，用于把个人提交持久化到课堂状态',
);

assert.equal(
  studentPage.includes('fetch(`/api/session/${sessionId}`)'),
  true,
  'L-sum 学生页应同步教师当前步骤与课堂状态',
);

assert.equal(
  studentPage.includes('scope=student-view'),
  true,
  'L-sum 学生页读取课堂状态时应使用 student-view 视图，避免拉取全班冗余数据',
);

assert.equal(
  studentPage.includes('student:lsum:state') && studentPage.includes('teacher:course-sync'),
  true,
  'L-sum 学生页应持久化 student:lsum:state，并读取 teacher:course-sync 控制答案揭示',
);

assert.equal(
  studentPage.includes('当前页面与教师不同步') && studentPage.includes('跳到教师当前页'),
  true,
  'L-sum 学生页应在不同步时提示并允许手动跳转到教师当前页',
);

assert.equal(
  studentPage.includes("status === 'FINISHED'"),
  true,
  'L-sum 学生页应在课堂结束后展示结束态提示，而不是继续伪装为演示模式',
);

console.log('lsum student session sync test passed');
