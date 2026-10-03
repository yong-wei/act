import { RELEASED_PROPULSION_ANCHORS } from './released-propulsion-anchors';
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

const LNG_BASE = '/assets/model-releases/lng-changheng/v1.2.0';
export const LNG_CHANGHENG_V120: VersionedModelPackageDescriptor = {
  packageId: 'lng-changheng',
  shipId: 'lng_changheng',
  modelVersion: '1.2.0',
  releaseManifestSha256: '411c51388054e9e1b7a9f666b06d7ff055c19484fbeafe35a5453a986363bcaf',
  sourceBlendSha256: '607e23ed4bd55051ea5a496bbabd69a28b58153ed6c99f6595536c01f359f869',
  baseUrl: LNG_BASE,
  roles: {
    'ship-proxy': artifact(LNG_BASE, 'ship-proxy', 'models/lng-changheng-ship-proxy.glb', 'ee1af4066ac326f519ce35496c47f1b940b664724466b4aba45b43131aeface7', 37280),
    'propulsion-anchors': artifact(LNG_BASE, 'propulsion-anchors', 'interfaces/propulsion-anchors.json', 'c5a93daa47558aef8f5ae08b734414d128f07b3b988605b6d1d3ed4d8a7076be', 5103),
    'ship-lod0': artifact(LNG_BASE, 'ship-lod0', 'models/lng-changheng-ship-lod0.glb', '6f294e520e3bbfebb631dcf3791f453f3387651cb0b1833aaafcfd4cadf56d2f', 10710900),
    'ship-lod1': artifact(LNG_BASE, 'ship-lod1', 'models/lng-changheng-ship-lod1.glb', '2c615e8bcbc2100b2ab7227ad9d5290f7e37e6c7148719d32fe538f64a92bdc5', 6467760),
    'ship-lod2': artifact(LNG_BASE, 'ship-lod2', 'models/lng-changheng-ship-lod2.glb', '4995b614934ccefad0830602e874e74e949edf8366b7eadc1407eb355f6297af', 4637340),
  },
  propulsionAnchors: RELEASED_PROPULSION_ANCHORS['lng-changheng'],
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

const TESSA_BASE = '/assets/model-releases/msc-tessa/v1.2.0';
export const MSC_TESSA_V120: VersionedModelPackageDescriptor = {
  packageId: 'msc-tessa',
  shipId: 'msc_tessa',
  modelVersion: '1.2.0',
  releaseManifestSha256: 'f5a1defd5e76e02418a27a5b88d06712d3ca5f52aa693300e1abda292aade66c',
  sourceBlendSha256: '85363a4f28059ac255e9ae86446563effd6246a687582d0541f872d00bba1f32',
  baseUrl: TESSA_BASE,
  roles: {
    'ship-proxy': artifact(TESSA_BASE, 'ship-proxy', 'models/msc-tessa-ship-proxy.glb', '869213db6cc8f9e6ffecb54eb0ef7742b80f2a57cc9673ea270e4c56918be096', 95432),
    'propulsion-anchors': artifact(TESSA_BASE, 'propulsion-anchors', 'interfaces/propulsion-anchors.json', '191603d27dbe5ad0067d94a479e801a8afcf540cbc30979e250dbe782f0d98ed', 3077),
    'ship-lod0': artifact(TESSA_BASE, 'ship-lod0', 'models/msc-tessa-ship-lod0.glb', '52519cc2c3c8ef939b0fa7c22c487d44c6f6c931d214c86d3311a88b3084a487', 15126196),
    'ship-lod1': artifact(TESSA_BASE, 'ship-lod1', 'models/msc-tessa-ship-lod1.glb', 'e56b291d700cc75143ee531aceea2b0fec90e483fdd4469e8ccdd9acc0a41e29', 6367796),
    'ship-lod2': artifact(TESSA_BASE, 'ship-lod2', 'models/msc-tessa-ship-lod2.glb', '13b3355f3379616f854f06283e590d3cf2327529556b32116333194fb6398052', 3359496),
  },
  propulsionAnchors: RELEASED_PROPULSION_ANCHORS['msc-tessa'],
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

const XL2_BASE = '/assets/model-releases/xue-long-2/v1.1.0';
export const XUE_LONG_2_V110: VersionedModelPackageDescriptor = {
  packageId: 'xue-long-2',
  shipId: 'xue_long_2',
  modelVersion: '1.1.0',
  releaseManifestSha256: '57da2380443b4b78675de1f63e7fe2c3358f93a250fa0969eb599ca9a4b23a8b',
  sourceBlendSha256: '75a83f4ab05e7c535fd7e341529e84e94d9a5de039585e88d2893eba6db90a96',
  baseUrl: XL2_BASE,
  roles: {
    'ship-proxy': artifact(XL2_BASE, 'ship-proxy', 'models/xue-long-2-ship-proxy.glb', '9982a57a62ba37b19545dc93d2c290a8c8530416581261508d85d92834753af2', 36928),
    'propulsion-anchors': artifact(XL2_BASE, 'propulsion-anchors', 'interfaces/propulsion-anchors.json', '43c887ce766c599a30916d700aae2c006b02a8c173143fe42c87764e8cbf9de1', 5305),
    'ship-lod0': artifact(XL2_BASE, 'ship-lod0', 'models/xue-long-2-ship-lod0.glb', 'a1e33b97c240c821c0f9f2e226e41cb1cf4391b8fd2e12ec3bb8ea4d416e4e80', 7509328),
    'ship-lod1': artifact(XL2_BASE, 'ship-lod1', 'models/xue-long-2-ship-lod1.glb', 'dc09a991112beaf33afdcb51e09fbefa4155f9577ec8a9d8b0b6ccc5e607e45d', 6094404),
    'ship-lod2': artifact(XL2_BASE, 'ship-lod2', 'models/xue-long-2-ship-lod2.glb', 'f9d90d22c36a867ad6a76cc469ebf0252acca349f675683d2ee02ec3dd6cef12', 2319132),
  },
  propulsionAnchors: RELEASED_PROPULSION_ANCHORS['xue-long-2'],
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

const ADORA_BASE = '/assets/model-releases/adora-magic-city/v1.1.0';
export const ADORA_MAGIC_CITY_V110: VersionedModelPackageDescriptor = {
  packageId: 'adora-magic-city',
  shipId: 'adora_magic_city_h1508',
  modelVersion: '1.1.0',
  releaseManifestSha256: '4d57f379afd874da75187ba0cdb400e440141829ff3b0ca4b8dd58f12665632f',
  sourceBlendSha256: '473c8e50d23ae21c11af75a71cb55fc03ea7f6f571acefb92f418070ed80dc19',
  baseUrl: ADORA_BASE,
  roles: {
    'ship-proxy': artifact(ADORA_BASE, 'ship-proxy', 'models/adora-magic-city-ship-proxy.glb', '9bcc54e6158e96eebb82534d53ae0d099e2bf3a73ee70be75d86715d03c4a8b9', 66092),
    'propulsion-anchors': artifact(ADORA_BASE, 'propulsion-anchors', 'interfaces/propulsion-anchors.json', '34c40bf93c2b0fc2eafc36f1bc6eb95009329be87038136629978038da91a010', 5365),
    'ship-lod0': artifact(ADORA_BASE, 'ship-lod0', 'models/adora-magic-city-ship-lod0.glb', 'badabacafdef99ce846db44cfb529e1c4424dda3e02e1cdeb4172b332b52faec', 22949872),
    'ship-lod1': artifact(ADORA_BASE, 'ship-lod1', 'models/adora-magic-city-ship-lod1.glb', '23babd95b7659cb7a842107279053c579e6235b8c338b86b1317c538bf99cc78', 6434592),
    'ship-lod2': artifact(ADORA_BASE, 'ship-lod2', 'models/adora-magic-city-ship-lod2.glb', '026c737c8b46cbed6cd7dec33e47beaaf18327355a5553a086c8c3cff82652b0', 1992404),
  },
  propulsionAnchors: RELEASED_PROPULSION_ANCHORS['adora-magic-city'],
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

const HYSY_BASE = '/assets/model-releases/hysy-981/v1.2.0';
export const HYSY_981_V120: VersionedModelPackageDescriptor = {
  packageId: 'hysy-981',
  shipId: 'hysy981',
  modelVersion: '1.2.0',
  releaseManifestSha256: '3479e094f0ce6ec9589648930ffc90c907e795a7b6446e92c03b3174fd233c95',
  sourceBlendSha256: '4021d91a3b8bcd98dcb6d3e144c09c3dc0d41f323c5bc7113a7a8a5bcec9f1cc',
  baseUrl: HYSY_BASE,
  roles: {
    'ship-proxy': artifact(HYSY_BASE, 'ship-proxy', 'models/hysy-981-ship-proxy.glb', 'e0adcdfbbfe794af348043fa3985bcca878895c59f7fcb4bf5757c78b221a99c', 92384),
    'propulsion-anchors': artifact(HYSY_BASE, 'propulsion-anchors', 'interfaces/propulsion-anchors.json', 'da483e84c56b8add154347af24fd6008863300a093e43dd51fcb544291b3135d', 22865),
    'ship-lod0': artifact(HYSY_BASE, 'ship-lod0', 'models/hysy-981-ship-lod0.glb', '26625689a73c013117fcdcef1c28a7a4b91a09ea345febf83d58c46884693349', 5808468),
    'ship-lod1': artifact(HYSY_BASE, 'ship-lod1', 'models/hysy-981-ship-lod1.glb', '66437e66825ae1f75e0d878ed2c3932361be2323b9c0ef6b94087aa712b25977', 3820820),
    'ship-lod2': artifact(HYSY_BASE, 'ship-lod2', 'models/hysy-981-ship-lod2.glb', '148bcbde326301a8b5060209bdc313c1eca72a57f5efc86135a988e9c6d6b8b8', 1543696),
  },
  propulsionAnchors: RELEASED_PROPULSION_ANCHORS['hysy-981'],
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

const TIANJING_BASE = '/assets/model-releases/dredger-tianjing/v1.2.0';
export const DREDGER_TIANJING_V120: VersionedModelPackageDescriptor = {
  packageId: 'dredger-tianjing',
  shipId: 'dredger_tianjing',
  modelVersion: '1.2.0',
  releaseManifestSha256: '6bfba1a313349014c191f9284b23a943f5a3ab743f34cb4dc959c69d2967edc2',
  sourceBlendSha256: '6349f951ec380d68939817e78b02644a3095b4371414c9f905478dc03ffe8e35',
  baseUrl: TIANJING_BASE,
  roles: {
    'ship-proxy': artifact(TIANJING_BASE, 'ship-proxy', 'models/dredger-tianjing-ship-proxy.glb', '180bcefc2f18b34cb1a895e681e216ea01b72b4c2130f18e75fcd503d04ceecf', 30952),
    'propulsion-anchors': artifact(TIANJING_BASE, 'propulsion-anchors', 'interfaces/propulsion-anchors.json', '76679528e9f0d38be4d48a0ad2ddc07dcfbbc896714d9e7ac5fe5d38a15a0f18', 5735),
    'ship-lod0': artifact(TIANJING_BASE, 'ship-lod0', 'models/dredger-tianjing-ship-lod0.glb', '25613ad60b2f2cea1bd32366fc0d84f56fafd3168c53f7d8c786e60a9649110d', 7621804),
    'ship-lod1': artifact(TIANJING_BASE, 'ship-lod1', 'models/dredger-tianjing-ship-lod1.glb', '56d58219b57876f37eb014aad737554212bd92720caa35c33c4e6985f34f72e2', 4659296),
    'ship-lod2': artifact(TIANJING_BASE, 'ship-lod2', 'models/dredger-tianjing-ship-lod2.glb', '9f613d41583ff09e0dbdedbbbd405eabdac6c191dd244e90c1cb6174104b5091', 2148672),
  },
  propulsionAnchors: RELEASED_PROPULSION_ANCHORS['dredger-tianjing'],
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
  'lng-carrier': LNG_CHANGHENG_V120,
  container: MSC_TESSA_V120,
  icebreaker: XUE_LONG_2_V110,
  'luxury-liner': ADORA_MAGIC_CITY_V110,
  'drilling-rig': HYSY_981_V120,
  dredger: DREDGER_TIANJING_V120,
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
