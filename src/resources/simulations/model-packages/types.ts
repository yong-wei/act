/**
 * 版本化仿真模型包的共享类型与 LOD 映射。
 *
 * 055 仍登记 collision/payload/demo/interactive-systems；其余船队包只声明三档主舰 LOD。
 * ACT 不修补上游模型字节。
 */

import { STATIC_HOSTNAME } from '@/lib/browser-delivery/types';

export type VersionedShipLodRole = 'ship-lod0' | 'ship-lod1' | 'ship-lod2';
export type VersionedOptionalRole = 'collision' | 'payload' | 'demo' | 'interactive-systems';
export type VersionedModelRole = VersionedShipLodRole | VersionedOptionalRole;

export interface VersionedModelArtifact {
  readonly role: VersionedModelRole;
  readonly file: string;
  readonly url: string;
  readonly sha256: string;
  readonly bytes: number;
}

export interface VersionedModelInterfaceContract {
  /** 每档主舰 GLB 内的唯一动画数量。 */
  readonly shipAnimationCount: number;
  /** 代表性语义动画（场景真正消费的接口，按名称绑定）。 */
  readonly shipInterfaceAnimations: readonly string[];
  /** 独立演示 GLB 的组合片段名；无独立 demo 角色时为空。 */
  readonly demoAnimations: readonly string[];
  readonly vlsLoadedCount: number;
  readonly hq10LoadedCount: number;
  /** 透明贴花纹理名；无贴花船为空。 */
  readonly decalImages: readonly string[];
}

/** clip 循环绑定：mixer 常开；speedCoupled 时 timeScale = rate × speed/designSpeed。 */
export interface ClipLoopBinding {
  readonly id: string;
  readonly drive: 'clip-loop';
  readonly clip: string;
  readonly speedCoupled?: boolean;
  readonly rate?: number;
}

/** 程序化绑定：直接驱动语义节点局部轴角度，角度 = 映射(遥测源) 并钳制到 ±maxAngleDeg。 */
export interface ProceduralBinding {
  readonly id: string;
  readonly drive: 'procedural';
  readonly nodes: readonly string[];
  readonly axis: 'x' | 'y' | 'z';
  readonly source: 'telemetry.rudderDeg' | 'telemetry.speedMps';
  readonly maxAngleDeg: number;
  /** 源值 → 角度方向；缺省 +1。 */
  readonly sign?: 1 | -1;
}

/** 实时方位：把遥测弧度写到节点局部轴，覆盖演示 clip。 */
export interface LiveRotationBinding {
  readonly id: string;
  readonly drive: 'live-rotation';
  readonly nodes: readonly string[];
  readonly axis: 'x' | 'y' | 'z';
  readonly azipodSlot?: 'P' | 'S';
  readonly thrusterId?: number;
  readonly sign?: 1 | -1;
}

/** 实时转速：按仿真时间积分 RPM → 局部轴相位。 */
export interface LiveSpinBinding {
  readonly id: string;
  readonly drive: 'live-spin';
  readonly nodes: readonly string[];
  readonly axis: 'x' | 'y' | 'z';
  readonly azipodSlot?: 'P' | 'S';
  readonly thrusterId?: number;
  readonly sign?: 1 | -1;
  /** 无吊舱/推进器 RPM 时，按航速比 × designRpm 驱动（程序化桨叶）。 */
  readonly rpmFromSpeed?: boolean;
  readonly designRpm?: number;
  /** 读取 BindingTelemetrySource.cutterRpm。 */
  readonly cutter?: boolean;
}

export type SemanticAnimationBinding =
  | ClipLoopBinding
  | ProceduralBinding
  | LiveRotationBinding
  | LiveSpinBinding;

export type VersionedModelRoles =
  Readonly<Record<VersionedShipLodRole, VersionedModelArtifact>>
  & Partial<Readonly<Record<VersionedOptionalRole, VersionedModelArtifact>>>;

export interface VersionedModelPackageDescriptor {
  readonly packageId: string;
  readonly shipId: string;
  readonly modelVersion: string;
  readonly releaseManifestSha256: string;
  readonly sourceBlendSha256: string;
  readonly baseUrl: string;
  readonly roles: VersionedModelRoles;
  /** 模型局部坐标基：glTF Y-up；舰艏 +X 或已写入文件的 +Z（act-forward）。 */
  readonly coordinateBasis: { readonly forward: '+X' | '+Z'; readonly up: '+Y' };
  /**
   * 坐标基适配（唯一适配点）：+X 艏 → 场景 +Z 艏为 −π/2；act-forward（+Z 艏）为 0。
   * 只允许在模型挂载组件处应用一次。声明了 modelToSceneMatrix 时不要再叠一次。
   */
  readonly basisYawRad: number;
  /** 行主序 4×4，对应 release.json coordinates.modelToSceneMatrix；用 Matrix4.set 一次应用。 */
  readonly modelToSceneMatrix?: readonly [
    number, number, number, number,
    number, number, number, number,
    number, number, number, number,
    number, number, number, number,
  ];
  readonly interfaceContract: VersionedModelInterfaceContract;
  /** 设计水线锚定：模型局部 Y（米）。声明后场景不得再 bbox 居中或按总高归一化。 */
  readonly verticalAnchor?: { readonly designWaterlineY: number };
  /** 模型总长（米）：场景缩放分母。 */
  readonly modelLengthMeters?: number;
  /** 推进器语义节点（模型局部米）：声明时尾迹逐桨发射。 */
  readonly propulsors?: readonly {
    readonly id: string;
    readonly node: string;
    readonly position: readonly [number, number, number];
  }[];
  readonly semanticBindings?: readonly SemanticAnimationBinding[];
  readonly telemetryScale?: {
    readonly designSpeedMps: number;
    readonly rudderLimitDeg: number;
  };
  readonly easterEgg?: {
    readonly patrolClips: readonly { readonly clip: string; readonly loop: 'repeat' | 'pingpong' }[];
    /** 主舰 GLB 内达标彩蛋：每次达标随机播放 1..n 条 LoopOnce。 */
    readonly attainmentClips?: readonly string[];
  };
}

export function artifact(
  baseUrl: string,
  role: VersionedModelRole,
  file: string,
  sha256: string,
  bytes: number,
): VersionedModelArtifact {
  return { role, file, url: `${baseUrl}/${file}`, sha256, bytes };
}

/** 质量档位 → 主舰 LOD 的唯一映射（高/中/低 → LOD0/1/2）。 */
export const SHIP_LOD_BY_QUALITY_TIER: Readonly<Record<'high' | 'medium' | 'low', VersionedShipLodRole>> = {
  high: 'ship-lod0',
  medium: 'ship-lod1',
  low: 'ship-lod2',
};

export function shipLodRoleForQualityTier(tier: 'high' | 'medium' | 'low'): VersionedShipLodRole {
  return SHIP_LOD_BY_QUALITY_TIER[tier];
}

export function shipLodUrlForQualityTier(
  descriptor: VersionedModelPackageDescriptor,
  tier: 'high' | 'medium' | 'low',
): string {
  const item = descriptor.roles[shipLodRoleForQualityTier(tier)];
  if (!item) {
    throw new Error(`missing-ship-lod:${descriptor.packageId}:${tier}`);
  }
  return item.url;
}

export const FLEET_DELIVERY_BUCKET = 'act-course-models';

export function artifactBasename(file: string): string {
  const base = file.split('/').pop();
  if (!base) throw new Error(`invalid-artifact-file:${file}`);
  return base;
}

/** 公开桶对象键：去掉同源 `/assets` 前缀，保留 `model-releases/<id>/v<ver>/...`。 */
export function ossObjectKey(item: VersionedModelArtifact): string {
  if (!item.url.startsWith('/assets/model-releases/')) {
    throw new Error(`unexpected-artifact-url:${item.url}`);
  }
  return item.url.slice('/assets/'.length);
}

export function ossArtifactUrl(item: VersionedModelArtifact): string {
  return `https://${STATIC_HOSTNAME}/${ossObjectKey(item)}`;
}

export function artifactCandidateUrls(item: VersionedModelArtifact): readonly [string, string] {
  return [ossArtifactUrl(item), item.url];
}

export function shipLodMountPlan(
  descriptor: VersionedModelPackageDescriptor,
  tier: 'high' | 'medium' | 'low',
): { readonly preferred: string; readonly local: string; readonly candidates: readonly [string, string] } {
  const item = descriptor.roles[shipLodRoleForQualityTier(tier)];
  if (!item) {
    throw new Error(`missing-ship-lod:${descriptor.packageId}:${tier}`);
  }
  const preferred = ossArtifactUrl(item);
  return { preferred, local: item.url, candidates: [preferred, item.url] };
}

export function shipLodCandidatesForQualityTier(
  descriptor: VersionedModelPackageDescriptor,
  tier: 'high' | 'medium' | 'low',
): readonly [string, string] {
  return shipLodMountPlan(descriptor, tier).candidates;
}

export function isDescriptorArtifactUrl(
  descriptor: VersionedModelPackageDescriptor,
  url: string,
): boolean {
  if (url.startsWith(descriptor.baseUrl)) return true;
  return Object.values(descriptor.roles).some((item) => (
    url === item.url || url === ossArtifactUrl(item)
  ));
}

export function basisYawRadForForward(forward: '+X' | '+Z'): number {
  return forward === '+X' ? -Math.PI / 2 : 0;
}
