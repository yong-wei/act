import type { SceneShipVisualProfile } from '../scene/types';

/**
 * 海洋石油 981 半潜式钻井平台场景视觉档案（profiles/drilling-hysy981 的视觉段扩展）。
 * 坐标约定：船体系 +Z 为舰艏、+Y 为上；starboard 右舷为 -X（forward × up 右手系）。
 * 肩锚点取双浮筒中心线（±WIDTH/2），DP 低速工况下尾迹低活跃为物理正确。
 */
export const drillingHysy981SceneVisual: SceneShipVisualProfile = {
  shipLengthMeters: 114,
  designSpeedKnots: 8,
  modelUrl: '/assets/models-opt/drilling-rig.glb',
  waterlineY: 0,
  wakeAnchors: {
    stern: [0, 0, -57],
    portShoulder: [39, 0, -34],
    starboardShoulder: [-39, 0, -34],
  },
};
