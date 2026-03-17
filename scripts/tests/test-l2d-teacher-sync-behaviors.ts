import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import ts from 'typescript';

const root = process.cwd();

function read(relativePath: string) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

function extractFunction(source: string, name: string) {
  const exportToken = `export function ${name}`;
  const exportAsyncToken = `export async function ${name}`;
  const start = source.indexOf(exportToken) >= 0 ? source.indexOf(exportToken) : source.indexOf(exportAsyncToken);
  assert.notEqual(start, -1, `${name} 应存在于源文件中`);

  const paramsStart = source.indexOf('(', start);
  assert.notEqual(paramsStart, -1, `${name} 应包含参数列表`);

  let paramsDepth = 0;
  let paramsEnd = -1;
  for (let index = paramsStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '(') {
      paramsDepth += 1;
    } else if (char === ')') {
      paramsDepth -= 1;
      if (paramsDepth === 0) {
        paramsEnd = index;
        break;
      }
    }
  }

  assert.notEqual(paramsEnd, -1, `${name} 参数列表应完整闭合`);

  const bodyStart = source.indexOf('{', paramsEnd);
  assert.notEqual(bodyStart, -1, `${name} 应包含函数体`);

  let depth = 0;
  let end = -1;
  for (let index = bodyStart; index < source.length; index += 1) {
    const char = source[index];
    if (char === '{') {
      depth += 1;
    } else if (char === '}') {
      depth -= 1;
      if (depth === 0) {
        end = index;
        break;
      }
    }
  }

  assert.notEqual(end, -1, `${name} 函数体应完整闭合`);
  return source.slice(start, end + 1);
}

function loadFunction(relativePath: string, name: string) {
  const source = read(relativePath);
  const fnSource = extractFunction(source, name);
  const transpiled = ts.transpileModule(fnSource, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
    },
  });
  const moduleExports: Record<string, unknown> = {};
  const context: Record<string, unknown> = {
    exports: moduleExports,
    module: { exports: moduleExports },
  };
  vm.runInNewContext(transpiled.outputText, context);
  return ((context.module as { exports: Record<string, unknown> }).exports[name] ??
    (context.exports as Record<string, unknown>)[name]) as (...args: unknown[]) => unknown;
}

const coursePath = 'src/lib/l2d-course.ts';
const teacherPagePath = 'src/features/interactive/l2d-three-domain-linkage/teacher-page.tsx';
const teacherHookPath = 'src/features/interactive/session-framework/use-teacher-lesson-session.ts';
const stateChannelPath = 'src/features/interactive/session-framework/use-session-state-channel.ts';

const shouldPostL2DTeacherSync = loadFunction(coursePath, 'shouldPostL2DTeacherSync');
const resolveL2DTeacherRevealedAnswers = loadFunction(coursePath, 'resolveL2DTeacherRevealedAnswers');
const finalizeL2DTeacherSession = loadFunction(coursePath, 'finalizeL2DTeacherSession');

assert.equal(
  shouldPostL2DTeacherSync({ loadingSession: true, teacherViewHydrated: false }),
  false,
  'session 仍在加载时不应写回 teacher-sync'
);

assert.equal(
  shouldPostL2DTeacherSync({ loadingSession: false, teacherViewHydrated: false }),
  false,
  'teacher-view 尚未回填完成时不应写回 teacher-sync'
);

assert.equal(
  shouldPostL2DTeacherSync({ loadingSession: false, teacherViewHydrated: true }),
  true,
  '只有 session 已加载且 teacher-view 已回填后，才允许首次写回 teacher-sync'
);

assert.deepEqual(
  resolveL2DTeacherRevealedAnswers({
    localRevealedAnswers: null,
    teacherSyncState: {
      kind: 'teacher_sync_l2d',
      activeStepId: 'step-04',
      revealedAnswers: { 'step-04': true },
      updatedAt: 1,
    },
  }),
  { 'step-04': true },
  '本地未编辑前，应优先沿用服务端已保存的 revealedAnswers'
);

assert.deepEqual(
  resolveL2DTeacherRevealedAnswers({
    localRevealedAnswers: { 'step-07': true },
    teacherSyncState: {
      kind: 'teacher_sync_l2d',
      activeStepId: 'step-04',
      revealedAnswers: { 'step-04': true },
      updatedAt: 1,
    },
  }),
  { 'step-07': true },
  '教师本地已有编辑时，应优先使用本地 draft，避免被服务端旧值反向覆盖'
);

let finalizeTriggeredOnFailure = false;
await assert.rejects(
  finalizeL2DTeacherSession({
    finishSession: async () => {
      throw new Error('finish failed');
    },
    trackSessionFinalize: () => {
      finalizeTriggeredOnFailure = true;
    },
    currentStepId: 'step-01',
  }),
  /finish failed/,
  'finish 失败时应继续向上抛错'
);
assert.equal(
  finalizeTriggeredOnFailure,
  false,
  'finish 失败时不应发送 finalize 事件'
);

const finalizeTrace: string[] = [];
await finalizeL2DTeacherSession({
  finishSession: async () => {
    finalizeTrace.push('finish');
  },
  trackSessionFinalize: ({ currentStepId }: { currentStepId: string }) => {
    finalizeTrace.push(`finalize:${currentStepId}`);
  },
  currentStepId: 'step-07',
});
assert.deepEqual(
  finalizeTrace,
  ['finish', 'finalize:step-07'],
  'finalize 事件必须在 finish 成功后发送'
);

const teacherPage = read(teacherPagePath);
const teacherHook = read(teacherHookPath);
const stateChannel = read(stateChannelPath);

assert.equal(
  teacherPage.includes('teacherViewHydrated') &&
    teacherPage.includes('shouldPostL2DTeacherSync') &&
    teacherPage.includes('resolveL2DTeacherRevealedAnswers') &&
    teacherPage.includes('finalizeL2DTeacherSession'),
  true,
  'L-2d 教师页应显式使用 hydrated gate、服务端 revealedAnswers 回填与 finalize helper'
);

assert.equal(
  teacherHook.includes('teacherViewHydrated') &&
    stateChannel.includes('teacherViewHydrated'),
  true,
  '共享 session/state hooks 应暴露 teacher-view hydrated 语义供课程页复用'
);

console.log('l2d teacher sync behavior test passed');
