import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const studentSessionHook = read('src/features/interactive/session-framework/use-student-lesson-session.ts');
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
  readme.includes('数据治理 worker') && readme.includes('scheduler'),
  true,
  '脚本文档应说明本地启动已包含 worker 与 scheduler',
);

console.log('classroom followups test passed');
