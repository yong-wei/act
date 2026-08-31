import { resolveRegisteredSimulationModel } from '@/lib/browser-delivery/client';
import type { SceneShipVisualProfile } from '../scene/types';

/**
 * 055 型驱逐舰场景视觉档案（profiles/destroyer-055 的视觉段扩展）。
 * 坐标约定：船体系 +Z 为舰艏、+Y 为上；starboard 右舷为 -X（forward × up 右手系）。
 */
export const destroyer055SceneVisual: SceneShipVisualProfile = {
  shipLengthMeters: 180,
  designSpeedKnots: 29,
  modelUrl: resolveRegisteredSimulationModel('destroyer').primary,
  waterlineY: 0,
  wakeAnchors: {
    stern: [0, 0, -90],
    portShoulder: [10, 0, -54],
    starboardShoulder: [-10, 0, -54],
  },
};
