#!/usr/bin/env node
/**
 * 接收 3DModels act-ship-release/1 的 ACT_RUNTIME_ONLY 包。
 *
 * 源目录必须含 release.json，并与 fleet-runtime-releases.json 的 manifestSha256 一致。
 * 复制 models/ 三档主舰（爱达无 LOD0 时用 LOD1/2/3）+ 可选 055 辅助 GLB + textures/。
 * GLB 图像 URI 为 ../textures/<sha>.png，不得只收 GLB。
 * 只保留当前激活版本；同 packageId 的旧目录与收据在接收成功后删除。
 * 服务回退只走 registry 单文件链，不保留旧版本化包。
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
const FLEET_RUNTIME_CATALOG = 'shared/export/fleet-runtime-releases.json';

const OTHER_ROLE_BY_FILE = {
  'type055-nanchang-101-collision.glb': 'collision',
  'type055-nanchang-101-weapon-payloads.glb': 'payload',
  'type055-nanchang-101-weapon-demo.glb': 'demo',
  'type055-nanchang-101-interactive-systems.glb': 'interactive-systems',
};

const CATALOG = {
  'xue-long-2': {
    sourceRel: 'assets/xue_long_2/exports/v1.0.1',
    expectedManifestSha256: 'a7be9f64a4254b58f0529e2a9044d5f348dfb06261fcec1c9f4566a92cd28153',
    posters: ['public/assets/icebreaker.png'],
  },
  'adora-magic-city': {
    sourceRel: 'assets/adora_magic_city/exports/v1.0.1',
    expectedManifestSha256: 'accabefd39060f5f2af2248f835380c28ed2379c3c7cf1b75f752cf2bdb7564a',
    posters: ['public/assets/luxury-liner.png'],
  },
  'msc-tessa': {
    sourceRel: 'assets/msc_tessa/exports/v1.1.1',
    expectedManifestSha256: 'ebfcda97940c9a12a6b4c5359b10534776550a2a481c34bd8c71c1eacc586328',
    posters: ['public/assets/container.png'],
  },
  'lng-changheng': {
    sourceRel: 'assets/lng_changheng/exports/v1.1.1',
    expectedManifestSha256: '03d57970f916b6f86e0362189f21decdcf68396c939262b86447f3bee4147332',
    posters: ['public/assets/Lng-carrier.png'],
  },
  'dredger-tianjing': {
    sourceRel: 'models/act-dredger-tianjing/exports/v1.1.1',
    expectedManifestSha256: 'c86bad48aca4d90ef7444e85622628a037a10c8d5345d84f1b3aac389052d606',
    posters: ['public/assets/dredger.png', 'public/assets/dredger-tianjing.png'],
  },
  'type055-nanchang-101': {
    sourceRel: 'assets/type_055_destroyer/exports/v2.2.1',
    expectedManifestSha256: '78b236851c5e59a62171ac3d7a616aeb79798eebcc420207811ffb667f959782',
    includeOtherGlbs: true,
    posters: ['public/assets/destroyer.png'],
  },
  'hysy-981': {
    sourceRel: 'models/hysy981-blender/exports/v1.1.1',
    expectedManifestSha256: 'cb54aa1124768777bccd38a67031ae32b0f77129e55e2bc4c338087f70949044',
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

function walkFiles(dir, prefix = '') {
  const names = readdirSync(dir).sort();
  const files = [];
  for (const name of names) {
    const rel = prefix ? `${prefix}/${name}` : name;
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) files.push(...walkFiles(full, rel));
    else files.push(rel);
  }
  return files;
}

function dirTreeDigest(dir) {
  const lines = walkFiles(dir).map((rel) => `${sha256(path.join(dir, rel))}  ${rel}`);
  return createHash('sha256').update(`${lines.join('\n')}\n`).digest('hex');
}

function retirePriorVersions(root, packageId, keepVersion) {
  const packageDir = path.join(root, 'public/assets/model-releases', packageId);
  if (existsSync(packageDir)) {
    for (const name of readdirSync(packageDir)) {
      if (!name.startsWith('v') || name === `v${keepVersion}`) continue;
      rmSync(path.join(packageDir, name), { recursive: true, force: true });
      console.log(`retired prior package dir: ${packageId}/${name}`);
    }
  }
  const artifactsDir = path.join(root, 'artifacts/model-releases');
  if (!existsSync(artifactsDir)) return;
  const keepReceipt = `${packageId}-v${keepVersion}`;
  for (const name of readdirSync(artifactsDir)) {
    if (!name.startsWith(`${packageId}-v`) || name === keepReceipt) continue;
    rmSync(path.join(artifactsDir, name), { recursive: true, force: true });
    console.log(`retired prior receipt: ${name}`);
  }
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

function assertFleetRuntimeCatalog(heroRoot, sourceRel, releaseSha) {
  const catalogPath = path.join(heroRoot, FLEET_RUNTIME_CATALOG);
  if (!statSync(catalogPath, { throwIfNoEntry: false })?.isFile()) {
    fail(`missing ${FLEET_RUNTIME_CATALOG}`);
  }
  const catalog = JSON.parse(readFileSync(catalogPath, 'utf8'));
  if (catalog.distribution !== 'ACT_RUNTIME_ONLY') {
    fail(`unexpected fleet catalog distribution ${catalog.distribution}`);
  }
  const entry = (catalog.releases ?? []).find((item) => item.path === sourceRel);
  if (!entry) fail(`${sourceRel} missing from fleet-runtime-releases.json`);
  if (entry.manifestSha256 !== releaseSha) {
    fail(`${sourceRel} catalog sha ${entry.manifestSha256} != ${releaseSha}`);
  }
}

function copyPoster(from, dest) {
  mkdirSync(path.dirname(dest), { recursive: true });
  if (from.endsWith('.webp') && dest.endsWith('.png')) {
    execFileSync('sips', ['-s', 'format', 'png', from, '--out', dest], { stdio: 'pipe' });
    if (!statSync(dest, { throwIfNoEntry: false })?.isFile() || statSync(dest).size <= 0) {
      fail(`poster convert failed ${dest}`);
    }
    return;
  }
  cpSync(from, dest);
  if (sha256(dest) !== sha256(from)) fail(`poster copy drift ${dest}`);
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
  assertFleetRuntimeCatalog(heroRoot, spec.sourceRel, releaseSha);
  const release = JSON.parse(readFileSync(releasePath, 'utf8'));
  if (release.schema !== 'act-ship-release/1') fail(`${packageId} unexpected schema ${release.schema}`);
  if (release.distribution !== 'ACT_RUNTIME_ONLY') {
    fail(`${packageId} unexpected distribution ${release.distribution}`);
  }
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
    to: `models/${packageId}-ship-lod${index}.glb`,
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
        to: `models/${base}`,
        sha256: sha256(from),
        bytes: statSync(from).size,
        kind: role,
        lod: null,
      });
    }
  }

  for (const texture of release.textures ?? []) {
    if (!/^textures\/[0-9a-f]{64}\.png$/.test(texture.file)) {
      fail(`unexpected texture path ${texture.file}`);
    }
    planned.push({
      role: `texture:${texture.sha256}`,
      from: texture.file,
      to: texture.file,
      sha256: texture.sha256,
      bytes: texture.bytes,
      kind: 'texture',
      lod: null,
    });
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
        mkdirSync(path.dirname(to), { recursive: true });
        cpSync(from, to);
        const after = sha256(to);
        if (after !== file.digest || statSync(to).size !== file.bytes) fail(`copy drift on ${file.to}`);
        copied.push({ file: file.to, sha256: after, bytes: file.bytes, role: file.role, kind: file.kind, lod: file.lod });
      }
      const roles = copied.filter((item) => item.kind !== 'texture');
      const textures = copied.filter((item) => item.kind === 'texture');
      const manifest = {
        schema: 'act-fleet-model-release/1',
        packageId,
        modelVersion,
        distribution: 'ACT_RUNTIME_ONLY',
        sourceRelease: `3DModels:${spec.sourceRel}`,
        sourceCommit: release.source?.commit ?? null,
        upstreamReleaseSha256: releaseSha,
        modelToSceneMatrix: release.coordinates.modelToSceneMatrix,
        coordinateBasis: {
          forward: release.coordinates.modelAxes.bow,
          up: release.coordinates.modelAxes.up,
        },
        artifacts: Object.fromEntries(roles.map((item) => [item.role, {
          file: item.file,
          sha256: item.sha256,
          bytes: item.bytes,
          kind: item.kind,
          lod: item.lod,
        }])),
        textures: textures.map((item) => ({
          file: item.file,
          sha256: item.sha256,
          bytes: item.bytes,
        })),
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
      copyPoster(heroFrom, path.join(root, poster));
    }
  }

  const manifestPath = path.join(targetDir, 'manifest.json');
  const manifestSha = sha256(manifestPath);
  const roles = copied.filter((item) => item.kind !== 'texture');
  const textures = copied.filter((item) => item.kind === 'texture');
  const receipt = {
    schema: 'act-model-release-receipt/1',
    packageId,
    modelVersion,
    capturedAt: new Date().toISOString(),
    packageTreeDigest: dirTreeDigest(targetDir),
    sourceCommitAtCapture: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf-8', cwd: root }).trim(),
    packageDirty,
    sourceRelease: `3DModels:${spec.sourceRel}`,
    upstreamReleaseSha256: releaseSha,
    manifestSha256: manifestSha,
    sourceBlendSha256: release.source?.checksumSha256 || release.source?.releaseSha256 || '',
    modelToSceneMatrix: release.coordinates.modelToSceneMatrix,
    roles: Object.fromEntries(roles.map((item) => [item.role, {
      file: item.file,
      sha256: item.sha256,
      bytes: item.bytes,
      kind: item.kind,
      lod: item.lod,
    }])),
    textures: textures.map((item) => ({
      file: item.file,
      sha256: item.sha256,
      bytes: item.bytes,
    })),
    copiedFiles: copied,
    integrity: 'source-and-destination-hashes-verified',
  };
  const receiptPath = path.join(root, `artifacts/model-releases/${packageId}-v${modelVersion}/receipt.json`);
  mkdirSync(path.dirname(receiptPath), { recursive: true });
  writeFileSync(receiptPath, `${JSON.stringify(receipt, null, 2)}\n`);
  retirePriorVersions(root, packageId, modelVersion);
  console.log(`received ${packageId} v${modelVersion} (${roles.length} models + ${textures.length} textures + manifest)`);
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
