import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const studentSessionHook = read('src/features/interactive/session-framework/use-student-lesson-session.ts');
const lsumStepPanels = read('src/features/interactive/lsum-design-feasible-domain/step-panels.tsx');
const l2aStepPanels = read('src/features/interactive/l2a-time-domain/step-panels.tsx');
const l2bStepPanels = read('src/features/interactive/l2b-root-locus/step-panels.tsx');
const l2cStepPanels = read('src/features/interactive/l2c-frequency-bode/step-panels.tsx');
const l2dStepPanels = read('src/features/interactive/l2d-three-domain-linkage/step-panels.tsx');
const startScript = read('scripts/ops/start.sh');
const stopScript = read('scripts/ops/stop.sh');
const readme = read('scripts/README.md');

assert.match(
  studentSessionHook,
  /enableSSE\s*=\s*false/,
  '学生课堂会话默认应关闭 SSE，仅保留轮询模式',
);

assert.equal(
  studentSessionHook.includes('实时连接失败，已降级到轮询模式'),
  false,
  '学生端不应再把 SSE 失败文案暴露到课堂页面',
);

assert.equal(
  lsumStepPanels.includes('打开控灵助手'),
  true,
  'L-sum 第10页应将页内按钮文案改为“打开控灵助手”',
);

for (const [label, content] of [
  ['L-2a', l2aStepPanels],
  ['L-2b', l2bStepPanels],
  ['L-2c', l2cStepPanels],
  ['L-sum', lsumStepPanels],
]) {
  assert.equal(
    content.includes('SubmissionStatus') && /disabled=\{isSubmitted\}|disabled=\{submissionLocked\}/.test(content),
    true,
    `${label} 的互动表单在提交后应展示提交状态并锁定再次提交`,
  );
}

assert.equal(
  l2dStepPanels.includes('提交成功') &&
    l2dStepPanels.includes('disabled={quizSubmitted}') &&
    l2dStepPanels.includes('disabled={taskOneSubmitted}') &&
    l2dStepPanels.includes('disabled={reflectionSubmitted}') &&
    l2dStepPanels.includes('disabled={postRangeSubmitted}'),
  true,
  'L-2d 的互动表单在提交后也应显示“提交成功”并锁定再次提交',
);

assert.equal(
  startScript.includes('worker:dev') && startScript.includes('worker:scheduler'),
  true,
  '启动脚本应拉起数据治理 worker 与 scheduler',
);

assert.equal(
  stopScript.includes('worker.pid') && stopScript.includes('scheduler.pid'),
  true,
  '停止脚本应回收 worker 与 scheduler 的 PID',
);

assert.equal(
  readme.includes('worker:dev') && readme.includes('worker:scheduler'),
  true,
  '脚本文档应说明本地启动已包含 worker 与 scheduler',
);

console.log('classroom followups test passed');
