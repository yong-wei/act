'use client';

import { useCallback, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { useTexture } from '@react-three/drei';

import { computeGerstnerDisplacement, GERSTNER_WAVE_SETS, type GerstnerWave } from './gerstner-waves';
import { packHullExclusion, type HullExclusionBox } from './hull-exclusion';
import { MAX_SHORE_SEGMENTS } from './gerstner-water-material';
import type { MarineShoreSegment } from '../environment/scene-layouts';
import { shorelineAmplitudeAttenuation } from '../environment/scene-layouts';
import {
  bandCellSize,
  bandLimitWaves,
  FAR_FIELD_BAND_SPECS,
  NEAR_FIELD_BAND_SPECS,
  nearFieldEnvelope,
  type OceanMeshBandSpec,
} from './ocean-bands';
import { createGerstnerWaterMaterial, cubeUvDefinesForHeight } from './gerstner-water-material';
import { MarineFoamFieldProvider, useMarineFoamField } from './foam-history-layer';
import { MarinePlanarReflection } from '../environment/planar-reflection';
import { useMarineVisualTime } from '../frame/marine-frame-provider';
import { DEFAULT_ENVIRONMENT_PRESET_ID, getEnvironmentPreset } from '../environment/environment-presets';
import { simulationScenePalette } from '../../components/simulation-theme';

/** 水面网格的世界基准高度（mesh position.y）：贴水覆盖层（折线/尾迹）必须叠加同一基准。 */
export const GERSTNER_WATER_BASE_Y = -1;

/** 场景默认海况（GerstnerWater 未显式传入时使用）；CPU 采样必须复用同一海况与振幅倍率。 */
export const DEFAULT_GERSTNER_SEA_STATE = 3;

/** 海面尺寸（米）：GerstnerWater 与 CPU 采样共用同一网格尺寸。 */
export const GERSTNER_WATER_SIZE = 60000;

/** 质量档位 → 网格细分（GerstnerWater 与 CPU 采样共用同一分辨率）。 */
export const GERSTNER_WATER_RESOLUTION_BY_TIER = {
  high: 256,
  medium: 128,
  low: 64,
} as const;

export type GerstnerWaterTier = keyof typeof GERSTNER_WATER_RESOLUTION_BY_TIER;

export interface GerstnerWaterMeshSpec {
  readonly size: number;
  readonly resolution: number;
}

/** 档位对应的渲染网格规格：CPU 采样必须按同一网格做插值。 */
export function gerstnerWaterMeshSpecForTier(tier: GerstnerWaterTier): GerstnerWaterMeshSpec {
  return { size: GERSTNER_WATER_SIZE, resolution: GERSTNER_WATER_RESOLUTION_BY_TIER[tier] };
}

/**
 * 基础交互波场（#2097）：船体姿态与交互采样的档位无关基准——画质只裁剪渲染
 * 细节（波分量数/网格细分），不得改变交互基准场；可见低档水面是同一场的近似。
 */
export const MARINE_BASE_INTERACTION_WAVES: readonly GerstnerWave[] = GERSTNER_WAVE_SETS.high;
export const MARINE_BASE_INTERACTION_MESH_SPEC: GerstnerWaterMeshSpec =
  gerstnerWaterMeshSpecForTier('high');

/**
 * 带限近场（#2098）：交互网格固定 2048 m × 256²（8 m 间距，档位无关），
 * 承载 λ≥32 m 频带（4 间隔/最短波长）；更短波交给微法线（#2100）。
 * 近场可见曲面对基础场的声明近似容差：被裁频带的振幅和 × 海况倍率。
 */
export const NEAR_FIELD_INTERVALS_PER_WAVELENGTH = 4;
export const NEAR_FIELD_MESH_SPEC: GerstnerWaterMeshSpec = {
  size: NEAR_FIELD_BAND_SPECS.high.size,
  resolution: NEAR_FIELD_BAND_SPECS.high.resolution,
};
/** 近场带限波组（档位无关）：CPU 可见曲面采样与 GPU 近场网格共用。 */
export const NEAR_FIELD_VISIBLE_WAVES: readonly GerstnerWave[] = bandLimitWaves(
  GERSTNER_WAVE_SETS.high,
  bandCellSize(NEAR_FIELD_MESH_SPEC as OceanMeshBandSpec),
  NEAR_FIELD_INTERVALS_PER_WAVELENGTH,
);
/** 近场可见曲面对基础交互场的声明近似容差（米）：被裁频带振幅和 × 海况 6 倍率（0.98）+ 8 m 三角网格对保留频带的插值误差上界（四轮复审实测 ~0.14、原则界 ~0.25），取 1.25。 */
export const NEAR_FIELD_APPROXIMATION_TOLERANCE_METERS = 1.25;
/** 远场网格（按画质档分辨率）：该尺度无可解析几何波，承载基面与视觉过渡。 */
export function farFieldMeshSpecForTier(tier: GerstnerWaterTier): GerstnerWaterMeshSpec {
  const spec = FAR_FIELD_BAND_SPECS[tier];
  return { size: spec.size, resolution: spec.resolution };
}
/** 远场带限波组：按远场间距裁剪（当前频谱下为空 → 几何平基面，不混叠）。 */
export function farFieldVisibleWavesForTier(tier: GerstnerWaterTier): readonly GerstnerWave[] {
  return bandLimitWaves(
    GERSTNER_WAVE_SETS.high,
    bandCellSize(FAR_FIELD_BAND_SPECS[tier]),
  );
}

/** 海况等级 → 振幅倍率（与 createGerstnerWaterMaterial 的 uAmplitudeScale 同一公式）。 */
export function gerstnerAmplitudeScale(seaState: number): number {
  return 0.3 + (seaState - 1) * 0.34;
}

interface DisplacedVertex {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

/** 与顶点着色器同一公式：解析场位移（含振幅倍率的水平分量）。相位取世界坐标（局部 + 网格原点），保证同一世界点/时间的波相位不随原点移动变化；水平位移平移不变，返回值保持局部坐标供三角包含测试。 */
function displaceVertex(
  waves: readonly GerstnerWave[],
  amplitudeScale: number,
  x: number,
  z: number,
  originX: number,
  originZ: number,
  timeSeconds: number,
): DisplacedVertex {
  const displacement = computeGerstnerDisplacement(waves, x + originX, z + originZ, timeSeconds);
  return {
    x: x + amplitudeScale * displacement.offsetX,
    y: amplitudeScale * displacement.y,
    z: z + amplitudeScale * displacement.offsetZ,
  };
}

/** 位移后 XZ 平面内的重心插值高度；点在三角形外返回 null。 */
function barycentricHeight(
  a: DisplacedVertex,
  b: DisplacedVertex,
  c: DisplacedVertex,
  x: number,
  z: number,
): number | null {
  const v0x = b.x - a.x;
  const v0z = b.z - a.z;
  const v1x = c.x - a.x;
  const v1z = c.z - a.z;
  const v2x = x - a.x;
  const v2z = z - a.z;
  const denominator = v0x * v1z - v1x * v0z;
  if (Math.abs(denominator) < 1e-12) return null;
  const u = (v2x * v1z - v1x * v2z) / denominator;
  const v = (v0x * v2z - v2x * v0z) / denominator;
  const w = 1 - u - v;
  const EPSILON = 1e-6;
  if (u < -EPSILON || v < -EPSILON || w < -EPSILON) return null;
  return w * a.y + u * b.y + v * c.y;
}

/**
 * 与可见水面同一坐标基准、同一细分曲面的 CPU 采样。
 *
 * GerstnerWater 网格逐帧平移到舰位、几何体已烘焙 -90° X 旋转（局部 XZ 平面、+Y 朝上，
 * 见 createGerstnerWaterGeometry），因此世界坐标必须先减去网格原点（舰位）。
 * 顶点着色器只在网格顶点计算 Gerstner 位移，顶点之间的可见水面是 GPU 对位移后
 * 三角形的线性插值——high 档 60000/256 ≈ 234 米边长，远大于最短波长，解析场采样
 * 与可见曲面在非顶点位置可差数米。采样必须还原位移后三角网格：在未位移网格定位
 * 目标单元后，于其 3×3 邻域内按与 PlaneGeometry 索引 (a,b,d),(b,c,d) 同一剖分
 * 逐一做位移后 XZ 包含测试并重心插值（位移顶点共享、曲面连续，目标必落在邻域
 * 某个位移后三角形内；水平位移 ≪ 单元边长，更大邻域无意义）。
 * 使船体、尾迹、贴水线与用户实际看到的曲面逐点一致。
 */
export function sampleVisibleWaterHeight(
  waves: readonly GerstnerWave[],
  amplitudeScale: number,
  mesh: GerstnerWaterMeshSpec,
  originX: number,
  originZ: number,
  worldX: number,
  worldZ: number,
  timeSeconds: number,
  envelope?: (localX: number, localZ: number) => number,
): number {
  const targetX = worldX - originX;
  const targetZ = worldZ - originZ;
  const cell = mesh.size / mesh.resolution;
  const half = mesh.size / 2;
  const lastCell = mesh.resolution - 1;
  const baseI = Math.min(Math.max(Math.floor((targetX + half) / cell), 0), lastCell);
  const baseJ = Math.min(Math.max(Math.floor((targetZ + half) / cell), 0), lastCell);

  const cornerCache = new Map<number, DisplacedVertex>();
  const corner = (i: number, j: number): DisplacedVertex => {
    const key = i * (mesh.resolution + 1) + j;
    let vertex = cornerCache.get(key);
    if (!vertex) {
      vertex = displaceVertex(waves, amplitudeScale * (envelope?.(i * cell - half, j * cell - half) ?? 1), i * cell - half, j * cell - half, originX, originZ, timeSeconds);
      cornerCache.set(key, vertex);
    }
    return vertex;
  };

  const tryCell = (i: number, j: number): number | null => {
    if (i < 0 || j < 0 || i > lastCell || j > lastCell) return null;
    const v00 = corner(i, j);
    const v10 = corner(i + 1, j);
    const v01 = corner(i, j + 1);
    const v11 = corner(i + 1, j + 1);
    return barycentricHeight(v00, v01, v10, targetX, targetZ)
      ?? barycentricHeight(v01, v11, v10, targetX, targetZ);
  };

  const center = tryCell(baseI, baseJ);
  if (center !== null) return GERSTNER_WATER_BASE_Y + center;
  for (const [di, dj] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]] as const) {
    const height = tryCell(baseI + di, baseJ + dj);
    if (height !== null) return GERSTNER_WATER_BASE_Y + height;
  }
  // 数值边界兜底（目标超出网格边缘）：返回最近角点位移高度
  return GERSTNER_WATER_BASE_Y + corner(baseI, baseJ).y;
}

export interface VisibleWaterSurfaceQuery {
  /** 批量共享角点缓存的高度采样（worldX/worldZ 为世界坐标）。 */
  readonly heightAt: (worldX: number, worldZ: number) => number;
}

/**
 * 近场可见曲面批量查询（#2098）：一次构建共享角点缓存，多点采样不再逐点新建
 * Map；带限波组 + 近场包络与 GPU 近场网格同一参数。
 */
export interface NearFieldSurfaceQueryOptions {
  /** 岸线段（#2117）：CPU 查询与 GPU 曲面同一衰减输入（缺省无衰减）。 */
  readonly shoreSegments?: readonly MarineShoreSegment[];
  readonly shoreFadeBandMeters?: number;
}

export function createNearFieldSurfaceQuery(
  amplitudeScale: number,
  originX: number,
  originZ: number,
  timeSeconds: number,
  options?: NearFieldSurfaceQueryOptions,
): VisibleWaterSurfaceQuery {
  const mesh = NEAR_FIELD_MESH_SPEC;
  const cell = mesh.size / mesh.resolution;
  const half = mesh.size / 2;
  const lastCell = mesh.resolution - 1;
  const shoreSegments = options?.shoreSegments;
  const shoreFadeBand = options?.shoreFadeBandMeters ?? 400;
  const cornerCache = new Map<number, DisplacedVertex>();
  const heightAtLocal = (targetX: number, targetZ: number): number => {
    const baseI = Math.min(Math.max(Math.floor((targetX + half) / cell), 0), lastCell);
    const baseJ = Math.min(Math.max(Math.floor((targetZ + half) / cell), 0), lastCell);
    const corner = (i: number, j: number): DisplacedVertex => {
      const key = i * (mesh.resolution + 1) + j;
      let vertex = cornerCache.get(key);
      if (!vertex) {
        // 包络按角点自身局部坐标求值（与 GPU 逐顶点同口径）；角点缓存后结果确定、与调用顺序无关。
        const cornerLocalX = i * cell - half;
        const cornerLocalZ = j * cell - half;
        const cornerEnvelope = nearFieldEnvelope(cornerLocalX, cornerLocalZ, mesh.size);
        // 岸线衰减（#2117）：与 GPU 顶点同一公式/输入——CPU/GPU 同一表面定义。
        const shoreAttenuation = shoreSegments && shoreSegments.length > 0
          ? shorelineAmplitudeAttenuation(shoreSegments, cornerLocalX + originX, cornerLocalZ + originZ, shoreFadeBand)
          : 1;
        vertex = displaceVertex(NEAR_FIELD_VISIBLE_WAVES, amplitudeScale * cornerEnvelope * shoreAttenuation, cornerLocalX, cornerLocalZ, originX, originZ, timeSeconds);
        cornerCache.set(key, vertex);
      }
      return vertex;
    };
    const tryCell = (i: number, j: number): number | null => {
      if (i < 0 || j < 0 || i > lastCell || j > lastCell) return null;
      const v00 = corner(i, j);
      const v10 = corner(i + 1, j);
      const v01 = corner(i, j + 1);
      const v11 = corner(i + 1, j + 1);
      return barycentricHeight(v00, v01, v10, targetX, targetZ)
        ?? barycentricHeight(v01, v11, v10, targetX, targetZ);
    };
    const center = tryCell(baseI, baseJ);
    if (center !== null) return GERSTNER_WATER_BASE_Y + center;
    for (const [di, dj] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]] as const) {
      const height = tryCell(baseI + di, baseJ + dj);
      if (height !== null) return GERSTNER_WATER_BASE_Y + height;
    }
    return GERSTNER_WATER_BASE_Y + corner(baseI, baseJ).y;
  };
  return {
    heightAt: (worldX, worldZ) => heightAtLocal(worldX - originX, worldZ - originZ),
  };
}

/**
 * 水面几何：-90° X 旋转必须烘焙进几何体，不能挂在 mesh rotation 上。
 * PlaneGeometry 原始平面在 XY（z 恒 0）；mesh 挂 rotation 时 shader 看到的
 * position.z 恒为 0（相位沿一维退化）、写入 position.y 的垂向位移落到世界水平轴。
 * 烘焙后局部即 XZ 平面、+Y 朝上，与 shader/CPU 采样同一坐标约定。
 */
export function createGerstnerWaterGeometry(size: number, resolution: number): THREE.PlaneGeometry {
  const geometry = new THREE.PlaneGeometry(size, size, resolution, resolution);
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

/** 未显式传色时的默认水色组：与默认环境预设（开阔海）同一真源，不再各自硬编码。 */
const DEFAULT_WATER_COLORS = getEnvironmentPreset(DEFAULT_ENVIRONMENT_PRESET_ID).water;

/** QA 方向诊断（#2118）：?qa=marine-env 让环境倒影随时间旋转——证明水面
 * 真在读环境（PMREM），而不是一片纯色天空的静态混色。 */
const ENV_QA_SPIN =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).has('qa', 'marine-env');

/** QA 旋转复用对象（与 three WebGLMaterials 同构：绕 Y 旋转 + transpose）。 */
const ENV_QA_SPIN_MATRIX = new THREE.Matrix4();

/** QA 浅水消费者关闭开关（#2119）：?qa-shallow=off——逐片元跳过岸线循环。 */
const SHALLOW_QA_DISABLED =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('qa-shallow') === 'off';

/** QA 平面反射关闭开关（#2118）：?qa-planar=off。 */
const PLANAR_QA_DISABLED =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('qa-planar') === 'off';

/** QA 归因开关（#2116）：?qa-micro=off 关闭全部微法线（挂载时解析一次）。 */
const MICRO_QA_DISABLED =
  typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('qa-micro') === 'off';

export interface GerstnerWaterProps {
  /** 质量档位：波分量数与网格细分随之缩放。 */
  readonly tier?: keyof typeof GERSTNER_WAVE_SETS;
  /** 船舶位置（海面跟随，与旧 WaveWater 同语义）。 */
  readonly shipPosition?: { readonly x: number; readonly z: number };
  /** 逐帧采样船舶位置的回调（替代 shipPosition，避免依赖 React 重渲染传播帧数据）。 */
  readonly positionSampler?: () => { readonly x: number; readonly z: number };
  /** 海面尺寸（米）。 */
  readonly size?: number;
  /** 海况等级 1-6，映射为振幅倍率。 */
  readonly seaState?: number;
  readonly waterColor?: string;
  readonly deepColor?: string;
  readonly horizonColor?: string;
  readonly foamColor?: string;
  readonly sunDirection?: THREE.Vector3;
  /** 同源太阳辐照（#2100）：preset.sun.intensity / 预设最大值；缺省 1。 */
  readonly sunIllumination?: number;
  /** 船壳排水排除框（#2101，船体局部坐标）；缺省无排除。 */
  readonly hullExclusionSampler?: () => readonly HullExclusionBox[] | null;
  readonly shipHeadingSampler?: () => number;
  /** 岸线段（#2102）：显示海面波幅随距岸衰减（渲染输入）。 */
  readonly shoreSegments?: readonly MarineShoreSegment[];
  readonly shoreFadeBandMeters?: number;
  /** 挖泥羽流（#2102 六轮复审）：合入水面片元着色（贴合动态波面）。 */
  readonly sedimentPlume?: { x: number; z: number; radiusMeters: number; opacity: number } | null;
  /** 实验重置令牌（#2115）：变化时清空泡沫历史场（与尾迹 key 同一重置源）。 */
  readonly resetToken?: number;
  /**
   * 实验隔离（#2121 对照页）：跳过内置 60km 远场网格（由实验分支提供
   * 统一的远场负载）。缺省 false（生产路径不变）。
   */
  readonly disableFarField?: boolean;
}

/** 单个带限水网格（#2098 内部组件）：几何/材质随波组与包络参数构建，逐帧写时间与原点。 */
function BandWaterMesh({
  waves,
  meshSpec,
  amplitudeScale,
  envelopeSizeMeters,
  nearCutoutHalfSizeMeters,
  microNormalTier,
  sunIllumination,
  hullExclusionSampler,
  shipHeadingSampler,
  shoreSegments,
  shoreFadeBandMeters,
  sedimentPlume,
  marineVisualTime,
  positionSampler,
  shipPosition,
  waterColor,
  deepColor,
  horizonColor,
  foamColor,
  sunDirection,
  foamTexture,
}: {
  readonly waves: readonly GerstnerWave[];
  readonly meshSpec: GerstnerWaterMeshSpec;
  readonly amplitudeScale: number;
  readonly envelopeSizeMeters: number;
  readonly nearCutoutHalfSizeMeters: number;
  readonly microNormalTier: 'high' | 'medium' | 'low';
  readonly sunIllumination: number;
  readonly hullExclusionSampler?: () => readonly HullExclusionBox[] | null;
  readonly shipHeadingSampler?: () => number;
  readonly shoreSegments?: readonly MarineShoreSegment[];
  readonly shoreFadeBandMeters: number;
  readonly sedimentPlume: { x: number; z: number; radiusMeters: number; opacity: number } | null;
  readonly marineVisualTime: (state: { clock: { elapsedTime: number; getElapsedTime?: () => number } }, delta: number) => number;
  readonly positionSampler?: () => { readonly x: number; readonly z: number } | undefined;
  readonly shipPosition?: { readonly x: number; readonly z: number };
  readonly waterColor: string;
  readonly deepColor: string;
  readonly horizonColor: string;
  readonly foamColor: string;
  readonly sunDirection: THREE.Vector3;
  readonly foamTexture: THREE.Texture;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const scene = useThree((state) => state.scene);
  // 泡沫历史密度场（#2115）：宿主 Provider 注入；材质消费密度纹理，域原点逐帧跟随。
  const foamField = useMarineFoamField();

  const geometry = useMemo(
    () => createGerstnerWaterGeometry(meshSpec.size, meshSpec.resolution),
    [meshSpec.size, meshSpec.resolution]
  );

  const material = useMemo(
    () => createGerstnerWaterMaterial({
      waves,
      waterColor,
      deepColor,
      horizonColor,
      foamColor,
      sunDirection,
      foamTexture,
      amplitudeScale,
      envelopeSizeMeters,
      nearCutoutHalfSizeMeters,
      microNormalTier,
      microEnabled: !MICRO_QA_DISABLED,
      sunIllumination,
      shoreSegments,
      shoreFadeBandMeters,
      foamField: foamField
        ? { texture: foamField.texture, domainMeters: foamField.domainMeters, resolution: foamField.field.resolution }
        : null,
    }),
    [waves, waterColor, deepColor, horizonColor, foamColor, sunDirection, foamTexture, amplitudeScale, envelopeSizeMeters, nearCutoutHalfSizeMeters, microNormalTier, sunIllumination, shoreSegments, shoreFadeBandMeters, foamField]
  );
  // 岸线段打包（#2102）：静态声明 → uniform 数组一次写入。
  useMemo(() => {
    const array = material.uniforms.uShoreSegments.value as Float32Array;
    array.fill(0);
    (shoreSegments ?? []).slice(0, MAX_SHORE_SEGMENTS).forEach((segment, index) => {
      const base = index * 4;
      array[base] = segment.from[0];
      array[base + 1] = segment.from[1];
      array[base + 2] = segment.to[0];
      array[base + 3] = segment.to[1];
      // 作者态岸深随段上传（#2102 四轮复审：浅水呈现的渲染输入）。
      (material.uniforms.uShoreDepths.value as Float32Array)[index] = segment.shoreDepthMeters;
    });
    material.uniforms.uShoreSegmentCount.value = Math.min((shoreSegments ?? []).length, MAX_SHORE_SEGMENTS);
    material.uniforms.uShoreFadeBand.value = shoreFadeBandMeters;
    // 羽流 uniform（#2102 六轮复审）：片元合成数据源（缺省零半径 = 关闭）。
    material.uniforms.uPlumeCenter.value.set(sedimentPlume?.x ?? 0, sedimentPlume?.z ?? 0);
    material.uniforms.uPlumeRadius.value = sedimentPlume?.radiusMeters ?? 0;
    material.uniforms.uPlumeOpacity.value = sedimentPlume?.opacity ?? 0;
  }, [material, shoreSegments, shoreFadeBandMeters, sedimentPlume]);

  useFrame((state, delta) => {
    material.uniforms.uTime.value = marineVisualTime(state, delta);
    const sampled = positionSampler?.() ?? shipPosition;
    if (meshRef.current && sampled) {
      meshRef.current.position.x = sampled.x;
      meshRef.current.position.z = sampled.z;
      material.uniforms.uWorldOrigin.value.set(sampled.x, sampled.z);
    }
    if (material.uniforms.uShallowFxEnabled.value !== (SHALLOW_QA_DISABLED ? 0 : 1)) {
      material.uniforms.uShallowFxEnabled.value = SHALLOW_QA_DISABLED ? 0 : 1;
    }
    // 泡沫场域原点（#2115）：域按量化步长重定位（非逐帧平移），材质按域原点采样。
    if (foamField) {
      material.uniforms.uFoamOrigin.value.set(foamField.field.originX, foamField.field.originZ);
    }
    // 环境辐射（#2118）：与船体 PBR 同一 PMREM（scene.userData 跨兄弟共享）。
    // 首次绑定/高度变化时补 CubeUV defines 并重编译；QA 旋转诊断经
    // envMapRotation 随视觉时间旋转采样方向。
    const env = (scene.userData as { marineEnvRadiance?: { texture: THREE.Texture; cubeUVHeight: number; intensity: number } }).marineEnvRadiance;
    if (env && material.uniforms.envMap.value !== env.texture) {
      material.uniforms.envMap.value = env.texture;
      material.uniforms.envMapIntensity.value = env.intensity;
      material.uniforms.uEnvEnabled.value = 1;
      let definesChanged = false;
      if (material.defines.USE_ENVMAP === undefined) {
        material.defines.USE_ENVMAP = '';
        material.defines.ENVMAP_TYPE_CUBE_UV = '';
        definesChanged = true;
      }
      const defines = cubeUvDefinesForHeight(env.cubeUVHeight);
      for (const [key, value] of Object.entries(defines)) {
        if (material.defines[key] !== value) {
          material.defines[key] = value;
          definesChanged = true;
        }
      }
      if (definesChanged) material.needsUpdate = true;
    } else if (!env && material.uniforms.uEnvEnabled.value !== 0) {
      material.uniforms.uEnvEnabled.value = 0;
      material.uniforms.envMapIntensity.value = 0;
    }
    if (ENV_QA_SPIN && material.uniforms.uEnvEnabled.value > 0) {
      const angle = state.clock.getElapsedTime() * 0.4;
      // 与船体同一路径（复审修复）：three WebGLMaterials 对内建材质把
      // scene.environmentRotation 的旋转矩阵转置后传入 envMapRotation——水面
      // uniform 按 setFromMatrix4(makeRotationFromEuler).transpose() 同构构建，
      // 两侧方向特征一致（不一边正转一边反转）。
      (material.uniforms.envMapRotation.value as THREE.Matrix3)
        .setFromMatrix4(ENV_QA_SPIN_MATRIX.makeRotationY(angle))
        .transpose();
      scene.environmentRotation?.set(0, angle, 0);
    }
    // 平面反射（#2118 受控高档）：反射组件经 scene.userData 提供纹理矩阵。
    const planar = (scene.userData as { marinePlanarReflection?: { texture: THREE.Texture; matrix: THREE.Matrix4; strength: number; planeY: number } }).marinePlanarReflection;
    if (planar) {
      material.uniforms.uPlanarTex.value = planar.texture;
      (material.uniforms.uPlanarMatrix.value as THREE.Matrix4).copy(planar.matrix);
      material.uniforms.uPlanarStrength.value = planar.strength;
      material.uniforms.uPlanarPlaneY.value = planar.planeY;
    } else if (material.uniforms.uPlanarStrength.value !== 0) {
      material.uniforms.uPlanarStrength.value = 0;
    }
    // 船壳排水排除（#2101）：逐帧写入船体局部框与船朝向（跟船网格原点=船位）。
    if (hullExclusionSampler) {
      const boxes = hullExclusionSampler();
      const packed = packHullExclusion(boxes ?? []);
      const array = material.uniforms.uHullExclusionBoxes.value as Float32Array;
      array.fill(0);
      packed.boxes.forEach(([cx, cz, hx, hz], index) => {
        const base = index * 4;
        array[base] = cx;
        array[base + 1] = cz;
        array[base + 2] = hx;
        array[base + 3] = hz;
      });
      material.uniforms.uHullExclusionCount.value = packed.count;
      material.uniforms.uShipHeading.value = shipHeadingSampler?.() ?? 0;
    }
  });

  return (
    <mesh
      ref={meshRef}
      geometry={geometry}
      material={material}
      position={[0, GERSTNER_WATER_BASE_Y, 0]}
    />
  );
}

/**
 * GPU Gerstner 海面（#2098 带限双网格）：近场交互网格（2048 m × 256²，档位无关，
 * λ≥32 m 频带 + 外缘幅度包络）+ 远场平面（60 km，按画质档分辨率；该尺度无可解
 * 析几何波 → 基面 + 视觉过渡，短波不混叠成假长波）。两网格共享世界相位、海况
 * 倍率、色彩与跟船原点；接缝处包络衰减到 0，两侧同为基准高度，无裂缝。
 */
export function GerstnerWater({
  tier = 'high',
  shipPosition,
  positionSampler,
  resetToken,
  disableFarField = false,
  seaState = DEFAULT_GERSTNER_SEA_STATE,
  waterColor = DEFAULT_WATER_COLORS.waterColor,
  deepColor = DEFAULT_WATER_COLORS.deepColor,
  horizonColor = DEFAULT_WATER_COLORS.horizonColor,
  foamColor = simulationScenePalette.waterFoam,
  sunDirection = new THREE.Vector3(0.45, 0.75, 0.35),
  sunIllumination = 1,
  hullExclusionSampler,
  shipHeadingSampler,
  shoreSegments,
  shoreFadeBandMeters = 400,
  sedimentPlume = null,
}: GerstnerWaterProps) {
  const foamTexture = useTexture('/assets/simulation-scene/textures/ocean-foam-noise-alpha.png');
  // 共享视觉时间：Provider 场景同帧唯一（暂停/倍速政策一致）；未接入场景回退 R3F 时钟。
  const marineVisualTime = useMarineVisualTime();

  foamTexture.wrapS = THREE.RepeatWrapping;
  foamTexture.wrapT = THREE.RepeatWrapping;

  const amplitudeScale = useMemo(() => gerstnerAmplitudeScale(seaState), [seaState]);
  const farWaves = useMemo(() => farFieldVisibleWavesForTier(tier), [tier]);
  const farSpec = useMemo(() => farFieldMeshSpecForTier(tier), [tier]);

  return (
    // 泡沫历史场宿主（#2115）：每场景一个跟船密度场；场内尾迹沉积、自然白浪
    // 注入与水面材质消费共用同一状态（Canvas 内 WakeTrail 经 context 接入）。
    <MarineFoamFieldProvider
      tier={tier}
      seaState={seaState}
      waves={NEAR_FIELD_VISIBLE_WAVES}
      amplitudeScale={amplitudeScale}
      positionSampler={positionSampler ?? (shipPosition ? () => shipPosition : undefined)}
      resetToken={resetToken}
    >
      {/* 受控高档平面反射（#2118）：高档且未显式关闭时启用（运动触发更新）。 */}
      <MarinePlanarReflection
        planeY={GERSTNER_WATER_BASE_Y}
        enabled={tier === 'high' && !PLANAR_QA_DISABLED}
        subjectPositionSampler={positionSampler ?? (shipPosition ? () => shipPosition : undefined)}
        subjectHeadingSampler={shipHeadingSampler}
      />
      <group name="marine-water">
      {disableFarField ? null : (
        <BandWaterMesh
          waves={farWaves}
          meshSpec={farSpec}
          amplitudeScale={amplitudeScale}
          envelopeSizeMeters={0}
          nearCutoutHalfSizeMeters={NEAR_FIELD_MESH_SPEC.size / 2}
          /* #2116 复审：远场与近场同微法线档——接缝两侧光学连续（高 DPR/窄 FOV
             下近场边缘微法线可达满幅；远距离由脚印过滤自然衰减 + 能量补偿）。 */
          microNormalTier={tier}
          sunIllumination={sunIllumination}
          hullExclusionSampler={hullExclusionSampler}
          shipHeadingSampler={shipHeadingSampler}
          shoreSegments={shoreSegments}
          shoreFadeBandMeters={shoreFadeBandMeters}
          sedimentPlume={null}
          marineVisualTime={marineVisualTime}
          positionSampler={positionSampler}
          shipPosition={shipPosition}
          waterColor={waterColor}
          deepColor={deepColor}
          horizonColor={horizonColor}
          foamColor={foamColor}
          sunDirection={sunDirection}
          foamTexture={foamTexture}
        />
      )}
      <BandWaterMesh
        waves={NEAR_FIELD_VISIBLE_WAVES}
        meshSpec={NEAR_FIELD_MESH_SPEC}
        amplitudeScale={amplitudeScale}
        envelopeSizeMeters={NEAR_FIELD_MESH_SPEC.size}
        nearCutoutHalfSizeMeters={0}
        microNormalTier={tier}
        sunIllumination={sunIllumination}
        hullExclusionSampler={hullExclusionSampler}
        shipHeadingSampler={shipHeadingSampler}
        shoreSegments={shoreSegments}
        shoreFadeBandMeters={shoreFadeBandMeters}
        sedimentPlume={sedimentPlume}
        marineVisualTime={marineVisualTime}
        positionSampler={positionSampler}
        shipPosition={shipPosition}
        waterColor={waterColor}
        deepColor={deepColor}
        horizonColor={horizonColor}
        foamColor={foamColor}
        sunDirection={sunDirection}
        foamTexture={foamTexture}
      />
      </group>
    </MarineFoamFieldProvider>
  );
}

/**
 * 帧记忆化的近场水高采样 hook（#2117）：统一时间源与表面输入。
 *
 * - 时间 = 共享视觉时钟（useMarineVisualTime：Provider 场景同帧唯一、暂停/倍速
 *   政策一致；无 Provider 场景回退 R3F 时钟——清除各 rig 的独立 wall-clock 旁路）。
 * - 表面 = createNearFieldSurfaceQuery（带限波组 + 包络 + 岸线衰减），与 GPU
 *   近场网格同一参数；同一 (time, origin, 参数) 只构建一次查询，本帧多点共享角点缓存。
 */
export function useNearFieldWaterHeight({
  positionSampler,
  seaState = DEFAULT_GERSTNER_SEA_STATE,
  shoreSegments,
  shoreFadeBandMeters = 400,
}: {
  readonly positionSampler: () => { readonly x: number; readonly z: number } | undefined;
  readonly seaState?: number;
  readonly shoreSegments?: readonly MarineShoreSegment[];
  readonly shoreFadeBandMeters?: number;
}): (x?: number, z?: number) => number {
  const marineVisualTime = useMarineVisualTime();
  const timeRef = useRef(0);
  const cacheRef = useRef<{
    key: string;
    query: ReturnType<typeof createNearFieldSurfaceQuery>;
  } | null>(null);
  useEffect(() => {
    // 重挂载（resetToken key）时丢弃旧查询缓存。
    cacheRef.current = null;
  }, []);
  useFrame((state, delta) => {
    timeRef.current = marineVisualTime(state, delta);
  });
  const amplitudeScale = gerstnerAmplitudeScale(seaState);
  const paramsKey = `${amplitudeScale}|${shoreFadeBandMeters}|${shoreSegments?.length ?? 0}`;
  return useCallback(
    (x?: number, z?: number) => {
      const origin = positionSampler();
      if (!origin) return GERSTNER_WATER_BASE_Y;
      const key = `${timeRef.current}|${origin.x}|${origin.z}|${paramsKey}`;
      let cached = cacheRef.current;
      if (!cached || cached.key !== key) {
        cached = {
          key,
          query: createNearFieldSurfaceQuery(
            amplitudeScale,
            origin.x,
            origin.z,
            timeRef.current,
            shoreSegments && shoreSegments.length > 0
              ? { shoreSegments, shoreFadeBandMeters }
              : undefined,
          ),
        };
        cacheRef.current = cached;
      }
      return cached.query.heightAt(x ?? origin.x, z ?? origin.z);
    },
    [positionSampler, amplitudeScale, paramsKey, shoreSegments, shoreFadeBandMeters],
  );
}
