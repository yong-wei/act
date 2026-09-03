#!/usr/bin/env node
/**
 * 接收 3DModels 的 type055-nanchang-101 v2.0.0 版本化模型发布包。
 *
 * 失败优先：源目录 manifest/六文件任一缺失、SHA-256 或大小与 manifest 声明不符、
 * 角色重复、复制后字节不一致，都拒绝整个包（不登记部分通过的子集）。
 *
 * 用法：
 *   node scripts/models/receive-type055-nanchang-101-v2.mjs --source <3DModels>/assets/type_055_destroyer/exports/v2.0.0
 *
 * 输出：
 *   public/assets/model-releases/type055-nanchang-101/v2.0.0/<七文件>
 *   artifacts/model-releases/type055-nanchang-101-v2.0.0/receipt.json（接收收据）
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { cpSync, mkdirSync, readFileSync, statSync, writeFileSync, rmSync } from 'node:fs';
import path from 'node:path';

const ROLES = ['ship_lod0', 'ship_lod1', 'ship_lod2', 'collision', 'payload', 'demo'];
const TARGET_DIR = 'public/assets/model-releases/type055-nanchang-101/v2.0.0';
const RECEIPT_PATH = 'artifacts/model-releases/type055-nanchang-101-v2.0.0/receipt.json';

function fail(message) {
  console.error(`receive rejected: ${message}`);
  process.exit(1);
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function repoRoot() {
  const root = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf-8' }).trim();
  return root;
}

const sourceArg = process.argv.find((arg) => arg.startsWith('--source='));
const sourceDir = sourceArg ? sourceArg.slice('--source='.length)
  : '/Users/YW/Documents/Project/3DModels/assets/type_055_destroyer/exports/v2.0.0';
const root = repoRoot();

// 1. 读取并核验源 manifest 身份
const manifestPath = path.join(sourceDir, 'manifest.json');
const manifestSha = sha256(manifestPath);
let manifest;
try {
  manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
} catch (error) {
  fail(`unreadable manifest: ${error.message}`);
}
if (manifest.schema !== 'type055-versioned-model-release/1') fail(`unexpected schema ${manifest.schema}`);
if (manifest.ship_id !== 'type_055_destroyer_101_nanchang') fail(`unexpected ship_id ${manifest.ship_id}`);
if (manifest.model_version !== '2.0.0') fail(`unexpected model_version ${manifest.model_version}`);
if (manifest.validation?.status !== 'PASS') fail('model-side validation is not PASS');

// proposal（issue #1898）锁定的发布 manifest 与源 .blend 身份
const EXPECTED_MANIFEST_SHA = '5901a821f7f955d4cafb0cd7c40420df506e24914de4abfa12678c7643f594b6';
const EXPECTED_SOURCE_BLEND_SHA = 'c8a82074fefc4d935d5714f78fafc18df5bf48662774a0a30f78714f435d6357';
if (manifestSha !== EXPECTED_MANIFEST_SHA) fail(`manifest sha256 ${manifestSha} != expected`);
if (manifest.source.sha256 !== EXPECTED_SOURCE_BLEND_SHA) fail('source .blend sha256 does not match the accepted release');

// 2. 六角色完整分母核验（角色重复 / 缺文件 / 哈希 / 大小）
const seenFiles = new Set();
for (const role of ROLES) {
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
const shipLods = ROLES.filter((role) => manifest.artifacts[role].kind === 'ship');
if (shipLods.length !== 3 || new Set(shipLods.map((role) => manifest.artifacts[role].lod)).size !== 3) {
  fail('expected three ship roles with distinct LOD indices');
}
const nonShipKinds = ROLES.filter((role) => manifest.artifacts[role].kind !== 'ship')
  .map((role) => manifest.artifacts[role].kind);
if (new Set(nonShipKinds).size !== nonShipKinds.length) fail(`non-ship role kinds collapsed: ${nonShipKinds.join(',')}`);

// 3. 复制到 ACT 版本化候选目录（manifest + 六文件；校验和与验证报告留在源侧）
const targetDir = path.join(root, TARGET_DIR);
rmSync(targetDir, { recursive: true, force: true });
mkdirSync(targetDir, { recursive: true });
const copied = [];
for (const file of ['manifest.json', ...ROLES.map((role) => manifest.artifacts[role].file)]) {
  const from = path.join(sourceDir, file);
  const to = path.join(targetDir, file);
  cpSync(from, to);
  // 复制前后字节一致：以哈希 + 大小复核目标文件
  const before = sha256(from);
  const after = sha256(to);
  if (before !== after || statSync(to).size !== statSync(from).size) fail(`copy drift on ${file}`);
  copied.push({ file, sha256: after, bytes: statSync(to).size });
}

// 4. 写接收收据（绑定源身份、逐文件哈希与复制核验）
const capturedAt = new Date().toISOString();
const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8', cwd: root }).trim();
const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf-8', cwd: root }).trim().length > 0;
const receipt = {
  schema: 'act-model-release-receipt/1',
  packageId: 'type055-nanchang-101',
  modelVersion: '2.0.0',
  capturedAt,
  sourceCommit: head,
  dirty,
  sourceDirectory: sourceDir,
  manifestSha256: manifestSha,
  sourceBlendSha256: manifest.source.sha256,
  modelSideValidation: manifest.validation.status,
  roles: Object.fromEntries(ROLES.map((role) => {
    const artifact = manifest.artifacts[role];
    // ACT 侧描述符的 role 键（连字符风格）与 manifest 角色名（下划线）的映射
    const actRole = { ship_lod0: 'ship-lod0', ship_lod1: 'ship-lod1', ship_lod2: 'ship-lod2' }[role] ?? role;
    return [actRole, { file: artifact.file, sha256: artifact.sha256, bytes: artifact.bytes, kind: artifact.kind, lod: artifact.lod ?? null }];
  })),
  copiedFiles: copied,
  integrity: 'source-and-destination-hashes-verified',
};
const receiptPath = path.join(root, RECEIPT_PATH);
mkdirSync(path.dirname(receiptPath), { recursive: true });
writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);

console.log(`received type055-nanchang-101 v2.0.0 (${copied.length - 1} GLBs + manifest)`);
console.log(`target: ${TARGET_DIR}`);
console.log(`receipt: ${RECEIPT_PATH}`);
