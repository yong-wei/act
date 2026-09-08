import { execSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  validateModelPackageInterface,
  validateReceivedModelPackage,
  parseGlbJsonChunk,
  type ModelPackageFileIo,
} from '../model-packages/model-package-validation';
import { propulsorSceneAnchors, shipLodUrlForQualityTier } from '../model-packages/model-interface';
import {
  XUE_LONG_2_V0,
  XUE_LONG_2_BASIS_YAW_RAD,
  matchActivatedXueLong2Package,
} from '../model-packages/xue-long-2-v0';
import { resolveVersionedDefault } from '@/lib/browser-delivery/client';

const PACKAGE_DIR = path.join(process.cwd(), 'public/assets/model-releases/xue-long-2/v0.1.0');
const RECEIPT_PATH = path.join(process.cwd(), 'artifacts/model-releases/xue-long-2-v0.1.0/receipt.json');

function realIo(): ModelPackageFileIo {
  return {
    listFiles: () => readdirSync(PACKAGE_DIR),
    sizeOf: (file) => statSync(path.join(PACKAGE_DIR, file)).size,
    sha256: (file) => createHash('sha256').update(readFileSync(path.join(PACKAGE_DIR, file))).digest('hex'),
  };
}

function glbJson(role: 'ship-lod0' | 'ship-lod1' | 'ship-lod2'): Record<string, unknown> {
  const artifact = XUE_LONG_2_V0.roles[role];
  return parseGlbJsonChunk(new Uint8Array(readFileSync(path.join(PACKAGE_DIR, artifact.file))));
}

describe('xue-long-2 v0.1.0 received package integrity', () => {
  it('verifies the complete three-LOD denominator, hashes, sizes and manifest identity', () => {
    const receipt = validateReceivedModelPackage(XUE_LONG_2_V0, realIo());
    expect(receipt.packageId).toBe('xue-long-2');
    expect(receipt.modelVersion).toBe('0.1.0');
    expect(Object.keys(receipt.roles)).toHaveLength(3);
    expect(receipt.manifestSha256).toBe(XUE_LONG_2_V0.releaseManifestSha256);
  });

  it('declares only the three ship LOD roles with unique files (no demo/payload/collision roles)', () => {
    expect(Object.keys(XUE_LONG_2_V0.roles).sort()).toEqual(['ship-lod0', 'ship-lod1', 'ship-lod2']);
    const roleFiles = Object.values(XUE_LONG_2_V0.roles).map((role) => role.file);
    expect(new Set(roleFiles).size).toBe(3);
  });

  it('rejects the whole package when one artifact hash drifts', () => {
    const files = new Map<string, { bytes: Uint8Array }>();
    for (const file of readdirSync(PACKAGE_DIR)) {
      files.set(file, { bytes: new Uint8Array(readFileSync(path.join(PACKAGE_DIR, file))) });
    }
    const entry = files.get(XUE_LONG_2_V0.roles['ship-lod2'].file);
    if (!entry) throw new Error('missing lod2 for tamper test');
    entry.bytes[entry.bytes.length - 1] ^= 0xff;
    const io: ModelPackageFileIo = {
      listFiles: () => [...files.keys()],
      sizeOf: (file) => files.get(file)?.bytes.length ?? -1,
      sha256: (file) => createHash('sha256').update(files.get(file)?.bytes ?? Buffer.alloc(0)).digest('hex'),
    };
    expect(() => validateReceivedModelPackage(XUE_LONG_2_V0, io)).toThrow('sha-mismatch');
  });

  it('binds a receive receipt with the same identities as the descriptor on a clean revision', () => {
    expect(existsSync(RECEIPT_PATH)).toBe(true);
    const receiptRaw = readFileSync(RECEIPT_PATH, 'utf-8');
    expect(receiptRaw, 'receipt must not contain local absolute paths').not.toContain('/Users/');
    const receipt = JSON.parse(receiptRaw);
    expect(receipt.schema).toBe('act-model-release-receipt/1');
    expect(receipt.manifestSha256).toBe(XUE_LONG_2_V0.releaseManifestSha256);
    expect(receipt.sourceBlendSha256).toBe(XUE_LONG_2_V0.sourceBlendSha256);
    expect(receipt.packageTreeDigest).toMatch(/^[0-9a-f]{40}$/);
    const entries = readdirSync(PACKAGE_DIR).sort().map((file) => {
      const blob = execSync(`git hash-object '${path.join(PACKAGE_DIR, file)}'`, { encoding: 'utf-8' }).trim();
      return `100644 blob ${blob}\t${file}`;
    });
    const mktree = execSync('git mktree', { input: `${entries.join('\n')}\n`, encoding: 'utf-8' }).trim();
    expect(mktree, 'receipt packageTreeDigest must equal the working package tree').toBe(receipt.packageTreeDigest);
    expect(receipt.packageDirty).toBe(false);
    for (const [role, artifact] of Object.entries(XUE_LONG_2_V0.roles)) {
      expect(receipt.roles[role]).toMatchObject({ file: artifact.file, sha256: artifact.sha256, bytes: artifact.bytes });
    }
  });
});

describe('xue-long-2 v0.1.0 GLB interface contract', () => {
  it('validates animations, targets and interface names on all three LODs', () => {
    const violations = validateModelPackageInterface(XUE_LONG_2_V0, {
      'ship-lod0': glbJson('ship-lod0'),
      'ship-lod1': glbJson('ship-lod1'),
      'ship-lod2': glbJson('ship-lod2'),
    });
    expect(violations).toEqual([]);
  });

  it('exposes the declared propulsor and pod nodes in every LOD', () => {
    for (const lod of ['ship-lod0', 'ship-lod1', 'ship-lod2'] as const) {
      const json = glbJson(lod) as { nodes?: { name?: unknown }[] };
      const names = new Set((json.nodes ?? []).map((node) => String(node.name ?? '')));
      for (const node of ['XL2_PROP_P', 'XL2_PROP_S', 'XL2_POD_P', 'XL2_POD_S', 'XueLong2Root']) {
        expect(names, `${lod} must contain ${node}`).toContain(node);
      }
    }
  });
});

describe('xue-long-2 v0.1.0 animation bindings map sailing telemetry', () => {
  it('couples both propeller clips to sailing speed (speedCoupled)', () => {
    const clips = (XUE_LONG_2_V0.semanticBindings ?? [])
      .filter((binding) => binding.drive === 'clip-loop' && binding.speedCoupled);
    expect(clips.map((binding) => (binding as { clip: string }).clip).sort()).toEqual(['propeller_P_spin', 'propeller_S_spin']);
  });

  it('keeps the three radars as always-on clip loops (unpaced by speed)', () => {
    const radar = (XUE_LONG_2_V0.semanticBindings ?? [])
      .filter((binding) => binding.drive === 'clip-loop' && !binding.speedCoupled);
    expect(radar).toHaveLength(3);
  });

  it('binds both pod azimuths procedurally to per-pod azimuth telemetry (rudder duty)', () => {
    const pods = (XUE_LONG_2_V0.semanticBindings ?? []).filter((binding) => binding.drive === 'procedural');
    expect(pods).toHaveLength(2);
    expect(pods.every((binding) => binding.axis === 'y')).toBe(true);
    expect(pods.map((binding) => binding.source).sort()).toEqual(
      ['telemetry.podAzimuthPortDeg', 'telemetry.podAzimuthStarboardDeg'],
    );
    expect(pods.map((binding) => (binding as { nodes: readonly string[] }).nodes.join(','))).toEqual(['XL2_POD_P', 'XL2_POD_S']);
  });

  it('reserves cranes and the helicopter rotor for the ending showcase pool only', () => {
    const showcase = XUE_LONG_2_V0.endingShowcase;
    expect(showcase).toBeDefined();
    expect([...showcase!.clips].sort()).toEqual(['crane_AFT_slew', 'crane_FORE_slew', 'crane_RESEARCH_slew', 'helicopter_rotor']);
    expect(showcase!.maxPicks).toBeGreaterThanOrEqual(1);
    expect(showcase!.maxPicks).toBeLessThanOrEqual(showcase!.clips.length);
    // 展示池 clip 不进入常开绑定（结束前保持静态）
    const alwaysOn = (XUE_LONG_2_V0.semanticBindings ?? []).map((binding) => (binding as { clip?: string }).clip);
    for (const clip of showcase!.clips) {
      expect(alwaysOn).not.toContain(clip);
    }
  });
});

describe('xue-long-2 activation and scene adaptation', () => {
  it('matches the icebreaker versioned default pointer to the received descriptor', () => {
    const activation = resolveVersionedDefault('icebreaker');
    expect(matchActivatedXueLong2Package(activation)).toEqual(XUE_LONG_2_V0);
    expect(matchActivatedXueLong2Package(null)).toBeNull();
    expect(matchActivatedXueLong2Package({
      packageId: 'xue-long-2',
      modelVersion: '9.9.9',
      baseUrl: XUE_LONG_2_V0.baseUrl,
    })).toBeNull();
  });

  it('uses the same -90° basis yaw as type055 (GLB +X bow → scene +Z bow)', () => {
    expect(XUE_LONG_2_V0.coordinateBasis).toEqual({ forward: '+X', up: '+Y' });
    expect(XUE_LONG_2_BASIS_YAW_RAD).toBe(-Math.PI / 2);
  });

  it('declares DWL origin anchoring and the hull length, not the bbox length', () => {
    expect(XUE_LONG_2_V0.verticalAnchor).toEqual({ designWaterlineY: 0 });
    expect(XUE_LONG_2_V0.modelLengthMeters).toBe(122.5);
  });

  it('maps propulsor anchors into the scene frame via the (-z, y, x) basis map', () => {
    const anchors = propulsorSceneAnchors(XUE_LONG_2_V0, 122.5);
    expect(anchors.map((entry) => entry.id)).toEqual(['prop-port', 'prop-starboard']);
    expect(anchors[0].anchor[0]).toBeCloseTo(5.2, 1);
    expect(anchors[0].anchor[2]).toBeCloseTo(-57.63, 1);
    expect(anchors[1].anchor[0]).toBeCloseTo(-5.2, 1);
    expect(anchors[1].anchor[2]).toBeCloseTo(-57.63, 1);
  });

  it('resolves LOD urls per quality tier', () => {
    expect(shipLodUrlForQualityTier(XUE_LONG_2_V0, 'high')).toContain('XueLong2-LOD0.glb');
    expect(shipLodUrlForQualityTier(XUE_LONG_2_V0, 'medium')).toContain('XueLong2-LOD1.glb');
    expect(shipLodUrlForQualityTier(XUE_LONG_2_V0, 'low')).toContain('XueLong2-LOD2.glb');
  });
});
