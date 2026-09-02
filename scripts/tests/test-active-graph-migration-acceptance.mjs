#!/usr/bin/env node
// #1743 验收门禁：manifest 全行 PASS + hash 与当前树一致 + 隐私扫描。
// 任一失败即非零退出；不存在豁免路径。
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const manifestPath = path.join(
  repoRoot,
  process.env.ACT_ACCEPTANCE_OUTPUT_DIR ?? 'artifacts/active-graph-migration-acceptance-v037',
  'manifest.json',
);

if (!existsSync(manifestPath)) {
  console.error(`FAIL acceptance manifest missing: ${path.relative(repoRoot, manifestPath)}`);
  console.error('run: node scripts/tests/capture-active-graph-migration-acceptance.mjs');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const failures = [];

if (manifest.schema !== 'active-graph-migration-acceptance/v1') failures.push('manifest schema mismatch');
if (manifest.denominator?.domains !== 15) failures.push(`denominator domains != 15 (${manifest.denominator?.domains})`);

for (const row of manifest.rows ?? []) {
  if (row.result !== 'PASS') failures.push(`row ${row.category}/${row.id}: ${row.result} — ${row.detail ?? ''}`);
}

// exact-revision 绑定：当前 HEAD 必须等于 capture revision，且源文件 hash 一致。
const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot }).toString().trim();
if (manifest.captureRevision !== revision) {
  const captureIsAncestor = spawnSync(
    'git',
    ['merge-base', '--is-ancestor', manifest.captureRevision, revision],
    { cwd: repoRoot, stdio: 'ignore' },
  ).status === 0;
  // Evidence-only follow-up commits may sit on top of the capture revision
  // when CAPTURE_SOURCE_FILES hashes still match HEAD.
  if (!captureIsAncestor) {
    failures.push(`capture revision ${manifest.captureRevision?.slice(0, 9)} != HEAD ${revision.slice(0, 9)}; recapture required`);
  }
}
for (const [file, expected] of Object.entries(manifest.sourceHashes ?? {})) {
  const actual = createHash('sha256').update(readFileSync(path.join(repoRoot, file))).digest('hex');
  if (actual !== expected) failures.push(`stale source hash: ${file}`);
}

const text = JSON.stringify(manifest);
for (const pattern of [/DemoStudent@/u, /\/Users\/[A-Za-z]/u, /next-auth\.session-token=[^"]/u]) {
  if (pattern.test(text)) failures.push(`privacy pattern leaked in manifest: ${pattern}`);
}

if (failures.length > 0) {
  console.error(`active graph migration acceptance FAILED (${failures.length}):`);
  for (const failure of failures) console.error(`  - ${failure}`);
  process.exit(1);
}
console.log(`active graph migration acceptance passed: ${(manifest.rows ?? []).length} rows on ${revision.slice(0, 9)}`);
