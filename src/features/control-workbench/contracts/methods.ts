import type { ControllerMethod } from '../../arena/types';

export type WorkbenchMethodPanelId =
  | ControllerMethod
  | 'identification'
  | 'nominal-model'
  | 'experiment-design'
  | 'metric-review';

export interface WorkbenchMethodPanelConfig {
  id: WorkbenchMethodPanelId;
  title: string;
  method?: ControllerMethod;
  enabled: boolean;
  locked?: boolean;
  description?: string;
}

export const WORKBENCH_CONTROLLER_METHOD_PANEL_IDS: ControllerMethod[] = [
  'serial-compensator',
  'pid',
  'optimized-pid',
  'composite-compensation',
  'mpc',
  'black-box-control',
  'code-controller',
];
