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
const deployReferenceSource = fs.readFileSync(
  path.join(root, '.agents/skills/server-ops/references/deploy-and-verify.md'),
  'utf8',
);

assert.match(
  skillSource,
  /主入口只保留总览/,
  'server-ops 主入口必须保持精简，只保留总览说明',
);

assert.match(
  skillSource,
  /只有满足以下至少一项时才允许启用本 skill/,
  'server-ops 必须使用显式远端服务器 Trigger Gate',
);

assert.match(
  skillSource,
  /用户明确要求把本项目发布或部署到服务器/,
  'server-ops 必须允许明确的服务器发布或部署请求',
);

assert.match(
  skillSource,
  /当前任务必须通过 SSH 或等价远端接口读取、诊断或修改服务器状态/,
  'server-ops 必须允许确实需要远端服务器状态的任务',
);

for (const forbiddenTrigger of [
  'Git、GitHub、ActKG 或其他仓库中的 Release、tag、Bundle、图谱发布核对',
  '分析图谱 authority、cutover readiness、CourseCoverage 或迁移条件',
  '任何不需要读取或改变远端服务器状态的“发布”“切换”“上线准备”讨论',
]) {
  assert.ok(
    skillSource.includes(forbiddenTrigger),
    `server-ops 必须明确排除非服务器任务: ${forbiddenTrigger}`,
  );
}

assert.match(
  skillSource,
  /语义存在歧义时默认不启用/,
  'server-ops 在触发语义不明确时必须默认不启用',
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

assert.match(
  skillSource,
  /已提交的 production cutover marker 存在时，普通 Legacy `remote-deploy\.sh` 必须保持禁用/,
  'server-ops 必须禁止已切换生产重新走 Legacy 部署路径',
);

for (const invariant of [
  '不同 transactionId 的历史 journal/receipt 是 Legacy 部署保留的 release 审计证据',
  '只有已提升 engine 与 `.tmp` 都是普通文件且 SHA-256 等于 sealed hash',
  'committed receipt、current marker、四个 selector、app/worker 镜像 OCI digest',
]) {
  assert.ok(
    deployReferenceSource.includes(invariant),
    `server-ops 必须保留生产图谱切换恢复不变量: ${invariant}`,
  );
}

console.log('server-ops skill contract passed');
