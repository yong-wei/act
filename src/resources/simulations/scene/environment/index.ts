export {
  DEFAULT_ENVIRONMENT_PRESET_ID,
  getEnvironmentPreset,
  SCENE_ENVIRONMENT_PRESETS,
} from './environment-presets';
export type { SceneEnvironmentPreset, SceneEnvironmentPresetId } from './environment-presets';
export {
  EnvironmentPresetSwitcher,
  SceneEnvironmentProvider,
  useSceneEnvironment,
} from './environment-state';
export { EnvironmentScene, useEnvironmentWaterColors } from './environment-scene';
export { MarineSceneLayoutObjects } from './scene-layout-objects';
export type { MarineSceneLayoutProps } from './scene-layout-objects';
export {
  MARINE_SCENE_LAYOUTS,
  shorelineAmplitudeAttenuation,
} from './scene-layouts';
export type {
  MarineEnvironmentObject,
  MarineEnvironmentObjectKind,
  MarineSceneLayout,
  MarineSceneLayoutId,
  MarineShoreSegment,
} from './scene-layouts';
