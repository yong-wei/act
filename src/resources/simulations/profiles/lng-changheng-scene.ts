import { resolveRegisteredSimulationModel } from '@/lib/browser-delivery/client';
import type { SceneShipVisualProfile } from '../scene/types';

/**
 * 长恒系列 LNG 运输船场景视觉档案（profiles/lng-changheng 的视觉段扩展）。
 * 坐标约定：船体系 +Z 为舰艏、+Y 为上；starboard 右舷为 -X（forward × up 右手系）。
 */
export const lngChanghengSceneVisual: SceneShipVisualProfile = {
  shipLengthMeters: 295,
  designSpeedKnots: 19,
  modelUrl: resolveRegisteredSimulationModel('lng-carrier').primary,
  waterlineY: 0,
  wakeAnchors: {
    stern: [0, 0, -147.5],
    portShoulder: [23, 0, -88.5],
    starboardShoulder: [-23, 0, -88.5],
  },
};
