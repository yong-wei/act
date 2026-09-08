#!/usr/bin/env node
/**
 * 接收 3DModels 的 xue-long-2（雪龙2号破冰船）版本化模型发布包。
 *
 * 失败优先：源目录 manifest/LOD 文件任一缺失、SHA-256 或大小与 manifest 声明不符、
 * LOD 序号重复、复制后字节不一致、或候选包路径存在未提交变更，都拒绝整个包。
 * 目标目录先在暂存目录完成全部校验，再原子重命名替换（同 type055 接收口径）。
 *
 * 用法：
 *   node scripts/models/receive-xuelong2-v0.mjs --source <3DModels>/assets/xue_long_2/exports/v0.1.0
 *   node scripts/models/receive-xuelong2-v0.mjs --source=<同上>
 *
 * 输出：
 *   public/assets/model-releases/xue-long-2/<version>/<manifest + GLBs>
 *   artifacts/model-releases/xue-long-2-<version>/receipt.json
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';

const RELEASES = {
  '0.1.0': {
    assetId: 'xue-long-2',
    actProfile: 'fleet-icebreaker-xuelong2',
    acceptedStatuses: ['LOCAL_CANDIDATE_PENDING_USER_VISUAL_ACCEPTANCE'],
    expectedManifestSha: '15f2fd2b0fe2e5d0e356040fb62c6f6d6702466d7ff5dfaf8cfbedddbef76b07',
    expectedBlendSha: 'bbb71b6c254e6825b98a59dfc6c8fba586d32650bf0dbe866c288b11c3d18ca5',
    defaultSource: '/Users/YW/Documents/Project/3DModels/assets/xue_long_2/exports/v0.1.0',
  },
};

const PACKAGE_RELATIVE = 'public/assets/model-releases/xue-long-2';
const LOD_ROLE = { 0: 'ship-lod0', 1: 'ship-lod1', 2: 'ship-lod2' };

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
  : Object.values(RELEASES).find((release) => existsSync(release.defaultSource))?.defaultSource;
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

const version = String(manifest.version || '');
const release = RELEASES[version];
if (!release) fail(`unsupported version ${version}`);
if (manifest.asset_id !== release.assetId) fail(`unexpected asset_id ${manifest.asset_id}`);
if (manifest.act_profile !== release.actProfile) fail(`unexpected act_profile ${manifest.act_profile}`);
if (!release.acceptedStatuses.includes(manifest.status)) {
  fail(`model-side status is ${manifest.status}, expected ${release.acceptedStatuses.join('|')}`);
}
if (manifestSha !== release.expectedManifestSha) fail(`manifest sha256 ${manifestSha} != expected`);
if (manifest.source_sha256 !== release.expectedBlendSha) fail('source .blend sha256 does not match the accepted release');

const lods = manifest.lods;
if (!Array.isArray(lods) || lods.length !== 3) fail(`expected 3 LODs, got ${lods?.length}`);
const seenLodIndices = new Set();
const seenFiles = new Set();
for (const lod of lods) {
  if (seenLodIndices.has(lod.lod)) fail(`duplicate LOD index ${lod.lod}`);
  seenLodIndices.add(lod.lod);
  if (seenFiles.has(lod.file)) fail(`duplicate file ${lod.file} across LODs`);
  seenFiles.add(lod.file);
  const file = path.join(sourceDir, lod.file);
  if (!statSync(file, { throwIfNoEntry: false })?.isFile()) fail(`missing LOD artifact ${lod.file}`);
  const bytes = statSync(file).size;
  if (bytes !== lod.bytes) fail(`${lod.file} size ${bytes} != declared ${lod.bytes}`);
  const digest = sha256(file);
  if (digest !== lod.sha256) fail(`${lod.file} sha256 ${digest} != declared ${lod.sha256}`);
}

const packageDirty = execFileSync(
  'git', ['status', '--porcelain', '--', PACKAGE_RELATIVE],
  { encoding: 'utf-8', cwd: root },
).trim().length > 0;
if (packageDirty) fail('candidate package paths have uncommitted changes; commit or restore them before receiving');

const TARGET_DIR = `${PACKAGE_RELATIVE}/v${version}`;
const RECEIPT_PATH = `artifacts/model-releases/xue-long-2-v${version}/receipt.json`;
const releaseFiles = ['manifest.json', ...lods.map((lod) => lod.file)];
const targetDir = path.join(root, TARGET_DIR);
const copied = [];
if (existsSync(targetDir)) {
  for (const file of releaseFiles) {
    const to = path.join(targetDir, file);
    if (!statSync(to, { throwIfNoEntry: false })?.isFile()) fail(`existing package incomplete: ${file}`);
    const digest = sha256(to);
    const declared = file === 'manifest.json' ? release.expectedManifestSha
      : lods.find((lod) => lod.file === file).sha256;
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
  packageId: 'xue-long-2',
  modelVersion: version,
  capturedAt,
  packageTreeDigest,
  sourceCommitAtCapture: head,
  packageDirty,
  sourceRelease: `3DModels:assets/xue_long_2/exports/v${version}`,
  manifestSha256: manifestSha,
  sourceBlendSha256: manifest.source_sha256,
  modelSideStatus: manifest.status,
  roles: Object.fromEntries(lods.map((lod) => [
    LOD_ROLE[lod.lod],
    { file: lod.file, sha256: lod.sha256, bytes: lod.bytes, lod: lod.lod },
  ])),
  copiedFiles: copied,
  integrity: 'source-and-destination-hashes-verified',
};
const receiptPath = path.join(root, RECEIPT_PATH);
mkdirSync(path.dirname(receiptPath), { recursive: true });
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

console.log(`received xue-long-2 v${version} (${copied.length - 1} GLBs + manifest)`);
console.log(`target: ${TARGET_DIR}`);
console.log(`receipt: ${RECEIPT_PATH} (sourceCommit ${head}, packageDirty ${packageDirty})`);
