#!/usr/bin/env node
/**
 * 接收 3DModels act-ship-release/1 整合包（主舰三档 LOD + 可选 055 辅助 GLB）。
 *
 * 源目录必须含 release.json。SHA 与 fleet-hero-releases.json / release.models.lods 不一致则拒绝。
 * 旧版本目录不覆盖。
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

const DEFAULT_HERO_ROOT = '/Users/YW/.codex/worktrees/8440/3DModels';

const OTHER_ROLE_BY_FILE = {
  'type055-nanchang-101-collision.glb': 'collision',
  'type055-nanchang-101-weapon-payloads.glb': 'payload',
  'type055-nanchang-101-weapon-demo.glb': 'demo',
  'type055-nanchang-101-interactive-systems.glb': 'interactive-systems',
};

const CATALOG = {
  'xue-long-2': {
    sourceRel: 'assets/xue_long_2/exports/v1.0.0',
    expectedManifestSha256: '75a83f4ab05e7c535fd7e341529e84e94d9a5de039585e88d2893eba6db90a96',
    posters: ['public/assets/icebreaker.png'],
  },
  'adora-magic-city': {
    sourceRel: 'assets/adora_magic_city/exports/v1.0.0',
    expectedManifestSha256: '473c8e50d23ae21c11af75a71cb55fc03ea7f6f571acefb92f418070ed80dc19',
    posters: ['public/assets/luxury-liner.png'],
  },
  'msc-tessa': {
    sourceRel: 'assets/msc_tessa/exports/v1.1.0',
    expectedManifestSha256: '85363a4f28059ac255e9ae86446563effd6246a687582d0541f872d00bba1f32',
    posters: ['public/assets/container.png'],
  },
  'lng-changheng': {
    sourceRel: 'assets/lng_changheng/exports/v1.1.0',
    expectedManifestSha256: '607e23ed4bd55051ea5a496bbabd69a28b58153ed6c99f6595536c01f359f869',
    posters: ['public/assets/Lng-carrier.png'],
  },
  'dredger-tianjing': {
    sourceRel: 'models/act-dredger-tianjing/exports/v1.1.0',
    expectedManifestSha256: '6349f951ec380d68939817e78b02644a3095b4371414c9f905478dc03ffe8e35',
    posters: ['public/assets/dredger.png', 'public/assets/dredger-tianjing.png'],
  },
  'type055-nanchang-101': {
    sourceRel: 'assets/type_055_destroyer/exports/v2.2.0',
    expectedManifestSha256: 'eafce990f09757d4631305516bb80f8a5d95a920b1321c375c446dc117aaac83',
    includeOtherGlbs: true,
    posters: ['public/assets/destroyer.png'],
  },
  'hysy-981': {
    sourceRel: 'models/hysy981-blender/exports/v1.1.0',
    expectedManifestSha256: '4021d91a3b8bcd98dcb6d3e144c09c3dc0d41f323c5bc7113a7a8a5bcec9f1cc',
    posters: ['public/assets/drilling-rig.png'],
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
    const full = path.join(dir, file);
    if (!statSync(full).isFile()) return null;
    const blob = execFileSync('git', ['hash-object', '-w', full], {
      encoding: 'utf-8',
      cwd: root,
    }).trim();
    return `100644 blob ${blob}\t${file}`;
  }).filter(Boolean);
  return execFileSync('git', ['mktree'], {
    input: `${entries.join('\n')}\n`,
    cwd: root,
    encoding: 'utf-8',
  }).trim();
}

function pickShipLods(lods) {
  const byId = Object.fromEntries(lods.map((lod) => [lod.id, lod]));
  if (byId.LOD0 && byId.LOD1 && byId.LOD2) return [byId.LOD0, byId.LOD1, byId.LOD2];
  if (byId.LOD1 && byId.LOD2 && byId.LOD3) return [byId.LOD1, byId.LOD2, byId.LOD3];
  fail(`cannot map three ship LODs from ${lods.map((lod) => lod.id).join(',')}`);
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
  const rootEq = argv.find((arg) => arg.startsWith('--hero-root='));
  const rootIdx = argv.indexOf('--hero-root');
  const heroRoot = rootEq ? rootEq.slice('--hero-root='.length)
    : rootIdx >= 0 ? argv[rootIdx + 1]
    : process.env.ACT_3DMODELS_HERO_ROOT || DEFAULT_HERO_ROOT;
  return { all, packageId, sourceDir, heroRoot };
}

function receivePackage(packageId, heroRoot, sourceOverride) {
  const spec = CATALOG[packageId];
  if (!spec) fail(`unknown package ${packageId}`);
  const sourceDir = sourceOverride || path.join(heroRoot, spec.sourceRel);
  const releasePath = path.join(sourceDir, 'release.json');
  if (!statSync(releasePath, { throwIfNoEntry: false })?.isFile()) {
    fail(`missing release.json in ${sourceDir}`);
  }
  const releaseSha = sha256(releasePath);
  if (releaseSha !== spec.expectedManifestSha256) {
    fail(`${packageId} release.json sha256 ${releaseSha} != ${spec.expectedManifestSha256}`);
  }
  const release = JSON.parse(readFileSync(releasePath, 'utf8'));
  if (release.schema !== 'act-ship-release/1') fail(`${packageId} unexpected schema ${release.schema}`);
  const shipLods = pickShipLods(release.models.lods);
  const modelVersion = release.version;
  const root = repoRoot();
  const packageRelative = `public/assets/model-releases/${packageId}`;
  const targetRelative = `${packageRelative}/v${modelVersion}`;
  const packageDirty = execFileSync(
    'git', ['status', '--porcelain', '--', targetRelative],
    { encoding: 'utf-8', cwd: root },
  ).trim().length > 0;
  if (packageDirty) fail(`${packageId} v${modelVersion} candidate paths have uncommitted changes`);

  const planned = shipLods.map((lod, index) => ({
    role: `ship-lod${index}`,
    from: lod.file,
    to: `${packageId}-ship-lod${index}.glb`,
    sha256: lod.sha256,
    bytes: lod.bytes,
    kind: 'ship',
    lod: index,
  }));

  if (spec.includeOtherGlbs) {
    for (const rel of release.models.otherGlbs ?? []) {
      const base = path.basename(rel);
      const role = OTHER_ROLE_BY_FILE[base];
      if (!role) continue;
      const from = path.join(sourceDir, rel);
      if (!statSync(from, { throwIfNoEntry: false })?.isFile()) fail(`missing other glb ${rel}`);
      planned.push({
        role,
        from: rel,
        to: base,
        sha256: sha256(from),
        bytes: statSync(from).size,
        kind: role,
        lod: null,
      });
    }
  }

  const verified = [];
  for (const file of planned) {
    const from = path.join(sourceDir, file.from);
    if (!statSync(from, { throwIfNoEntry: false })?.isFile()) fail(`missing artifact ${file.from}`);
    const digest = sha256(from);
    if (digest !== file.sha256) fail(`${file.from} sha256 ${digest} != ${file.sha256}`);
    const bytes = statSync(from).size;
    if (file.bytes != null && bytes !== file.bytes) fail(`${file.from} bytes ${bytes} != ${file.bytes}`);
    verified.push({ ...file, bytes, digest });
  }

  const targetDir = path.join(root, targetRelative);
  const copied = [];
  if (existsSync(targetDir)) {
    for (const file of verified) {
      const to = path.join(targetDir, file.to);
      if (!statSync(to, { throwIfNoEntry: false })?.isFile()) fail(`existing package incomplete: ${file.to}`);
      const digest = sha256(to);
      if (digest !== file.digest || statSync(to).size !== file.bytes) {
        fail(`existing package drifted: ${file.to}`);
      }
      copied.push({ file: file.to, sha256: digest, bytes: file.bytes, role: file.role, kind: file.kind, lod: file.lod });
    }
    console.log(`identical package already received: ${packageId} v${modelVersion} (no-op)`);
  } else {
    const stagingDir = path.join(root, packageRelative, `.staging-v${modelVersion}-${process.pid}-${Date.now()}`);
    rmSync(stagingDir, { recursive: true, force: true });
    mkdirSync(stagingDir, { recursive: true });
    try {
      for (const file of verified) {
        const from = path.join(sourceDir, file.from);
        const to = path.join(stagingDir, file.to);
        cpSync(from, to);
        const after = sha256(to);
        if (after !== file.digest || statSync(to).size !== file.bytes) fail(`copy drift on ${file.to}`);
        copied.push({ file: file.to, sha256: after, bytes: file.bytes, role: file.role, kind: file.kind, lod: file.lod });
      }
      const manifest = {
        schema: 'act-fleet-model-release/1',
        packageId,
        modelVersion,
        sourceRelease: `3DModels:${spec.sourceRel}`,
        sourceCommit: release.source?.commit ?? null,
        upstreamReleaseSha256: releaseSha,
        modelToSceneMatrix: release.coordinates.modelToSceneMatrix,
        coordinateBasis: {
          forward: release.coordinates.modelAxes.bow,
          up: release.coordinates.modelAxes.up,
        },
        artifacts: Object.fromEntries(copied.map((item) => [item.role, {
          file: item.file,
          sha256: item.sha256,
          bytes: item.bytes,
          kind: item.kind,
          lod: item.lod,
        }])),
      };
      writeFileSync(path.join(stagingDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
      mkdirSync(path.dirname(targetDir), { recursive: true });
      renameSync(stagingDir, targetDir);
    } finally {
      rmSync(stagingDir, { recursive: true, force: true });
    }
  }

  const heroRel = release.hero?.image;
  if (heroRel) {
    const heroFrom = path.join(sourceDir, heroRel);
    if (!statSync(heroFrom, { throwIfNoEntry: false })?.isFile()) fail(`missing hero image ${heroRel}`);
    for (const poster of spec.posters) {
      const dest = path.join(root, poster);
      mkdirSync(path.dirname(dest), { recursive: true });
      cpSync(heroFrom, dest);
      if (sha256(dest) !== sha256(heroFrom)) fail(`poster copy drift ${poster}`);
    }
  }

  const manifestPath = path.join(targetDir, 'manifest.json');
  const manifestSha = sha256(manifestPath);
  const receipt = {
    schema: 'act-model-release-receipt/1',
    packageId,
    modelVersion,
    capturedAt: new Date().toISOString(),
    packageTreeDigest: dirTreeDigest(root, targetDir),
    sourceCommitAtCapture: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8', cwd: root }).trim(),
    packageDirty,
    sourceRelease: `3DModels:${spec.sourceRel}`,
    upstreamReleaseSha256: releaseSha,
    manifestSha256: manifestSha,
    sourceBlendSha256: release.source?.checksumSha256 ?? '',
    modelToSceneMatrix: release.coordinates.modelToSceneMatrix,
    roles: Object.fromEntries(copied.map((item) => [item.role, {
      file: item.file,
      sha256: item.sha256,
      bytes: item.bytes,
      kind: item.kind,
      lod: item.lod,
    }])),
    copiedFiles: copied,
    integrity: 'source-and-destination-hashes-verified',
  };
  const receiptPath = path.join(root, `artifacts/model-releases/${packageId}-v${modelVersion}/receipt.json`);
  mkdirSync(path.dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  console.log(`received ${packageId} v${modelVersion} (${copied.length} files + manifest)`);
  console.log(`target: ${targetRelative}`);
  console.log(`manifestSha256: ${manifestSha}`);
}

const { all, packageId, sourceDir, heroRoot } = parseArgs(process.argv.slice(2));
if (all) {
  for (const id of Object.keys(CATALOG)) receivePackage(id, heroRoot);
} else if (packageId) {
  receivePackage(packageId, heroRoot, sourceDir);
} else {
  fail('usage: --package <id> | --all [--hero-root <3DModels>]');
}
