import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), 'utf8');
}

const startScript = read('scripts/ops/start.sh');
const validationDoc = read('.agents/skills/interactive-lesson/references/closed-loop-browser-validation.md');

assert.equal(
  startScript.includes('npm run dev -- --hostname 127.0.0.1 --port "$FRONTEND_PORT"'),
  true,
  '启动脚本应继续使用 next dev 作为本地浏览器调试基线',
);

assert.equal(
  startScript.includes('curl -fsS') && startScript.includes('/interactive-learning/courses'),
  true,
  '启动脚本应在返回成功前轮询浏览器调试目标页，避免页面只加载一半',
);

assert.equal(
  startScript.includes('npm run seed:fixed-passwords'),
  true,
  '启动脚本应同步固定测试账号密码，避免浏览器验收账号与文档漂移',
);

assert.equal(
  validationDoc.includes('npm run startup') && validationDoc.includes('不要使用 `npm run start`'),
  true,
  '闭环浏览器验收参考应明确使用 startup，而不是 next start',
);

console.log('browser debug bootstrap test passed');
