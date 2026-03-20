import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

const teacherPage = fs.readFileSync(
  path.join(root, 'src/features/interactive/lsum-design-feasible-domain/teacher-page.tsx'),
  'utf8',
);

assert.equal(
  teacherPage.includes('fetch(`/api/session/${sessionId}`)'),
  true,
  'L-sum 教师页应读取真实课堂会话，而不是只依赖本地演示状态',
);

assert.equal(
  teacherPage.includes('fetch(`/api/session/${sessionId}/state`)'),
  true,
  'L-sum 教师页应轮询课堂状态，用于统计学生提交与在线情况',
);

assert.equal(
  teacherPage.includes('currentItemId') && teacherPage.includes('LSUM_STAGE_MAP'),
  true,
  'L-sum 教师页切换步骤时应 PATCH currentItemId/currentStage 到课堂会话',
);

assert.equal(
  teacherPage.includes('teacher:course-sync'),
  true,
  'L-sum 教师页应广播 teacher:course-sync，供学生端读取答案揭示与当前步骤',
);

assert.equal(
  teacherPage.includes('buildSessionEndReturnHref') && teacherPage.includes("status: 'FINISHED'"),
  true,
  'L-sum 教师页结束课堂时应真正回写 FINISHED 状态，并跳回教师后台或课程入口',
);

console.log('lsum teacher session sync test passed');
