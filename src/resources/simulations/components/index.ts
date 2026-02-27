/**
 * 船舶仿真共享组件
 */

export {
  UnifiedCameraController,
  cameraViews,
  getNextCameraView,
  getCameraViewLabel,
  isPresetView,
  type CameraView,
  type CameraMode,
  type CameraConfig,
  type UnifiedCameraControllerProps,
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
