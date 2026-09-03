import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';
import * as THREE from 'three';

import {
  validateModelPackageInterface,
  validateReceivedModelPackage,
  type ModelPackageFileIo,
} from '../model-packages/model-package-validation';
import {
  SHIP_LOD_BY_QUALITY_TIER,
  TYPE055_NANCHANG_101_V2,
  TYPE055_V2_BASIS_YAW_RAD,
  shipLodUrlForQualityTier,
} from '../model-packages/type055-nanchang-101-v2';
import { findAnimationIndex, listLoadedInstanceNames, listMunitionTemplateNames } from '../model-packages/model-interface';

const PACKAGE_DIR = path.join(process.cwd(), 'public/assets/model-releases/type055-nanchang-101/v2.0.0');
const RECEIPT_PATH = path.join(process.cwd(), 'artifacts/model-releases/type055-nanchang-101-v2.0.0/receipt.json');

function realIo(): ModelPackageFileIo {
  return {
    listFiles: () => readdirSync(PACKAGE_DIR),
    sizeOf: (file) => statSync(path.join(PACKAGE_DIR, file)).size,
    sha256: (file) => createHash('sha256').update(readFileSync(path.join(PACKAGE_DIR, file))).digest('hex'),
  };
}

/** 读取真实包文件并按声明篡改一项，返回新 IO（不落盘）。 */
function tamperedIo(mutate: (files: Map<string, { bytes: Uint8Array }>) => void): ModelPackageFileIo {
  const files = new Map<string, { bytes: Uint8Array }>();
  for (const file of readdirSync(PACKAGE_DIR)) {
    files.set(file, { bytes: new Uint8Array(readFileSync(path.join(PACKAGE_DIR, file))) });
  }
  mutate(files);
  return {
    listFiles: () => [...files.keys()],
    sizeOf: (file) => files.get(file)?.bytes.length ?? -1,
    sha256: (file) => createHash('sha256').update(files.get(file)?.bytes ?? Buffer.alloc(0)).digest('hex'),
  };
}

describe('type055-nanchang-101 v2.0.0 received package integrity', () => {
  it('verifies the complete six-file denominator, hashes, sizes and manifest identity', () => {
    const receipt = validateReceivedModelPackage(TYPE055_NANCHANG_101_V2, realIo());
    expect(receipt.packageId).toBe('type055-nanchang-101');
    expect(receipt.modelVersion).toBe('2.0.0');
    expect(Object.keys(receipt.roles)).toHaveLength(6);
    expect(receipt.manifestSha256).toBe(TYPE055_NANCHANG_101_V2.releaseManifestSha256);
  });

  it('registers each role exactly once with unique files', () => {
    const roleFiles = Object.values(TYPE055_NANCHANG_101_V2.roles).map((role) => role.file);
    expect(new Set(roleFiles).size).toBe(6);
    expect(Object.keys(TYPE055_NANCHANG_101_V2.roles).sort()).toEqual(
      ['collision', 'demo', 'payload', 'ship-lod0', 'ship-lod1', 'ship-lod2'],
    );
  });

  it('binds a receive receipt with the same identities as the descriptor', () => {
    expect(existsSync(RECEIPT_PATH)).toBe(true);
    const receipt = JSON.parse(readFileSync(RECEIPT_PATH, 'utf-8'));
    expect(receipt.schema).toBe('act-model-release-receipt/1');
    expect(receipt.manifestSha256).toBe(TYPE055_NANCHANG_101_V2.releaseManifestSha256);
    expect(receipt.sourceBlendSha256).toBe(TYPE055_NANCHANG_101_V2.sourceBlendSha256);
    for (const [role, artifact] of Object.entries(TYPE055_NANCHANG_101_V2.roles)) {
      expect(receipt.roles[role]).toMatchObject({ file: artifact.file, sha256: artifact.sha256, bytes: artifact.bytes });
    }
  });

  it('rejects the whole package when one artifact hash drifts', () => {
    const io = tamperedIo((files) => {
      const entry = files.get(TYPE055_NANCHANG_101_V2.roles['ship-lod1'].file);
      if (!entry) throw new Error('missing lod1 for tamper test');
      entry.bytes[0] ^= 0xff;
    });
    expect(() => validateReceivedModelPackage(TYPE055_NANCHANG_101_V2, io)).toThrow('sha-mismatch');
  });

  it('rejects a partially received package (missing file)', () => {
    const io = tamperedIo((files) => {
      files.delete(TYPE055_NANCHANG_101_V2.roles.collision.file);
    });
    expect(() => validateReceivedModelPackage(TYPE055_NANCHANG_101_V2, io)).toThrow('missing-file');
  });

  it('rejects size drift and undeclared files inside the candidate directory', () => {
    const io = tamperedIo((files) => {
      files.set('stowaway.glb', { bytes: new Uint8Array([1, 2, 3]) });
    });
    expect(() => validateReceivedModelPackage(TYPE055_NANCHANG_101_V2, io)).toThrow('undeclared-file');
  });

  it('rejects when the release manifest itself is replaced', () => {
    const io = tamperedIo((files) => {
      files.set('manifest.json', { bytes: new TextEncoder().encode('{}') });
    });
    expect(() => validateReceivedModelPackage(TYPE055_NANCHANG_101_V2, io)).toThrow('manifest-sha-mismatch');
  });
});

describe('type055-nanchang-101 v2.0.0 semantic interface contract', () => {
  const glbJsonOf = (file: string) => {
    const bytes = new Uint8Array(readFileSync(path.join(PACKAGE_DIR, file)));
    return parseGlb(bytes);
  };

  function parseGlb(bytes: Uint8Array): Record<string, unknown> {
    // 复用被测解析器，保持测试与实现同一 GLB 读取口径
    const jsonLength = bytes[12] | (bytes[13] << 8) | (bytes[14] << 16) | (bytes[15] << 24);
    return JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength)));
  }

  it('validates every declared interface across the real six GLBs', () => {
    const glbJson = {
      'ship-lod0': glbJsonOf(TYPE055_NANCHANG_101_V2.roles['ship-lod0'].file),
      'ship-lod1': glbJsonOf(TYPE055_NANCHANG_101_V2.roles['ship-lod1'].file),
      'ship-lod2': glbJsonOf(TYPE055_NANCHANG_101_V2.roles['ship-lod2'].file),
      demo: glbJsonOf(TYPE055_NANCHANG_101_V2.roles.demo.file),
      payload: glbJsonOf(TYPE055_NANCHANG_101_V2.roles.payload.file),
    };
    expect(validateModelPackageInterface(TYPE055_NANCHANG_101_V2, glbJson)).toEqual([]);
  });

  it('detects a wrong ship animation count and an unreachable animation target', () => {
    const ship = glbJsonOf(TYPE055_NANCHANG_101_V2.roles['ship-lod2'].file);
    const truncated = { ...ship, animations: (ship.animations as unknown[]).slice(0, 100) };
    const violations = validateModelPackageInterface(TYPE055_NANCHANG_101_V2, { 'ship-lod2': truncated });
    expect(violations.map((item) => item.kind)).toContain('ship-animation-count');

    const redirected = JSON.parse(JSON.stringify(ship)) as {
      animations: { channels: { target: { node: number } }[] }[];
    };
    redirected.animations[0].channels[0].target.node = 999999;
    const unreachable = validateModelPackageInterface(TYPE055_NANCHANG_101_V2, { 'ship-lod2': redirected });
    expect(unreachable.map((item) => item.kind)).toContain('animation-target-unreachable');
  });

  it('resolves runtime bindings by semantic name, rejecting duplicates and indices', () => {
    const ship = glbJsonOf(TYPE055_NANCHANG_101_V2.roles['ship-lod0'].file) as unknown as {
      animations: { name?: unknown }[];
      nodes: { name?: unknown; extras?: unknown }[];
    };
    expect(findAnimationIndex(ship, 'rudder_port')).not.toBeNull();
    expect(findAnimationIndex(ship, 'no_such_clip')).toBeNull();

    const payload = glbJsonOf(TYPE055_NANCHANG_101_V2.roles.payload.file) as unknown as {
      animations: { name?: unknown }[];
      nodes: { name?: unknown; extras?: unknown }[];
    };
    const loaded = listLoadedInstanceNames(payload);
    expect(loaded.vls).toHaveLength(TYPE055_NANCHANG_101_V2.interfaceContract.vlsLoadedCount);
    expect(loaded.hq10).toHaveLength(TYPE055_NANCHANG_101_V2.interfaceContract.hq10LoadedCount);
    expect(listMunitionTemplateNames(payload).length).toBeGreaterThan(0);

    const duplicated = { ...ship, animations: [...ship.animations, ship.animations[0]] };
    expect(findAnimationIndex(duplicated as typeof ship, String(ship.animations[0].name))).toBeNull();
  });
});

describe('quality tier to LOD mapping and coordinate basis adapter', () => {
  it('maps high/medium/low uniquely to LOD0/1/2', () => {
    expect(SHIP_LOD_BY_QUALITY_TIER).toEqual({ high: 'ship-lod0', medium: 'ship-lod1', low: 'ship-lod2' });
    expect(shipLodUrlForQualityTier(TYPE055_NANCHANG_101_V2, 'high')).toBe(TYPE055_NANCHANG_101_V2.roles['ship-lod0'].url);
    expect(shipLodUrlForQualityTier(TYPE055_NANCHANG_101_V2, 'low')).toBe(TYPE055_NANCHANG_101_V2.roles['ship-lod2'].url);
  });

  it('adapts the model +X-bow basis onto the scene +Z-bow basis with one yaw rotation', () => {
    const yaw = TYPE055_V2_BASIS_YAW_RAD;
    const quaternion = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
    const apply = (vector: [number, number, number]) =>
      new THREE.Vector3(...vector).applyQuaternion(quaternion);

    // 舰艏 +X → 场景 +Z（场景船体系艏向）
    expect(apply([1, 0, 0]).angleTo(new THREE.Vector3(0, 0, 1))).toBeLessThan(1e-9);
    // 上方向不变
    expect(apply([0, 1, 0]).angleTo(new THREE.Vector3(0, 1, 0))).toBeLessThan(1e-9);
    // 右舷（forward × up = +Z local）→ 场景 -X；左舷 → 场景 +X（与旧模型档案一致）
    expect(apply([0, 0, 1]).angleTo(new THREE.Vector3(-1, 0, 0))).toBeLessThan(1e-9);
    expect(apply([0, 0, -1]).angleTo(new THREE.Vector3(1, 0, 0))).toBeLessThan(1e-9);
  });
});
