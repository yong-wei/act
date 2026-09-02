#!/usr/bin/env node
// #1743 验收门禁：manifest 全行 PASS + 封闭分母 + 源/截图 hash 与当前树一致。
// 任一失败即非零退出；不存在豁免路径。
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const outputDirRelative = process.env.ACT_ACCEPTANCE_OUTPUT_DIR ?? 'artifacts/active-graph-migration-acceptance-v037';
const manifestPath = path.join(repoRoot, outputDirRelative, 'manifest.json');

const DOMAINS = [
  'root-locus', 'modeling', 'time', 'stability', 'frequency', 'design',
  'discrete', 'state-space', 'nonlinear-analysis', 'lyapunov', 'discrete-design',
  'robustness', 'optimal', 'robust-design', 'nonlinear-design',
];

const REQUIRED_ROW_IDS = [
  'denominator/root.domains.count',
  'denominator/root.aggregate',
  'locale/release.capability',
  ...DOMAINS.flatMap((domain) => [
    `structure/domain.${domain}.default.bounded`,
    `structure/domain.${domain}.default.coverage`,
    `structure/domain.${domain}.search.bounded`,
    `structure/domain.${domain}.detail.identity`,
    `structure/domain.${domain}.neighborhood.bounded`,
  ]),
  'hierarchy/root.entries.visible',
  ...DOMAINS.flatMap((domain) => [
    `hierarchy/domain.${domain}.overview`,
    `hierarchy/domain.${domain}.one-hop`,
  ]),
  'force/2d.movement',
  'force/2d.camera-fit',
  'force/3d.dimension-switch',
  'controls/filter.type.reversible',
  'controls/filter.teaching.checkbox',
  'controls/filter.families.count',
  'controls/toolbar.consolidated',
  'locale/switch.roundtrip',
  'controls/mobile.drawer',
  'hierarchy/mobile.large-domain.directory-retained',
  'hierarchy/mobile.small-domain.no-visible-directory',
  'roles/role.teacher.domain-overview',
  'roles/role.admin.domain-overview',
  'performance/domain.usable-time',
  'performance/domain.requests',
  'performance/domain.bytes',
  'performance/force.settle',
  'performance/overview.dom-nodes',
  'performance/overview.visible-labels',
  'performance/overview.katex',
  'performance/longtasks.count',
  'performance/longtasks.total',
  'privacy/evidence.scan',
];

if (!existsSync(manifestPath)) {
  console.error(`FAIL acceptance manifest missing: ${path.relative(repoRoot, manifestPath)}`);
  console.error('run: node scripts/tests/capture-active-graph-migration-acceptance.mjs');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
const failures = [];

if (manifest.schema !== 'active-graph-migration-acceptance/v1') failures.push('manifest schema mismatch');
if (manifest.denominator?.domains !== 15) failures.push(`denominator domains != 15 (${manifest.denominator?.domains})`);

const rowIdSet = new Set((manifest.rows ?? []).map((row) => `${row.category}/${row.id}`));
for (const required of REQUIRED_ROW_IDS) {
  if (!rowIdSet.has(required)) failures.push(`missing required row ${required}`);
}
if (rowIdSet.size !== REQUIRED_ROW_IDS.length) {
  failures.push(`row count ${rowIdSet.size} != required ${REQUIRED_ROW_IDS.length}`);
}

for (const row of manifest.rows ?? []) {
  if (row.result !== 'PASS') failures.push(`row ${row.category}/${row.id}: ${row.result} — ${row.detail ?? ''}`);
}

function sha256File(relativePath) {
  return createHash('sha256').update(readFileSync(path.join(repoRoot, relativePath))).digest('hex');
}

const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: repoRoot }).toString().trim();
if (Object.keys(manifest.sourceHashes ?? {}).length === 0) {
  failures.push('manifest sourceHashes missing');
}
for (const [file, expected] of Object.entries(manifest.sourceHashes ?? {})) {
  const actual = sha256File(file);
  if (actual !== expected) failures.push(`stale source hash: ${file}`);
}

const screenshots = manifest.evidence?.screenshots ?? [];
const screenshotHashes = manifest.evidence?.screenshotHashes ?? {};
if (screenshots.length === 0) failures.push('manifest evidence.screenshots missing');
for (const file of screenshots) {
  const relative = path.join(outputDirRelative, file);
  if (!existsSync(path.join(repoRoot, relative))) {
    failures.push(`missing screenshot ${relative}`);
    continue;
  }
  const expected = screenshotHashes[file];
  if (!expected) {
    failures.push(`missing screenshot hash ${file}`);
    continue;
  }
  const actual = sha256File(relative);
  if (actual !== expected) failures.push(`stale screenshot hash: ${file}`);
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
