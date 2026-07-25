import type { SceneShipVisualProfile } from '../scene/types';

/**
 * 雪龙号破冰船场景视觉档案（profiles/icebreaker-xuelong 的视觉段扩展）。
 * 坐标约定：船体系 +Z 为舰艏、+Y 为上；starboard 右舷为 -X（forward × up 右手系）。
 */
export const icebreakerXuelongSceneVisual: SceneShipVisualProfile = {
  shipLengthMeters: 122.5,
  designSpeedKnots: 15.5,
  modelUrl: '/assets/models-opt/icebreaker.glb',
  waterlineY: 0,
  wakeAnchors: {
    stern: [0, 0, -61.25],
    portShoulder: [11, 0, -36.75],
    starboardShoulder: [-11, 0, -36.75],
  },
};
