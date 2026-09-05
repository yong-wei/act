#!/usr/bin/env node
/**
 * 接收 3DModels 的 type055-nanchang-101 版本化模型发布包。
 *
 * 失败优先：源目录 manifest/角色文件任一缺失、SHA-256 或大小与 manifest 声明不符、
 * 角色重复、复制后字节不一致、或候选包路径存在未提交变更，都拒绝整个包
 * （不登记部分通过的子集）。目标目录先在暂存目录完成全部校验，再原子重命名替换。
 *
 * 用法：
 *   node scripts/models/receive-type055-nanchang-101-v2.mjs --source <3DModels>/assets/type_055_destroyer/exports/v2.1.0
 *   node scripts/models/receive-type055-nanchang-101-v2.mjs --source=<同上>
 *
 * 输出：
 *   public/assets/model-releases/type055-nanchang-101/<version>/<manifest + GLBs>
 *   artifacts/model-releases/type055-nanchang-101-<version>/receipt.json
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const RELEASES = {
  '2.0.0': {
    schema: 'type055-versioned-model-release/1',
    roles: ['ship_lod0', 'ship_lod1', 'ship_lod2', 'collision', 'payload', 'demo'],
    expectedManifestSha: '5901a821f7f955d4cafb0cd7c40420df506e24914de4abfa12678c7643f594b6',
    expectedBlendSha: 'c8a82074fefc4d935d5714f78fafc18df5bf48662774a0a30f78714f435d6357',
    validationStatuses: ['PASS'],
    defaultSource: '/Users/YW/Documents/Project/3DModels/assets/type_055_destroyer/exports/v2.0.0',
  },
  '2.1.0': {
    schema: 'type055-versioned-model-release/2',
    roles: ['ship_lod0', 'ship_lod1', 'ship_lod2', 'collision', 'payload', 'demo', 'interactive'],
    expectedManifestSha: 'c4dcf49ab7c23ca1d0a269800f29a9dcd180f1e2795dc2db882e87575586f7c8',
    expectedBlendSha: 'c8a82074fefc4d935d5714f78fafc18df5bf48662774a0a30f78714f435d6357',
    validationStatuses: ['PASS', 'PASS_WITH_BUDGET_WARNING'],
    defaultSource: '/Users/YW/Documents/Project/3DModels/assets/type_055_destroyer/exports/v2.1.0',
  },
  '2.1.1': {
    schema: 'type055-versioned-model-release/2',
    roles: ['ship_lod0', 'ship_lod1', 'ship_lod2', 'collision', 'payload', 'demo', 'interactive'],
    expectedManifestSha: '24f7dfdb2ec362d3fb4ac9fe0b1b6c63ce15d5c1f34b8603ddf5638932581430',
    expectedBlendSha: 'c8a82074fefc4d935d5714f78fafc18df5bf48662774a0a30f78714f435d6357',
    validationStatuses: ['PASS', 'PASS_WITH_BUDGET_WARNING'],
    defaultSource: '/Users/YW/Documents/Project/3DModels/assets/type_055_destroyer/exports/v2.1.1',
  },
};

const PACKAGE_RELATIVE = 'public/assets/model-releases/type055-nanchang-101';
const ACT_ROLE = {
  ship_lod0: 'ship-lod0',
  ship_lod1: 'ship-lod1',
  ship_lod2: 'ship-lod2',
  interactive: 'interactive-systems',
};

function fail(message) {
  console.error(`receive rejected: ${message}`);
  process.exit(1);
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function repoRoot() {
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim();
}

const argv = process.argv.slice(2);
const sourceEq = argv.find((arg) => arg.startsWith('--source='));
const sourceIdx = argv.indexOf('--source');
const sourceDir = sourceEq ? sourceEq.slice('--source='.length)
  : sourceIdx >= 0 ? argv[sourceIdx + 1]
  : [RELEASES['2.1.1'], RELEASES['2.1.0'], RELEASES['2.0.0']].find((release) => existsSync(release.defaultSource))?.defaultSource;
if (!sourceDir || !existsSync(sourceDir)) fail(`source release directory not found: ${sourceDir || '(missing --source value)'}`);

const root = repoRoot();
const manifestPath = path.join(sourceDir, 'manifest.json');
const manifestSha = sha256(manifestPath);
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
} catch (error) {
  fail(`unreadable manifest: ${error.message}`);
}

const version = String(manifest.model_version || '');
const release = RELEASES[version];
if (!release) fail(`unsupported model_version ${version}`);
if (manifest.schema !== release.schema) fail(`unexpected schema ${manifest.schema}`);
if (manifest.ship_id !== 'type_055_destroyer_101_nanchang') fail(`unexpected ship_id ${manifest.ship_id}`);
if (!release.validationStatuses.includes(manifest.validation?.status)) {
  fail(`model-side validation is ${manifest.validation?.status}, expected ${release.validationStatuses.join('|')}`);
}
if (manifestSha !== release.expectedManifestSha) fail(`manifest sha256 ${manifestSha} != expected`);
if (manifest.source.sha256 !== release.expectedBlendSha) fail('source .blend sha256 does not match the accepted release');

const roles = release.roles;
const seenFiles = new Set();
for (const role of roles) {
  const artifact = manifest.artifacts[role];
  if (!artifact) fail(`manifest missing role ${role}`);
  if (seenFiles.has(artifact.file)) fail(`duplicate file ${artifact.file} across roles`);
  seenFiles.add(artifact.file);
  const file = path.join(sourceDir, artifact.file);
  if (!statSync(file, { throwIfNoEntry: false })?.isFile()) fail(`missing artifact ${artifact.file}`);
  const bytes = statSync(file).size;
  if (bytes !== artifact.bytes) fail(`${artifact.file} size ${bytes} != declared ${artifact.bytes}`);
  const digest = sha256(file);
  if (digest !== artifact.sha256) fail(`${artifact.file} sha256 ${digest} != declared ${artifact.sha256}`);
}
const shipLods = roles.filter((role) => manifest.artifacts[role].kind === 'ship');
if (shipLods.length !== 3 || new Set(shipLods.map((role) => manifest.artifacts[role].lod)).size !== 3) {
  fail('expected three ship roles with distinct LOD indices');
}
const nonShipKinds = roles.filter((role) => manifest.artifacts[role].kind !== 'ship')
  .map((role) => manifest.artifacts[role].kind);
if (new Set(nonShipKinds).size !== nonShipKinds.length) fail(`non-ship role kinds collapsed: ${nonShipKinds.join(',')}`);

const packageDirty = execFileSync(
  'git', ['status', '--porcelain', '--', PACKAGE_RELATIVE],
  { encoding: 'utf-8', cwd: root },
).trim().length > 0;
if (packageDirty) fail('candidate package paths have uncommitted changes; commit or restore them before receiving');

const TARGET_DIR = `${PACKAGE_RELATIVE}/v${version}`;
const RECEIPT_PATH = `artifacts/model-releases/type055-nanchang-101-v${version}/receipt.json`;
const releaseFiles = ['manifest.json', ...roles.map((role) => manifest.artifacts[role].file)];
const targetDir = path.join(root, TARGET_DIR);
const copied = [];
if (existsSync(targetDir)) {
  for (const file of releaseFiles) {
    const to = path.join(targetDir, file);
    if (!statSync(to, { throwIfNoEntry: false })?.isFile()) fail(`existing package incomplete: ${file}`);
    const digest = sha256(to);
    const declared = file === 'manifest.json' ? release.expectedManifestSha
      : roles.map((role) => manifest.artifacts[role]).find((artifact) => artifact.file === file).sha256;
    if (digest !== declared || statSync(to).size !== statSync(path.join(sourceDir, file)).size) {
      fail(`existing package drifted from the release identity: ${file}`);
    }
    copied.push({ file, sha256: digest, bytes: statSync(to).size });
  }
  console.log('identical package already received; keeping verified directory in place (no-op)');
} else {
  const stagingDir = path.join(root, PACKAGE_RELATIVE, `.staging-v${version}-${process.pid}-${Date.now()}`);
  rmSync(stagingDir, { recursive: true, force: true });
  mkdirSync(stagingDir, { recursive: true });
  try {
    for (const file of releaseFiles) {
      const from = path.join(sourceDir, file);
      const to = path.join(stagingDir, file);
      cpSync(from, to);
      const before = sha256(from);
      const after = sha256(to);
      if (before !== after || statSync(to).size !== statSync(from).size) fail(`copy drift on ${file}`);
      copied.push({ file, sha256: after, bytes: statSync(to).size });
    }
    renameSync(stagingDir, targetDir);
  } finally {
    rmSync(stagingDir, { recursive: true, force: true });
  }
}

function dirTreeDigest(dir) {
  const entries = readdirSync(dir).sort().map((file) => {
    const blob = execFileSync('git', ['hash-object', '-w', path.join(dir, file)], { encoding: 'utf-8', cwd: root }).trim();
    return `100644 blob ${blob}\t${file}`;
  });
  return execFileSync('git', ['mktree'], { input: `${entries.join('\n')}\n`, cwd: root, encoding: 'utf-8' }).trim();
}
const capturedAt = new Date().toISOString();
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8', cwd: root }).trim();
const packageTreeDigest = dirTreeDigest(targetDir);
const receipt = {
  schema: 'act-model-release-receipt/1',
  packageId: 'type055-nanchang-101',
  modelVersion: version,
  capturedAt,
  packageTreeDigest,
  sourceCommitAtCapture: head,
  packageDirty,
  sourceRelease: `3DModels:assets/type_055_destroyer/exports/v${version}`,
  manifestSha256: manifestSha,
  sourceBlendSha256: manifest.source.sha256,
  modelSideValidation: manifest.validation.status,
  roles: Object.fromEntries(roles.map((role) => {
    const artifact = manifest.artifacts[role];
    const actRole = ACT_ROLE[role] ?? role;
    return [actRole, { file: artifact.file, sha256: artifact.sha256, bytes: artifact.bytes, kind: artifact.kind, lod: artifact.lod ?? null }];
  })),
  copiedFiles: copied,
  integrity: 'source-and-destination-hashes-verified',
};
const receiptPath = path.join(root, RECEIPT_PATH);
mkdirSync(path.dirname(receiptPath), { recursive: true });
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

console.log(`received type055-nanchang-101 v${version} (${copied.length - 1} GLBs + manifest)`);
console.log(`target: ${TARGET_DIR}`);
console.log(`receipt: ${RECEIPT_PATH} (sourceCommit ${head}, packageDirty ${packageDirty})`);
