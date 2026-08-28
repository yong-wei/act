import { resolveRegisteredSimulationModel } from '@/lib/browser-delivery/client';
import type { SceneShipVisualProfile } from '../scene/types';

/**
 * MSC Tessa 超大型集装箱船场景视觉档案（profiles/container-msc 的视觉段扩展）。
 * 坐标约定：船体系 +Z 为舰艏、+Y 为上；starboard 右舷为 -X（forward × up 右手系）。
 */
export const containerMscSceneVisual: SceneShipVisualProfile = {
  shipLengthMeters: 399.9,
  designSpeedKnots: 20,
  modelUrl: resolveRegisteredSimulationModel('container').primary,
  waterlineY: 0,
  wakeAnchors: {
    stern: [0, 0, -199.95],
    portShoulder: [30.75, 0, -120],
    starboardShoulder: [-30.75, 0, -120],
  },
};
