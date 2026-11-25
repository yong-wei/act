import { RELEASED_PROPULSION_ANCHORS } from './released-propulsion-anchors';
/**
 * type055-nanchang-101 版本化模型包的 ACT 侧只读描述符。
 *
 * 身份由 `scripts/models/receive-fleet-model-release.mjs` 接收时逐文件核验，
 * 收据位于 `artifacts/model-releases/type055-nanchang-101-v2.4.0/receipt.json`。
 * 本模块只登记当前激活版；旧版描述符与目录已退役。
 * ACT 不修补上游模型字节（缺陷返回 3DModels 发新版本）。
 *
 * v2.4.0：ACT_RUNTIME_ONLY，压缩 GLB 在 models/，WebP 贴图在 textures/；
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

const BASE_URL = '/assets/model-releases/type055-nanchang-101/v2.4.0';

export const TYPE055_NANCHANG_101_V2: VersionedModelPackageDescriptor = {
  packageId: 'type055-nanchang-101',
  shipId: 'type_055_destroyer_101_nanchang',
  modelVersion: '2.4.0',
  releaseManifestSha256: 'b93ebdd2384bbf78604202ee0d84f4e41c598604c3d8301b1222acea4a239a69',
  sourceBlendSha256: 'eafce990f09757d4631305516bb80f8a5d95a920b1321c375c446dc117aaac83',
  baseUrl: BASE_URL,
  roles: {
    'ship-proxy': artifact(BASE_URL, 'ship-proxy', 'models/type055-nanchang-101-ship-proxy.glb', '3b6e2458ee2b10cb895bf00692798edcf6874be0577066fa59ddaec4578d4b48', 45052),
    'propulsion-anchors': artifact(BASE_URL, 'propulsion-anchors', 'interfaces/propulsion-anchors.json', '191551353ddd9a70af0e228b02358c50791892925e74a307edad5499886eae8b', 5766),
    'ship-lod0': artifact(BASE_URL, 'ship-lod0', 'models/type055-nanchang-101-ship-lod0.glb', 'fb329aa219a30cbc6437c976ba8478c98ac301bbdf18fc6252d1877283a10a34', 1504364),
    'ship-lod1': artifact(BASE_URL, 'ship-lod1', 'models/type055-nanchang-101-ship-lod1.glb', '391bc35795c1663c8494a03fdd99c0886c446f086559ec22bae5cdf902c5b4bb', 797356),
    'ship-lod2': artifact(BASE_URL, 'ship-lod2', 'models/type055-nanchang-101-ship-lod2.glb', '47bfcc34387dbfca6d4e46ae76bc87579bd7ccbf233b129332984892a683a2f1', 548344),
    collision: artifact(BASE_URL, 'collision', 'models/type055-nanchang-101-collision.glb', '43866aa270c7c0cbff262aac82f6c158acbb31a4d120de202b4e2206ab01ad80', 30196),
    payload: artifact(BASE_URL, 'payload', 'models/type055-nanchang-101-weapon-payloads.glb', 'a6c82b415861cc7675a22a850244c75efca6decb633a67b66e565386e1ce88f6', 188528),
    demo: artifact(BASE_URL, 'demo', 'models/type055-nanchang-101-weapon-demo.glb', '59c5555cba1b7df5b53f72916fc98579ad2c5f3fb7fc758071a236f89a6dcb90', 164904),
    'interactive-systems': artifact(BASE_URL, 'interactive-systems', 'models/type055-nanchang-101-interactive-systems.glb', '3a145891714801c98f8e79461b8c64e8f523067eeb10315c6e428c56f9f5895b', 13092),
  },
  propulsionAnchors: RELEASED_PROPULSION_ANCHORS['type055-nanchang-101'],
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
