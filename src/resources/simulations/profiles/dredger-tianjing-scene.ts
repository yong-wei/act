import type { SceneShipVisualProfile } from '../scene/types';

/**
 * 天鲸号绞吸式挖泥船场景视觉档案（profiles/dredger-tianjing 的视觉段扩展）。
 * 坐标约定：船体系 +Z 为舰艏、+Y 为上；starboard 右舷为 -X（forward × up 右手系）。
 * 作业低速工况下尾迹低活跃为物理正确。
 */
export const dredgerTianjingSceneVisual: SceneShipVisualProfile = {
  shipLengthMeters: 127.5,
  designSpeedKnots: 12,
  modelUrl: '/assets/models-opt/dredger.glb',
  waterlineY: 0,
  wakeAnchors: {
    stern: [0, 0, -63.75],
    portShoulder: [11, 0, -38.25],
    starboardShoulder: [-11, 0, -38.25],
  },
};
