import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import { buildSessionEndReturnHref } from '../../src/lib/classroom-session-end';

const root = process.cwd();
const l2aTeacherPage = fs.readFileSync(path.join(root, 'src/features/interactive/l2a-time-domain/teacher-page.tsx'), 'utf8');
const cruiseTeacherPage = fs.readFileSync(path.join(root, 'src/features/interactive/cruise-classroom/teacher-page.tsx'), 'utf8');
const classDetailPage = fs.readFileSync(path.join(root, 'src/app/teacher/classes/[classId]/page.tsx'), 'utf8');

assert.equal(
  buildSessionEndReturnHref({
    classId: 'class-1',
    planTitle: 'L-2a：三张面孔，同一系统 · 时域直觉速通 (副本)',
  }),
  '/teacher/classes/class-1',
  '班级课堂结束后应回到班级详情页',
);

assert.equal(
  buildSessionEndReturnHref({
    classId: null,
    planTitle: 'L-2a：三张面孔，同一系统 · 时域直觉速通 (副本)',
  }),
  '/interactive-learning/courses/l2a-time-domain-fasttrack',
  'L-2a 精品课堂结束后应回到课程入口页',
);

assert.equal(
  buildSessionEndReturnHref({
    classId: null,
    planTitle: '普通教案：控制系统导论',
  }),
  '/teacher/lesson-plans',
  '普通课堂结束后应回到教师教案页',
);

assert.equal(l2aTeacherPage.includes('结束课堂'), true, 'L-2a 教师页应提供结束课堂入口');
assert.equal(cruiseTeacherPage.includes('结束课堂'), true, '邮轮教师页应提供结束课堂入口');
assert.equal(classDetailPage.includes('停止课堂'), true, '教师班级页应提供停止进行中课堂入口');

console.log('classroom session end test passed');
