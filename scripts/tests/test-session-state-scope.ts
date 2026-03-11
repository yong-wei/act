import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const stateRoute = fs.readFileSync(path.join(root, 'src/app/api/session/[sessionId]/state/route.ts'), 'utf8');
const l2aStudentPage = fs.readFileSync(path.join(root, 'src/features/interactive/l2a-time-domain/student-page.tsx'), 'utf8');
const cruiseStudentPage = fs.readFileSync(path.join(root, 'src/features/interactive/cruise-classroom/student-page.tsx'), 'utf8');

assert.equal(
  stateRoute.includes("searchParams.get('scope')"),
  true,
  '课堂状态接口应支持按 scope 收敛返回范围，避免学生端拉取全班所有状态',
);

assert.equal(
  l2aStudentPage.includes('?scope=self'),
  true,
  'L-2a 学生页应仅拉取自己的课堂状态',
);

assert.equal(
  cruiseStudentPage.includes('?scope=student-view'),
  true,
  '邮轮学生页应拉取裁剪后的学生视图状态，而不是全量课堂状态',
);

console.log('session state scope test passed');
