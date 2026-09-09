#!/usr/bin/env node
/**
 * 接收 3DModels 船队版本化发布包（LOD 三档 GLB）。
 *
 * 失败优先：源文件缺失、SHA-256 不符、复制后字节不一致、或目标目录有未提交变更，
 * 都拒绝整个包。目标目录先在暂存目录完成全部校验，再原子重命名替换。
 *
 * 用法：
 *   node scripts/models/receive-fleet-model-release.mjs --package <id>
 *   node scripts/models/receive-fleet-model-release.mjs --package <id> --source <dir>
 *   node scripts/models/receive-fleet-model-release.mjs --all
 */

import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  cpSync,
  existsSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import path from 'node:path';

const CATALOG = {
  'lng-changheng': {
    modelVersion: '1.0.0',
    sourceBlendSha256: '0e6ed33706be52ad0b95b5563ac27a8e0715d6a7db5095dfd039648635c5e2a0',
    sourceRelease: '3DModels:assets/lng_changheng/exports/v1.0.0',
    defaultSource: '/Users/YW/Documents/Project/3DModels/assets/lng_changheng/exports/v1.0.0',
    files: [
      { role: 'ship-lod0', from: 'act-forward/LNG-Changheng-LOD0.glb', to: 'lng-changheng-ship-lod0.glb', sha256: '6a698d8c90b413c2c59896275f8519e37e4aaa191c610fa5031363340980c4ed' },
      { role: 'ship-lod1', from: 'act-forward/LNG-Changheng-LOD1.glb', to: 'lng-changheng-ship-lod1.glb', sha256: '3fea6c0ec482bc1ed1e355e3568e4aef279f3799f5b1d1ecca0e41ca632492b0' },
      { role: 'ship-lod2', from: 'act-forward/LNG-Changheng-LOD2.glb', to: 'lng-changheng-ship-lod2.glb', sha256: '9b69a101051457fe935859ff964dcd054175a8af30d758d38310dca85b6c3cec' },
    ],
  },
  'msc-tessa': {
    modelVersion: '1.0.0',
    sourceBlendSha256: '4071f36ddc02b2c365dcdc12a122151ccf8662da6b0a3b9f21bb213ed9bdb579',
    sourceRelease: '3DModels:assets/msc_tessa/exports/v1.0.0',
    defaultSource: '/Users/YW/Documents/Project/3DModels/assets/msc_tessa/exports/v1.0.0',
    files: [
      { role: 'ship-lod0', from: 'act-forward/MSC-Tessa-LOD0.glb', to: 'msc-tessa-ship-lod0.glb', sha256: '75fdbb9a3f5bf886e0ddeff3ce8e21eb50be3cdd1531cd05c422387c6a33fe83' },
      { role: 'ship-lod1', from: 'act-forward/MSC-Tessa-LOD1.glb', to: 'msc-tessa-ship-lod1.glb', sha256: '4630058368a82f8bea33c7dfdf137b98d72f48fc18ad94ad45627a97499a6256' },
      { role: 'ship-lod2', from: 'act-forward/MSC-Tessa-LOD2.glb', to: 'msc-tessa-ship-lod2.glb', sha256: 'd7c4e30f1b952d72f068c0adf36ff23ea2ff28ff19379ec03c3ddb2c6f3f02b8' },
    ],
  },
  'xue-long-2': {
    modelVersion: '0.1.1',
    sourceBlendSha256: '779376d5f1b62995868899e60e53e3536de55ea8482b5f6b26048502a6bf4d0f',
    sourceRelease: '3DModels:assets/xue_long_2/exports/v0.1.1',
    defaultSource: '/Users/YW/Documents/Project/3DModels/assets/xue_long_2/exports/v0.1.1',
    files: [
      { role: 'ship-lod0', from: 'XueLong2-LOD0.glb', to: 'xue-long-2-ship-lod0.glb', sha256: '6b4a1aa6d2ae2dde7506edf95fbd0e08dc8505d3fd086a30ec45e6bef140bf70' },
      { role: 'ship-lod1', from: 'XueLong2-LOD1.glb', to: 'xue-long-2-ship-lod1.glb', sha256: '37b78aec28c04ecd917b73462b577f488f5aa8abbce9d57399293547e09214b2' },
      { role: 'ship-lod2', from: 'XueLong2-LOD2.glb', to: 'xue-long-2-ship-lod2.glb', sha256: '9094b6fe267d661ec07e41b05ecb4fa1f26778aa6ff2d00f0d3444020f64803e' },
    ],
  },
  'adora-magic-city': {
    modelVersion: '0.1.0',
    sourceBlendSha256: '5b0e8009facc8bd19f425b3594de9ef9dc975daaad86acc80c9405000b309974',
    sourceRelease: '3DModels:assets/adora_magic_city/exports/v0.1.0',
    defaultSource: '/Users/YW/Documents/Project/3DModels/assets/adora_magic_city/exports/v0.1.0',
    files: [
      { role: 'ship-lod0', from: 'adora-magic-city-h1508-lod1.glb', to: 'adora-magic-city-ship-lod0.glb', sha256: '7b78d9b528bb7eac3fd122cd56335e7c1d02df40799b0beae940055a045f1353' },
      { role: 'ship-lod1', from: 'adora-magic-city-h1508-lod2.glb', to: 'adora-magic-city-ship-lod1.glb', sha256: '56e169d8cd99906749780ef9f3c08763ca184980a787a49efd7dfb6a4de2877f' },
      { role: 'ship-lod2', from: 'adora-magic-city-h1508-lod3.glb', to: 'adora-magic-city-ship-lod2.glb', sha256: '251f207f51d5dfc412757d4ef408acd8e8b29c465fba30d9d6eee36fbdf48c65' },
    ],
  },
  'hysy-981': {
    modelVersion: '1.0.2',
    sourceBlendSha256: '5bb9e091771e26545b258067b566fe0f846ba4b5724b883b7cd999b879f2005d',
    sourceRelease: '3DModels:github-release:HYSY981-ACT-v1.0.2',
    defaultSource: '/tmp/hysy981-act-v102/extracted/HYSY981-ACT-v1.0.2',
    files: [
      { role: 'ship-lod0', from: 'act-forward/HYSY981-LOD0.glb', to: 'hysy-981-ship-lod0.glb', sha256: '8ed0b4f80003cba606f0451abcd5d28cfbf8fafacf544f5881fdb6c17e77c02a' },
      { role: 'ship-lod1', from: 'act-forward/HYSY981-LOD1.glb', to: 'hysy-981-ship-lod1.glb', sha256: 'db77a653373bbdb1be40094e8ebc4a054675c8d2c3e9130b2ac9a5e7ab1e2f25' },
      { role: 'ship-lod2', from: 'act-forward/HYSY981-LOD2.glb', to: 'hysy-981-ship-lod2.glb', sha256: 'c9c3073ab15c3c59913f9627aadc03c055c5a430b1ba06d61b3f86ec014ce5a7' },
    ],
  },
  'dredger-tianjing': {
    modelVersion: '1.0.1',
    sourceBlendSha256: 'a3aacd0275c5f50ea7eefe1900f76c66a7ff769ec1fb6a22a9b5efff6f3aa455',
    sourceRelease: '3DModels:models/act-dredger-tianjing/exports/v1.0.1',
    defaultSource: '/Users/YW/Documents/Project/3DModels/models/act-dredger-tianjing/exports/v1.0.1',
    files: [
      { role: 'ship-lod0', from: 'act-forward/Tianjing-LOD0.glb', to: 'dredger-tianjing-ship-lod0.glb', sha256: '0fa10a9faad7e38e549c1793bbdf217a41fb1cfd36c2960685bf194735927c5e' },
      { role: 'ship-lod1', from: 'act-forward/Tianjing-LOD1.glb', to: 'dredger-tianjing-ship-lod1.glb', sha256: '16d9535981195e85ee44a74f9c0fe4ff41eb89f7c80be9cc6c8a5d12a273c18c' },
      { role: 'ship-lod2', from: 'act-forward/Tianjing-LOD2.glb', to: 'dredger-tianjing-ship-lod2.glb', sha256: '82c022a23cceeb2d5dd63bffd65846b6ac538ff7ef910c3b3c5ce8b35e1b8509' },
    ],
  },
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

function dirTreeDigest(root, dir) {
  const entries = readdirSync(dir).sort().map((file) => {
    const blob = execFileSync('git', ['hash-object', '-w', path.join(dir, file)], {
      encoding: 'utf-8',
      cwd: root,
    }).trim();
    return `100644 blob ${blob}\t${file}`;
  });
  return execFileSync('git', ['mktree'], {
    input: `${entries.join('\n')}\n`,
    cwd: root,
    encoding: 'utf-8',
  }).trim();
}

function parseArgs(argv) {
  const all = argv.includes('--all');
  const pkgEq = argv.find((arg) => arg.startsWith('--package='));
  const pkgIdx = argv.indexOf('--package');
  const packageId = pkgEq ? pkgEq.slice('--package='.length)
    : pkgIdx >= 0 ? argv[pkgIdx + 1]
    : null;
  const sourceEq = argv.find((arg) => arg.startsWith('--source='));
  const sourceIdx = argv.indexOf('--source');
  const sourceDir = sourceEq ? sourceEq.slice('--source='.length)
    : sourceIdx >= 0 ? argv[sourceIdx + 1]
    : null;
  return { all, packageId, sourceDir };
}

function receivePackage(packageId, sourceOverride) {
  const spec = CATALOG[packageId];
  if (!spec) fail(`unknown package ${packageId}`);
  const sourceDir = sourceOverride || spec.defaultSource;
  if (!sourceDir || !existsSync(sourceDir)) fail(`source release directory not found: ${sourceDir || '(missing --source value)'}`);

  const files = spec.files;
  if (files.length !== 3) fail(`${packageId} must declare exactly three ship LOD files`);

  const root = repoRoot();
  const packageRelative = `public/assets/model-releases/${packageId}`;
  const targetRelative = `${packageRelative}/v${spec.modelVersion}`;
  const packageDirty = execFileSync(
    'git', ['status', '--porcelain', '--', targetRelative],
    { encoding: 'utf-8', cwd: root },
  ).trim().length > 0;
  if (packageDirty) fail(`${packageId} v${spec.modelVersion} candidate package paths have uncommitted changes; commit or restore them before receiving`);

  const verified = [];
  for (const file of files) {
    const from = path.join(sourceDir, file.from);
    if (!statSync(from, { throwIfNoEntry: false })?.isFile()) fail(`missing artifact ${file.from}`);
    const digest = sha256(from);
    if (digest !== file.sha256) fail(`${file.from} sha256 ${digest} != expected ${file.sha256}`);
    verified.push({ ...file, bytes: statSync(from).size, digest });
  }

  const targetDir = path.join(root, packageRelative, `v${spec.modelVersion}`);
  const copied = [];
  if (existsSync(targetDir)) {
    for (const file of verified) {
      const to = path.join(targetDir, file.to);
      if (!statSync(to, { throwIfNoEntry: false })?.isFile()) fail(`existing package incomplete: ${file.to}`);
      const digest = sha256(to);
      if (digest !== file.digest || statSync(to).size !== file.bytes) {
        fail(`existing package drifted from the release identity: ${file.to}`);
      }
      copied.push({ file: file.to, sha256: digest, bytes: file.bytes, role: file.role });
    }
    const existingManifest = path.join(targetDir, 'manifest.json');
    if (!statSync(existingManifest, { throwIfNoEntry: false })?.isFile()) {
      fail('existing package missing manifest.json');
    }
    console.log(`identical package already received: ${packageId} v${spec.modelVersion} (no-op)`);
  } else {
    const stagingDir = path.join(root, packageRelative, `.staging-v${spec.modelVersion}-${process.pid}-${Date.now()}`);
    rmSync(stagingDir, { recursive: true, force: true });
    mkdirSync(stagingDir, { recursive: true });
    try {
      for (const file of verified) {
        const from = path.join(sourceDir, file.from);
        const to = path.join(stagingDir, file.to);
        cpSync(from, to);
        const after = sha256(to);
        if (after !== file.digest || statSync(to).size !== file.bytes) fail(`copy drift on ${file.to}`);
        copied.push({ file: file.to, sha256: after, bytes: file.bytes, role: file.role });
      }
      const manifest = {
        schema: 'act-fleet-model-release/1',
        packageId,
        modelVersion: spec.modelVersion,
        sourceRelease: spec.sourceRelease,
        sourceBlendSha256: spec.sourceBlendSha256,
        artifacts: Object.fromEntries(copied.map((item) => [item.role, {
          file: item.file,
          sha256: item.sha256,
          bytes: item.bytes,
          kind: 'ship',
          lod: Number(item.role.replace('ship-lod', '')),
        }])),
      };
      const manifestBody = `${JSON.stringify(manifest, null, 2)}\n`;
      writeFileSync(path.join(stagingDir, 'manifest.json'), manifestBody);
      mkdirSync(path.dirname(targetDir), { recursive: true });
      renameSync(stagingDir, targetDir);
    } finally {
      rmSync(stagingDir, { recursive: true, force: true });
    }
  }

  const manifestPath = path.join(targetDir, 'manifest.json');
  const manifestSha = sha256(manifestPath);
  const capturedAt = new Date().toISOString();
  const head = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8', cwd: root }).trim();
  const packageTreeDigest = dirTreeDigest(root, targetDir);
  const receipt = {
    schema: 'act-model-release-receipt/1',
    packageId,
    modelVersion: spec.modelVersion,
    capturedAt,
    packageTreeDigest,
    sourceCommitAtCapture: head,
    packageDirty,
    sourceRelease: spec.sourceRelease,
    manifestSha256: manifestSha,
    sourceBlendSha256: spec.sourceBlendSha256,
    roles: Object.fromEntries(copied.map((item) => [item.role, {
      file: item.file,
      sha256: item.sha256,
      bytes: item.bytes,
      kind: 'ship',
      lod: Number(item.role.replace('ship-lod', '')),
    }])),
    copiedFiles: copied,
    integrity: 'source-and-destination-hashes-verified',
  };
  const receiptPath = path.join(root, `artifacts/model-releases/${packageId}-v${spec.modelVersion}/receipt.json`);
  mkdirSync(path.dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(`received ${packageId} v${spec.modelVersion} (${copied.length} GLBs + manifest)`);
  console.log(`target: public/assets/model-releases/${packageId}/v${spec.modelVersion}`);
  console.log(`manifestSha256: ${manifestSha}`);
  console.log(`receipt: artifacts/model-releases/${packageId}-v${spec.modelVersion}/receipt.json`);
}

const argv = process.argv.slice(2);
const { all, packageId, sourceDir } = parseArgs(argv);
if (all) {
  for (const id of Object.keys(CATALOG)) {
    receivePackage(id, id === 'hysy-981' ? sourceDir : undefined);
  }
} else if (packageId) {
  receivePackage(packageId, sourceDir);
} else {
  fail('usage: --package <id> | --all');
}
