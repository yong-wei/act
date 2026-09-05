/**
 * type055-nanchang-101 v2.1.1 版本化模型包的 ACT 侧只读描述符。
 *
 * 身份由 `scripts/models/receive-type055-nanchang-101-v2.mjs` 接收时逐文件核验
 * （七 GLB + manifest 的 SHA-256 与大小，复制前后字节一致），收据位于
 * `artifacts/model-releases/type055-nanchang-101-v2.1.1/receipt.json`。
 * 本模块只登记已验证事实；ACT 不修补上游模型字节（缺陷返回 3DModels 发新版本）。
 *
 * v2.1.1 相对 v2.1.0：修复水下船体防锈漆归属（MAT_ANTIFOULING_RED 覆盖
 * X[-88.62,78.75]、Y[-0.79,7.05]，三档 LOD 一致）；动画与语义节点接口不变。
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
  /** 每档主舰 GLB 内的唯一动画数量（v2.1.1 模型侧验证：15）。 */
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

const BASE_URL = '/assets/model-releases/type055-nanchang-101/v2.1.1';

function artifact(role: VersionedModelRole, file: string, sha256: string, bytes: number): VersionedModelArtifact {
  return { role, file, url: `${BASE_URL}/${file}`, sha256, bytes };
}

export const TYPE055_NANCHANG_101_V2: VersionedModelPackageDescriptor = {
  packageId: 'type055-nanchang-101',
  shipId: 'type_055_destroyer_101_nanchang',
  modelVersion: '2.1.1',
  releaseManifestSha256: '24f7dfdb2ec362d3fb4ac9fe0b1b6c63ce15d5c1f34b8603ddf5638932581430',
  sourceBlendSha256: 'c8a82074fefc4d935d5714f78fafc18df5bf48662774a0a30f78714f435d6357',
  baseUrl: BASE_URL,
  roles: {
    'ship-lod0': artifact('ship-lod0', 'type055-nanchang-101-ship-lod0.glb', '36f22dd282f7390766441588cfc8a46b1a1f3e13782f946bdb6a09f202131119', 3536140),
    'ship-lod1': artifact('ship-lod1', 'type055-nanchang-101-ship-lod1.glb', '16f7e9308a54fb948b6818bd79891f8756bb775ce3cd40bbb38d48dabff57d53', 1732928),
    'ship-lod2': artifact('ship-lod2', 'type055-nanchang-101-ship-lod2.glb', '506681dad4c4f2b0a36fdfc901583ff27c8bdb38cbd7ea8440e211925a23bc99', 1146052),
    collision: artifact('collision', 'type055-nanchang-101-collision.glb', 'd9c99dd5270077585f39a6978af183986e461c028e51c39759948c6e14664db9', 52472),
    payload: artifact('payload', 'type055-nanchang-101-weapon-payloads.glb', 'cd0cdc2ffec9f3b519452b2be3c52eaff52659d9cb818bc64edaba2bc50fa7f9', 200896),
    demo: artifact('demo', 'type055-nanchang-101-weapon-demo.glb', '28a8b54fb9fcae6a82450f7d88a8b29c689999e05156015055f838a3d9d42c7f', 185172),
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
  // 模型局部 Y=0 为龙骨基线，设计水线 Y=6.6（= 吃水）；防锈漆覆盖到 Y=7.05（boot-top 余量）。
  verticalAnchor: { designWaterlineY: 6.6 },
  modelLengthMeters: 179.69,
  propulsors: [
    { id: 'prop-port', node: 'PROP_PORT', position: [-82.97, 2.71, -4.8] },
    { id: 'prop-starboard', node: 'PROP_STARBOARD', position: [-82.97, 2.71, 4.8] },
  ],
  telemetryScale: { designSpeedMps: 29 * 0.514444, rudderLimitDeg: 35 },
  semanticBindings: [
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
  ],
  easterEgg: {
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
