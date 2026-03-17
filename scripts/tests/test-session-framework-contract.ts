import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const contractPath = 'src/features/interactive/session-framework/session-contract.ts';
const progressChannelPath = 'src/features/interactive/session-framework/use-session-progress-channel.ts';
const stateChannelPath = 'src/features/interactive/session-framework/use-session-state-channel.ts';
const studentHookPath = 'src/features/interactive/session-framework/use-student-lesson-session.ts';
const teacherHookPath = 'src/features/interactive/session-framework/use-teacher-lesson-session.ts';
const indexPath = 'src/features/interactive/session-framework/index.ts';
const stateRoutePath = 'src/app/api/session/[sessionId]/state/route.ts';

assert.equal(
  fs.existsSync(path.join(root, contractPath)),
  true,
  '应新增 session-framework/session-contract.ts'
);

assert.equal(
  fs.existsSync(path.join(root, progressChannelPath)),
  true,
  '应新增 use-session-progress-channel.ts'
);

assert.equal(
  fs.existsSync(path.join(root, stateChannelPath)),
  true,
  '应新增 use-session-state-channel.ts'
);

assert.equal(
  fs.existsSync(path.join(root, studentHookPath)),
  true,
  '应新增 use-student-lesson-session.ts'
);

assert.equal(
  fs.existsSync(path.join(root, teacherHookPath)),
  true,
  '应新增 use-teacher-lesson-session.ts'
);

assert.equal(
  fs.existsSync(path.join(root, indexPath)),
  true,
  '应新增 session-framework/index.ts'
);

const contract = read(contractPath);
const progressChannel = read(progressChannelPath);
const stateChannel = read(stateChannelPath);
const studentHook = read(studentHookPath);
const teacherHook = read(teacherHookPath);
const indexFile = read(indexPath);
const stateRoute = read(stateRoutePath);

assert.equal(
  contract.includes('lessonKey') &&
    contract.includes('studentStateKey') &&
    contract.includes('teacherStateKey') &&
    contract.includes('createEmptyStudentState') &&
    contract.includes('isStudentState') &&
    contract.includes('isTeacherSyncState') &&
    contract.includes('buildTeacherSyncPayload'),
  true,
  'adapter 契约应包含 lessonKey / stateKey / createEmptyStudentState / isStudentState / isTeacherSyncState / buildTeacherSyncPayload'
);

assert.equal(
  progressChannel.includes('fetch(`/api/session/${sessionId}`)') &&
    progressChannel.includes('method: \'PATCH\'') &&
    progressChannel.includes('setInterval'),
  true,
  'session progress channel 应统一处理 session 拉取、PATCH 与 polling'
);

assert.equal(
  stateChannel.includes('?scope=student-view') &&
    stateChannel.includes('?scope=self') &&
    stateChannel.includes('?scope=teacher-view') &&
    stateChannel.includes('courseStates') &&
    stateChannel.includes('teacherStates'),
  true,
  'session state channel 应统一处理 self / student-view / teacher-view，并显式分桶 courseStates 与 teacherStates'
);

assert.equal(
  studentHook.includes('sessionInfo') &&
    studentHook.includes('stateRecords') &&
    studentHook.includes('activeIndex') &&
    studentHook.includes('teacherIndex') &&
    studentHook.includes('isOutOfSync') &&
    studentHook.includes('createEmptyStudentState'),
  true,
  'student hook 应暴露统一字段，并复用 adapter 的 createEmptyStudentState'
);

assert.equal(
  teacherHook.includes('sessionInfo') &&
    teacherHook.includes('stateRecords') &&
    teacherHook.includes('activeIndex') &&
    teacherHook.includes('teacherIndex') &&
    teacherHook.includes('isOutOfSync') &&
    teacherHook.includes('buildTeacherSyncPayload'),
  true,
  'teacher hook 应暴露统一字段，并复用 adapter 的 buildTeacherSyncPayload'
);

assert.equal(
  indexFile.includes('useStudentLessonSession') &&
    indexFile.includes('useTeacherLessonSession') &&
    indexFile.includes('useSessionProgressChannel') &&
    indexFile.includes('useSessionStateChannel'),
  true,
  'session-framework/index.ts 应统一导出共享 hooks'
);

assert.equal(
  stateRoute.includes("scope === 'teacher-view'") &&
    stateRoute.includes('courseStates') &&
    stateRoute.includes('teacherStates'),
  true,
  '课堂状态接口应新增 teacher-view，并显式分离 courseStates 与 teacherStates'
);

assert.equal(
  stateRoute.includes('states: courseStates') &&
    stateRoute.includes('return NextResponse.json({ states, courseStates: states, teacherStates, summary })'),
  true,
  'teacher-view 与默认 GET 当前都应保持 states 等价于课程态列表，避免旧教师页语义被静默改坏'
);

console.log('session framework contract test passed');
