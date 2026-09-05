/**
 * type055-nanchang-101 版本化模型包的 ACT 侧只读描述符。
 *
 * 身份由 `scripts/models/receive-type055-nanchang-101-v2.mjs` 接收时逐文件核验
 * （七 GLB + manifest 的 SHA-256 与大小，复制前后字节一致），收据位于
 * `artifacts/model-releases/type055-nanchang-101-v<version>/receipt.json`。
 * 本模块只登记已验证事实；ACT 不修补上游模型字节（缺陷返回 3DModels 发新版本）。
 *
 * v2.1.2（当前激活）：剔除 `national_flag_wind` 根骨骼 FLAG_BONE_00 的伪
 * (-1,-1,-1) scale 轨道（Blender 5.2 多骨架导出缺陷，上游管线 sanitize），
 * 国旗恢复向 -X 舰艉飘动；几何、材质与接口合同同 v2.1.1。
 * v2.1.1、v2.1.0 保留为运行时有序回退（接口合同一致，仅动画字节/材质归属不同）。
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
  /** 每档主舰 GLB 内的唯一动画数量（模型侧验证：15）。 */
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

export type SemanticAnimationBinding = ClipLoopBinding | ProceduralBinding;

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
  /** 遥测源归一化参数。 */
  readonly telemetryScale?: {
    readonly designSpeedMps: number;
    readonly rudderLimitDeg: number;
  };
  /** 彩蛋（达标触发）：L1 主舰内巡检 clip；L2 从 interfaceContract.demoAnimations 随机一条。 */
  readonly easterEgg?: {
    readonly patrolClips: readonly { readonly clip: string; readonly loop: 'repeat' | 'pingpong' }[];
  };
}

function artifact(baseUrl: string, role: VersionedModelRole, file: string, sha256: string, bytes: number): VersionedModelArtifact {
  return { role, file, url: `${baseUrl}/${file}`, sha256, bytes };
}

/** v2.1.x 共用的接口合同（v2.1.1 仅改材质归属、v2.1.2 仅剔除伪 scale 轨道，接口不变）。 */
const V2_INTERFACE_CONTRACT: VersionedModelInterfaceContract = {
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
};

// 模型局部 Y=0 为龙骨基线，设计水线 Y=6.6（= 吃水）；防锈漆覆盖到 Y=7.05（boot-top 余量）。
const V2_VERTICAL_ANCHOR = { designWaterlineY: 6.6 } as const;
const V2_MODEL_LENGTH_METERS = 179.69;
const V2_PROPULSORS = [
  { id: 'prop-port', node: 'PROP_PORT', position: [-82.97, 2.71, -4.8] as const },
  { id: 'prop-starboard', node: 'PROP_STARBOARD', position: [-82.97, 2.71, 4.8] as const },
] as const;
const V2_TELEMETRY_SCALE = { designSpeedMps: 29 * 0.514444, rudderLimitDeg: 35 } as const;
const V2_SEMANTIC_BINDINGS: readonly SemanticAnimationBinding[] = [
  { id: 'prop-port-spin', drive: 'clip-loop', clip: 'prop_port_spin', speedCoupled: true, rate: 2 },
  { id: 'prop-starboard-spin', drive: 'clip-loop', clip: 'prop_starboard_spin', speedCoupled: true, rate: 2 },
  { id: 'national-flag-wind', drive: 'clip-loop', clip: 'national_flag_wind' },
  { id: 'nav-radar-spin', drive: 'clip-loop', clip: 'nav_radar_spin' },
  {
    id: 'rudder-angle',
    drive: 'procedural',
    nodes: ['RUDDER_PORT', 'RUDDER_STARBOARD'],
    axis: 'y',
    source: 'telemetry.rudderDeg',
    maxAngleDeg: 30,
    sign: -1,
  },
  {
    id: 'antenna-lean',
    drive: 'procedural',
    nodes: [
      'COMM_ANTENNA_GROUP_BRIDGE_ROOF_PORT_PIVOT',
      'COMM_ANTENNA_GROUP_BRIDGE_ROOF_STARBOARD_PIVOT',
      'COMM_ANTENNA_GROUP_HANGAR_TIER1_AFT_PORT_PIVOT',
      'COMM_ANTENNA_GROUP_HANGAR_TIER1_AFT_STARBOARD_PIVOT',
      'COMM_ANTENNA_GROUP_HANGAR_UPPER_PORT_PIVOT',
      'COMM_ANTENNA_GROUP_HANGAR_UPPER_STARBOARD_PIVOT',
      'COMM_ANTENNA_GROUP_MIDSHIP_AFT_LOW_PORT_PIVOT',
      'COMM_ANTENNA_GROUP_MIDSHIP_AFT_LOW_STARBOARD_PIVOT',
      'COMM_ANTENNA_GROUP_MIDSHIP_FIRST_LOW_CENTRE_PIVOT',
      'COMM_ANTENNA_GROUP_MIDSHIP_WING_PORT_PIVOT',
      'COMM_ANTENNA_GROUP_MIDSHIP_WING_STARBOARD_PIVOT',
    ],
    axis: 'z',
    source: 'telemetry.speedMps',
    maxAngleDeg: 8,
    sign: 1,
  },
];
const V2_EASTER_EGG = {
  patrolClips: [
    { clip: 'main_gun_yaw', loop: 'repeat' },
    { clip: 'main_gun_pitch', loop: 'repeat' },
    { clip: 'ciws_yaw', loop: 'repeat' },
    { clip: 'ciws_pitch', loop: 'repeat' },
    { clip: 'ciws_barrel_spin', loop: 'repeat' },
    { clip: 'hq10_yaw', loop: 'repeat' },
    { clip: 'hq10_pitch', loop: 'repeat' },
    { clip: 'hangar_port_open', loop: 'pingpong' },
    { clip: 'hangar_starboard_open', loop: 'pingpong' },
  ],
} as const;

const BASE_URL = '/assets/model-releases/type055-nanchang-101/v2.1.2';

export const TYPE055_NANCHANG_101_V2: VersionedModelPackageDescriptor = {
  packageId: 'type055-nanchang-101',
  shipId: 'type_055_destroyer_101_nanchang',
  modelVersion: '2.1.2',
  releaseManifestSha256: 'e56460aae95234157fb738b36ba5e09e0165353e68f53e70c093f7f325989eb5',
  sourceBlendSha256: 'c8a82074fefc4d935d5714f78fafc18df5bf48662774a0a30f78714f435d6357',
  baseUrl: BASE_URL,
  roles: {
    'ship-lod0': artifact(BASE_URL, 'ship-lod0', 'type055-nanchang-101-ship-lod0.glb', '9b59b3185681586a76af1b6c94522cbe99dca675c52132dde674468c9b568fd3', 3527132),
    'ship-lod1': artifact(BASE_URL, 'ship-lod1', 'type055-nanchang-101-ship-lod1.glb', '2cbfe9dd6800b88304a2887835ccd695d3fa15a784a876260b409b9e037b3df0', 1729084),
    'ship-lod2': artifact(BASE_URL, 'ship-lod2', 'type055-nanchang-101-ship-lod2.glb', 'eb7c551d177b78b619d1d4b6c35a02008a60248f89ad358114ad4033dab70327', 1138920),
    collision: artifact(BASE_URL, 'collision', 'type055-nanchang-101-collision.glb', 'd9c99dd5270077585f39a6978af183986e461c028e51c39759948c6e14664db9', 52472),
    payload: artifact(BASE_URL, 'payload', 'type055-nanchang-101-weapon-payloads.glb', 'cd0cdc2ffec9f3b519452b2be3c52eaff52659d9cb818bc64edaba2bc50fa7f9', 200896),
    demo: artifact(BASE_URL, 'demo', 'type055-nanchang-101-weapon-demo.glb', '28a8b54fb9fcae6a82450f7d88a8b29c689999e05156015055f838a3d9d42c7f', 185172),
    'interactive-systems': artifact(BASE_URL, 'interactive-systems', 'type055-nanchang-101-interactive-systems.glb', 'fbfcad67a3cadb5c7a8d2c111659b5099685d4355d9060f9c33b83f1313da244', 14648),
  },
  coordinateBasis: { forward: '+X', up: '+Y' },
  interfaceContract: V2_INTERFACE_CONTRACT,
  verticalAnchor: V2_VERTICAL_ANCHOR,
  modelLengthMeters: V2_MODEL_LENGTH_METERS,
  propulsors: V2_PROPULSORS,
  telemetryScale: V2_TELEMETRY_SCALE,
  semanticBindings: V2_SEMANTIC_BINDINGS,
  easterEgg: V2_EASTER_EGG,
};

const BASE_URL_V2_1_1 = '/assets/model-releases/type055-nanchang-101/v2.1.1';

/** v2.1.1 描述符：保留为运行时有序回退（接口合同与语义声明同 v2.1.2）。 */
export const TYPE055_NANCHANG_101_V2_1_1: VersionedModelPackageDescriptor = {
  packageId: 'type055-nanchang-101',
  shipId: 'type_055_destroyer_101_nanchang',
  modelVersion: '2.1.1',
  releaseManifestSha256: '24f7dfdb2ec362d3fb4ac9fe0b1b6c63ce15d5c1f34b8603ddf5638932581430',
  sourceBlendSha256: 'c8a82074fefc4d935d5714f78fafc18df5bf48662774a0a30f78714f435d6357',
  baseUrl: BASE_URL_V2_1_1,
  roles: {
    'ship-lod0': artifact(BASE_URL_V2_1_1, 'ship-lod0', 'type055-nanchang-101-ship-lod0.glb', '36f22dd282f7390766441588cfc8a46b1a1f3e13782f946bdb6a09f202131119', 3536140),
    'ship-lod1': artifact(BASE_URL_V2_1_1, 'ship-lod1', 'type055-nanchang-101-ship-lod1.glb', '16f7e9308a54fb948b6818bd79891f8756bb775ce3cd40bbb38d48dabff57d53', 1732928),
    'ship-lod2': artifact(BASE_URL_V2_1_1, 'ship-lod2', 'type055-nanchang-101-ship-lod2.glb', '506681dad4c4f2b0a36fdfc901583ff27c8bdb38cbd7ea8440e211925a23bc99', 1146052),
    collision: artifact(BASE_URL_V2_1_1, 'collision', 'type055-nanchang-101-collision.glb', 'd9c99dd5270077585f39a6978af183986e461c028e51c39759948c6e14664db9', 52472),
    payload: artifact(BASE_URL_V2_1_1, 'payload', 'type055-nanchang-101-weapon-payloads.glb', 'cd0cdc2ffec9f3b519452b2be3c52eaff52659d9cb818bc64edaba2bc50fa7f9', 200896),
    demo: artifact(BASE_URL_V2_1_1, 'demo', 'type055-nanchang-101-weapon-demo.glb', '28a8b54fb9fcae6a82450f7d88a8b29c689999e05156015055f838a3d9d42c7f', 185172),
    'interactive-systems': artifact(BASE_URL_V2_1_1, 'interactive-systems', 'type055-nanchang-101-interactive-systems.glb', 'fbfcad67a3cadb5c7a8d2c111659b5099685d4355d9060f9c33b83f1313da244', 14648),
  },
  coordinateBasis: { forward: '+X', up: '+Y' },
  interfaceContract: V2_INTERFACE_CONTRACT,
  verticalAnchor: V2_VERTICAL_ANCHOR,
  modelLengthMeters: V2_MODEL_LENGTH_METERS,
  propulsors: V2_PROPULSORS,
  telemetryScale: V2_TELEMETRY_SCALE,
  semanticBindings: V2_SEMANTIC_BINDINGS,
  easterEgg: V2_EASTER_EGG,
};

const BASE_URL_V2_1_0 = '/assets/model-releases/type055-nanchang-101/v2.1.0';

/** v2.1.0 描述符：保留为运行时有序回退（接口合同与语义声明同 v2.1.1）。 */
export const TYPE055_NANCHANG_101_V2_1_0: VersionedModelPackageDescriptor = {
  packageId: 'type055-nanchang-101',
  shipId: 'type_055_destroyer_101_nanchang',
  modelVersion: '2.1.0',
  releaseManifestSha256: 'c4dcf49ab7c23ca1d0a269800f29a9dcd180f1e2795dc2db882e87575586f7c8',
  sourceBlendSha256: 'c8a82074fefc4d935d5714f78fafc18df5bf48662774a0a30f78714f435d6357',
  baseUrl: BASE_URL_V2_1_0,
  roles: {
    'ship-lod0': artifact(BASE_URL_V2_1_0, 'ship-lod0', 'type055-nanchang-101-ship-lod0.glb', '7cde4ffc671307a18815175d9e2cdb496b8326602ac5747d169c50a8184c5c6c', 3782868),
    'ship-lod1': artifact(BASE_URL_V2_1_0, 'ship-lod1', 'type055-nanchang-101-ship-lod1.glb', '1dba6026bb5f7cfc27849a9cde1cc731c32e6af6785acd59b20f2b296e8da385', 1786884),
    'ship-lod2': artifact(BASE_URL_V2_1_0, 'ship-lod2', 'type055-nanchang-101-ship-lod2.glb', '6f074262171bd2776793429aeb96c60049f8a24bd2b0cbe21b1bdaa4a1cf5df2', 1149624),
    collision: artifact(BASE_URL_V2_1_0, 'collision', 'type055-nanchang-101-collision.glb', 'd9c99dd5270077585f39a6978af183986e461c028e51c39759948c6e14664db9', 52472),
    payload: artifact(BASE_URL_V2_1_0, 'payload', 'type055-nanchang-101-weapon-payloads.glb', 'cd0cdc2ffec9f3b519452b2be3c52eaff52659d9cb818bc64edaba2bc50fa7f9', 200896),
    demo: artifact(BASE_URL_V2_1_0, 'demo', 'type055-nanchang-101-weapon-demo.glb', '8583cc77bbe13794b21113feef62be486a416e8fb8df38138eae221c960bf45b', 185324),
    'interactive-systems': artifact(BASE_URL_V2_1_0, 'interactive-systems', 'type055-nanchang-101-interactive-systems.glb', 'fbfcad67a3cadb5c7a8d2c111659b5099685d4355d9060f9c33b83f1313da244', 14648),
  },
  coordinateBasis: { forward: '+X', up: '+Y' },
  interfaceContract: V2_INTERFACE_CONTRACT,
  verticalAnchor: V2_VERTICAL_ANCHOR,
  modelLengthMeters: V2_MODEL_LENGTH_METERS,
  propulsors: V2_PROPULSORS,
  telemetryScale: V2_TELEMETRY_SCALE,
  semanticBindings: V2_SEMANTIC_BINDINGS,
  easterEgg: V2_EASTER_EGG,
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

/** 已接收的 type055 版本化包 baseUrl 集合（激活版 + 有序回退版）。 */
export const TYPE055_VERSIONED_PACKAGE_BASE_URLS: readonly string[] = [
  TYPE055_NANCHANG_101_V2.baseUrl,
  TYPE055_NANCHANG_101_V2_1_1.baseUrl,
  TYPE055_NANCHANG_101_V2_1_0.baseUrl,
];

/** URL 是否属于任一已接收 type055 版本化包资产（坐标基适配判定唯一入口）。 */
export function isType055VersionedAssetUrl(url: string): boolean {
  return TYPE055_VERSIONED_PACKAGE_BASE_URLS.some((baseUrl) => url.startsWith(baseUrl));
}

/**
 * 推进器模型局部坐标 → 场景船体系尾迹锚点。
 *
 * 与 TYPE055_V2_BASIS_YAW_RAD 同一映射：(x, y, z) → (-z, y, x)，再按
 * 场景船长/模型总长缩放；锚点 y 置 0（泡沫高度由 waterYSampler 决定）。
 * bbox 居中偏移（本模型 ≤5cm）忽略。
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
