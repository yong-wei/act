/**
 * type055-nanchang-101 v2.0.0 版本化模型包的 ACT 侧只读描述符。
 *
 * 身份由 `scripts/models/receive-type055-nanchang-101-v2.mjs` 接收时逐文件核验
 * （六 GLB + manifest 的 SHA-256 与大小，复制前后字节一致），收据位于
 * `artifacts/model-releases/type055-nanchang-101-v2.0.0/receipt.json`。
 * 本模块只登记已验证事实；ACT 不修补上游模型字节（缺陷返回 3DModels 发新版本）。
 */

export type VersionedModelRole =
  | 'ship-lod0'
  | 'ship-lod1'
  | 'ship-lod2'
  | 'collision'
  | 'payload'
  | 'demo';

export interface VersionedModelArtifact {
  readonly role: VersionedModelRole;
  readonly file: string;
  readonly url: string;
  readonly sha256: string;
  readonly bytes: number;
}

export interface VersionedModelInterfaceContract {
  /** 每档主舰 GLB 内的唯一动画数量（模型侧验证：127）。 */
  readonly shipAnimationCount: number;
  /** 代表性语义动画（场景/演示真正消费的接口，按名称绑定）。 */
  readonly shipInterfaceAnimations: readonly string[];
  /** 武器演示 GLB 的组合片段名（模型侧验证：8 个）。 */
  readonly demoAnimations: readonly string[];
  readonly vlsLoadedCount: number;
  readonly hq10LoadedCount: number;
  /** 透明贴花纹理名（两处 RGBA PNG 贴花）。 */
  readonly decalImages: readonly string[];
}

export interface VersionedModelPackageDescriptor {
  readonly packageId: string;
  readonly shipId: string;
  readonly modelVersion: string;
  readonly releaseManifestSha256: string;
  readonly sourceBlendSha256: string;
  readonly baseUrl: string;
  readonly roles: Readonly<Record<VersionedModelRole, VersionedModelArtifact>>;
  /** 模型局部坐标基：glTF Y-up、舰艏沿 +X（场景基为 +Z 舰艏，见 basisYawRad）。 */
  readonly coordinateBasis: { readonly forward: '+X'; readonly up: '+Y' };
  readonly interfaceContract: VersionedModelInterfaceContract;
}

const BASE_URL = '/assets/model-releases/type055-nanchang-101/v2.0.0';

function artifact(role: VersionedModelRole, file: string, sha256: string, bytes: number): VersionedModelArtifact {
  return { role, file, url: `${BASE_URL}/${file}`, sha256, bytes };
}

export const TYPE055_NANCHANG_101_V2: VersionedModelPackageDescriptor = {
  packageId: 'type055-nanchang-101',
  shipId: 'type_055_destroyer_101_nanchang',
  modelVersion: '2.0.0',
  releaseManifestSha256: '5901a821f7f955d4cafb0cd7c40420df506e24914de4abfa12678c7643f594b6',
  sourceBlendSha256: 'c8a82074fefc4d935d5714f78fafc18df5bf48662774a0a30f78714f435d6357',
  baseUrl: BASE_URL,
  roles: {
    'ship-lod0': artifact('ship-lod0', 'type055-nanchang-101-ship-lod0.glb', '7174c5dd88f6b51d2482a4a188bc966083b899739c243308cab61e713911a164', 24060684),
    'ship-lod1': artifact('ship-lod1', 'type055-nanchang-101-ship-lod1.glb', '46e0c80e2780b78992637d0a73c2405a441c8d0e6a2e53fc2ca6fd7da68d95ef', 15789220),
    'ship-lod2': artifact('ship-lod2', 'type055-nanchang-101-ship-lod2.glb', '23dce8d71110a165c99c5737ca0092a5ff8464c68091d3e3453ee8c235b46e1d', 9029444),
    collision: artifact('collision', 'type055-nanchang-101-collision.glb', 'a1f61231a5621a34515e419a9a0ea746fda198c27e0ac09b6667e3a55d67f143', 92524),
    payload: artifact('payload', 'type055-nanchang-101-weapon-payloads.glb', '1dc10d841075c28c4f2430a7a50fdc2951a9eb6c7745d6260d267014ee5da39b', 242964),
    demo: artifact('demo', 'type055-nanchang-101-weapon-demo.glb', '4d09bed69ae2f3827ca99784d361e74df1e0f73218a7f51d49da38bb0f2af6f1', 245636),
  },
  coordinateBasis: { forward: '+X', up: '+Y' },
  interfaceContract: {
    shipAnimationCount: 127,
    shipInterfaceAnimations: [
      'rudder_port',
      'rudder_starboard',
      'prop_port_spin',
      'prop_starboard_spin',
      'main_gun_yaw',
      'main_gun_pitch',
      'national_flag_wind',
      'hangar_port_open',
      'hangar_starboard_open',
    ],
    demoAnimations: [
      'demo_weapon_systems_overview',
      'demo_ciws_burst',
      'demo_hq10_launch',
      'demo_main_gun_fire',
      'demo_vls_aft_yj18_hot',
      'demo_vls_forward_hhq9_cold',
      'demo_decoy_chaff_launch',
      'demo_decoy_ir_launch',
    ],
    vlsLoadedCount: 112,
    hq10LoadedCount: 24,
    decalImages: ['g07-hull-number-101-rgba', 'g07-flight-deck-markings-rgba'],
  },
};

/** 候选开关值：`/simulations/destroyer?model=type055-v2` 显式启用候选模型包。 */
export const TYPE055_V2_CANDIDATE_PARAM = 'model';
export const TYPE055_V2_CANDIDATE_VALUE = 'type055-v2';

/** 纯函数判定（客户端 hook 与模块级条件预载共用同一口径）。 */
export function isType055V2CandidateSearch(search: string): boolean {
  return new URLSearchParams(search).get(TYPE055_V2_CANDIDATE_PARAM) === TYPE055_V2_CANDIDATE_VALUE;
}

/** 质量档位 → 主舰 LOD 的唯一映射（高/中/低 → LOD0/1/2）。 */
export const SHIP_LOD_BY_QUALITY_TIER: Readonly<Record<'high' | 'medium' | 'low', 'ship-lod0' | 'ship-lod1' | 'ship-lod2'>> = {
  high: 'ship-lod0',
  medium: 'ship-lod1',
  low: 'ship-lod2',
};

export function shipLodRoleForQualityTier(tier: 'high' | 'medium' | 'low'): 'ship-lod0' | 'ship-lod1' | 'ship-lod2' {
  return SHIP_LOD_BY_QUALITY_TIER[tier];
}

export function shipLodUrlForQualityTier(
  descriptor: VersionedModelPackageDescriptor,
  tier: 'high' | 'medium' | 'low',
): string {
  return descriptor.roles[shipLodRoleForQualityTier(tier)].url;
}

/**
 * 坐标基适配（唯一适配点）：把模型的 +X 舰艏 / Y-up 基装配进场景的 +Z 舰艏体系。
 *
 * 场景视觉管线（尾迹锚点、镜头、航向 yaw）钉死船体系 +Z 舰艏、+X 左舷、-X 右舷。
 * 该绕 Y 轴 -90° 旋转恰好完成基映射：舰艏 +X→+Z、左舷 -Z→+X、右舷 +Z→-X、上不变。
 * 只允许在模型挂载组件处应用一次；场景组件不得追加补偿旋转。
 */
export const TYPE055_V2_BASIS_YAW_RAD = -Math.PI / 2;
