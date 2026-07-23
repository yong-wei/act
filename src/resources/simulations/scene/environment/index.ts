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
