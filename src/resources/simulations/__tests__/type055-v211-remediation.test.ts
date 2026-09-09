import { readdirSync, readFileSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  DEFAULT_GERSTNER_SEA_STATE,
  gerstnerAmplitudeScale,
  GERSTNER_WAVE_SETS,
  GERSTNER_WATER_BASE_Y,
  sampleVisibleWaterHeight,
  computeGerstnerDisplacement,
  createGerstnerWaterGeometry,
  gerstnerWaterMeshSpecForTier,
} from '../scene/water';
import { resolveEmitterAnchors } from '../scene/wake/wake-trail';
import {
  TYPE055_NANCHANG_101_V2_1_0,
  TYPE055_NANCHANG_101_V2_1_1,
  TYPE055_NANCHANG_101_V2_1_2,
  isType055VersionedAssetUrl,
  shipLodUrlForQualityTier,
} from '../model-packages/type055-nanchang-101-v2';
import { validateReceivedModelPackage, type ModelPackageFileIo } from '../model-packages/model-package-validation';
import { advanceAttainment, createAttainmentState } from '../simulations/destroyer-simulation';
import { destroyer055SceneVisual } from '../profiles/destroyer-055-scene';

/**
 * #1996 Codex review 整改回归：
 * F1 共享波面坐标/振幅基准；F2 达标门（机动段才评估）；F3 双桨逐帧节点绑定；
 * F4 v2.1.0 运行时有序回退；F5 水面网格轴约定（复审 P1）；F6 达标门 maxSettlingTime（复审 P2）；
 * F7 L0 clip 绑定进 useEffect（用户报告：螺旋桨不转）；F8 v2.1.2 红旗伪 scale 轨道剔除；
 * F9 shader 相位改用不可变原始坐标（复审 P1）；F10 v2.1.3 螺旋桨 clip 裁净常量保持尾。
 */

describe('F1: visible water sampling shares the mesh-local coordinate basis', () => {
  const waves = GERSTNER_WAVE_SETS.high;
  const scale = gerstnerAmplitudeScale(DEFAULT_GERSTNER_SEA_STATE);
  const mesh = gerstnerWaterMeshSpecForTier('high');

  const displaced = (x: number, z: number, t: number) => {
    const d = computeGerstnerDisplacement(waves, x, z, t);
    return { x: x + scale * d.offsetX, y: scale * d.y, z: z + scale * d.offsetZ };
  };

  it('matches the displaced vertex height exactly at grid vertices', () => {
    const originX = -6000;
    const originZ = 120;
    const t = 37.5;
    // 网格顶点的位移后世界位置：采样必须等于该顶点的位移高度
    const cell = mesh.size / mesh.resolution;
    const vx = -mesh.size / 2 + 130 * cell;
    const vz = -mesh.size / 2 + 127 * cell;
    const vertex = displaced(vx, vz, t);
    const sampled = sampleVisibleWaterHeight(waves, scale, mesh, originX, originZ, originX + vertex.x, originZ + vertex.z, t);
    expect(sampled).toBeCloseTo(GERSTNER_WATER_BASE_Y + vertex.y, 6);
  });

  it('interpolates the displaced triangle mesh instead of the analytic field between vertices', () => {
    const originX = 0;
    const originZ = 0;
    const t = 1.2;
    const localX = 90;
    const localZ = 0;
    // 复审案例：默认 60000/256 网格、局部 (90,0)、t=1.2s 处，解析场与网格插值相差数米
    const cell = mesh.size / mesh.resolution;
    const half = mesh.size / 2;
    const lastCell = mesh.resolution - 1;
    const baseI = Math.min(Math.max(Math.floor((localX + half) / cell), 0), lastCell);
    const baseJ = Math.min(Math.max(Math.floor((localZ + half) / cell), 0), lastCell);
    // 独立路径的期望：在 3×3 邻域内做位移后 XZ 包含测试，取首个命中的三角形
    let expected: number | null = null;
    const bary = (a: ReturnType<typeof displaced>, b: ReturnType<typeof displaced>, c: ReturnType<typeof displaced>) => {
      const den = (b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z);
      if (Math.abs(den) < 1e-12) return null;
      const u = ((localX - a.x) * (c.z - a.z) - (c.x - a.x) * (localZ - a.z)) / den;
      const v = ((b.x - a.x) * (localZ - a.z) - (localX - a.x) * (b.z - a.z)) / den;
      const w = 1 - u - v;
      if (u < -1e-6 || v < -1e-6 || w < -1e-6) return null;
      return w * a.y + u * b.y + v * c.y;
    };
    for (let di = -1; di <= 1 && expected === null; di += 1) {
      for (let dj = -1; dj <= 1 && expected === null; dj += 1) {
        const i = baseI + di;
        const j = baseJ + dj;
        if (i < 0 || j < 0 || i > lastCell || j > lastCell) continue;
        const v00 = displaced(i * cell - half, j * cell - half, t);
        const v10 = displaced((i + 1) * cell - half, j * cell - half, t);
        const v01 = displaced(i * cell - half, (j + 1) * cell - half, t);
        const v11 = displaced((i + 1) * cell - half, (j + 1) * cell - half, t);
        expected = bary(v00, v01, v10) ?? bary(v01, v11, v10);
      }
    }
    expect(expected).not.toBeNull();
    const sampled = sampleVisibleWaterHeight(waves, scale, mesh, originX, originZ, localX, localZ, t);
    expect(sampled).toBeCloseTo(GERSTNER_WATER_BASE_Y + expected!, 9);
    // 与解析场（未插值）采样必须显著不同：证明走的是网格插值而非解析曲面
    const analytic = GERSTNER_WATER_BASE_Y + computeGerstnerDisplacement(waves, localX, localZ, t).y;
    expect(Math.abs(sampled - analytic)).toBeGreaterThan(0.5);
  });

  it('differs from naive world-coordinate sampling at a non-origin ship position', () => {
    const originX = -6000;
    const t = 12.3;
    const shipLocal = sampleVisibleWaterHeight(waves, scale, mesh, originX, 0, originX, 0, t);
    const naiveWorld = GERSTNER_WATER_BASE_Y + computeGerstnerDisplacement(waves, originX, 0, t).y;
    // 非原点舰位：同一世界点的网格局部坐标是 (0,0) 附近，朴素世界采样是另一波相
    expect(Math.abs(shipLocal - naiveWorld)).toBeGreaterThan(0.01);
  });

  it('matches the shader amplitude scale for the scene default sea state', () => {
    expect(gerstnerAmplitudeScale(DEFAULT_GERSTNER_SEA_STATE)).toBeCloseTo(0.3 + (3 - 1) * 0.34, 9);
  });
});

describe('F2: attainment requires entering a maneuver leg', () => {
  it('does not fire during the initial straight leg even with zero heading error', () => {
    const state = createAttainmentState(0);
    for (let i = 0; i < 100; i += 1) {
      expect(advanceAttainment(state, 0, 0, 5, 0.1)).toBe(false);
    }
    expect(state.dwell).toBe(0);
    expect(state.maneuverActive).toBe(false);
  });

  it('fires once after the target steps and the error settles within maxError for 3s', () => {
    const state = createAttainmentState(0);
    // 60s 目标阶跃 0° → 90°，误差先大后收敛
    expect(advanceAttainment(state, 90, 60, 5, 0.1)).toBe(false);
    expect(state.maneuverActive).toBe(true);
    let fired = 0;
    for (let i = 0; i < 29; i += 1) {
      if (advanceAttainment(state, 90, 1, 5, 0.1)) fired += 1;
    }
    expect(fired).toBe(0);
    expect(advanceAttainment(state, 90, 1, 5, 0.1)).toBe(true);
    // 已触发后不重复记数，直到误差超过 2×maxError 重新武装
    expect(advanceAttainment(state, 90, 1, 5, 0.1)).toBe(false);
    expect(advanceAttainment(state, 90, 20, 5, 0.1)).toBe(false);
    let refired = 0;
    for (let i = 0; i < 30; i += 1) {
      if (advanceAttainment(state, 90, 1, 5, 0.1)) refired += 1;
    }
    expect(refired).toBe(1);
  });

  it('recognizes a slowly ramping target (interpolation), not only per-step jumps', () => {
    const state = createAttainmentState(0);
    // headingPoints 线性插值使阶跃变成 18s 斜坡：逐子步目标增量远小于任何瞬时阈值
    let maneuverAt = -1;
    for (let i = 0; i < 300; i += 1) {
      const rampedTarget = Math.min(90, i * 0.5);
      advanceAttainment(state, rampedTarget, 0, 5, 0.1);
      if (maneuverAt < 0 && state.maneuverActive) maneuverAt = i;
    }
    expect(maneuverAt).toBeGreaterThan(0);
    expect(maneuverAt).toBeLessThan(20);
  });

  it('can fire while tracking a continuous ramp within tolerance (circle task semantics)', () => {
    const state = createAttainmentState(0);
    let fired = 0;
    // 定常回转：目标持续变化、跟踪误差始终在 maxError 内
    for (let i = 0; i < 600; i += 1) {
      if (advanceAttainment(state, i * 0.06, 10, 15, 1 / 60)) fired += 1;
    }
    expect(fired).toBeGreaterThanOrEqual(1);
  });
});

describe('F3: wake emitter anchors follow the propulsor node world position', () => {
  const position = [1000, 0, -2000] as const;

  it('uses the per-frame override world position when provided', () => {
    const override = [1005, 2.7, -2083] as const;
    const anchors = resolveEmitterAnchors(destroyer055SceneVisual, position, 0, override);
    expect(anchors.stern).toEqual([1005, 2.7, -2083]);
    // 肩部相对发射点按航向对称外推（heading=0：前方 = +Z）
    expect(anchors.portShoulder[0]).toBeCloseTo(1005 + 6, 6);
    expect(anchors.portShoulder[2]).toBeCloseTo(-2083 + 30, 6);
    expect(anchors.starboardShoulder[0]).toBeCloseTo(1005 - 6, 6);
  });

  it('falls back to the profile anchors when the override is null', () => {
    const anchors = resolveEmitterAnchors(destroyer055SceneVisual, position, 0, null);
    expect(anchors.stern).toEqual([1000, 0, -2090]);
    const fallback = resolveEmitterAnchors(destroyer055SceneVisual, position, 0);
    expect(fallback.stern).toEqual(anchors.stern);
  });
});

describe('F4: v2.1.0 stays in the runtime ordered fallback chain', () => {
  const PACKAGE_DIR_V210 = path.join(process.cwd(), 'public/assets/model-releases/type055-nanchang-101/v2.1.0');

  function v210Io(): ModelPackageFileIo {
    return {
      listFiles: () => readdirSync(PACKAGE_DIR_V210),
      sizeOf: (file) => statSync(path.join(PACKAGE_DIR_V210, file)).size,
      sha256: (file) => createHash('sha256').update(readFileSync(path.join(PACKAGE_DIR_V210, file))).digest('hex'),
    };
  }

  it('validates the on-disk v2.1.0 package against the fallback descriptor', () => {
    const receipt = validateReceivedModelPackage(TYPE055_NANCHANG_101_V2_1_0, v210Io());
    expect(receipt.modelVersion).toBe('2.1.0');
    expect(Object.keys(receipt.roles)).toHaveLength(7);
  });

  it('places the received fallback LODs between the activated package and the legacy single-file chain', () => {
    const source = readFileSync(path.join(process.cwd(), 'src/resources/simulations/simulations/destroyer-simulation.tsx'), 'utf-8');
    const fallbackBlock = source.match(/orderedFallback = \[[\s\S]*?\];/);
    expect(fallbackBlock).not.toBeNull();
    expect(fallbackBlock![0]).toContain('shipLodCandidatesForQualityTier(TYPE055_NANCHANG_101_V2_1_3, tier)');
    expect(fallbackBlock![0]).toContain('shipLodCandidatesForQualityTier(TYPE055_NANCHANG_101_V2_1_2, tier)');
    expect(fallbackBlock![0]).toContain('shipLodCandidatesForQualityTier(TYPE055_NANCHANG_101_V2_1_1, tier)');
    expect(fallbackBlock![0]).toContain('shipLodCandidatesForQualityTier(TYPE055_NANCHANG_101_V2_1_0, tier)');
    expect(fallbackBlock![0]).toContain('MODEL.candidates');
    expect(shipLodUrlForQualityTier(TYPE055_NANCHANG_101_V2_1_2, 'high')).toContain('/v2.1.2/');
    expect(shipLodUrlForQualityTier(TYPE055_NANCHANG_101_V2_1_1, 'high')).toContain('/v2.1.1/');
    expect(shipLodUrlForQualityTier(TYPE055_NANCHANG_101_V2_1_0, 'high')).toContain('/v2.1.0/');
  });

  it('applies the coordinate basis to every received package asset url', () => {
    expect(isType055VersionedAssetUrl('/assets/model-releases/type055-nanchang-101/v2.2.0/type055-nanchang-101-ship-lod0.glb')).toBe(true);
    expect(isType055VersionedAssetUrl('/assets/model-releases/type055-nanchang-101/v2.1.3/type055-nanchang-101-ship-lod0.glb')).toBe(true);
    expect(isType055VersionedAssetUrl('/assets/model-releases/type055-nanchang-101/v2.1.2/type055-nanchang-101-ship-lod0.glb')).toBe(true);
    expect(isType055VersionedAssetUrl('/assets/model-releases/type055-nanchang-101/v2.1.1/type055-nanchang-101-ship-lod0.glb')).toBe(true);
    expect(isType055VersionedAssetUrl('/assets/model-releases/type055-nanchang-101/v2.1.0/type055-nanchang-101-ship-lod0.glb')).toBe(true);
    expect(isType055VersionedAssetUrl('/assets/models-opt/destroyer.glb')).toBe(false);
  });
});

describe('F5: water geometry bakes the -90° X rotation into vertices', () => {
  it('lies in the local XZ plane with Y up, so shader phase/displacement axes match the CPU reference', () => {
    const size = 1200;
    const geometry = createGerstnerWaterGeometry(size, 8);
    const positions = geometry.getAttribute('position');
    let minX = Infinity;
    let maxX = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    for (let i = 0; i < positions.count; i += 1) {
      // shader 以 position.y 写垂向位移：几何基面必须 y 恒 0（旋转已烘焙，而非挂在 mesh 上）
      expect(positions.getY(i)).toBeCloseTo(0, 6);
      minX = Math.min(minX, positions.getX(i));
      maxX = Math.max(maxX, positions.getX(i));
      minZ = Math.min(minZ, positions.getZ(i));
      maxZ = Math.max(maxZ, positions.getZ(i));
    }
    // shader 以 position.xz 取相位：两个水平轴都必须真正展开（修复前 z 恒 0，相位退化）
    expect(maxX - minX).toBeCloseTo(size, 6);
    expect(maxZ - minZ).toBeCloseTo(size, 6);
  });

  it('GPU 顶点世界 Y（烘焙几何 + shader 水平/垂向位移）与 CPU 采样逐点一致', () => {
    const waves = GERSTNER_WAVE_SETS.high;
    const scale = gerstnerAmplitudeScale(DEFAULT_GERSTNER_SEA_STATE);
    const mesh = { size: 600, resolution: 16 };
    const geometry = createGerstnerWaterGeometry(mesh.size, mesh.resolution);
    const positions = geometry.getAttribute('position');
    const originX = -6000;
    const originZ = 120;
    const t = 42.7;
    // 抽查若干顶点：GPU 世界 XZ = 参数点 + ampScale·水平位移，世界 Y = BASE_Y + ampScale·垂向位移
    for (const index of [0, 37, 101, 200, positions.count - 1]) {
      const localX = positions.getX(index);
      const localZ = positions.getZ(index);
      const displacement = computeGerstnerDisplacement(waves, localX, localZ, t);
      const gpuWorldY = GERSTNER_WATER_BASE_Y + scale * displacement.y;
      const cpuSample = sampleVisibleWaterHeight(
        waves, scale, mesh, originX, originZ,
        originX + localX + scale * displacement.offsetX,
        originZ + localZ + scale * displacement.offsetZ,
        t,
      );
      expect(cpuSample).toBeCloseTo(gpuWorldY, 6);
    }
  });

  it('非顶点位置与真实几何索引缓冲的位移三角网重心插值一致', () => {
    const waves = GERSTNER_WAVE_SETS.high;
    const scale = gerstnerAmplitudeScale(DEFAULT_GERSTNER_SEA_STATE);
    const mesh = { size: 600, resolution: 16 };
    const geometry = createGerstnerWaterGeometry(mesh.size, mesh.resolution);
    const positions = geometry.getAttribute('position');
    const indices = geometry.getIndex();
    expect(indices).not.toBeNull();
    const t = 42.7;
    const displacedVertex = (vertexIndex: number) => {
      const x = positions.getX(vertexIndex);
      const z = positions.getZ(vertexIndex);
      const d = computeGerstnerDisplacement(waves, x, z, t);
      return { x: x + scale * d.offsetX, y: scale * d.y, z: z + scale * d.offsetZ };
    };
    // 直接用几何体索引缓冲中的三角形做重心插值（即 GPU 实际光栅化的曲面）
    const heightAt = (x: number, z: number) => {
      for (let tri = 0; tri < indices!.count; tri += 3) {
        const a = displacedVertex(indices!.getX(tri));
        const b = displacedVertex(indices!.getX(tri + 1));
        const c = displacedVertex(indices!.getX(tri + 2));
        const den = (b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z);
        if (Math.abs(den) < 1e-12) continue;
        const u = ((x - a.x) * (c.z - a.z) - (c.x - a.x) * (z - a.z)) / den;
        const v = ((b.x - a.x) * (z - a.z) - (x - a.x) * (b.z - a.z)) / den;
        const w = 1 - u - v;
        if (u >= -1e-6 && v >= -1e-6 && w >= -1e-6) {
          return w * a.y + u * b.y + v * c.y;
        }
      }
      return null;
    };
    // 抽查若干非顶点位置：CPU 采样必须等于索引缓冲三角网的插值
    for (const [px, pz] of [[37.3, -12.8], [101.6, 55.2], [-250.4, 199.7], [0.5, -0.4]] as const) {
      const expected = heightAt(px, pz);
      expect(expected).not.toBeNull();
      const sampled = sampleVisibleWaterHeight(waves, scale, mesh, 0, 0, px, pz, t);
      expect(sampled).toBeCloseTo(GERSTNER_WATER_BASE_Y + expected!, 9);
    }
  });
});

describe('F6: attainment honors successCriteria.maxSettlingTime', () => {
  it('does not fire when the error settles after the settling deadline', () => {
    const state = createAttainmentState(0);
    // 机动激活后先偏离 130s（maxSettlingTime=120），再收敛到阈值内保持 3s
    expect(advanceAttainment(state, 90, 60, 5, 1, 120)).toBe(false);
    expect(state.maneuverActive).toBe(true);
    for (let i = 0; i < 129; i += 1) advanceAttainment(state, 90, 60, 5, 1, 120);
    let fired = 0;
    for (let i = 0; i < 40; i += 1) {
      if (advanceAttainment(state, 90, 1, 5, 0.1, 120)) fired += 1;
    }
    expect(fired).toBe(0);
  });

  it('fires when the error settles within the settling deadline', () => {
    const state = createAttainmentState(0);
    expect(advanceAttainment(state, 90, 60, 5, 1, 120)).toBe(false);
    let fired = 0;
    for (let i = 0; i < 40; i += 1) {
      if (advanceAttainment(state, 90, 1, 5, 0.1, 120)) fired += 1;
    }
    expect(fired).toBe(1);
  });

  it('re-arm after an excursion opens a new settling window', () => {
    const state = createAttainmentState(0);
    advanceAttainment(state, 90, 60, 5, 1, 120);
    // 先按时达标一次
    let fired = 0;
    for (let i = 0; i < 40; i += 1) {
      if (advanceAttainment(state, 90, 1, 5, 0.1, 120)) fired += 1;
    }
    expect(fired).toBe(1);
    // 新机动段：误差冲过 2×maxError 重新武装并清零调节时钟
    advanceAttainment(state, 45, 30, 5, 0.1, 120);
    expect(state.armed).toBe(true);
    expect(state.maneuverTime).toBeLessThan(1);
    // 新窗口内收敛仍然计数
    let refired = 0;
    for (let i = 0; i < 40; i += 1) {
      if (advanceAttainment(state, 45, 1, 5, 0.1, 120)) refired += 1;
    }
    expect(refired).toBe(1);
  });
});

describe('F7: L0 clip-loop bindings mount inside useEffect (StrictMode-safe)', () => {
  it('plays clip actions in an effect with stopAllAction cleanup, not in useMemo', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/resources/simulations/components/semantic-bindings-rig.tsx'),
      'utf-8',
    );
    const effectMatch = source.match(/useEffect\(\(\) => \{[\s\S]*?drive !== 'clip-loop'[\s\S]*?\}, \[mixer, animations, descriptor\]\)/);
    expect(effectMatch).not.toBeNull();
    expect(effectMatch![0]).toContain('mixer.stopAllAction()');
    // useMemo 块内不得再有 clipAction/play 副作用
    const memoBlocks = source.match(/useMemo\(\(\) => \{[\s\S]*?\}, \[[^\]]*\]\)/g) ?? [];
    for (const block of memoBlocks) {
      expect(block).not.toContain('clipAction');
    }
  });
});

describe('F8: v2.1.2 flag clip has no spurious mirrored scale channel', () => {
  const V212_PACKAGE_DIR = path.join(process.cwd(), 'public/assets/model-releases/type055-nanchang-101/v2.1.2');

  function glbJsonOf(file: string) {
    const bytes = readFileSync(path.join(V212_PACKAGE_DIR, file));
    const jsonLength = bytes[12] | (bytes[13] << 8) | (bytes[14] << 16) | (bytes[15] << 24);
    return JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength))) as {
      animations?: { name?: string; channels: { target: { node: number; path: string } }[] }[];
      nodes?: { name?: string }[];
    };
  }

  // 上游 Blender 5.2 多骨架导出缺陷曾给 FLAG_BONE_00 写入常量 (-1,-1,-1) scale，
  // 播放时整面国旗点反演到舰艏；v2.1.2 管线 sanitize 必须剔净全部三档 LOD。
  it.each(['type055-nanchang-101-ship-lod0.glb', 'type055-nanchang-101-ship-lod1.glb', 'type055-nanchang-101-ship-lod2.glb'])(
    'strips FLAG_BONE scale channels from national_flag_wind in %s',
    (file) => {
      const json = glbJsonOf(file);
      const clip = (json.animations ?? []).find((animation) => animation.name === 'national_flag_wind');
      expect(clip, 'national_flag_wind clip missing').toBeDefined();
      const flagScaleChannels = clip!.channels.filter(
        (channel) => channel.target.path === 'scale'
          && (json.nodes?.[channel.target.node]?.name ?? '').startsWith('FLAG_BONE'),
      );
      expect(flagScaleChannels).toHaveLength(0);
    },
  );
});

describe('F9: shader phase uses immutable original coordinates (CPU/GPU same field)', () => {
  const waves = GERSTNER_WAVE_SETS.high;
  const scale = gerstnerAmplitudeScale(DEFAULT_GERSTNER_SEA_STATE);

  /** 独立复刻顶点着色器主循环（不复用 CPU helper）：phase 必须取自原始坐标。 */
  function shaderReplicaDisplace(x: number, z: number, t: number) {
    let posX = x;
    let posY = 0;
    let posZ = z;
    for (const wave of waves) {
      const length = Math.hypot(wave.direction[0], wave.direction[1]) || 1;
      const dx = wave.direction[0] / length;
      const dz = wave.direction[1] / length;
      const amp = wave.amplitude * scale;
      const k = (2 * Math.PI) / wave.wavelength;
      const c = wave.speed * Math.sqrt(9.8 / k);
      const phase = k * (dx * x + dz * z) - c * k * t;
      posY += amp * Math.sin(phase);
      posX += wave.steepness * amp * dx * Math.cos(phase);
      posZ += wave.steepness * amp * dz * Math.cos(phase);
    }
    return { x: posX, y: posY, z: posZ };
  }

  it('CPU helper与着色器独立复刻在顶点位移上逐点一致', () => {
    const t = 54.87;
    for (const [x, z] of [[0, 0], [117.3, -45.6], [-300, 200], [90, 0], [234.375, -234.375]] as const) {
      const replica = shaderReplicaDisplace(x, z, t);
      const helper = computeGerstnerDisplacement(waves, x, z, t);
      expect(replica.y).toBeCloseTo(scale * helper.y, 9);
      expect(replica.x - x).toBeCloseTo(scale * helper.offsetX, 9);
      expect(replica.z - z).toBeCloseTo(scale * helper.offsetZ, 9);
    }
  });

  it('非顶点采样与着色器复刻的位移三角网插值一致（复审案例 t=54.87）', () => {
    const mesh = gerstnerWaterMeshSpecForTier('high');
    const t = 54.87;
    const cell = mesh.size / mesh.resolution;
    const half = mesh.size / 2;
    for (const [px, pz] of [[90, 0], [0.5, -0.4], [-1234.5, 678.9]] as const) {
      const baseI = Math.floor((px + half) / cell);
      const baseJ = Math.floor((pz + half) / cell);
      let expected: number | null = null;
      for (let di = -1; di <= 1 && expected === null; di += 1) {
        for (let dj = -1; dj <= 1 && expected === null; dj += 1) {
          const i = baseI + di;
          const j = baseJ + dj;
          const v00 = shaderReplicaDisplace(i * cell - half, j * cell - half, t);
          const v10 = shaderReplicaDisplace((i + 1) * cell - half, j * cell - half, t);
          const v01 = shaderReplicaDisplace(i * cell - half, (j + 1) * cell - half, t);
          const v11 = shaderReplicaDisplace((i + 1) * cell - half, (j + 1) * cell - half, t);
          const bary = (a: typeof v00, b: typeof v00, c: typeof v00) => {
            const den = (b.x - a.x) * (c.z - a.z) - (c.x - a.x) * (b.z - a.z);
            if (Math.abs(den) < 1e-12) return null;
            const u = ((px - a.x) * (c.z - a.z) - (c.x - a.x) * (pz - a.z)) / den;
            const v = ((b.x - a.x) * (pz - a.z) - (px - a.x) * (b.z - a.z)) / den;
            const w = 1 - u - v;
            if (u < -1e-6 || v < -1e-6 || w < -1e-6) return null;
            return w * a.y + u * b.y + v * c.y;
          };
          expected = bary(v00, v01, v10) ?? bary(v01, v11, v10);
        }
      }
      expect(expected).not.toBeNull();
      const sampled = sampleVisibleWaterHeight(waves, scale, mesh, 0, 0, px, pz, t);
      expect(sampled).toBeCloseTo(GERSTNER_WATER_BASE_Y + expected!, 9);
    }
  });

  it('shader 源码以不可变原始坐标计算相位', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/resources/simulations/scene/water/gerstner-water-material.ts'),
      'utf-8',
    );
    expect(source).toContain('vec3 basePos = position;');
    expect(source).toContain('phase = k * (dx * basePos.x + dz * basePos.z)');
    expect(source).not.toContain('phase = k * (dx * pos.x + dz * pos.z)');
  });
});

describe('F10: v2.1.3 prop spin clips rotate continuously without a hold tail', () => {
  const V213_PACKAGE_DIR = path.join(process.cwd(), 'public/assets/model-releases/type055-nanchang-101/v2.1.3');

  function glbJsonOf(file: string) {
    const bytes = readFileSync(path.join(V213_PACKAGE_DIR, file));
    const jsonLength = bytes[12] | (bytes[13] << 8) | (bytes[14] << 16) | (bytes[15] << 24);
    return JSON.parse(new TextDecoder().decode(bytes.subarray(20, 20 + jsonLength))) as {
      animations?: {
        name?: string;
        channels: { target: { node: number; path: string }; sampler: number }[];
        samplers: { input: number }[];
      }[];
      accessors?: { count: number; max?: number[] }[];
      nodes?: { name?: string }[];
    };
  }

  // 上游 G05 四键布局对 continuous 关节产生 second_limit→home_end 常量保持段
  // （v2.1.2 clip 3.042s：2s 旋转 + 1s 静止尾，循环播放呈分段停顿）；
  // v2.1.3 管线 trim_continuous_spin_hold 裁净后 clip 以整圈终点（49 帧 ≈ 2.042s）收尾。
  it.each(['type055-nanchang-101-ship-lod0.glb', 'type055-nanchang-101-ship-lod1.glb', 'type055-nanchang-101-ship-lod2.glb'])(
    'prop spin clips in %s end at the full-turn frame with no constant tail',
    (file) => {
      const json = glbJsonOf(file);
      for (const clipName of ['prop_port_spin', 'prop_starboard_spin']) {
        const clip = (json.animations ?? []).find((animation) => animation.name === clipName);
        expect(clip, `${clipName} clip missing`).toBeDefined();
        const rotationChannel = clip!.channels.find((channel) => channel.target.path === 'rotation');
        expect(rotationChannel, `${clipName} rotation channel missing`).toBeDefined();
        const input = json.accessors?.[clip!.samplers[rotationChannel!.sampler].input];
        expect(input).toBeDefined();
        expect(input!.count).toBe(49);
        expect(input!.max?.[0]).toBeCloseTo(49 / 24, 3);
      }
    },
  );

  it.each(['type055-nanchang-101-ship-lod0.glb', 'type055-nanchang-101-ship-lod1.glb', 'type055-nanchang-101-ship-lod2.glb'])(
    'keeps the v2.1.2 flag fix: no FLAG_BONE scale channels in %s',
    (file) => {
      const json = glbJsonOf(file);
      const clip = (json.animations ?? []).find((animation) => animation.name === 'national_flag_wind');
      expect(clip, 'national_flag_wind clip missing').toBeDefined();
      const flagScaleChannels = clip!.channels.filter(
        (channel) => channel.target.path === 'scale'
          && (json.nodes?.[channel.target.node]?.name ?? '').startsWith('FLAG_BONE'),
      );
      expect(flagScaleChannels).toHaveLength(0);
    },
  );
});
