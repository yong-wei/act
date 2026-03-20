import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const eventsRoute = fs.readFileSync(path.join(root, 'src/app/api/interactive/events/route.ts'), 'utf8');
const stateRoute = fs.readFileSync(path.join(root, 'src/app/api/session/[sessionId]/state/route.ts'), 'utf8');

assert.equal(
  eventsRoute.includes('resourceKey'),
  true,
  '/api/interactive/events 应读取 resourceKey'
);

assert.equal(
  eventsRoute.includes('event.resourceKey || event.resourceId') &&
    eventsRoute.includes('event.resourceKey ?? event.resourceId'),
  true,
  '/api/interactive/events 应兼容旧 payload，仅传 resourceId 时仍视为有效并回填 resourceKey'
);

assert.equal(
  eventsRoute.includes('lessonKey'),
  true,
  '/api/interactive/events 应读取 lessonKey'
);

assert.equal(
  eventsRoute.includes('stepId'),
  true,
  '/api/interactive/events 应读取 stepId'
);

assert.equal(
  eventsRoute.includes('actorRole'),
  true,
  '/api/interactive/events 应读取 actorRole'
);

assert.equal(
  eventsRoute.includes('clientEventAt'),
  true,
  '/api/interactive/events 应写入 clientEventAt'
);

assert.equal(
  stateRoute.includes('stateKey'),
  true,
  '/api/session/[sessionId]/state 应支持显式 stateKey'
);

assert.equal(
  stateRoute.includes('sessionId_userId_stateKey'),
  true,
  '/api/session/[sessionId]/state 应使用 sessionId_userId_stateKey 唯一键'
);

assert.equal(
  stateRoute.includes("return 'teacher-sync'") || stateRoute.includes("const teacherStateKey = 'teacher-sync'"),
  true,
  'teacher:course-sync 应使用独立的 teacher-sync stateKey'
);

assert.equal(
  stateRoute.includes("return 'course'") || stateRoute.includes("const courseStateKey = 'course'"),
  true,
  '学生课程状态应显式使用 course stateKey'
);
