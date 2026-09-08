/**
 * xue-long-2（雪龙2号极地科考破冰船）版本化模型包的 ACT 侧只读描述符。
 *
 * 身份由 `scripts/models/receive-xuelong2-v0.mjs` 接收时逐文件核验
 * （三 GLB + manifest 的 SHA-256 与大小，复制前后字节一致），收据位于
 * `artifacts/model-releases/xue-long-2-v0.1.0/receipt.json`。
 * 本模块只登记已验证事实；ACT 不修补上游模型字节（缺陷返回 3DModels 发新版本）。
 *
 * v0.1.0（当前激活）：完整建模首版的本地视觉候选。三档 LOD 各含 11 个演示
 * 动画片段（单 track、约 10s 无缝循环）。上游 Three.js r184 探针已验证
 * 动画绑定、坐标适配（GLB +X 艏 → ACT +Z 艏，绕 Y -90°，同 type055 基适配）
 * 与包围盒（船壳长 122.5m；DWL 上方约 41.44m、下方约 8.35m）。
 *
 * 接口事实（ACT 侧 GLB 探针实测，2026-09-09）：
 * - 根链 XL2_DESIGN → XueLong2Root → 各语义节点，全 identity 变换，
 *   原点为设计水线 × 中心线 × 总长中点（designWaterlineY = 0）；
 * - pod/crane/radar/heli clip 绕节点局部 Y（垂直轴）旋转，propeller 绕局部 X
 *   （艏艉轴）；文档表格中的"源局部轴 Z"为 Blender Z-up 源坐标，导出后即 Y；
 * - 吊舱 XL2_POD_P/S 挂点 (-55, -1.9, ∓5.2)，桨 XL2_PROP_P/S 世界位置
 *   (-57.63, -5.6, ∓5.2)（模型局部米）；桨节点随吊舱方位旋转，尾迹锚点逐帧采样。
 *
 * 语义绑定（Azipod 船型，吊舱方位角承担舵角职能）：
 * - L0 常开：雷达×3 clip-loop（船舶常态）＋ 螺旋桨×2 speedCoupled（timeScale 与
 *   实际航速成比例，暂停时停转）＋ 吊舱方位 procedural（左/右舷分别绑定
 *   azimuth1/azimuth2 遥测，1:1 映射到 ±180°，符号与场景方位语义一致）；
 * - 结束展示（endingShowcase）：仿真从推进转停止时，从吊机×3 + 直升机旋翼
 *   池中随机选 1..3 条组合循环播放；恢复推进即停止（停放直升机旋翼默认不播，
 *   仅随机选中时启动，符合上游接入指引）。
 */

import type {
  SemanticAnimationBinding,
  VersionedModelArtifact,
  VersionedModelPackageDescriptor,
} from './model-interface';

/** 11 个演示片段：三档 LOD 完全一致（上游探针验证无 LOD 动画身份漂移）。 */
const INTERFACE_CONTRACT = {
  shipAnimationCount: 11,
  shipInterfaceAnimations: [
    'crane_AFT_slew',
    'crane_FORE_slew',
    'crane_RESEARCH_slew',
    'helicopter_rotor',
    'pod_P_azimuth',
    'propeller_P_spin',
    'pod_S_azimuth',
    'propeller_S_spin',
    'radar_0_spin',
    'radar_1_spin',
    'radar_2_spin',
  ],
} as const;

// 原点即设计水线（DWL origin，上游 manifest coordinate 字段声明）。
const VERTICAL_ANCHOR = { designWaterlineY: 0 } as const;
// 船壳长 122.5m；完整包围盒（含吊机等附件）约 124.33m，禁止按包围盒重缩放。
const MODEL_LENGTH_METERS = 122.5;
// 桨节点挂点（模型局部米）：与 XL2_PROP_P/S 世界位置一致（探针实测）。
const PROPULSORS = [
  { id: 'prop-port', node: 'XL2_PROP_P', position: [-57.63, -5.6, -5.2] as const },
  { id: 'prop-starboard', node: 'XL2_PROP_S', position: [-57.63, -5.6, 5.2] as const },
] as const;
// 设计航速 15.5 kn（profile designSpeedKnots 同源）；吊舱全回转无机械限位，
// 钳制到 ±180° 只做数值保护（1:1 映射）。
const TELEMETRY_SCALE = { designSpeedMps: 15.5 * 0.514444, podAzimuthLimitDeg: 180 } as const;
// 演示 clip 角速度 0.233 rad/s；rate=10 在设计航速下约 0.37 转/s，
// 与 type055 螺旋桨视觉节奏同量级（大直径低转速桨的感知口径）。
// 雷达演示 clip 约 54s/圈，rate=2 → 27s/圈，贴近真实导航雷达扫描周期。
const SEMANTIC_BINDINGS: readonly SemanticAnimationBinding[] = [
  { id: 'propeller-port-spin', drive: 'clip-loop', clip: 'propeller_P_spin', speedCoupled: true, rate: 10 },
  { id: 'propeller-starboard-spin', drive: 'clip-loop', clip: 'propeller_S_spin', speedCoupled: true, rate: 10 },
  { id: 'radar-0-spin', drive: 'clip-loop', clip: 'radar_0_spin', rate: 2 },
  { id: 'radar-1-spin', drive: 'clip-loop', clip: 'radar_1_spin', rate: 2 },
  { id: 'radar-2-spin', drive: 'clip-loop', clip: 'radar_2_spin', rate: 2 },
  {
    id: 'pod-port-azimuth',
    drive: 'procedural',
    nodes: ['XL2_POD_P'],
    axis: 'y',
    source: 'telemetry.podAzimuthPortDeg',
    maxAngleDeg: 180,
  },
  {
    id: 'pod-starboard-azimuth',
    drive: 'procedural',
    nodes: ['XL2_POD_S'],
    axis: 'y',
    source: 'telemetry.podAzimuthStarboardDeg',
    maxAngleDeg: 180,
  },
];
// 结束展示池：吊机×3（回转演示）+ 直升机旋翼；每次停止边沿随机选 1..3 条。
const ENDING_SHOWCASE = {
  clips: ['crane_AFT_slew', 'crane_FORE_slew', 'crane_RESEARCH_slew', 'helicopter_rotor'],
  maxPicks: 3,
} as const;

const BASE_URL = '/assets/model-releases/xue-long-2/v0.1.0';

function artifact(role: 'ship-lod0' | 'ship-lod1' | 'ship-lod2', file: string, sha256: string, bytes: number): VersionedModelArtifact {
  return { role, file, url: `${BASE_URL}/${file}`, sha256, bytes };
}

export const XUE_LONG_2_V0: VersionedModelPackageDescriptor = {
  packageId: 'xue-long-2',
  shipId: 'fleet-icebreaker-xuelong2',
  modelVersion: '0.1.0',
  releaseManifestSha256: '15f2fd2b0fe2e5d0e356040fb62c6f6d6702466d7ff5dfaf8cfbedddbef76b07',
  sourceBlendSha256: 'bbb71b6c254e6825b98a59dfc6c8fba586d32650bf0dbe866c288b11c3d18ca5',
  baseUrl: BASE_URL,
  roles: {
    'ship-lod0': artifact('ship-lod0', 'XueLong2-LOD0.glb', '8dd18ab53c3c54f55737eedc3e5931391a4fcedb82fa369585183cf66db39724', 26402916),
    'ship-lod1': artifact('ship-lod1', 'XueLong2-LOD1.glb', '3edd74f49259eaf1ce62f040046ad9a349c19a4593644d712cce635d5b929278', 17378740),
    'ship-lod2': artifact('ship-lod2', 'XueLong2-LOD2.glb', '669a8cb1e34626d18ac832d82f6477f48e65df3769813966f2fe7d44c83c38e2', 7955268),
  },
  coordinateBasis: { forward: '+X', up: '+Y' },
  interfaceContract: INTERFACE_CONTRACT,
  verticalAnchor: VERTICAL_ANCHOR,
  modelLengthMeters: MODEL_LENGTH_METERS,
  propulsors: PROPULSORS,
  telemetryScale: TELEMETRY_SCALE,
  semanticBindings: SEMANTIC_BINDINGS,
  endingShowcase: ENDING_SHOWCASE,
};

/** 已接收的 xue-long-2 版本化包 baseUrl 集合（坐标基适配判定唯一入口）。 */
export const XUE_LONG_2_VERSIONED_PACKAGE_BASE_URLS: readonly string[] = [XUE_LONG_2_V0.baseUrl];

/** URL 是否属于任一已接收 xue-long-2 版本化包资产（坐标基适配判定）。 */
export function isXueLong2VersionedAssetUrl(url: string): boolean {
  return XUE_LONG_2_VERSIONED_PACKAGE_BASE_URLS.some((baseUrl) => url.startsWith(baseUrl));
}

/**
 * 坐标基适配（同 type055 唯一适配点）：GLB +X 艏 / +Y 上 / +Z 右舷 →
 * 场景 +Z 艏 / +Y 上 / +X 左舷，绕 Y -90° 恰好完成基映射。只允许在模型
 * 挂载组件处应用一次；场景组件不得追加补偿旋转。
 */
export const XUE_LONG_2_BASIS_YAW_RAD = -Math.PI / 2;

/** 把 registry 激活指针对上已接收描述符；未知包 fail closed，不半切换。 */
export function matchActivatedXueLong2Package(
  activation: { readonly packageId: string; readonly modelVersion: string; readonly baseUrl: string } | null,
): VersionedModelPackageDescriptor | null {
  if (!activation) return null;
  if (
    activation.packageId === XUE_LONG_2_V0.packageId
    && activation.modelVersion === XUE_LONG_2_V0.modelVersion
    && activation.baseUrl === XUE_LONG_2_V0.baseUrl
  ) {
    return XUE_LONG_2_V0;
  }
  return null;
}
