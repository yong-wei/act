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

const LNG_BASE = '/assets/model-releases/lng-changheng/v1.3.0';
export const LNG_CHANGHENG_V130: VersionedModelPackageDescriptor = {
  packageId: 'lng-changheng',
  shipId: 'lng_changheng',
  modelVersion: '1.3.0',
  releaseManifestSha256: 'ffeb6901e4d9e4ad4bdf5b09dda52096ab926b32c730f7f0b03a47e9b5e66ce1',
  sourceBlendSha256: '607e23ed4bd55051ea5a496bbabd69a28b58153ed6c99f6595536c01f359f869',
  baseUrl: LNG_BASE,
  roles: {
    'ship-proxy': artifact(LNG_BASE, 'ship-proxy', 'models/lng-changheng-ship-proxy.glb', 'ee1af4066ac326f519ce35496c47f1b940b664724466b4aba45b43131aeface7', 37280),
    'propulsion-anchors': artifact(LNG_BASE, 'propulsion-anchors', 'interfaces/propulsion-anchors.json', 'f0fc8608ffa2a17361b30bcbf01e28babf3ecb57aa7cbdd058297da53cea225a', 5103),
    'ship-lod0': artifact(LNG_BASE, 'ship-lod0', 'models/lng-changheng-ship-lod0.glb', '866a05bc9e56e352bd8362bbd540a8781482f03cd8a6a71c8292ca5648cb2df3', 3958176),
    'ship-lod1': artifact(LNG_BASE, 'ship-lod1', 'models/lng-changheng-ship-lod1.glb', '2f671506a3985e9db6f32a6f55a145bffa7995e13685bcd11b82a6d12045507e', 2504176),
    'ship-lod2': artifact(LNG_BASE, 'ship-lod2', 'models/lng-changheng-ship-lod2.glb', '298b81a5bc8b6d068f2dad02e7c8ce6dcdc982da59a67eff67a5874a895ed3c9', 1851764),
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

const TESSA_BASE = '/assets/model-releases/msc-tessa/v1.3.0';
export const MSC_TESSA_V130: VersionedModelPackageDescriptor = {
  packageId: 'msc-tessa',
  shipId: 'msc_tessa',
  modelVersion: '1.3.0',
  releaseManifestSha256: '1e39169feeaa5fe775a7221cb245c4e4d9f1671460e8d4f5e47896d52e2bac4e',
  sourceBlendSha256: '85363a4f28059ac255e9ae86446563effd6246a687582d0541f872d00bba1f32',
  baseUrl: TESSA_BASE,
  roles: {
    'ship-proxy': artifact(TESSA_BASE, 'ship-proxy', 'models/msc-tessa-ship-proxy.glb', '869213db6cc8f9e6ffecb54eb0ef7742b80f2a57cc9673ea270e4c56918be096', 95432),
    'propulsion-anchors': artifact(TESSA_BASE, 'propulsion-anchors', 'interfaces/propulsion-anchors.json', '7a5d16751816d36de2f9a1fe8e4d05f9318419ac1e82aa6ffb7e417c6e2eee07', 3077),
    'ship-lod0': artifact(TESSA_BASE, 'ship-lod0', 'models/msc-tessa-ship-lod0.glb', 'e46e0d7be41f78a05c065ae2e2874d931dad3fbd7c7476cbd70e456a59a66cee', 6282432),
    'ship-lod1': artifact(TESSA_BASE, 'ship-lod1', 'models/msc-tessa-ship-lod1.glb', 'a312ca19b7097355642f4bc9f6f5a815023720d07951f3c1ec29ec470db938d4', 2596036),
    'ship-lod2': artifact(TESSA_BASE, 'ship-lod2', 'models/msc-tessa-ship-lod2.glb', '007bf5e367f1c4550b21a89449a9debed82f34d378387122cd6a0b967f0a3c97', 1414788),
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

const XL2_BASE = '/assets/model-releases/xue-long-2/v1.2.0';
export const XUE_LONG_2_V120: VersionedModelPackageDescriptor = {
  packageId: 'xue-long-2',
  shipId: 'xue_long_2',
  modelVersion: '1.2.0',
  releaseManifestSha256: '1fdffbc200820c2ea8778ad027c5c53fe316128da6825a82726f919145b579bb',
  sourceBlendSha256: '75a83f4ab05e7c535fd7e341529e84e94d9a5de039585e88d2893eba6db90a96',
  baseUrl: XL2_BASE,
  roles: {
    'ship-proxy': artifact(XL2_BASE, 'ship-proxy', 'models/xue-long-2-ship-proxy.glb', '9982a57a62ba37b19545dc93d2c290a8c8530416581261508d85d92834753af2', 36928),
    'propulsion-anchors': artifact(XL2_BASE, 'propulsion-anchors', 'interfaces/propulsion-anchors.json', '82b6f42fda7b5d0a0f2fbc6c1da28dc85b38b651620c5b039754603329f9b7e2', 5305),
    'ship-lod0': artifact(XL2_BASE, 'ship-lod0', 'models/xue-long-2-ship-lod0.glb', '0d8a578f7d8fb2f89b9031ed226ab006f5db0c95797d35d15d865741d55657f5', 2573932),
    'ship-lod1': artifact(XL2_BASE, 'ship-lod1', 'models/xue-long-2-ship-lod1.glb', '8b2fd933a18f50b625e8445b0379e8db290234027c92b38372039a2e7f6a70de', 2079336),
    'ship-lod2': artifact(XL2_BASE, 'ship-lod2', 'models/xue-long-2-ship-lod2.glb', '19e6261ccd23720fd7b86490894ebc81bcf0ae2dc5331e5afda8d408ba82d8ea', 932448),
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

const ADORA_BASE = '/assets/model-releases/adora-magic-city/v1.2.0';
export const ADORA_MAGIC_CITY_V120: VersionedModelPackageDescriptor = {
  packageId: 'adora-magic-city',
  shipId: 'adora_magic_city_h1508',
  modelVersion: '1.2.0',
  releaseManifestSha256: '0c99f592fc94be26aba920eb7d1f710aa5802d9b036db1a542bc03f5f4205386',
  sourceBlendSha256: '473c8e50d23ae21c11af75a71cb55fc03ea7f6f571acefb92f418070ed80dc19',
  baseUrl: ADORA_BASE,
  roles: {
    'ship-proxy': artifact(ADORA_BASE, 'ship-proxy', 'models/adora-magic-city-ship-proxy.glb', '9bcc54e6158e96eebb82534d53ae0d099e2bf3a73ee70be75d86715d03c4a8b9', 66092),
    'propulsion-anchors': artifact(ADORA_BASE, 'propulsion-anchors', 'interfaces/propulsion-anchors.json', '6ae2007f6a4078dd5b21436056c3367f2c9cba04223368630e087d24bd5554dd', 5365),
    'ship-lod0': artifact(ADORA_BASE, 'ship-lod0', 'models/adora-magic-city-ship-lod0.glb', 'fb0880579e94ade28dd8746b1ea07d99d328629c3564e57d389d199656be3ac4', 8805028),
    'ship-lod1': artifact(ADORA_BASE, 'ship-lod1', 'models/adora-magic-city-ship-lod1.glb', 'f2f3ba2f6016a1f28a9bebcd596b6c26a217509d42d0c183cf02af4599ecf69c', 2494168),
    'ship-lod2': artifact(ADORA_BASE, 'ship-lod2', 'models/adora-magic-city-ship-lod2.glb', '45c2d532c54627271cd5738900226ad19b88e8a54f2da88ec9f98d1ca74bb7e8', 861580),
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

const HYSY_BASE = '/assets/model-releases/hysy-981/v1.3.0';
export const HYSY_981_V130: VersionedModelPackageDescriptor = {
  packageId: 'hysy-981',
  shipId: 'hysy981',
  modelVersion: '1.3.0',
  releaseManifestSha256: '53aec0d07e2764f8949ba3f2dab6a0fee9d964b406d716194b7464db8a60a8d8',
  sourceBlendSha256: '4021d91a3b8bcd98dcb6d3e144c09c3dc0d41f323c5bc7113a7a8a5bcec9f1cc',
  baseUrl: HYSY_BASE,
  roles: {
    'ship-proxy': artifact(HYSY_BASE, 'ship-proxy', 'models/hysy-981-ship-proxy.glb', 'e0adcdfbbfe794af348043fa3985bcca878895c59f7fcb4bf5757c78b221a99c', 92384),
    'propulsion-anchors': artifact(HYSY_BASE, 'propulsion-anchors', 'interfaces/propulsion-anchors.json', '10cd760bea8ca2d79c03fe7fec6833ffa6c3eaf719d8be161d5f59294ef23700', 22865),
    'ship-lod0': artifact(HYSY_BASE, 'ship-lod0', 'models/hysy-981-ship-lod0.glb', '26d8d822518b04f25f6d35323aaef667bc100606d160666af10bd3ce23568c10', 2393360),
    'ship-lod1': artifact(HYSY_BASE, 'ship-lod1', 'models/hysy-981-ship-lod1.glb', '9866caff074e2884a6ab0ad1ee4eafd376c1a57431116a7e3bff19d20eec5cfd', 1690104),
    'ship-lod2': artifact(HYSY_BASE, 'ship-lod2', 'models/hysy-981-ship-lod2.glb', '5bd374e60d49e3e229dcf3dc64b9aba30ce46db04dfb0606d2a8a0c11a99a287', 778852),
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

const TIANJING_BASE = '/assets/model-releases/dredger-tianjing/v1.3.0';
export const DREDGER_TIANJING_V130: VersionedModelPackageDescriptor = {
  packageId: 'dredger-tianjing',
  shipId: 'dredger_tianjing',
  modelVersion: '1.3.0',
  releaseManifestSha256: '793f4f662906878c7c96769c04c9f25e8d6aa7a50968614f4604d26253856839',
  sourceBlendSha256: '6349f951ec380d68939817e78b02644a3095b4371414c9f905478dc03ffe8e35',
  baseUrl: TIANJING_BASE,
  roles: {
    'ship-proxy': artifact(TIANJING_BASE, 'ship-proxy', 'models/dredger-tianjing-ship-proxy.glb', '180bcefc2f18b34cb1a895e681e216ea01b72b4c2130f18e75fcd503d04ceecf', 30952),
    'propulsion-anchors': artifact(TIANJING_BASE, 'propulsion-anchors', 'interfaces/propulsion-anchors.json', 'bc025fd3ef595c0440acace79b5a899575b63bcf13054a6a3cf62d497ce21b6a', 5735),
    'ship-lod0': artifact(TIANJING_BASE, 'ship-lod0', 'models/dredger-tianjing-ship-lod0.glb', '97e21160c5f6f142533c30264716093ee546daff4d819f1bfcd4625b7a411386', 3141708),
    'ship-lod1': artifact(TIANJING_BASE, 'ship-lod1', 'models/dredger-tianjing-ship-lod1.glb', 'd86bca313a7dafd8fea3813066208823649ce506734822d2eecc7ec4a780f417', 2023208),
    'ship-lod2': artifact(TIANJING_BASE, 'ship-lod2', 'models/dredger-tianjing-ship-lod2.glb', 'cf805f6dac70fce7cb785e82d839b23b72dd73e0419fbfda41be677802b33e87', 1107380),
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
    {
      id: 'ladder-pitch',
      drive: 'live-rotation',
      nodes: ['TJ_LADDER'],
      axis: 'z',
      ladder: true,
      sign: -1,
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
  'lng-carrier': LNG_CHANGHENG_V130,
  container: MSC_TESSA_V130,
  icebreaker: XUE_LONG_2_V120,
  'luxury-liner': ADORA_MAGIC_CITY_V120,
  'drilling-rig': HYSY_981_V130,
  dredger: DREDGER_TIANJING_V130,
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
