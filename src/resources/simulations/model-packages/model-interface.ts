/**
 * 版本化模型包的运行时语义接口。
 *
 * 绑定只允许稳定语义名（节点名/动画名/extras），禁止 glTF 数组索引与
 * Blender 自动后缀。武器载荷与演示片段属于独立生命周期：仅由明确消费者
 * 延迟加载；弹药模板运行时克隆生成、寿命到期销毁，不进入主舰常驻节点。
 */

export interface SemanticGltf {
  readonly animations: readonly { readonly name?: unknown }[];
  readonly nodes: readonly { readonly name?: unknown; readonly extras?: unknown }[];
}

function namedAnimations(gltf: SemanticGltf): string[] {
  return gltf.animations.map((clip) => String(clip.name ?? ''));
}

/** 按名称解析动画；缺失或重名都算接口失败（返回 null），调用方不得静默降级。 */
export function findAnimationIndex(gltf: SemanticGltf, animationName: string): number | null {
  const hits = namedAnimations(gltf)
    .map((name, index) => (name === animationName ? index : -1))
    .filter((index) => index >= 0);
  return hits.length === 1 ? hits[0] : null;
}

/** 按名称解析节点；缺失或重名返回 null。 */
export function findNodeIndices(gltf: SemanticGltf, nodeName: string): number[] {
  return gltf.nodes
    .map((node, index) => (String(node.name ?? '') === nodeName ? index : -1))
    .filter((index) => index >= 0);
}

export function findNodeIndex(gltf: SemanticGltf, nodeName: string): number | null {
  const hits = findNodeIndices(gltf, nodeName);
  return hits.length === 1 ? hits[0] : null;
}

/** 按 extras.component_id 唯一解析节点（接口元数据通道）。 */
export function findNodeByComponentId(gltf: SemanticGltf, componentId: string): number | null {
  const hits = gltf.nodes
    .map((node, index) => {
      const extras = node.extras as { component_id?: unknown } | undefined;
      return extras?.component_id === componentId ? index : -1;
    })
    .filter((index) => index >= 0);
  return hits.length === 1 ? hits[0] : null;
}

/** 弹药模板节点名（MUNITION_*_TEMPLATE）：运行时按需克隆的生成源。 */
export function listMunitionTemplateNames(gltf: SemanticGltf): string[] {
  return gltf.nodes
    .map((node) => String(node.name ?? ''))
    .filter((name) => /^MUNITION_.*_TEMPLATE$/.test(name));
}

/** 装填实例节点名（VLS/HQ-10 已装填弹药）。 */
export function listLoadedInstanceNames(gltf: SemanticGltf): { vls: string[]; hq10: string[] } {
  const names = gltf.nodes.map((node) => String(node.name ?? ''));
  return {
    vls: names.filter((name) => /^VLS_.*_LOADED_MISSILE$/.test(name)),
    hq10: names.filter((name) => /^HQ10_R\d+_C\d+_LOADED_MISSILE$/.test(name)),
  };
}

// ============ 版本化模型包通用描述符 ============

export type VersionedModelRole =
  | 'ship-lod0'
  | 'ship-lod1'
  | 'ship-lod2'
  | 'collision'
  | 'payload'
  | 'demo'
  | 'interactive-systems';

/** 三档主舰 LOD 是任何版本化包的必备角色；其余角色按包形态可选。 */
export type ShipLodRole = 'ship-lod0' | 'ship-lod1' | 'ship-lod2';

export interface VersionedModelArtifact {
  readonly role: VersionedModelRole;
  readonly file: string;
  readonly url: string;
  readonly sha256: string;
  readonly bytes: number;
}

/** 主舰 GLB 的接口合同下限：动画数量与场景真正消费的语义动画名。 */
export interface ShipModelInterfaceContract {
  readonly shipAnimationCount: number;
  readonly shipInterfaceAnimations: readonly string[];
}

/** clip 循环绑定：mixer 常开；speedCoupled 时 timeScale = rate × speed/designSpeed。 */
export interface ClipLoopBinding {
  readonly id: string;
  readonly drive: 'clip-loop';
  readonly clip: string;
  readonly speedCoupled?: boolean;
  readonly rate?: number;
}

/**
 * 程序化绑定：直接驱动语义节点局部轴角度，角度 = 映射(遥测源) 并钳制到 ±maxAngleDeg。
 * 遥测源：rudderDeg/speedMps 为通用航行遥测；podAzimuthPortDeg/podAzimuthStarboardDeg
 * 为 Azipod 船型（吊舱方位角承担舵角职能）的左右舷方位遥测。
 */
export interface ProceduralBinding {
  readonly id: string;
  readonly drive: 'procedural';
  readonly nodes: readonly string[];
  readonly axis: 'x' | 'y' | 'z';
  readonly source:
    | 'telemetry.rudderDeg'
    | 'telemetry.speedMps'
    | 'telemetry.podAzimuthPortDeg'
    | 'telemetry.podAzimuthStarboardDeg';
  readonly maxAngleDeg: number;
  /** 源值 → 角度方向；缺省 +1。 */
  readonly sign?: 1 | -1;
}

export type SemanticAnimationBinding = ClipLoopBinding | ProceduralBinding;

/**
 * 仿真结束展示：仿真从推进转停止（暂停/收尾）的边沿触发，从 clips 池随机
 * 选 1..maxPicks 条组合循环播放；仿真恢复推进时停止并回到航行视觉。
 */
export interface EndingShowcaseSpec {
  readonly clips: readonly string[];
  readonly maxPicks: number;
}

export interface VersionedModelPackageDescriptor {
  readonly packageId: string;
  readonly shipId: string;
  readonly modelVersion: string;
  readonly releaseManifestSha256: string;
  readonly sourceBlendSha256: string;
  readonly baseUrl: string;
  readonly roles: Readonly<Record<ShipLodRole, VersionedModelArtifact> & Partial<Record<VersionedModelRole, VersionedModelArtifact>>>;
  /** 模型局部坐标基：glTF Y-up、舰艏沿 +X（场景基为 +Z 舰艏，装配处绕 Y -90°）。 */
  readonly coordinateBasis: { readonly forward: '+X'; readonly up: '+Y' };
  readonly interfaceContract: ShipModelInterfaceContract;
  /** 设计水线锚定：模型局部 Y（米）。缺省时场景沿用 bbox 推导定位。 */
  readonly verticalAnchor?: { readonly designWaterlineY: number };
  /** 模型总长（米）：推进器锚点换算的场景缩放分母。 */
  readonly modelLengthMeters?: number;
  /** 推进器语义节点（模型局部米）：声明时尾迹逐桨发射；缺省保持 profile 单航迹。 */
  readonly propulsors?: readonly {
    readonly id: string;
    readonly node: string;
    readonly position: readonly [number, number, number];
  }[];
  /** 声明式动画绑定（L0 常开）：按语义名解析，单条失败 fail closed 不影响其余。 */
  readonly semanticBindings?: readonly SemanticAnimationBinding[];
  /** 遥测源归一化参数（rudderLimitDeg/podAzimuthLimitDeg 按船型取其一）。 */
  readonly telemetryScale?: {
    readonly designSpeedMps: number;
    readonly rudderLimitDeg?: number;
    readonly podAzimuthLimitDeg?: number;
  };
  /** 彩蛋（达标触发）：L1 主舰内巡检 clip；L2 从 interfaceContract.demoAnimations 随机一条。 */
  readonly easterEgg?: {
    readonly patrolClips: readonly { readonly clip: string; readonly loop: 'repeat' | 'pingpong' }[];
  };
  /** 仿真结束展示（停止边沿触发）：随机组合循环播放。 */
  readonly endingShowcase?: EndingShowcaseSpec;
}

// ============ 版本化模型包共享装配辅助 ============

/** 质量档位 → 主舰 LOD 的唯一映射（高/中/低 → LOD0/1/2）。 */
export const SHIP_LOD_BY_QUALITY_TIER: Readonly<Record<'high' | 'medium' | 'low', ShipLodRole>> = {
  high: 'ship-lod0',
  medium: 'ship-lod1',
  low: 'ship-lod2',
};

export function shipLodRoleForQualityTier(tier: 'high' | 'medium' | 'low'): ShipLodRole {
  return SHIP_LOD_BY_QUALITY_TIER[tier];
}

export function shipLodUrlForQualityTier(
  descriptor: VersionedModelPackageDescriptor,
  tier: 'high' | 'medium' | 'low',
): string {
  return descriptor.roles[shipLodRoleForQualityTier(tier)].url;
}

/**
 * 推进器模型局部坐标 → 场景船体系尾迹锚点。
 *
 * 与基适配（绕 Y -90°）同一映射：(x, y, z) → (-z, y, x)，再按
 * 场景船长/模型总长缩放；锚点 y 置 0（泡沫高度由 waterYSampler 决定）。
 * bbox 居中偏移（模型设计原点即中心线×总长中点时 ≤5cm）忽略。
 */
export function propulsorSceneAnchors(
  descriptor: VersionedModelPackageDescriptor,
  sceneShipLengthMeters: number,
): { id: string; anchor: [number, number, number] }[] {
  if (!descriptor.propulsors || !descriptor.modelLengthMeters) return [];
  const scale = sceneShipLengthMeters / descriptor.modelLengthMeters;
  return descriptor.propulsors.map((propulsor) => ({
    id: propulsor.id,
    anchor: [
      -propulsor.position[2] * scale,
      0,
      propulsor.position[0] * scale,
    ],
  }));
}
