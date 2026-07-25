/**
 * 环境预设：与课程视频系统共享的 5 套海况/天空/光照成套设定。
 * 场景本体与平台明暗主题脱钩，由学生在场景内手动切换（ADR 20260723）。
 * 光照参数移植自 Remotion resolveEnvironmentLighting，雾距按平台尺度重标定。
 */

export type SceneEnvironmentPresetId = 'open-sea' | 'dawn-haze' | 'sunset-warm' | 'overcast' | 'storm-blue';

export interface SceneEnvironmentPreset {
  readonly id: SceneEnvironmentPresetId;
  readonly label: string;
  /** 天空球体贴图（public 相对路径）。 */
  readonly skyTexture: string;
  /** 地平线剪影贴图与透明度。 */
  readonly horizonTexture: string;
  readonly horizonOpacity: number;
  /** 剪影带高度系数（0..1，越大越远越高）。 */
  readonly horizonY: number;
  /** 云层贴图与透明度。 */
  readonly cloudTexture: string;
  readonly cloudOpacity: number;
  /** 天空球体不透明度。 */
  readonly skyOpacity: number;
  /** 视觉尺度系数（球体/剪影带半径倍率）。 */
  readonly scale: number;
  /** 雾色与相对平台默认雾距（4500/18000）的缩放。 */
  readonly fog: { readonly color: string; readonly nearScale: number; readonly farScale: number };
  readonly hemisphere: { readonly skyColor: string; readonly groundColor: string; readonly intensity: number };
  readonly sun: {
    readonly color: string;
    readonly intensity: number;
    readonly position: readonly [number, number, number];
  };
  readonly fill: { readonly color: string; readonly intensity: number };
  /** 海面颜色组（供 GerstnerWater 按预设驱动）。 */
  readonly water: {
    readonly waterColor: string;
    readonly deepColor: string;
    readonly horizonColor: string;
  };
  /** 音景环境声键（scene/audio 消费）。 */
  readonly ambience: 'calm-sea' | 'dawn-harbor' | 'sunset-coast' | 'overcast-wind' | 'storm';
}

const TEXTURE_BASE = '/assets/simulation-scene/environment';

export const SCENE_ENVIRONMENT_PRESETS: readonly SceneEnvironmentPreset[] = [
  {
    id: 'open-sea',
    label: '开阔海',
    skyTexture: `${TEXTURE_BASE}/sky-clear-day.png`,
    horizonTexture: `${TEXTURE_BASE}/env-island-chain-alpha.png`,
    horizonOpacity: 0.58,
    horizonY: 0.35,
    cloudTexture: `${TEXTURE_BASE}/cloud-soft-layer-alpha.png`,
    cloudOpacity: 0.18,
    skyOpacity: 0.82,
    scale: 1.05,
    fog: { color: '#bcd6e4', nearScale: 1, farScale: 1 },
    hemisphere: { skyColor: '#eaf8ff', groundColor: '#112b3a', intensity: 1.2 },
    sun: { color: '#ffffff', intensity: 2, position: [4, 7, 5] },
    fill: { color: '#8ddfff', intensity: 0.9 },
    water: { waterColor: '#1a5f86', deepColor: '#0b2f47', horizonColor: '#9fc3d8' },
    ambience: 'calm-sea',
  },
  {
    id: 'dawn-haze',
    label: '薄雾黎明',
    skyTexture: `${TEXTURE_BASE}/sky-dawn-haze.png`,
    horizonTexture: `${TEXTURE_BASE}/env-harbor-port-alpha.png`,
    horizonOpacity: 0.84,
    horizonY: 0.18,
    cloudTexture: `${TEXTURE_BASE}/cloud-streaks-alpha.png`,
    cloudOpacity: 0.26,
    skyOpacity: 0.92,
    scale: 1.18,
    fog: { color: '#3a4a52', nearScale: 0.65, farScale: 0.75 },
    hemisphere: { skyColor: '#ffe3c2', groundColor: '#102833', intensity: 1.1 },
    sun: { color: '#ffc48a', intensity: 1.65, position: [-5, 4, 3] },
    fill: { color: '#8ddfff', intensity: 0.72 },
    water: { waterColor: '#2a5568', deepColor: '#122b38', horizonColor: '#d8b48f' },
    ambience: 'dawn-harbor',
  },
  {
    id: 'sunset-warm',
    label: '暖色日落',
    skyTexture: `${TEXTURE_BASE}/sky-sunset-warm.png`,
    horizonTexture: `${TEXTURE_BASE}/env-coastal-city-alpha.png`,
    horizonOpacity: 0.86,
    horizonY: 0.2,
    cloudTexture: `${TEXTURE_BASE}/cloud-streaks-alpha.png`,
    cloudOpacity: 0.3,
    skyOpacity: 0.96,
    scale: 1.22,
    fog: { color: '#3d3a52', nearScale: 0.7, farScale: 0.8 },
    hemisphere: { skyColor: '#ffd0a0', groundColor: '#111f31', intensity: 1 },
    sun: { color: '#ff9f5c', intensity: 1.45, position: [-6, 2.8, 4] },
    fill: { color: '#8ddfff', intensity: 0.7 },
    water: { waterColor: '#33425e', deepColor: '#161f33', horizonColor: '#e8975c' },
    ambience: 'sunset-coast',
  },
  {
    id: 'overcast',
    label: '阴云',
    skyTexture: `${TEXTURE_BASE}/sky-overcast.png`,
    horizonTexture: `${TEXTURE_BASE}/env-island-chain-alpha.png`,
    horizonOpacity: 0.6,
    horizonY: 0.3,
    cloudTexture: `${TEXTURE_BASE}/cloud-soft-layer-alpha.png`,
    cloudOpacity: 0.32,
    skyOpacity: 0.88,
    scale: 1.0,
    fog: { color: '#5a6a72', nearScale: 0.8, farScale: 0.9 },
    hemisphere: { skyColor: '#c7d8df', groundColor: '#10212a', intensity: 1.25 },
    sun: { color: '#cbdce4', intensity: 0.9, position: [3, 6, 4] },
    fill: { color: '#9ccae2', intensity: 0.82 },
    water: { waterColor: '#3a5563', deepColor: '#1a2c35', horizonColor: '#8aa4b0' },
    ambience: 'overcast-wind',
  },
  {
    id: 'storm-blue',
    label: '风暴蓝',
    skyTexture: `${TEXTURE_BASE}/sky-storm-blue.png`,
    horizonTexture: `${TEXTURE_BASE}/env-rocky-islands-alpha.png`,
    horizonOpacity: 0.64,
    horizonY: 0.28,
    cloudTexture: `${TEXTURE_BASE}/cloud-soft-layer-alpha.png`,
    cloudOpacity: 0.34,
    skyOpacity: 0.92,
    scale: 1.12,
    fog: { color: '#182b35', nearScale: 0.6, farScale: 0.7 },
    hemisphere: { skyColor: '#c7d8df', groundColor: '#10212a', intensity: 1.25 },
    sun: { color: '#cbdce4', intensity: 0.9, position: [3, 6, 4] },
    fill: { color: '#9ccae2', intensity: 0.82 },
    water: { waterColor: '#1e3a48', deepColor: '#0c1c26', horizonColor: '#5f7d8c' },
    ambience: 'storm',
  },
];

export const DEFAULT_ENVIRONMENT_PRESET_ID: SceneEnvironmentPresetId = 'open-sea';

export function getEnvironmentPreset(id: SceneEnvironmentPresetId): SceneEnvironmentPreset {
  const preset = SCENE_ENVIRONMENT_PRESETS.find((entry) => entry.id === id);
  if (!preset) throw new Error(`unknown environment preset: ${id}`);
  return preset;
}
