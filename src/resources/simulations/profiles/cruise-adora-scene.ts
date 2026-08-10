import type { SceneShipVisualProfile } from '../scene/types';

/**
 * 爱达·魔都号豪华邮轮场景视觉档案（profiles/cruise-adora 的视觉段扩展）。
 * 坐标约定：船体系 +Z 为舰艏、+Y 为上；starboard 右舷为 -X（forward × up 右手系）。
 */
export const cruiseAdoraSceneVisual: SceneShipVisualProfile = {
  shipLengthMeters: 323.6,
  designSpeedKnots: 18,
  modelUrl: '/assets/models-opt/luxury-liner.glb',
  waterlineY: 0,
  wakeAnchors: {
    stern: [0, 0, -161.8],
    portShoulder: [18.6, 0, -97],
    starboardShoulder: [-18.6, 0, -97],
  },
};
