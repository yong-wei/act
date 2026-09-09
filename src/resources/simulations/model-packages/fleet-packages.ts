/**
 * 船队已激活版本化模型包（055 除外，仍见 type055-nanchang-101-v2.ts）。
 * 身份与 SHA-256 来自 receive-fleet-model-release.mjs 收据。
 * 每个 logicalId 只登记当前激活版；旧版描述符与目录已退役。
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

const LNG_BASE = '/assets/model-releases/lng-changheng/v1.1.1';
export const LNG_CHANGHENG_V111: VersionedModelPackageDescriptor = {
  packageId: 'lng-changheng',
  shipId: 'lng_changheng',
  modelVersion: '1.1.1',
  releaseManifestSha256: '70270b78cbbcf030fac43e7b4df8bbce600d272aa6d15eaa72abee5e127b207f',
  sourceBlendSha256: '607e23ed4bd55051ea5a496bbabd69a28b58153ed6c99f6595536c01f359f869',
  baseUrl: LNG_BASE,
  roles: {
    'ship-lod0': artifact(LNG_BASE, 'ship-lod0', 'models/lng-changheng-ship-lod0.glb', '6f294e520e3bbfebb631dcf3791f453f3387651cb0b1833aaafcfd4cadf56d2f', 10710900),
    'ship-lod1': artifact(LNG_BASE, 'ship-lod1', 'models/lng-changheng-ship-lod1.glb', '2c615e8bcbc2100b2ab7227ad9d5290f7e37e6c7148719d32fe538f64a92bdc5', 6467760),
    'ship-lod2': artifact(LNG_BASE, 'ship-lod2', 'models/lng-changheng-ship-lod2.glb', '4995b614934ccefad0830602e874e74e949edf8366b7eadc1407eb355f6297af', 4637340),
  },
  coordinateBasis: { forward: '+X', up: '+Y' },
  basisYawRad: 0,
  modelToSceneMatrix: HERO_NATIVE_TO_SCENE,
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

const TESSA_BASE = '/assets/model-releases/msc-tessa/v1.1.1';
export const MSC_TESSA_V111: VersionedModelPackageDescriptor = {
  packageId: 'msc-tessa',
  shipId: 'msc_tessa',
  modelVersion: '1.1.1',
  releaseManifestSha256: '03b0b0d5f23e60baeb7db9f03ea207060545286221f407693a1a8bb6dcf76f48',
  sourceBlendSha256: '85363a4f28059ac255e9ae86446563effd6246a687582d0541f872d00bba1f32',
  baseUrl: TESSA_BASE,
  roles: {
    'ship-lod0': artifact(TESSA_BASE, 'ship-lod0', 'models/msc-tessa-ship-lod0.glb', '52519cc2c3c8ef939b0fa7c22c487d44c6f6c931d214c86d3311a88b3084a487', 15126196),
    'ship-lod1': artifact(TESSA_BASE, 'ship-lod1', 'models/msc-tessa-ship-lod1.glb', 'e56b291d700cc75143ee531aceea2b0fec90e483fdd4469e8ccdd9acc0a41e29', 6367796),
    'ship-lod2': artifact(TESSA_BASE, 'ship-lod2', 'models/msc-tessa-ship-lod2.glb', '13b3355f3379616f854f06283e590d3cf2327529556b32116333194fb6398052', 3359496),
  },
  coordinateBasis: { forward: '+X', up: '+Y' },
  basisYawRad: 0,
  modelToSceneMatrix: HERO_NATIVE_TO_SCENE,
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

const XL2_BASE = '/assets/model-releases/xue-long-2/v1.0.1';
export const XUE_LONG_2_V101: VersionedModelPackageDescriptor = {
  packageId: 'xue-long-2',
  shipId: 'xue_long_2',
  modelVersion: '1.0.1',
  releaseManifestSha256: '7d5ac39938017b78c1ca3fbd46e9986224e86f86b5d7d353c26d1ae837517403',
  sourceBlendSha256: '75a83f4ab05e7c535fd7e341529e84e94d9a5de039585e88d2893eba6db90a96',
  baseUrl: XL2_BASE,
  roles: {
    'ship-lod0': artifact(XL2_BASE, 'ship-lod0', 'models/xue-long-2-ship-lod0.glb', 'a1e33b97c240c821c0f9f2e226e41cb1cf4391b8fd2e12ec3bb8ea4d416e4e80', 7509328),
    'ship-lod1': artifact(XL2_BASE, 'ship-lod1', 'models/xue-long-2-ship-lod1.glb', 'dc09a991112beaf33afdcb51e09fbefa4155f9577ec8a9d8b0b6ccc5e607e45d', 6094404),
    'ship-lod2': artifact(XL2_BASE, 'ship-lod2', 'models/xue-long-2-ship-lod2.glb', 'f9d90d22c36a867ad6a76cc469ebf0252acca349f675683d2ee02ec3dd6cef12', 2319132),
  },
  coordinateBasis: { forward: '+X', up: '+Y' },
  basisYawRad: 0,
  modelToSceneMatrix: HERO_NATIVE_TO_SCENE,
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

const ADORA_BASE = '/assets/model-releases/adora-magic-city/v1.0.1';
export const ADORA_MAGIC_CITY_V101: VersionedModelPackageDescriptor = {
  packageId: 'adora-magic-city',
  shipId: 'adora_magic_city_h1508',
  modelVersion: '1.0.1',
  releaseManifestSha256: '16b837703fce1625386e6effc48664e9f0b2476e9f10dfcd6f35f19d6dab1998',
  sourceBlendSha256: '473c8e50d23ae21c11af75a71cb55fc03ea7f6f571acefb92f418070ed80dc19',
  baseUrl: ADORA_BASE,
  roles: {
    'ship-lod0': artifact(ADORA_BASE, 'ship-lod0', 'models/adora-magic-city-ship-lod0.glb', 'badabacafdef99ce846db44cfb529e1c4424dda3e02e1cdeb4172b332b52faec', 22949872),
    'ship-lod1': artifact(ADORA_BASE, 'ship-lod1', 'models/adora-magic-city-ship-lod1.glb', '23babd95b7659cb7a842107279053c579e6235b8c338b86b1317c538bf99cc78', 6434592),
    'ship-lod2': artifact(ADORA_BASE, 'ship-lod2', 'models/adora-magic-city-ship-lod2.glb', '026c737c8b46cbed6cd7dec33e47beaaf18327355a5553a086c8c3cff82652b0', 1992404),
  },
  coordinateBasis: { forward: '+X', up: '+Y' },
  basisYawRad: 0,
  modelToSceneMatrix: HERO_NATIVE_TO_SCENE,
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

const HYSY_BASE = '/assets/model-releases/hysy-981/v1.1.1';
export const HYSY_981_V111: VersionedModelPackageDescriptor = {
  packageId: 'hysy-981',
  shipId: 'hysy981',
  modelVersion: '1.1.1',
  releaseManifestSha256: '5f03cc73173f94502d2891a432d5c0ba7dfcef533342688bd761fa3008574952',
  sourceBlendSha256: '4021d91a3b8bcd98dcb6d3e144c09c3dc0d41f323c5bc7113a7a8a5bcec9f1cc',
  baseUrl: HYSY_BASE,
  roles: {
    'ship-lod0': artifact(HYSY_BASE, 'ship-lod0', 'models/hysy-981-ship-lod0.glb', '26625689a73c013117fcdcef1c28a7a4b91a09ea345febf83d58c46884693349', 5808468),
    'ship-lod1': artifact(HYSY_BASE, 'ship-lod1', 'models/hysy-981-ship-lod1.glb', '66437e66825ae1f75e0d878ed2c3932361be2323b9c0ef6b94087aa712b25977', 3820820),
    'ship-lod2': artifact(HYSY_BASE, 'ship-lod2', 'models/hysy-981-ship-lod2.glb', '148bcbde326301a8b5060209bdc313c1eca72a57f5efc86135a988e9c6d6b8b8', 1543696),
  },
  coordinateBasis: { forward: '+X', up: '+Y' },
  basisYawRad: 0,
  modelToSceneMatrix: HERO_NATIVE_TO_SCENE,
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

const TIANJING_BASE = '/assets/model-releases/dredger-tianjing/v1.1.1';
export const DREDGER_TIANJING_V111: VersionedModelPackageDescriptor = {
  packageId: 'dredger-tianjing',
  shipId: 'dredger_tianjing',
  modelVersion: '1.1.1',
  releaseManifestSha256: '3eb8568bcf15fc44cb8c9989185cdbadd20c7554976070a876bdf92aa31dfb82',
  sourceBlendSha256: '6349f951ec380d68939817e78b02644a3095b4371414c9f905478dc03ffe8e35',
  baseUrl: TIANJING_BASE,
  roles: {
    'ship-lod0': artifact(TIANJING_BASE, 'ship-lod0', 'models/dredger-tianjing-ship-lod0.glb', '25613ad60b2f2cea1bd32366fc0d84f56fafd3168c53f7d8c786e60a9649110d', 7621804),
    'ship-lod1': artifact(TIANJING_BASE, 'ship-lod1', 'models/dredger-tianjing-ship-lod1.glb', '56d58219b57876f37eb014aad737554212bd92720caa35c33c4e6985f34f72e2', 4659296),
    'ship-lod2': artifact(TIANJING_BASE, 'ship-lod2', 'models/dredger-tianjing-ship-lod2.glb', '9f613d41583ff09e0dbdedbbbd405eabdac6c191dd244e90c1cb6174104b5091', 2148672),
  },
  coordinateBasis: { forward: '+X', up: '+Y' },
  basisYawRad: 0,
  modelToSceneMatrix: HERO_NATIVE_TO_SCENE,
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

export const FLEET_ACTIVE_PACKAGES: Partial<Record<SimulationModelId, VersionedModelPackageDescriptor>> = {
  destroyer: TYPE055_NANCHANG_101_V2,
  'lng-carrier': LNG_CHANGHENG_V111,
  container: MSC_TESSA_V111,
  icebreaker: XUE_LONG_2_V101,
  'luxury-liner': ADORA_MAGIC_CITY_V101,
  'drilling-rig': HYSY_981_V111,
  dredger: DREDGER_TIANJING_V111,
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
