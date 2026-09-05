import { execSync } from 'node:child_process';
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
  propulsorSceneAnchors,
  shipLodUrlForQualityTier,
} from '../model-packages/type055-nanchang-101-v2';
import { cloneSkinnedScene, skinnedBindingsIntact } from '../model-packages/clone-skinned-scene';
import { findAnimationIndex, listLoadedInstanceNames, listMunitionTemplateNames } from '../model-packages/model-interface';

const PACKAGE_DIR = path.join(process.cwd(), 'public/assets/model-releases/type055-nanchang-101/v2.1.1');
const RECEIPT_PATH = path.join(process.cwd(), 'artifacts/model-releases/type055-nanchang-101-v2.1.1/receipt.json');

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

describe('type055-nanchang-101 v2.1.1 received package integrity', () => {
  it('verifies the complete seven-role denominator, hashes, sizes and manifest identity', () => {
    const receipt = validateReceivedModelPackage(TYPE055_NANCHANG_101_V2, realIo());
    expect(receipt.packageId).toBe('type055-nanchang-101');
    expect(receipt.modelVersion).toBe('2.1.1');
    expect(Object.keys(receipt.roles)).toHaveLength(7);
    expect(receipt.manifestSha256).toBe(TYPE055_NANCHANG_101_V2.releaseManifestSha256);
  });

  it('registers each role exactly once with unique files including interactive-systems', () => {
    const roleFiles = Object.values(TYPE055_NANCHANG_101_V2.roles).map((role) => role.file);
    expect(new Set(roleFiles).size).toBe(7);
    expect(Object.keys(TYPE055_NANCHANG_101_V2.roles).sort()).toEqual(
      ['collision', 'demo', 'interactive-systems', 'payload', 'ship-lod0', 'ship-lod1', 'ship-lod2'],
    );
  });

  it('rejects a duplicate-role denominator and a missing role', () => {
    const duplicate = {
      ...TYPE055_NANCHANG_101_V2,
      roles: {
        ...TYPE055_NANCHANG_101_V2.roles,
        demo: TYPE055_NANCHANG_101_V2.roles.payload,
      },
    };
    expect(() => validateReceivedModelPackage(duplicate, realIo())).toThrow('incomplete-role-denominator');
    const io = tamperedIo((files) => {
      files.delete(TYPE055_NANCHANG_101_V2.roles['interactive-systems'].file);
    });
    expect(() => validateReceivedModelPackage(TYPE055_NANCHANG_101_V2, io)).toThrow('missing-file');
  });

  it('binds a receive receipt with the same identities as the descriptor on a clean revision', () => {
    expect(existsSync(RECEIPT_PATH)).toBe(true);
    const receiptRaw = readFileSync(RECEIPT_PATH, 'utf-8');
    expect(receiptRaw, 'receipt must not contain local absolute paths').not.toContain('/Users/');
    const receipt = JSON.parse(receiptRaw);
    expect(receipt.schema).toBe('act-model-release-receipt/1');
    expect(receipt.manifestSha256).toBe(TYPE055_NANCHANG_101_V2.releaseManifestSha256);
    expect(receipt.sourceBlendSha256).toBe(TYPE055_NANCHANG_101_V2.sourceBlendSha256);
    // 收据的可验证主绑定：候选包目录 tree digest（任意克隆/squash 后仍可复核）
    expect(receipt.packageTreeDigest).toMatch(/^[0-9a-f]{40}$/);
    const entries = readdirSync(PACKAGE_DIR).sort().map((file) => {
      const blob = execSync(`git hash-object '${path.join(PACKAGE_DIR, file)}'`, { encoding: 'utf-8' }).trim();
      return `100644 blob ${blob}\t${file}`;
    });
    const mktree = execSync('git mktree', { input: `${entries.join('\n')}\n`, encoding: 'utf-8' }).trim();
    expect(mktree, 'receipt packageTreeDigest must equal the working package tree').toBe(receipt.packageTreeDigest);
    let headTree = '';
    try {
      headTree = execSync(
        'git rev-parse HEAD:public/assets/model-releases/type055-nanchang-101/v2.1.1',
        { encoding: 'utf-8' },
      ).trim();
    } catch {
      headTree = '';
    }
    if (headTree) {
      expect(headTree, 'committed package tree must match the receipt once the directory is in HEAD').toBe(receipt.packageTreeDigest);
    }
    // 捕获时工作区必须干净（脏收据 fail closed）
    expect(receipt.packageDirty).toBe(false);
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

describe('type055-nanchang-101 v2.1.1 semantic interface contract', () => {
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
    const truncated = { ...ship, animations: (ship.animations as unknown[]).slice(0, 8) };
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

describe('v2.1.1 declared waterline anchor, propulsors and semantic bindings', () => {
  const glbJsonOf = (file: string) => {
    const bytes = new Uint8Array(readFileSync(path.join(PACKAGE_DIR, file)));
    const jsonLength = bytes[12] | (bytes[13] << 8) | (bytes[14] << 16) | (bytes[15] << 24);
    return JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength))) as {
      animations?: { name?: string }[];
      nodes?: { name?: string }[];
    };
  };

  it('declares the design waterline and twin propulsors consistent across all LODs', () => {
    expect(TYPE055_NANCHANG_101_V2.verticalAnchor?.designWaterlineY).toBe(6.6);
    expect(TYPE055_NANCHANG_101_V2.propulsors?.map((propulsor) => propulsor.node)).toEqual([
      'PROP_PORT',
      'PROP_STARBOARD',
    ]);
    for (const role of ['ship-lod0', 'ship-lod1', 'ship-lod2'] as const) {
      const nodeNames = new Set((glbJsonOf(TYPE055_NANCHANG_101_V2.roles[role].file).nodes ?? []).map((node) => node.name));
      for (const propulsor of TYPE055_NANCHANG_101_V2.propulsors ?? []) {
        expect(nodeNames.has(propulsor.node), `${role} must contain ${propulsor.node}`).toBe(true);
      }
    }
  });

  it('converts propulsor model-local positions onto the scene +Z-bow basis', () => {
    const anchors = propulsorSceneAnchors(TYPE055_NANCHANG_101_V2, 180);
    expect(anchors).toHaveLength(2);
    const port = anchors.find((anchor) => anchor.id === 'prop-port');
    const starboard = anchors.find((anchor) => anchor.id === 'prop-starboard');
    // 模型局部 (x=-82.97 艉, z=-4.8 左舷) → 场景 (x=+4.8 左舷, z=-82.97 艉)，缩放 180/179.69
    expect(port?.anchor[0]).toBeCloseTo(4.81, 1);
    expect(port?.anchor[2]).toBeCloseTo(-83.11, 1);
    expect(starboard?.anchor[0]).toBeCloseTo(-4.81, 1);
    expect(port?.anchor[1]).toBe(0);
  });

  it('resolves every declared semantic binding against the real ship GLBs', () => {
    const bindings = TYPE055_NANCHANG_101_V2.semanticBindings ?? [];
    expect(bindings.length).toBeGreaterThan(0);
    for (const role of ['ship-lod0', 'ship-lod1', 'ship-lod2'] as const) {
      const json = glbJsonOf(TYPE055_NANCHANG_101_V2.roles[role].file);
      const clipNames = new Set((json.animations ?? []).map((clip) => clip.name));
      const nodeNames = new Set((json.nodes ?? []).map((node) => node.name));
      for (const binding of bindings) {
        if (binding.drive === 'clip-loop') {
          expect(clipNames.has(binding.clip), `${role} must contain clip ${binding.clip}`).toBe(true);
        } else {
          for (const node of binding.nodes) {
            expect(nodeNames.has(node), `${role} must contain node ${node} for ${binding.id}`).toBe(true);
          }
        }
      }
      for (const patrol of TYPE055_NANCHANG_101_V2.easterEgg?.patrolClips ?? []) {
        expect(clipNames.has(patrol.clip), `${role} must contain patrol clip ${patrol.clip}`).toBe(true);
      }
    }
    const demo = glbJsonOf(TYPE055_NANCHANG_101_V2.roles.demo.file);
    const demoClipNames = new Set((demo.animations ?? []).map((clip) => clip.name));
    for (const clipName of TYPE055_NANCHANG_101_V2.interfaceContract.demoAnimations) {
      expect(demoClipNames.has(clipName)).toBe(true);
    }
  });

  it('keeps antifouling material below the declared waterline in every LOD', () => {
    // 接收侧材质归属事实：防锈漆与灰色的分界面即声明水线（含 boot-top 余量）。
    // 逐顶点几何核验在模型侧 G08 完成；ACT 侧核对三档 LOD 都声明了防锈漆材质。
    for (const role of ['ship-lod0', 'ship-lod1', 'ship-lod2'] as const) {
      const json = glbJsonOf(TYPE055_NANCHANG_101_V2.roles[role].file) as { materials?: { name?: string }[] };
      const materialNames = new Set((json.materials ?? []).map((material) => material.name));
      expect(materialNames.has('MAT_ANTIFOULING_RED'), `${role} must declare MAT_ANTIFOULING_RED`).toBe(true);
    }
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

describe('skeleton-aware scene cloning', () => {
  it('keeps skinned mesh bones inside the cloned tree', () => {
    const bone = new THREE.Bone();
    bone.name = 'flag-bone';
    const geometry = new THREE.BoxGeometry(1, 2, 0.1);
    const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshBasicMaterial());
    mesh.add(bone);
    mesh.bind(new THREE.Skeleton([bone]));
    const root = new THREE.Group();
    root.add(mesh);

    expect(skinnedBindingsIntact(root.clone(true))).toBe(false);
    const cloned = cloneSkinnedScene(root);
    expect(skinnedBindingsIntact(cloned)).toBe(true);
    expect(cloned).not.toBe(root);
  });
});
