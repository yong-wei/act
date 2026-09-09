/**
 * type055-nanchang-101 版本化模型包的 ACT 侧只读描述符。
 *
 * 身份由 `scripts/models/receive-fleet-model-release.mjs` 接收时逐文件核验，
 * 收据位于 `artifacts/model-releases/type055-nanchang-101-v2.2.1/receipt.json`。
 * 本模块只登记当前激活版；旧版描述符与目录已退役。
 * ACT 不修补上游模型字节（缺陷返回 3DModels 发新版本）。
 *
 * v2.2.1：ACT_RUNTIME_ONLY，GLB 在 models/，贴图在 textures/；
 * 声明矩阵一次挂载（含 Y=−7.05）。加载失败只回退 registry 单文件链。
 */

export * from './types';

import {
  artifact,
  isDescriptorArtifactUrl,
  type SemanticAnimationBinding,
  type VersionedModelInterfaceContract,
  type VersionedModelPackageDescriptor,
} from './types';

/** 当前包接口合同。 */
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

const HERO_055_TO_SCENE = [
  0, 0, -1, 0,
  0, 1, 0, -7.05,
  1, 0, 0, 0,
  0, 0, 0, 1,
] as const;

const BASE_URL = '/assets/model-releases/type055-nanchang-101/v2.2.1';

export const TYPE055_NANCHANG_101_V2: VersionedModelPackageDescriptor = {
  packageId: 'type055-nanchang-101',
  shipId: 'type_055_destroyer_101_nanchang',
  modelVersion: '2.2.1',
  releaseManifestSha256: '37502cc1814b6be408b124d9b72a20b7f66031cd4a364bfe6a74fb3dda8081d8',
  sourceBlendSha256: 'eafce990f09757d4631305516bb80f8a5d95a920b1321c375c446dc117aaac83',
  baseUrl: BASE_URL,
  roles: {
    'ship-lod0': artifact(BASE_URL, 'ship-lod0', 'models/type055-nanchang-101-ship-lod0.glb', 'ca07f94f0cbc015b42fe492bd050b39b9a89887ce4f872af241ada109ece6bfd', 3370584),
    'ship-lod1': artifact(BASE_URL, 'ship-lod1', 'models/type055-nanchang-101-ship-lod1.glb', '83c01d5a97a09b3ea9e9305d2ecad39cc4374f3b11ecb289eaa8a7011c32dbcd', 1569240),
    'ship-lod2': artifact(BASE_URL, 'ship-lod2', 'models/type055-nanchang-101-ship-lod2.glb', '61586d12b971e63bc9fa4afbaca8f39a0d7ff33aeaeba685cda3c98fc0bbc556', 988780),
    collision: artifact(BASE_URL, 'collision', 'models/type055-nanchang-101-collision.glb', '24fcb99fe32a66b992511048ad2f4b5d06c249379cc9734de82de056d9f7991d', 52472),
    payload: artifact(BASE_URL, 'payload', 'models/type055-nanchang-101-weapon-payloads.glb', 'c17a578374da69aa2617502cf26c5a928f4416ef5ddddb058bf919a3cec6ede8', 200848),
    demo: artifact(BASE_URL, 'demo', 'models/type055-nanchang-101-weapon-demo.glb', 'bcbbf38947fbb2e90942b162cc1c6fcd3e82f506de1c6616c66ee498bc3e767b', 185120),
    'interactive-systems': artifact(BASE_URL, 'interactive-systems', 'models/type055-nanchang-101-interactive-systems.glb', 'fbfcad67a3cadb5c7a8d2c111659b5099685d4355d9060f9c33b83f1313da244', 14648),
  },
  coordinateBasis: { forward: '+X', up: '+Y' },
  basisYawRad: 0,
  modelToSceneMatrix: HERO_055_TO_SCENE,
  interfaceContract: V2_INTERFACE_CONTRACT,
  verticalAnchor: { designWaterlineY: 0 },
  modelLengthMeters: V2_MODEL_LENGTH_METERS,
  propulsors: V2_PROPULSORS,
  telemetryScale: V2_TELEMETRY_SCALE,
  semanticBindings: V2_SEMANTIC_BINDINGS,
  easterEgg: V2_EASTER_EGG,
};

/**
 * 坐标基适配（唯一适配点）：把模型的 +X 舰艏 / Y-up 基装配进场景的 +Z 舰艏体系。
 *
 * 场景视觉管线（尾迹锚点、镜头、航向 yaw）钉死船体系 +Z 舰艏、+X 左舷、-X 右舷。
 * 该绕 Y 轴 -90° 旋转恰好完成基映射：舰艏 +X→+Z、左舷 -Z→+X、右舷 +Z→-X、上不变。
 * 只允许在模型挂载组件处应用一次；场景组件不得追加补偿旋转。
 */
export const TYPE055_V2_BASIS_YAW_RAD = -Math.PI / 2;

/** 当前激活的 type055 版本化包。 */
export const TYPE055_RECEIVED_PACKAGES: readonly VersionedModelPackageDescriptor[] = [
  TYPE055_NANCHANG_101_V2,
];

export const TYPE055_VERSIONED_PACKAGE_BASE_URLS: readonly string[] = TYPE055_RECEIVED_PACKAGES.map(
  (descriptor) => descriptor.baseUrl,
);

/** URL 是否属于任一已接收 type055 版本化包资产（含 OSS 候选）。 */
export function isType055VersionedAssetUrl(url: string): boolean {
  return TYPE055_RECEIVED_PACKAGES.some((descriptor) => isDescriptorArtifactUrl(descriptor, url));
}

export function matchType055DescriptorByUrl(url: string): VersionedModelPackageDescriptor | null {
  return TYPE055_RECEIVED_PACKAGES.find((descriptor) => isDescriptorArtifactUrl(descriptor, url)) ?? null;
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
