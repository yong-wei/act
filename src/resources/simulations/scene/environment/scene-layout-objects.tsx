'use client';

import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame, useThree } from '@react-three/fiber';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

import {
  MARINE_SCENE_LAYOUTS,
  type MarineEnvironmentObject,
  type MarineSceneLayoutId,
} from './scene-layouts';

/**
 * 布局环境物（#2102 建立 / #2119 精修）：
 * - 可辨识复合轮廓（岸桥=门吊桁架、岛屿=多峰、码头=桩基栈桥、储罐=穹顶罐、
 *   浮标=带顶标立杆、防波堤=堆石堤断面）——替代单一锥体/立柱占位；
 * - 真实按距 LOD（THREE.LOD：近景复合轮廓 → 远景简化基元）；
 * - 重复物实例批处理（同 kind ≥2 时 InstancedMesh，一次 draw）；
 * - 世界锚定（世界坐标静态放置，不随相机/原点移动）。
 * 同栈复用现有 water/sky/lighting/quality 模块——不创建第二套海洋或渲染器。
 */

/** 单位尺度几何构造（y 向上、原点在底部；实例矩阵按 object.scale 缩放）。 */
function unitBox(w: number, h: number, d: number, x = 0, y = 0, z = 0): THREE.BufferGeometry {
  const geometry = new THREE.BoxGeometry(w, h, d);
  geometry.translate(x, y, z);
  return geometry;
}

function unitCylinder(
  top: number,
  bottom: number,
  height: number,
  x = 0,
  y = 0,
  z = 0,
  segments = 12,
): THREE.BufferGeometry {
  const geometry = new THREE.CylinderGeometry(top, bottom, height, segments);
  geometry.translate(x, y, z);
  return geometry;
}

/** 岸桥（门吊）：四腿门架 + 顶梁 + 前伸臂 + 配重 + 机房（可辨识港口剪影）。 */
function buildCraneGeometry(): THREE.BufferGeometry {
  const legOffset = 0.32;
  const legs: THREE.BufferGeometry[] = [];
  for (const [sx, sz] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
    legs.push(unitBox(0.1, 0.95, 0.1, sx * legOffset, 0.475, sz * legOffset * 0.6));
  }
  return mergeGeometries([
    ...legs,
    unitBox(0.86, 0.07, 0.5, 0, 0.99, 0), // 顶梁
    unitBox(0.62, 0.05, 0.08, 0.16, 1.06, 0), // 前伸臂
    unitBox(0.18, 0.1, 0.3, -0.36, 1.03, 0), // 配重
    unitBox(0.2, 0.12, 0.24, -0.1, 1.06, 0), // 机房
  ], false) as THREE.BufferGeometry;
}

/** 多峰岛屿：三锥叠置的山脊剪影（替代单锥占位）。 */
function buildIslandGeometry(): THREE.BufferGeometry {
  return mergeGeometries([
    new THREE.ConeGeometry(0.7, 0.5, 9),
    (() => {
      const cone = new THREE.ConeGeometry(0.46, 0.34, 8);
      cone.translate(0.34, 0, -0.18);
      cone.rotateY(0.7);
      return cone;
    })(),
    (() => {
      const cone = new THREE.ConeGeometry(0.38, 0.26, 8);
      cone.translate(-0.3, 0, 0.26);
      cone.rotateY(-0.4);
      return cone;
    })(),
  ], false) as THREE.BufferGeometry;
}

/** 码头：栈桥面 + 六桩（水面接触可信）。 */
function buildPierGeometry(): THREE.BufferGeometry {
  const pilings: THREE.BufferGeometry[] = [];
  for (const [sx, sz] of [[-0.36, -0.3], [0.36, -0.3], [-0.36, 0.3], [0.36, 0.3], [0, -0.3], [0, 0.3]] as const) {
    pilings.push(unitCylinder(0.05, 0.05, 0.5, sx, -0.25, sz, 8));
  }
  return mergeGeometries([unitBox(1, 0.12, 0.76, 0, 0.06, 0), ...pilings], false) as THREE.BufferGeometry;
}

/** 储罐：罐体 + 穹顶（罐区轮廓）。 */
function buildTankGeometry(): THREE.BufferGeometry {
  const dome = new THREE.SphereGeometry(0.5, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  dome.translate(0, 0.7, 0);
  return mergeGeometries([unitCylinder(0.5, 0.5, 0.7, 0, 0.35, 0, 16), dome], false) as THREE.BufferGeometry;
}

/** 浮标：罐身 + 立杆 + 顶标（可辨识航标）。 */
function buildBuoyGeometry(): THREE.BufferGeometry {
  const topMark = new THREE.SphereGeometry(0.1, 8, 6);
  topMark.translate(0, 1.75, 0);
  return mergeGeometries([
    unitCylinder(0.35, 0.45, 1.2, 0, 0.6, 0, 12),
    unitCylinder(0.04, 0.04, 0.9, 0, 1.3, 0, 6),
    topMark,
  ], false) as THREE.BufferGeometry;
}

/** 防波堤：堆石堤断面（底宽顶窄两层 + 块石点缀）。 */
function buildBreakwaterGeometry(): THREE.BufferGeometry {
  return mergeGeometries([
    unitBox(1, 0.7, 0.3, 0, 0.35, 0),
    unitBox(0.8, 0.5, 0.2, 0, 0.95, 0),
    (() => {
      const rock = new THREE.DodecahedronGeometry(0.07, 0);
      rock.translate(0.2, 1.25, 0);
      return rock;
    })(),
  ], false) as THREE.BufferGeometry;
}

/** 岩石簇：主岩 + 伴岩。 */
function buildRockGeometry(): THREE.BufferGeometry {
  const companion = new THREE.DodecahedronGeometry(0.55, 0);
  companion.translate(0.62, 0, 0.3);
  companion.scale(1, 0.7, 1);
  return mergeGeometries([new THREE.DodecahedronGeometry(1, 0), companion], false) as THREE.BufferGeometry;
}

/** 冰盘：双层不规则薄盘。 */
function buildIceFloeGeometry(): THREE.BufferGeometry {
  const upper = new THREE.CylinderGeometry(0.4, 0.5, 0.05, 7);
  upper.translate(0.1, 0.06, -0.05);
  return mergeGeometries([
    new THREE.CylinderGeometry(0.5, 0.55, 0.08, 7),
    upper,
  ], false) as THREE.BufferGeometry;
}

/** 复合轮廓（近景级）。 */
const COMPOSITE_GEOMETRY_BY_KIND: Record<string, () => THREE.BufferGeometry> = {
  buoy: buildBuoyGeometry,
  breakwater: buildBreakwaterGeometry,
  pier: buildPierGeometry,
  rock: buildRockGeometry,
  island: buildIslandGeometry,
  tank: buildTankGeometry,
  crane: buildCraneGeometry,
  'ice-floe': buildIceFloeGeometry,
};

const COMPOSITE_CACHE = new Map<string, THREE.BufferGeometry>();

/** 复合几何缓存（同 kind 共享——LOD 与实例化共同消费）。 */
function compositeGeometryFor(kind: MarineEnvironmentObject['kind']): THREE.BufferGeometry {
  let geometry = COMPOSITE_CACHE.get(kind);
  if (!geometry) {
    geometry = (COMPOSITE_GEOMETRY_BY_KIND[kind] ?? (() => new THREE.BoxGeometry(1, 1, 1)))();
    COMPOSITE_CACHE.set(kind, geometry);
  }
  return geometry;
}

const NEAR_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x5f6b73, roughness: 0.9, metalness: 0.05 });
const FAR_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x50606e, roughness: 1, metalness: 0 });
const ICE_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xdfeef6, roughness: 0.55, metalness: 0 });

function materialFor(object: MarineEnvironmentObject): THREE.Material {
  if (object.kind === 'ice-floe') return ICE_MATERIAL;
  return object.detail === 'near' ? NEAR_MATERIAL : FAR_MATERIAL;
}

/**
 * 类别尺度映射（#2119 复审修复）：\`scale\` 是横向特征尺寸（米），不是各轴
 * 等比系数——防波堤 1400m 指长度，断面高度固定 ~14m；等比拉伸会把 1.3 单位
 * 高的复合断面放大成 1.8km 高的墙。浮标/岩石/冰盘/岛屿/储罐/岸桥为等比体。
 */
function instanceScaleFor(object: MarineEnvironmentObject): THREE.Vector3 {
  if (object.kind === 'breakwater') {
    return new THREE.Vector3(object.scale, 14, Math.max(24, object.scale * 0.18));
  }
  if (object.kind === 'pier') {
    return new THREE.Vector3(object.scale, 10, Math.max(8, object.scale * 0.3));
  }
  return new THREE.Vector3(object.scale, object.scale, object.scale);
}

/** 实例批次的世界分区半径（#2119 复审）：近区用复合轮廓、远区用简化基元——
 * 相机绕船（近原点）作业时远区对象屏幕投影小，三角形细节可测量下降。 */
const INSTANCE_NEAR_RADIUS_METERS = 2500;

/** LOD 切换距离（米 × 对象尺度——大物体更晚降级）。 */
function lodDistanceFor(object: MarineEnvironmentObject): number {
  return (object.detail === 'near' ? 900 : 4200) * Math.max(1, object.scale * 0.02);
}

/** 单个环境物：真实按距 LOD（复合轮廓 → 简化基元），世界锚定。 */
function EnvironmentObjectLod({ object }: { readonly object: MarineEnvironmentObject }) {
  const lod = useMemo(() => {
    const node = new THREE.LOD();
    const scale = instanceScaleFor(object);
    const composite = compositeGeometryFor(object.kind);
    const simplified = new THREE.Mesh(
      simplifiedGeometryFor(object.kind),
      materialFor(object),
    );
    simplified.scale.copy(scale);
    const detailed = new THREE.Mesh(composite, materialFor(object));
    detailed.scale.copy(scale);
    node.addLevel(detailed, 0);
    node.addLevel(simplified, lodDistanceFor(object));
    return node;
  }, [object]);
  useEffect(() => () => {
    // 复合几何共享缓存不释放；简化级基元随对象释放。
    lod.levels.slice(1).forEach((level) => (level.object as THREE.Mesh).geometry.dispose());
  }, [lod]);
  return (
    <primitive
      object={lod}
      position={[object.x, (object.y ?? 0) + (object.kind === 'ice-floe' ? 0.2 : 0), object.z]}
      rotation={[0, object.headingRad ?? 0, 0]}
      castShadow={object.detail === 'near'}
      receiveShadow={object.detail === 'near'}
    />
  );
}

/** 简化级几何（远景基元——LOD 第二级）。 */
function simplifiedGeometryFor(kind: MarineEnvironmentObject['kind']): THREE.BufferGeometry {
  switch (kind) {
    case 'buoy':
      return new THREE.CylinderGeometry(0.4, 0.45, 1.6, 8);
    case 'crane':
      return new THREE.BoxGeometry(0.8, 1.1, 0.5);
    case 'island':
      return new THREE.ConeGeometry(0.7, 0.5, 7);
    case 'pier':
      return new THREE.BoxGeometry(1, 0.6, 0.76);
    case 'tank':
      return new THREE.CylinderGeometry(0.5, 0.5, 1, 10);
    case 'rock':
      return new THREE.DodecahedronGeometry(1, 0);
    case 'ice-floe':
      return new THREE.CylinderGeometry(0.5, 0.55, 0.08, 7);
    case 'breakwater':
      return new THREE.BoxGeometry(1, 1.2, 0.3);
    default:
      return new THREE.BoxGeometry(1, 1, 1);
  }
}

/** 重复物实例批处理：同 kind ≥2 时的 InstancedMesh（一次 draw call）。 */
function writeInstanceMatrices(
  mesh: THREE.InstancedMesh,
  objects: readonly MarineEnvironmentObject[],
  kind: MarineEnvironmentObject['kind'],
): void {
  const matrix = new THREE.Matrix4();
  const rotation = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  objects.forEach((object, index) => {
    rotation.setFromAxisAngle(up, object.headingRad ?? 0);
    matrix.compose(
      new THREE.Vector3(object.x, (object.y ?? 0) + (kind === 'ice-floe' ? 0.2 : 0), object.z),
      rotation,
      instanceScaleFor(object),
    );
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true;
}

/**
 * 重复物实例批处理（#2119 复审：近/远世界分区两级）——近区（≤2500m）实例
 * 用复合轮廓、远区实例用简化基元：相机绕船作业时远区细节可测量下降，
 * 两批各一次 draw（仍远少于逐对象 mesh）。
 */
function EnvironmentObjectInstances({
  objects,
  kind,
}: {
  readonly objects: readonly MarineEnvironmentObject[];
  readonly kind: MarineEnvironmentObject['kind'];
}) {
  const material = useMemo(() => materialFor(objects[0]), [objects]);
  const nearRef = useRef<THREE.InstancedMesh>(null);
  const farRef = useRef<THREE.InstancedMesh>(null);
  const { near, far } = useMemo(() => {
    const near = objects.filter((object) => Math.hypot(object.x, object.z) <= INSTANCE_NEAR_RADIUS_METERS);
    const far = objects.filter((object) => Math.hypot(object.x, object.z) > INSTANCE_NEAR_RADIUS_METERS);
    return { near, far };
  }, [objects]);
  useEffect(() => {
    if (nearRef.current && near.length > 0) writeInstanceMatrices(nearRef.current, near, kind);
    if (farRef.current && far.length > 0) writeInstanceMatrices(farRef.current, far, kind);
  }, [near, far, kind]);
  const compositeGeometry = useMemo(() => compositeGeometryFor(kind), [kind]);
  const simplifiedGeometry = useMemo(() => simplifiedGeometryFor(kind), [kind]);
  return (
    <>
      {near.length > 0 ? (
        <instancedMesh
          key={`${kind}-near`}
          ref={nearRef}
          args={[compositeGeometry, material, near.length]}
          castShadow={objects[0].detail === 'near'}
          receiveShadow={objects[0].detail === 'near'}
        />
      ) : null}
      {far.length > 0 ? (
        <instancedMesh
          key={`${kind}-far`}
          ref={farRef}
          args={[simplifiedGeometry, material, far.length]}
          castShadow={false}
          receiveShadow={false}
        />
      ) : null}
    </>
  );
}

export interface MarineSceneLayoutProps {
  /** 布局声明 id；未声明（缺省）不渲染环境物（保留纯海面语义）。 */
  readonly layoutId?: MarineSceneLayoutId;
  /**
   * 运行态冰况覆盖（#2102 二轮复审）：冰的可见分布服从已有冰况输入
   * （如破冰船冰区模式/冰厚状态）；缺省退回布局声明密度。
   */
  readonly iceCoverageOverride?: () => number;
}

/** 布局挂载：按声明渲染世界锚定环境物（同一 water/sky/quality 栈，无专属渲染器）。 */
/** 当前布局的挖泥羽流声明（水面片元合成的数据源，#2102 六轮复审）。 */
export function marineLayoutSedimentPlume(layoutId?: MarineSceneLayoutId) {
  return layoutId ? MARINE_SCENE_LAYOUTS[layoutId].sedimentPlume ?? null : null;
}

/** 重复物实例化阈值：同 kind 达到该数量改用 InstancedMesh。 */
const INSTANCING_THRESHOLD = 2;

export function MarineSceneLayoutObjects({ layoutId, iceCoverageOverride }: MarineSceneLayoutProps) {
  const layout = layoutId ? MARINE_SCENE_LAYOUTS[layoutId] : null;
  const gl = useThree((state) => state.gl);
  const grouped = useMemo(() => {
    if (!layout) return null;
    const coverage = iceCoverageOverride?.() ?? layout.iceCoverage ?? 1;
    const objects = layout.objects.filter((object) => {
      if (object.kind !== 'ice-floe') return true;
      const index = layout.objects.filter((item) => item.kind === 'ice-floe').indexOf(object);
      const visibleCount = Math.ceil(
        layout.objects.filter((item) => item.kind === 'ice-floe').length * Math.min(Math.max(coverage, 0), 1),
      );
      return index < visibleCount;
    });
    const byKind = new Map<MarineEnvironmentObject['kind'], MarineEnvironmentObject[]>();
    for (const object of objects) {
      const bucket = byKind.get(object.kind) ?? [];
      bucket.push(object);
      byKind.set(object.kind, bucket);
    }
    const instanced: Array<[MarineEnvironmentObject['kind'], MarineEnvironmentObject[]]> = [];
    const individual: MarineEnvironmentObject[] = [];
    for (const [kind, bucket] of byKind) {
      if (bucket.length >= INSTANCING_THRESHOLD) instanced.push([kind, bucket]);
      else individual.push(...bucket);
    }
    return { instanced, individual };
  }, [layout, iceCoverageOverride]);

  // QA 测量面（#2119）：实际 draw calls（renderer.info）与实例化统计。
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!new URLSearchParams(window.location.search).has('qa', 'marine-layout')) return;
    window.__marineLayoutStats = {
      layoutId: layoutId ?? null,
      instancedKinds: grouped ? grouped.instanced.map(([kind, bucket]) => ({ kind, count: bucket.length })) : [],
      individualObjects: grouped ? grouped.individual.length : 0,
      rendererDrawCalls: 0,
    };
    return () => {
      delete window.__marineLayoutStats;
    };
  }, [layoutId, grouped]);
  useFrame(() => {
    if (typeof window === 'undefined' || !window.__marineLayoutStats) return;
    window.__marineLayoutStats.rendererDrawCalls = gl.info.render.calls;
  });

  if (!layout || !grouped) return null;
  return (
    <group name="marine-layout">
      {grouped.instanced.map(([kind, bucket]) => (
        <EnvironmentObjectInstances key={kind} kind={kind} objects={bucket} />
      ))}
      {grouped.individual.map((object) => (
        <EnvironmentObjectLod key={object.id} object={object} />
      ))}
    </group>
  );
}

declare global {
  interface Window {
    /** QA 测量面（#2119）：?qa=marine-layout 开启——实际 draw calls 与实例化统计。 */
    __marineLayoutStats?: {
      readonly layoutId: MarineSceneLayoutId | null;
      readonly instancedKinds: ReadonlyArray<{ readonly kind: string; readonly count: number }>;
      readonly individualObjects: number;
      rendererDrawCalls: number;
    };
  }
}
