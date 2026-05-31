import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const skillSource = fs.readFileSync(
  path.join(root, '.agents/skills/server-ops/SKILL.md'),
  'utf8',
);
const databaseSyncSource = fs.readFileSync(
  path.join(root, '.agents/skills/server-ops/references/database-sync.md'),
  'utf8',
);

assert.match(
  skillSource,
  /主入口只保留总览/,
  'server-ops 主入口必须保持精简，只保留总览说明',
);

assert.match(
  databaseSyncSource,
  /bash scripts\/db\/sync-remote-db-to-local\.sh/,
  '数据库同步 reference 必须默认指向确定性的同步脚本',
);

assert.match(
  databaseSyncSource,
  /脚本会先备份本地库，再导出远端并重建本地库/,
  '数据库同步 reference 必须明确脚本会先备份本地库，再导出远端并重建本地库',
);

console.log('server-ops skill contract passed');
