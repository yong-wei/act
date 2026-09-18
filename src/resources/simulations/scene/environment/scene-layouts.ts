/**
 * 海洋场景布局（#2102）：可信海域/港湾/作业区/极地的声明式环境物与岸线数据。
 *
 * 纯模块。WeatherPreset（已有环境预设）管天空/光/雾与显示海面；SceneLayout（本模块）
 * 只管环境物位置、岸线与作者态深度的渲染输入——不创建第二套 Water/Sky/Renderer，
 * 不引入新数值力/碰撞/任务障碍（视觉扩展槽）。环境物世界锚定（世界坐标静态放置），
 * 按布局懒加载；远处物体用简化几何（LOD 数据在声明中区分近/远）。
 */

/** 环境物几何类别（程序化生成，无外部资产依赖）。 */
export type MarineEnvironmentObjectKind =
  | 'buoy' // 近景浮标：圆柱+球
  | 'breakwater' // 堤岸：长盒
  | 'pier' // 码头桩群：盒阵列
  | 'rock' // 岩石：低多边形十二面体
  | 'island' // 远景岛屿：低多边形锥
  | 'tank' // 远景储罐：圆柱
  | 'crane' // 远景岸桥：细长盒桁
  | 'ice-floe'; // 极地冰块：扁平多面体

export interface MarineEnvironmentObject {
  readonly id: string;
  readonly kind: MarineEnvironmentObjectKind;
  /** 世界坐标（米）。 */
  readonly x: number;
  readonly z: number;
  /** 底部高程（米，通常 0 或吃水）。 */
  readonly y?: number;
  /** 朝向（弧度）。 */
  readonly headingRad?: number;
  /** 特征尺度（米，按类别解释为半径/边长/高度）。 */
  readonly scale: number;
  /** 近景（三维几何+接触细节）或远景（简化 LOD）。 */
  readonly detail: 'near' | 'far';
}

/** 岸线段（渲染输入：接触泡沫/浅水色/波幅衰减，非水动力网格）。 */
export interface MarineShoreSegment {
  readonly id: string;
  /** 段起点/终点（世界米）。 */
  readonly from: readonly [number, number];
  readonly to: readonly [number, number];
  /** 作者态岸边水深（米，视觉浅水色输入）。 */
  readonly shoreDepthMeters: number;
}

export type MarineSceneLayoutId =
  | 'open-sea-distant-islands'
  | 'harbor-entrance-channel'
  | 'shallow-construction-site'
  | 'offshore-operations-area'
  | 'polar-ice-field';

export interface MarineSceneLayout {
  readonly id: MarineSceneLayoutId;
  readonly label: string;
  readonly objects: readonly MarineEnvironmentObject[];
  readonly shoreSegments: readonly MarineShoreSegment[];
  /**
   * 允许的天气覆盖（显式声明，不暗中切换数值扰动）：只覆盖环境预设键，
   * 不触碰海况数值或任务参数。
   */
  readonly suggestedEnvironmentPreset?: string;
  /** 极地冰况视觉（冰块分布密度 0-1，服从既有冰况输入，不模拟破冰碰撞）。 */
  readonly iceCoverage?: number;
  /** 挖泥羽流视觉参数（有限范围低成本表示，不影响任务指标）。 */
  readonly sedimentPlume?: {
    readonly x: number;
    readonly z: number;
    readonly radiusMeters: number;
    readonly opacity: number;
  };
}

export const MARINE_SCENE_LAYOUTS: Record<MarineSceneLayoutId, MarineSceneLayout> = {
  'open-sea-distant-islands': {
    id: 'open-sea-distant-islands',
    label: '开阔海·远岛',
    suggestedEnvironmentPreset: 'open-sea',
    objects: [
      { id: 'island-north', kind: 'island', x: -9000, z: -14000, scale: 1200, detail: 'far' },
      { id: 'island-east', kind: 'island', x: 16000, z: -4000, scale: 900, detail: 'far' },
      { id: 'buoy-1', kind: 'buoy', x: -600, z: 900, scale: 2.2, detail: 'near' },
      { id: 'buoy-2', kind: 'buoy', x: 1200, z: -1500, scale: 2.2, detail: 'near' },
    ],
    shoreSegments: [],
  },
  'harbor-entrance-channel': {
    id: 'harbor-entrance-channel',
    label: '港口入口·航道',
    suggestedEnvironmentPreset: 'dawn-haze',
    objects: [
      { id: 'breakwater-west', kind: 'breakwater', x: -1500, z: -2200, headingRad: 0.35, scale: 1400, detail: 'near' },
      { id: 'breakwater-east', kind: 'breakwater', x: 1500, z: -2200, headingRad: -0.35, scale: 1400, detail: 'near' },
      { id: 'pier-cluster', kind: 'pier', x: 600, z: -5200, scale: 320, detail: 'far' },
      { id: 'crane-1', kind: 'crane', x: 400, z: -5600, scale: 60, detail: 'far' },
      { id: 'crane-2', kind: 'crane', x: 800, z: -5600, scale: 60, detail: 'far' },
      { id: 'tank-1', kind: 'tank', x: 1300, z: -5400, scale: 40, detail: 'far' },
      { id: 'buoy-channel-1', kind: 'buoy', x: 0, z: -1000, scale: 2.2, detail: 'near' },
      { id: 'buoy-channel-2', kind: 'buoy', x: -120, z: 300, scale: 2.2, detail: 'near' },
    ],
    shoreSegments: [
      { id: 'shore-west', from: [-2600, -2600], to: [-400, -1400], shoreDepthMeters: 6 },
      { id: 'shore-east', from: [400, -1400], to: [2600, -2600], shoreDepthMeters: 6 },
    ],
  },
  'shallow-construction-site': {
    id: 'shallow-construction-site',
    label: '浅水施工区',
    suggestedEnvironmentPreset: 'overcast',
    objects: [
      { id: 'rock-1', kind: 'rock', x: -800, z: -600, scale: 14, detail: 'near' },
      { id: 'rock-2', kind: 'rock', x: 950, z: 400, scale: 9, detail: 'near' },
      { id: 'buoy-site-1', kind: 'buoy', x: -300, z: 500, scale: 2, detail: 'near' },
      { id: 'buoy-site-2', kind: 'buoy', x: 350, z: -450, scale: 2, detail: 'near' },
    ],
    shoreSegments: [
      { id: 'shore-shallow-north', from: [-2200, 1800], to: [2200, 1800], shoreDepthMeters: 4 },
      { id: 'shore-shallow-south', from: [-2200, -1800], to: [2200, -1800], shoreDepthMeters: 4 },
    ],
    sedimentPlume: { x: 0, z: 0, radiusMeters: 260, opacity: 0.35 },
  },
  'offshore-operations-area': {
    id: 'offshore-operations-area',
    label: '远海作业区',
    suggestedEnvironmentPreset: 'storm-blue',
    objects: [
      { id: 'island-far', kind: 'island', x: -18000, z: 22000, scale: 1500, detail: 'far' },
      { id: 'buoy-ops-1', kind: 'buoy', x: -400, z: 1200, scale: 2.4, detail: 'near' },
      { id: 'buoy-ops-2', kind: 'buoy', x: 500, z: 1000, scale: 2.4, detail: 'near' },
    ],
    shoreSegments: [],
  },
  'polar-ice-field': {
    id: 'polar-ice-field',
    label: '极地冰区',
    suggestedEnvironmentPreset: 'overcast',
    // 冰块分布服从已有冰况输入（iceCoverage 视觉密度），不模拟破冰碰撞。
    iceCoverage: 0.45,
    objects: [
      { id: 'ice-1', kind: 'ice-floe', x: -900, z: -700, scale: 42, detail: 'near' },
      { id: 'ice-2', kind: 'ice-floe', x: 1100, z: -300, scale: 30, detail: 'near' },
      { id: 'ice-3', kind: 'ice-floe', x: 300, z: 1400, scale: 55, detail: 'near' },
      { id: 'ice-4', kind: 'ice-floe', x: -1500, z: 900, scale: 26, detail: 'far' },
      { id: 'ice-5', kind: 'ice-floe', x: 2200, z: -1600, scale: 38, detail: 'far' },
      { id: 'island-polar', kind: 'island', x: 24000, z: -20000, scale: 2200, detail: 'far' },
    ],
    shoreSegments: [],
  },
};

/**
 * 岸线波幅衰减（渲染输入）：距岸线越近波幅越小（浅水耗散的视觉近似）。
 * 返回 [0,1] 衰减因子（1 = 无岸线影响），非新水动力——只用于显示海面的振幅调制。
 */
export function shorelineAmplitudeAttenuation(
  shoreSegments: readonly MarineShoreSegment[],
  worldX: number,
  worldZ: number,
  fadeBandMeters: number,
): number {
  if (shoreSegments.length === 0 || fadeBandMeters <= 0) return 1;
  let minDistance = Infinity;
  for (const segment of shoreSegments) {
    const [ax, az] = segment.from;
    const [bx, bz] = segment.to;
    const abx = bx - ax;
    const abz = bz - az;
    const lengthSquared = abx * abx + abz * abz;
    const t = lengthSquared > 0
      ? Math.min(Math.max(((worldX - ax) * abx + (worldZ - az) * abz) / lengthSquared, 0), 1)
      : 0;
    const cx = ax + abx * t;
    const cz = az + abz * t;
    minDistance = Math.min(minDistance, Math.hypot(worldX - cx, worldZ - cz));
  }
  if (minDistance >= fadeBandMeters) return 1;
  const t = minDistance / fadeBandMeters;
  // 平滑衰减到岸边 0.15（保留少量残余波纹）。
  return 0.15 + 0.85 * t * t * (3 - 2 * t);
}
