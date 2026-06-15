/**
 * 船舶仿真共享组件
 */

export {
  UnifiedCameraController,
  RightClickFreeModeBridge,
  cameraViews,
  getNextCameraView,
  getCameraViewLabel,
  isPresetView,
  type CameraView,
  type CameraMode,
  type CameraConfig,
  type UnifiedCameraControllerProps,
  type RightClickFreeModeBridgeProps,
} from './camera-controller';

export {
  CameraViewSwitcher,
  CameraViewSwitcherCompact,
  type CameraViewSwitcherProps,
} from './camera-view-switcher';

export {
  simulationUi,
  SimulationTopBar,
  SimulationDock,
  SimulationAssessmentPanel,
  type SimulationDockTab,
  type SimulationAssessmentMetric,
} from './simulation-ui';

export {
  SIMULATION_SCENE_THEMES,
  simulationScenePalette,
  simulationThemeEvidenceContract,
  useSimulationSceneTheme,
  type SimulationSceneTheme,
  type SimulationThemeMode,
} from './simulation-theme';

export { ModelLoadingPlaceholder } from './model-loading-placeholder';
