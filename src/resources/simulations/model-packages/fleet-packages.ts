/**
 * 船队已激活版本化模型包（055 除外，仍见 type055-nanchang-101-v2.ts）。
 * 身份与 SHA-256 来自 receive-fleet-model-release.mjs 收据。
 */

import type { SimulationModelId } from '@/lib/browser-delivery/types';
import type { VersionedDefaultActivation } from '@/lib/browser-delivery/versioned-defaults';
import { TYPE055_NANCHANG_101_V2 } from './type055-nanchang-101-v2';
import {
  artifact,
  type SemanticAnimationBinding,
  type VersionedModelInterfaceContract,
  type VersionedModelPackageDescriptor,
} from './types';

/** 整合包统一：模型 +X 艏 → 场景 +Z 艏，无额外水线平移。 */
const HERO_NATIVE_TO_SCENE = [
  0, 0, -1, 0,
  0, 1, 0, 0,
  1, 0, 0, 0,
  0, 0, 0, 1,
] as const;

function visualContract(
  shipAnimationCount: number,
  shipInterfaceAnimations: readonly string[],
): VersionedModelInterfaceContract {
  return {
    shipAnimationCount,
    shipInterfaceAnimations,
    demoAnimations: [],
    vlsLoadedCount: 0,
    hq10LoadedCount: 0,
    decalImages: [],
  };
}

const LNG_BASE = '/assets/model-releases/lng-changheng/v1.0.0';
export const LNG_CHANGHENG_V1: VersionedModelPackageDescriptor = {
  packageId: 'lng-changheng',
  shipId: 'lng_changheng',
  modelVersion: '1.0.0',
  releaseManifestSha256: 'd599a9186cdc24d784e6ce101734096d0c6325e2cc84837fa342e0248ba97720',
  sourceBlendSha256: '0e6ed33706be52ad0b95b5563ac27a8e0715d6a7db5095dfd039648635c5e2a0',
  baseUrl: LNG_BASE,
  roles: {
    'ship-lod0': artifact(LNG_BASE, 'ship-lod0', 'lng-changheng-ship-lod0.glb', '6a698d8c90b413c2c59896275f8519e37e4aaa191c610fa5031363340980c4ed', 27808996),
    'ship-lod1': artifact(LNG_BASE, 'ship-lod1', 'lng-changheng-ship-lod1.glb', '3fea6c0ec482bc1ed1e355e3568e4aef279f3799f5b1d1ecca0e41ca632492b0', 19893940),
    'ship-lod2': artifact(LNG_BASE, 'ship-lod2', 'lng-changheng-ship-lod2.glb', '9b69a101051457fe935859ff964dcd054175a8af30d758d38310dca85b6c3cec', 16763640),
  },
  coordinateBasis: { forward: '+Z', up: '+Y' },
  basisYawRad: 0,
  interfaceContract: visualContract(4, [
    'ACT.Propeller.portAction',
    'ACT.Propeller.starboardAction',
    'ACT.Rudder.portAction',
    'ACT.Rudder.starboardAction',
  ]),
  verticalAnchor: { designWaterlineY: 0 },
  modelLengthMeters: 299,
  telemetryScale: { designSpeedMps: 9.8, rudderLimitDeg: 35 },
  semanticBindings: [
    { id: 'prop-port', drive: 'clip-loop', clip: 'ACT.Propeller.portAction', speedCoupled: true, rate: 1 },
    { id: 'prop-stbd', drive: 'clip-loop', clip: 'ACT.Propeller.starboardAction', speedCoupled: true, rate: 1 },
    {
      id: 'rudder',
      drive: 'procedural',
      nodes: ['ACT.Rudder.port', 'ACTRudderport', 'ACT.Rudder.starboard', 'ACTRudderstarboard'],
      axis: 'y',
      source: 'telemetry.rudderDeg',
      maxAngleDeg: 30,
      sign: 1,
    },
  ],
};

const TESSA_BASE = '/assets/model-releases/msc-tessa/v1.0.0';
export const MSC_TESSA_V1: VersionedModelPackageDescriptor = {
  packageId: 'msc-tessa',
  shipId: 'msc_tessa',
  modelVersion: '1.0.0',
  releaseManifestSha256: 'da8ebe39bbcb0d92453324bd3191655cd358da035ec5131f591493ec33ed8754',
  sourceBlendSha256: '4071f36ddc02b2c365dcdc12a122151ccf8662da6b0a3b9f21bb213ed9bdb579',
  baseUrl: TESSA_BASE,
  roles: {
    'ship-lod0': artifact(TESSA_BASE, 'ship-lod0', 'msc-tessa-ship-lod0.glb', '75fdbb9a3f5bf886e0ddeff3ce8e21eb50be3cdd1531cd05c422387c6a33fe83', 31972684),
    'ship-lod1': artifact(TESSA_BASE, 'ship-lod1', 'msc-tessa-ship-lod1.glb', '4630058368a82f8bea33c7dfdf137b98d72f48fc18ad94ad45627a97499a6256', 13535476),
    'ship-lod2': artifact(TESSA_BASE, 'ship-lod2', 'msc-tessa-ship-lod2.glb', 'd7c4e30f1b952d72f068c0adf36ff23ea2ff28ff19379ec03c3ddb2c6f3f02b8', 6845708),
  },
  coordinateBasis: { forward: '+Z', up: '+Y' },
  basisYawRad: 0,
  interfaceContract: visualContract(2, ['ACT.PropellerAction', 'ACT.RudderAction']),
  verticalAnchor: { designWaterlineY: 0 },
  modelLengthMeters: 399.9,
  telemetryScale: { designSpeedMps: 10.3, rudderLimitDeg: 35 },
  semanticBindings: [
    { id: 'prop', drive: 'clip-loop', clip: 'ACT.PropellerAction', speedCoupled: true, rate: 1 },
    {
      id: 'rudder',
      drive: 'procedural',
      nodes: ['ACT.Rudder', 'ACTRudder'],
      axis: 'y',
      source: 'telemetry.rudderDeg',
      maxAngleDeg: 30,
      sign: 1,
    },
  ],
};

const XL2_BASE = '/assets/model-releases/xue-long-2/v0.1.1';
export const XUE_LONG_2_V011: VersionedModelPackageDescriptor = {
  packageId: 'xue-long-2',
  shipId: 'xue_long_2',
  modelVersion: '0.1.1',
  releaseManifestSha256: '0823363bd3cfc94eb1d1ed53d9c4d7a9ae6a0d28f4a8e3442dcb0ee4ce3922be',
  sourceBlendSha256: '779376d5f1b62995868899e60e53e3536de55ea8482b5f6b26048502a6bf4d0f',
  baseUrl: XL2_BASE,
  roles: {
    'ship-lod0': artifact(XL2_BASE, 'ship-lod0', 'xue-long-2-ship-lod0.glb', '6b4a1aa6d2ae2dde7506edf95fbd0e08dc8505d3fd086a30ec45e6bef140bf70', 28705320),
    'ship-lod1': artifact(XL2_BASE, 'ship-lod1', 'xue-long-2-ship-lod1.glb', '37b78aec28c04ecd917b73462b577f488f5aa8abbce9d57399293547e09214b2', 19410008),
    'ship-lod2': artifact(XL2_BASE, 'ship-lod2', 'xue-long-2-ship-lod2.glb', '9094b6fe267d661ec07e41b05ecb4fa1f26778aa6ff2d00f0d3444020f64803e', 6129540),
  },
  coordinateBasis: { forward: '+X', up: '+Y' },
  basisYawRad: -Math.PI / 2,
  interfaceContract: visualContract(11, ['radar_0_spin', 'radar_1_spin', 'radar_2_spin']),
  verticalAnchor: { designWaterlineY: 0 },
  modelLengthMeters: 122.5,
  telemetryScale: { designSpeedMps: 6, rudderLimitDeg: 35 },
  semanticBindings: [
    { id: 'radar-0', drive: 'clip-loop', clip: 'radar_0_spin' },
    { id: 'radar-1', drive: 'clip-loop', clip: 'radar_1_spin' },
    { id: 'radar-2', drive: 'clip-loop', clip: 'radar_2_spin' },
    { id: 'pod-p', drive: 'live-rotation', nodes: ['XL2_POD_P'], axis: 'y', azipodSlot: 'P' },
    { id: 'pod-s', drive: 'live-rotation', nodes: ['XL2_POD_S'], axis: 'y', azipodSlot: 'S' },
    { id: 'prop-p', drive: 'live-spin', nodes: ['XL2_PROP_P'], axis: 'x', azipodSlot: 'P', sign: 1 },
    { id: 'prop-s', drive: 'live-spin', nodes: ['XL2_PROP_S'], axis: 'x', azipodSlot: 'S', sign: -1 },
  ],
  easterEgg: {
    patrolClips: [],
    attainmentClips: ['crane_AFT_slew', 'crane_FORE_slew', 'crane_RESEARCH_slew', 'helicopter_rotor'],
  },
};

const ADORA_BASE = '/assets/model-releases/adora-magic-city/v0.1.0';
export const ADORA_MAGIC_CITY_V010: VersionedModelPackageDescriptor = {
  packageId: 'adora-magic-city',
  shipId: 'adora_magic_city_h1508',
  modelVersion: '0.1.0',
  releaseManifestSha256: '1b26ff58dc067f59f6349d1c50df771ffa47a59ca2748ca83df8f8ad1bb9bd6b',
  sourceBlendSha256: '5b0e8009facc8bd19f425b3594de9ef9dc975daaad86acc80c9405000b309974',
  baseUrl: ADORA_BASE,
  roles: {
    'ship-lod0': artifact(ADORA_BASE, 'ship-lod0', 'adora-magic-city-ship-lod0.glb', '7b78d9b528bb7eac3fd122cd56335e7c1d02df40799b0beae940055a045f1353', 58454488),
    'ship-lod1': artifact(ADORA_BASE, 'ship-lod1', 'adora-magic-city-ship-lod1.glb', '56e169d8cd99906749780ef9f3c08763ca184980a787a49efd7dfb6a4de2877f', 14403336),
    'ship-lod2': artifact(ADORA_BASE, 'ship-lod2', 'adora-magic-city-ship-lod2.glb', '251f207f51d5dfc412757d4ef408acd8e8b29c465fba30d9d6eee36fbdf48c65', 4940344),
  },
  coordinateBasis: { forward: '+X', up: '+Y' },
  basisYawRad: -Math.PI / 2,
  interfaceContract: visualContract(7, [
    'radar_0_spin',
    'radar_1_spin',
    'radar_2_spin',
    'prop_p_spin',
    'prop_s_spin',
  ]),
  verticalAnchor: { designWaterlineY: 0 },
  modelLengthMeters: 323.6,
  telemetryScale: { designSpeedMps: 9.3, rudderLimitDeg: 35 },
  semanticBindings: [
    { id: 'radar-0', drive: 'clip-loop', clip: 'radar_0_spin' },
    { id: 'radar-1', drive: 'clip-loop', clip: 'radar_1_spin' },
    { id: 'radar-2', drive: 'clip-loop', clip: 'radar_2_spin' },
    { id: 'prop-p', drive: 'clip-loop', clip: 'prop_p_spin', speedCoupled: true, rate: 1 },
    { id: 'prop-s', drive: 'clip-loop', clip: 'prop_s_spin', speedCoupled: true, rate: 1 },
    {
      id: 'pod-azimuth',
      drive: 'procedural',
      nodes: ['AMC_OUT_POD_P', 'AMC_OUT_POD_S'],
      axis: 'y',
      source: 'telemetry.rudderDeg',
      maxAngleDeg: 30,
      sign: 1,
    },
  ],
};

const HYSY_THRUSTERS: SemanticAnimationBinding[] = Array.from({ length: 8 }, (_, index) => {
  const id = index + 1;
  return [
    {
      id: `thruster-${id}-azimuth`,
      drive: 'live-rotation' as const,
      nodes: [`Thruster_${id}_AzimuthPivot`],
      axis: 'y' as const,
      thrusterId: id,
    },
    {
      id: `thruster-${id}-spin`,
      drive: 'live-spin' as const,
      nodes: [`Thruster_${id}_SpinPivot`],
      axis: 'x' as const,
      thrusterId: id,
      sign: 1 as const,
    },
  ];
}).flat();

const HYSY_BASE_V1 = '/assets/model-releases/hysy-981/v1.0.0';
/** 已接收的 v1.0.0，保持不可变；生产激活为 v1.0.2。 */
export const HYSY_981_V1: VersionedModelPackageDescriptor = {
  packageId: 'hysy-981',
  shipId: 'hysy981',
  modelVersion: '1.0.0',
  releaseManifestSha256: 'f81461a172deab2884648fc6a2906036a1c816ac44a444237a1ff19bb69e7d5a',
  sourceBlendSha256: 'fa3476c6ca698a10a8777f04efc761efdc74acf319b8f90f2e0ee79faac95261',
  baseUrl: HYSY_BASE_V1,
  roles: {
    'ship-lod0': artifact(HYSY_BASE_V1, 'ship-lod0', 'hysy-981-ship-lod0.glb', 'abcb836b5eeb3b28bcbf3289a0ee7945a99b28ce1d41b477830a5c025e43e82f', 12556632),
    'ship-lod1': artifact(HYSY_BASE_V1, 'ship-lod1', 'hysy-981-ship-lod1.glb', '9e2dd211fbe2a2551b42bca28f6d724bcafd677de11c3cd04d2ea278295d6e4d', 9270492),
    'ship-lod2': artifact(HYSY_BASE_V1, 'ship-lod2', 'hysy-981-ship-lod2.glb', '97b87dcea34742d29be3c487e91bb65ac73343976a9ec95fd4e81902853be6d8', 5233536),
  },
  coordinateBasis: { forward: '+Z', up: '+Y' },
  basisYawRad: 0,
  interfaceContract: visualContract(14, [
    'CranePortCycle',
    'CraneStarboardCycle',
    'CraneAuxiliaryCycle',
    'ServiceDoor1',
    'ServiceDoor2',
    'TopDriveTravel',
  ]),
  verticalAnchor: { designWaterlineY: 0 },
  modelLengthMeters: 114,
  telemetryScale: { designSpeedMps: 1, rudderLimitDeg: 35 },
  semanticBindings: HYSY_THRUSTERS,
  easterEgg: {
    patrolClips: [],
    attainmentClips: [
      'CranePortCycle',
      'CraneStarboardCycle',
      'CraneAuxiliaryCycle',
      'ServiceDoor1',
      'ServiceDoor2',
      'TopDriveTravel',
    ],
  },
};

const HYSY_BASE = '/assets/model-releases/hysy-981/v1.0.2';
export const HYSY_981_V102: VersionedModelPackageDescriptor = {
  packageId: 'hysy-981',
  shipId: 'hysy981',
  modelVersion: '1.0.2',
  releaseManifestSha256: 'fd16b6bbfb7b2378ce56405d7df048f5a34b7b383fe108880dfd0bebd143978f',
  sourceBlendSha256: '5bb9e091771e26545b258067b566fe0f846ba4b5724b883b7cd999b879f2005d',
  baseUrl: HYSY_BASE,
  roles: {
    'ship-lod0': artifact(HYSY_BASE, 'ship-lod0', 'hysy-981-ship-lod0.glb', '8ed0b4f80003cba606f0451abcd5d28cfbf8fafacf544f5881fdb6c17e77c02a', 8803472),
    'ship-lod1': artifact(HYSY_BASE, 'ship-lod1', 'hysy-981-ship-lod1.glb', 'db77a653373bbdb1be40094e8ebc4a054675c8d2c3e9130b2ac9a5e7ab1e2f25', 6815824),
    'ship-lod2': artifact(HYSY_BASE, 'ship-lod2', 'hysy-981-ship-lod2.glb', 'c9c3073ab15c3c59913f9627aadc03c055c5a430b1ba06d61b3f86ec014ce5a7', 4538756),
  },
  coordinateBasis: { forward: '+Z', up: '+Y' },
  basisYawRad: 0,
  interfaceContract: visualContract(14, [
    'CranePortCycle',
    'CraneStarboardCycle',
    'CraneAuxiliaryCycle',
    'ServiceDoor1',
    'ServiceDoor2',
    'TopDriveTravel',
  ]),
  verticalAnchor: { designWaterlineY: 0 },
  modelLengthMeters: 114,
  telemetryScale: { designSpeedMps: 1, rudderLimitDeg: 35 },
  semanticBindings: HYSY_THRUSTERS,
  easterEgg: {
    patrolClips: [],
    attainmentClips: [
      'CranePortCycle',
      'CraneStarboardCycle',
      'CraneAuxiliaryCycle',
      'ServiceDoor1',
      'ServiceDoor2',
      'TopDriveTravel',
    ],
  },
};

const TIANJING_BASE = '/assets/model-releases/dredger-tianjing/v1.0.1';
/** 天鲸 v1.0.1：act-forward Meshopt GLB；船体设计近似 120 m，不按公开 127.5 m 缩放。 */
export const DREDGER_TIANJING_V101: VersionedModelPackageDescriptor = {
  packageId: 'dredger-tianjing',
  shipId: 'dredger_tianjing',
  modelVersion: '1.0.1',
  releaseManifestSha256: '7e4c91491117156887393646f8f750e07d761748c5132be32034a8a3235efbe6',
  sourceBlendSha256: 'a3aacd0275c5f50ea7eefe1900f76c66a7ff769ec1fb6a22a9b5efff6f3aa455',
  baseUrl: TIANJING_BASE,
  roles: {
    'ship-lod0': artifact(TIANJING_BASE, 'ship-lod0', 'dredger-tianjing-ship-lod0.glb', '0fa10a9faad7e38e549c1793bbdf217a41fb1cfd36c2960685bf194735927c5e', 16223384),
    'ship-lod1': artifact(TIANJING_BASE, 'ship-lod1', 'dredger-tianjing-ship-lod1.glb', '16d9535981195e85ee44a74f9c0fe4ff41eb89f7c80be9cc6c8a5d12a273c18c', 13333432),
    'ship-lod2': artifact(TIANJING_BASE, 'ship-lod2', 'dredger-tianjing-ship-lod2.glb', '82c022a23cceeb2d5dd63bffd65846b6ac538ff7ef910c3b3c5ce8b35e1b8509', 4331152),
  },
  coordinateBasis: { forward: '+Z', up: '+Y' },
  basisYawRad: 0,
  interfaceContract: visualContract(18, [
    'TJ_DEMO_prop_port',
    'TJ_DEMO_prop_starboard',
    'TJ_DEMO_rudder_port',
    'TJ_DEMO_rudder_starboard',
    'TJ_DEMO_cutter_spin',
  ]),
  verticalAnchor: { designWaterlineY: 0 },
  modelLengthMeters: 120,
  telemetryScale: { designSpeedMps: 6, rudderLimitDeg: 25 },
  semanticBindings: [
    {
      id: 'rudder',
      drive: 'procedural',
      nodes: ['TJ_RUDDER_PORT', 'TJ_RUDDER_STBD'],
      axis: 'y',
      source: 'telemetry.rudderDeg',
      maxAngleDeg: 25,
      sign: 1,
    },
    {
      id: 'prop-port',
      drive: 'live-spin',
      nodes: ['TJ_PROP_PORT'],
      axis: 'x',
      rpmFromSpeed: true,
      designRpm: 120,
    },
    {
      id: 'prop-stbd',
      drive: 'live-spin',
      nodes: ['TJ_PROP_STBD'],
      axis: 'x',
      rpmFromSpeed: true,
      designRpm: 120,
      sign: -1,
    },
    {
      id: 'cutter-spin',
      drive: 'live-spin',
      nodes: ['TJ_CUTTER'],
      axis: 'x',
      cutter: true,
    },
  ] satisfies readonly SemanticAnimationBinding[],
  easterEgg: {
    patrolClips: [],
    attainmentClips: [
      'TJ_DEMO_crane_FWD_slew',
      'TJ_DEMO_crane_FWD_luff',
      'TJ_DEMO_crane_FWD_hoist',
      'TJ_DEMO_crane_MID_slew',
      'TJ_DEMO_crane_MID_luff',
      'TJ_DEMO_crane_MID_hoist',
    ],
  },
};

const LNG_BASE_V110 = '/assets/model-releases/lng-changheng/v1.1.0';
export const LNG_CHANGHENG_V110: VersionedModelPackageDescriptor = {
  ...LNG_CHANGHENG_V1,
  modelVersion: '1.1.0',
  releaseManifestSha256: '36e4e3d08ba5debfb541fdc3b8709f7cda309848d5d8563588c94b545a774de8',
  sourceBlendSha256: 'e16db39d111f605d426a595a2fc8ce27a465685fda0f1947f31767dd8d980af8',
  baseUrl: LNG_BASE_V110,
  roles: {
    'ship-lod0': artifact(LNG_BASE_V110, 'ship-lod0', 'lng-changheng-ship-lod0.glb', 'ea3cff4b5d893abb8e1a37774d4d1c2b679a45271713519c9aa32966098d7996', 18334232),
    'ship-lod1': artifact(LNG_BASE_V110, 'ship-lod1', 'lng-changheng-ship-lod1.glb', 'db8c55f960c094bb1e83939af25cf138e59cd428947ee903d66014f3e8c186ba', 14090944),
    'ship-lod2': artifact(LNG_BASE_V110, 'ship-lod2', 'lng-changheng-ship-lod2.glb', '1d469e223d97cf34b22c4804a1e57babcfa1f93682147b1bb67d9891be25bb78', 12260464),
  },
  coordinateBasis: { forward: '+X', up: '+Y' },
  basisYawRad: 0,
  modelToSceneMatrix: HERO_NATIVE_TO_SCENE,
};

const TESSA_BASE_V110 = '/assets/model-releases/msc-tessa/v1.1.0';
export const MSC_TESSA_V110: VersionedModelPackageDescriptor = {
  ...MSC_TESSA_V1,
  modelVersion: '1.1.0',
  releaseManifestSha256: '9992c511247e98db0938df49d84aee59e2fc44f75a6180f006b04e49852631a6',
  sourceBlendSha256: 'dfe9eb7cdf9e23baf93088f97be4877a8f5a5045f2edc3ca788774bcc9e8ef46',
  baseUrl: TESSA_BASE_V110,
  roles: {
    'ship-lod0': artifact(TESSA_BASE_V110, 'ship-lod0', 'msc-tessa-ship-lod0.glb', '52519cc2c3c8ef939b0fa7c22c487d44c6f6c931d214c86d3311a88b3084a487', 15126196),
    'ship-lod1': artifact(TESSA_BASE_V110, 'ship-lod1', 'msc-tessa-ship-lod1.glb', 'e56b291d700cc75143ee531aceea2b0fec90e483fdd4469e8ccdd9acc0a41e29', 6367796),
    'ship-lod2': artifact(TESSA_BASE_V110, 'ship-lod2', 'msc-tessa-ship-lod2.glb', '13b3355f3379616f854f06283e590d3cf2327529556b32116333194fb6398052', 3359496),
  },
  coordinateBasis: { forward: '+X', up: '+Y' },
  basisYawRad: 0,
  modelToSceneMatrix: HERO_NATIVE_TO_SCENE,
};

const XL2_BASE_V100 = '/assets/model-releases/xue-long-2/v1.0.0';
export const XUE_LONG_2_V100: VersionedModelPackageDescriptor = {
  ...XUE_LONG_2_V011,
  modelVersion: '1.0.0',
  releaseManifestSha256: '84a03708e930baad8fd8f611338ea8fa122e03d4d10be7d1e1d93d905bdbe59a',
  sourceBlendSha256: '0363a7b096e45d9dca89af38340985f8fcd49d182d103809c3476d76ac31ac02',
  baseUrl: XL2_BASE_V100,
  roles: {
    'ship-lod0': artifact(XL2_BASE_V100, 'ship-lod0', 'xue-long-2-ship-lod0.glb', '07f6c32aaa3f9e8003004b7df9679f2c1625893fb7ccbc3fd81142e57ece0ad2', 18491600),
    'ship-lod1': artifact(XL2_BASE_V100, 'ship-lod1', 'xue-long-2-ship-lod1.glb', '2d2e2c05ccdcb686e0cfac09122c1ef50a6bf79e6ba299a2afbce0d05b3b34a4', 11168364),
    'ship-lod2': artifact(XL2_BASE_V100, 'ship-lod2', 'xue-long-2-ship-lod2.glb', '44cf32a79a55b100d1fb5339b42aad4157f066ce84a73852ec2655033c01b4ae', 3454636),
  },
  coordinateBasis: { forward: '+X', up: '+Y' },
  basisYawRad: 0,
  modelToSceneMatrix: HERO_NATIVE_TO_SCENE,
};

const ADORA_BASE_V100 = '/assets/model-releases/adora-magic-city/v1.0.0';
export const ADORA_MAGIC_CITY_V100: VersionedModelPackageDescriptor = {
  ...ADORA_MAGIC_CITY_V010,
  modelVersion: '1.0.0',
  releaseManifestSha256: '74e9db5300e7a059468222260b3668d0b7197ddf689a4df69d135365bdeeb891',
  sourceBlendSha256: 'c8193a2cdc61a756745238ccfb8abd243f051dfb5aabef61a7be4921b0ea769c',
  baseUrl: ADORA_BASE_V100,
  roles: {
    'ship-lod0': artifact(ADORA_BASE_V100, 'ship-lod0', 'adora-magic-city-ship-lod0.glb', '9cd3759921334a12869c93d900066f694e6c50ef5228b62b83cf89a8d5e006c4', 23862856),
    'ship-lod1': artifact(ADORA_BASE_V100, 'ship-lod1', 'adora-magic-city-ship-lod1.glb', '0a16a760d9e1e9d29443603092747d393b26b87bc3562157a4b99948ce30fb10', 7347580),
    'ship-lod2': artifact(ADORA_BASE_V100, 'ship-lod2', 'adora-magic-city-ship-lod2.glb', 'c1bfd4c4af9452f656bf8d14b68a713197089e330c12190d63547e3d3eae311f', 2905428),
  },
  coordinateBasis: { forward: '+X', up: '+Y' },
  basisYawRad: 0,
  modelToSceneMatrix: HERO_NATIVE_TO_SCENE,
};

const HYSY_BASE_V110 = '/assets/model-releases/hysy-981/v1.1.0';
export const HYSY_981_V110: VersionedModelPackageDescriptor = {
  ...HYSY_981_V102,
  modelVersion: '1.1.0',
  releaseManifestSha256: 'e8784560cea34d3f97bac573fe599733aa4a042ba4f16cf2e938969da634a640',
  sourceBlendSha256: '383f2ee2958639634555ef9d78370d7ceebadd1ef5b98bd19be94efbfa83ca52',
  baseUrl: HYSY_BASE_V110,
  roles: {
    'ship-lod0': artifact(HYSY_BASE_V110, 'ship-lod0', 'hysy-981-ship-lod0.glb', '140f6599a9ea9495f6d9d059480924c340c581eaceabf19c650184d6c3c18791', 8803276),
    'ship-lod1': artifact(HYSY_BASE_V110, 'ship-lod1', 'hysy-981-ship-lod1.glb', 'e1f504c43136d8732434eb205168b379530c003110b293f77632ad777c2db1de', 6815628),
    'ship-lod2': artifact(HYSY_BASE_V110, 'ship-lod2', 'hysy-981-ship-lod2.glb', '315ae2cce75e4dc75b42bdf13a91cc98f0bf1576ec8dce0620993aa7b2ae7a0c', 4538556),
  },
  coordinateBasis: { forward: '+X', up: '+Y' },
  basisYawRad: 0,
  modelToSceneMatrix: HERO_NATIVE_TO_SCENE,
};

const TIANJING_BASE_V110 = '/assets/model-releases/dredger-tianjing/v1.1.0';
export const DREDGER_TIANJING_V110: VersionedModelPackageDescriptor = {
  ...DREDGER_TIANJING_V101,
  modelVersion: '1.1.0',
  releaseManifestSha256: 'cb9113e730cc5cd7d643a0b663fa422fa8edaf2356058d4bc16bc18ddcc6305d',
  sourceBlendSha256: '6c45ea9a08d3939af59957267605fab78a84a299ab923646f522caacb84cf281',
  baseUrl: TIANJING_BASE_V110,
  roles: {
    'ship-lod0': artifact(TIANJING_BASE_V110, 'ship-lod0', 'dredger-tianjing-ship-lod0.glb', '9d497172cf2b53bf6db61e9a027561156ea1d23e5ebe650f6ad2443d1faa729e', 16223208),
    'ship-lod1': artifact(TIANJING_BASE_V110, 'ship-lod1', 'dredger-tianjing-ship-lod1.glb', 'a58fb171527a8af14feb0816c26589dede14566c816db6110066fde804f92eb2', 13333256),
    'ship-lod2': artifact(TIANJING_BASE_V110, 'ship-lod2', 'dredger-tianjing-ship-lod2.glb', '29dc3424ae55e4ed2d50404335f6e8647a9142e22f1a16ac339b1c6d9bdb1f16', 4330980),
  },
  coordinateBasis: { forward: '+X', up: '+Y' },
  basisYawRad: 0,
  modelToSceneMatrix: HERO_NATIVE_TO_SCENE,
};

export const FLEET_ACTIVE_PACKAGES: Partial<Record<SimulationModelId, VersionedModelPackageDescriptor>> = {
  destroyer: TYPE055_NANCHANG_101_V2,
  'lng-carrier': LNG_CHANGHENG_V110,
  container: MSC_TESSA_V110,
  icebreaker: XUE_LONG_2_V100,
  'luxury-liner': ADORA_MAGIC_CITY_V100,
  'drilling-rig': HYSY_981_V110,
  dredger: DREDGER_TIANJING_V110,
};

export function matchActivatedFleetPackage(
  logicalId: SimulationModelId,
  activation: VersionedDefaultActivation | null,
): VersionedModelPackageDescriptor | null {
  if (!activation) return null;
  const descriptor = FLEET_ACTIVE_PACKAGES[logicalId];
  if (!descriptor) return null;
  if (
    descriptor.packageId === activation.packageId
    && descriptor.modelVersion === activation.modelVersion
    && descriptor.baseUrl === activation.baseUrl
  ) {
    return descriptor;
  }
  return null;
}
