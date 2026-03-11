import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  buildSessionParticipantHref,
  resolveSessionRouteFromPlanTitle,
} from '../../src/lib/classroom-session-route';

const root = process.cwd();

const classroomJoinPage = fs.readFileSync(path.join(root, 'src/app/classroom/join/page.tsx'), 'utf8');
const premiumQuickJoin = fs.readFileSync(path.join(root, 'src/features/interactive/premium-classroom-quick-join.tsx'), 'utf8');
const cruiseEntry = fs.readFileSync(path.join(root, 'src/features/interactive/cruise-classroom/entry-page.tsx'), 'utf8');
const l2aEntry = fs.readFileSync(path.join(root, 'src/features/interactive/l2a-time-domain/entry-page.tsx'), 'utf8');

const cruiseRoute = resolveSessionRouteFromPlanTitle('柔性之海——豪华邮轮的舒适度控制 (副本)');
assert.equal(cruiseRoute.routeSegment, 'cruise-comfort-boppps', '邮轮副本教案应解析到邮轮精品课程路由');

const l2aRoute = resolveSessionRouteFromPlanTitle('L-2a：三张面孔，同一系统 · 时域直觉速通 (副本)');
assert.equal(l2aRoute.routeSegment, 'l2a-time-domain-fasttrack', 'L-2a 副本教案应解析到 L-2a 精品课程路由');

const defaultRoute = resolveSessionRouteFromPlanTitle('普通教案：控制系统导论');
assert.equal(defaultRoute.routeSegment, null, '普通教案不应被错误解析为精品课程');

assert.equal(
  buildSessionParticipantHref({ role: 'student', sessionId: 'demo123', planTitle: '柔性之海——豪华邮轮的舒适度控制 (副本)' }),
  '/interactive-learning/courses/cruise-comfort-boppps/student/demo123',
  '邮轮学生跳转路径应指向精品课程学生页',
);

assert.equal(
  buildSessionParticipantHref({ role: 'teacher', sessionId: 'demo456', planTitle: '普通教案：控制系统导论' }),
  '/classroom/teacher/demo456',
  '普通课堂教师路径应保留旧课堂页',
);

for (const [label, content] of [
  ['通用加入页', classroomJoinPage],
  ['互动学习快速加入', premiumQuickJoin],
  ['邮轮课程加入入口', cruiseEntry],
  ['L-2a 课程加入入口', l2aEntry],
] as const) {
  assert.equal(
    content.includes('studentHref') || content.includes('buildSessionParticipantHref'),
    true,
    `${label} 应复用统一课堂跳转结果，而不是硬编码课程学生页`,
  );
}

console.log('classroom session route test passed');
