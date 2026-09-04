export { SCENE_CAMERA_SHOTS, perspectiveTargetForScreenPoint } from './camera-shots';
export type { SceneCameraShot, SceneCameraShotId, ShotArgs } from './camera-shots';
export { StayPutCameraController } from './stay-put-camera-controller';
export type { StayPutCameraControllerProps } from './stay-put-camera-controller';
export {
  captureOrbitOffset,
  createViewOffsetStore,
  resolveStayPutGoal,
  shouldReanchorOnCameraIdentityChange,
  translateWithShip,
  ZERO_ORBIT_OFFSET,
} from './stay-put';
export type { ShotFrame, ViewOffsetStore, ViewOrbitOffset } from './stay-put';
export { boxProjectsInsideNdc, framePerspectiveCameraToBox } from './frame-box';
