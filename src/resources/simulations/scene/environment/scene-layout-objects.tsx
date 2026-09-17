'use client';

import { useMemo } from 'react';
import * as THREE from 'three';

import {
  MARINE_SCENE_LAYOUTS,
  type MarineEnvironmentObject,
  type MarineSceneLayoutId,
} from './scene-layouts';

/**
 * 布局环境物（#2102）：程序化三维几何、世界锚定（世界坐标静态放置，不随相机/原点移动）。
 * 近景（buoy/rock/breakwater/ice）与远景（island/tank/crane/pier）同栈复用现有
 * water/sky/lighting/quality 模块——不创建第二套海洋或渲染器。
 */

function geometryFor(object: MarineEnvironmentObject): THREE.BufferGeometry {
  switch (object.kind) {
    case 'buoy':
      return new THREE.CylinderGeometry(object.scale * 0.35, object.scale * 0.45, object.scale * 1.6, 12);
    case 'breakwater':
      return new THREE.BoxGeometry(object.scale, 14, object.scale * 0.18);
    case 'pier':
      return new THREE.BoxGeometry(object.scale, 10, object.scale * 0.3);
    case 'rock':
      return new THREE.DodecahedronGeometry(object.scale, 0);
    case 'island':
      return new THREE.ConeGeometry(object.scale * 0.7, object.scale * 0.5, 7);
    case 'tank':
      return new THREE.CylinderGeometry(object.scale * 0.5, object.scale * 0.5, object.scale, 16);
    case 'crane':
      return new THREE.BoxGeometry(6, object.scale * 1.4, 6);
    case 'ice-floe':
      return new THREE.CylinderGeometry(object.scale * 0.5, object.scale * 0.55, object.scale * 0.08, 7);
    default:
      return new THREE.BoxGeometry(object.scale, object.scale, object.scale);
  }
}

const NEAR_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x5f6b73, roughness: 0.9, metalness: 0.05 });
const FAR_MATERIAL = new THREE.MeshStandardMaterial({ color: 0x50606e, roughness: 1, metalness: 0 });
const ICE_MATERIAL = new THREE.MeshStandardMaterial({ color: 0xdfeef6, roughness: 0.55, metalness: 0 });

function materialFor(object: MarineEnvironmentObject): THREE.Material {
  if (object.kind === 'ice-floe') return ICE_MATERIAL;
  return object.detail === 'near' ? NEAR_MATERIAL : FAR_MATERIAL;
}

/** 单个环境物：世界锚定（position 为世界坐标，receiveShadow 只在近景）。 */
function EnvironmentObjectMesh({ object }: { readonly object: MarineEnvironmentObject }) {
  const geometry = useMemo(() => geometryFor(object), [object]);
  const material = useMemo(() => materialFor(object), [object]);
  const isIce = object.kind === 'ice-floe';
  return (
    <mesh
      geometry={geometry}
      material={material}
      position={[object.x, (object.y ?? 0) + (isIce ? 0.2 : 0), object.z]}
      rotation={[0, object.headingRad ?? 0, 0]}
      castShadow={object.detail === 'near'}
      receiveShadow={object.detail === 'near'}
    />
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

/** 挖泥羽流（#2102）：有限范围低成本视觉表示（半透明圆盘），不影响任务指标。 */
function SedimentPlumeDisc({ x, z, radiusMeters, opacity }: {
  readonly x: number;
  readonly z: number;
  readonly radiusMeters: number;
  readonly opacity: number;
}) {
  const geometry = useMemo(() => new THREE.CircleGeometry(radiusMeters, 24), [radiusMeters]);
  // 贴水合成（五轮复审）：保留深度测试（船体/岩石/浮标等前景几何正确遮挡羽流），
  // 以 polygonOffset 负偏移把羽流深度拉近相机——位于波面之上，波峰波谷下持续可见；
  // 高 renderOrder 保证在不透明水面之后绘制（透明队列内排序）。
  const material = useMemo(
    () => new THREE.MeshBasicMaterial({
      color: 0x7a6a52,
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -8,
    }),
    [opacity],
  );
  return <mesh geometry={geometry} material={material} position={[x, -0.92, z]} rotation={[-Math.PI / 2, 0, 0]} renderOrder={10} />;
}

/** 布局挂载：按声明渲染世界锚定环境物（同一 water/sky/quality 栈，无专属渲染器）。 */
export function MarineSceneLayoutObjects({ layoutId, iceCoverageOverride }: MarineSceneLayoutProps) {
  const layout = layoutId ? MARINE_SCENE_LAYOUTS[layoutId] : null;
  if (!layout) return null;
  // 冰况密度门控（#2102）：运行态冰况（如破冰船冰区模式/冰厚）优先，
  // 缺省退回布局声明密度——冰的可见分布服从已有冰况，不自行模拟。
  const coverage = iceCoverageOverride?.() ?? layout.iceCoverage ?? 1;
  const objects = layout.objects.filter((object) => {
    if (object.kind !== 'ice-floe') return true;
    const index = layout.objects.filter((item) => item.kind === 'ice-floe').indexOf(object);
    const visibleCount = Math.ceil(
      layout.objects.filter((item) => item.kind === 'ice-floe').length * Math.min(Math.max(coverage, 0), 1),
    );
    return index < visibleCount;
  });
  return (
    <group>
      {objects.map((object) => (
        <EnvironmentObjectMesh key={object.id} object={object} />
      ))}
      {layout.sedimentPlume ? (
        <SedimentPlumeDisc
          x={layout.sedimentPlume.x}
          z={layout.sedimentPlume.z}
          radiusMeters={layout.sedimentPlume.radiusMeters}
          opacity={layout.sedimentPlume.opacity}
        />
      ) : null}
    </group>
  );
}
