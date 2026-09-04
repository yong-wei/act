/**
 * type055-nanchang-101 v2.1.0 版本化模型包的 ACT 侧只读描述符。
 *
 * 身份由 `scripts/models/receive-type055-nanchang-101-v2.mjs` 接收时逐文件核验
 * （七 GLB + manifest 的 SHA-256 与大小，复制前后字节一致），收据位于
 * `artifacts/model-releases/type055-nanchang-101-v2.1.0/receipt.json`。
 * 本模块只登记已验证事实；ACT 不修补上游模型字节（缺陷返回 3DModels 发新版本）。
 */

export type VersionedModelRole =
  | 'ship-lod0'
  | 'ship-lod1'
  | 'ship-lod2'
  | 'collision'
  | 'payload'
  | 'demo'
  | 'interactive-systems';

export interface VersionedModelArtifact {
  readonly role: VersionedModelRole;
  readonly file: string;
  readonly url: string;
  readonly sha256: string;
  readonly bytes: number;
}

export interface VersionedModelInterfaceContract {
  /** 每档主舰 GLB 内的唯一动画数量（v2.1.0 模型侧验证：15）。 */
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

const BASE_URL = '/assets/model-releases/type055-nanchang-101/v2.1.0';

function artifact(role: VersionedModelRole, file: string, sha256: string, bytes: number): VersionedModelArtifact {
  return { role, file, url: `${BASE_URL}/${file}`, sha256, bytes };
}

export const TYPE055_NANCHANG_101_V2: VersionedModelPackageDescriptor = {
  packageId: 'type055-nanchang-101',
  shipId: 'type_055_destroyer_101_nanchang',
  modelVersion: '2.1.0',
  releaseManifestSha256: 'c4dcf49ab7c23ca1d0a269800f29a9dcd180f1e2795dc2db882e87575586f7c8',
  sourceBlendSha256: 'c8a82074fefc4d935d5714f78fafc18df5bf48662774a0a30f78714f435d6357',
  baseUrl: BASE_URL,
  roles: {
    'ship-lod0': artifact('ship-lod0', 'type055-nanchang-101-ship-lod0.glb', '7cde4ffc671307a18815175d9e2cdb496b8326602ac5747d169c50a8184c5c6c', 3782868),
    'ship-lod1': artifact('ship-lod1', 'type055-nanchang-101-ship-lod1.glb', '1dba6026bb5f7cfc27849a9cde1cc731c32e6af6785acd59b20f2b296e8da385', 1786884),
    'ship-lod2': artifact('ship-lod2', 'type055-nanchang-101-ship-lod2.glb', '6f074262171bd2776793429aeb96c60049f8a24bd2b0cbe21b1bdaa4a1cf5df2', 1149624),
    collision: artifact('collision', 'type055-nanchang-101-collision.glb', 'd9c99dd5270077585f39a6978af183986e461c028e51c39759948c6e14664db9', 52472),
    payload: artifact('payload', 'type055-nanchang-101-weapon-payloads.glb', 'cd0cdc2ffec9f3b519452b2be3c52eaff52659d9cb818bc64edaba2bc50fa7f9', 200896),
    demo: artifact('demo', 'type055-nanchang-101-weapon-demo.glb', '8583cc77bbe13794b21113feef62be486a416e8fb8df38138eae221c960bf45b', 185324),
    'interactive-systems': artifact('interactive-systems', 'type055-nanchang-101-interactive-systems.glb', 'fbfcad67a3cadb5c7a8d2c111659b5099685d4355d9060f9c33b83f1313da244', 14648),
  },
  coordinateBasis: { forward: '+X', up: '+Y' },
  interfaceContract: {
    shipAnimationCount: 15,
    shipInterfaceAnimations: [
      'ciws_yaw',
      'ciws_pitch',
      'ciws_barrel_spin',
      'hangar_port_open',
      'hangar_starboard_open',
      'hq10_yaw',
      'hq10_pitch',
      'nav_radar_spin',
      'main_gun_yaw',
      'main_gun_pitch',
      'national_flag_wind',
      'prop_port_spin',
      'prop_starboard_spin',
      'rudder_port',
      'rudder_starboard',
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

/** 把 registry 激活指针对上已接收描述符；未知包 fail closed，不半切换。 */
export function matchActivatedType055Package(
  activation: { readonly packageId: string; readonly modelVersion: string; readonly baseUrl: string } | null,
): VersionedModelPackageDescriptor | null {
  if (!activation) return null;
  if (
    activation.packageId === TYPE055_NANCHANG_101_V2.packageId
    && activation.modelVersion === TYPE055_NANCHANG_101_V2.modelVersion
    && activation.baseUrl === TYPE055_NANCHANG_101_V2.baseUrl
  ) {
    return TYPE055_NANCHANG_101_V2;
  }
  return null;
}
