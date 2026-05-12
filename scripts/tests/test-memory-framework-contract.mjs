import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const codexHome = process.env.CODEX_HOME || path.join(process.env.HOME, '.codex');

function read(relPath) {
  return fs.readFileSync(path.join(root, relPath), 'utf8');
}

const agents = read('AGENTS.md');
const memoryReadme = read('docs/memory/README.md');
const memorySkill = fs.readFileSync(
  path.join(codexHome, 'skills/memory-maintenance/SKILL.md'),
  'utf8',
);

assert.match(
  agents,
  /初始化|刚进入仓库|最近记忆/,
  'AGENTS.md 应指导智能体在初始化时快速读取最近记忆',
);

assert.match(
  agents,
  /docs\/memory\/02-recent-summary\.md/,
  'AGENTS.md 应明确指向 recent summary 入口文件',
);

assert.match(
  memoryReadme,
  /02-recent-summary\.md/,
  'memory README 应包含 recent summary 入口',
);

assert.match(
  memoryReadme,
  /初始化|快速建立上下文|最近摘要/,
  'memory README 应说明初始化时如何快速读取最近上下文',
);

assert.match(
  memorySkill,
  /recent summary|最近摘要|02-recent-summary/,
  'memory-maintenance skill 应说明 recent summary 的维护规则',
);

assert.match(
  memorySkill,
  /初始化|快速建立上下文/,
  'memory-maintenance skill 应说明如何维护初始化读取入口',
);

console.log('memory framework contract passed');
