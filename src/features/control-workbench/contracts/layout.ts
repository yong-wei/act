import type { WorkbenchMethodPanelId } from './methods';
import type { WorkbenchViewConfig, WorkbenchViewId } from './views';

export type WorkbenchPresetId =
  | 'classic-whitebox'
  | 'blackbox-identification'
  | 'composite-control'
  | 'assignment-guided'
  | 'odyssey'
  | 'free-explore';

export interface WorkbenchLayoutPreset {
  id: WorkbenchPresetId;
  label: string;
  viewConfigs: WorkbenchViewConfig[];
  methodPanelIds: WorkbenchMethodPanelId[];
  defaultViewId?: WorkbenchViewId;
}

export const CLASSIC_WHITEBOX_LAYOUT_PRESET: WorkbenchLayoutPreset = {
  id: 'classic-whitebox',
  label: '经典白箱四视图',
  defaultViewId: 'time-domain',
  viewConfigs: [
    { id: 'time-domain', title: '时域响应', enabled: true },
    { id: 'bode', title: 'Bode 图', enabled: true },
    { id: 'root-locus', title: '根轨迹', enabled: true },
    { id: 'nyquist', title: 'Nyquist 图', enabled: true },
  ],
  methodPanelIds: ['serial-compensator', 'pid'],
};

export const BLACKBOX_IDENTIFICATION_LAYOUT_PRESET: WorkbenchLayoutPreset = {
  id: 'blackbox-identification',
  label: '黑箱辨识工作台',
  defaultViewId: 'experiment-dataset',
  viewConfigs: [
    { id: 'experiment-dataset', title: '黑箱实验数据', enabled: true },
    { id: 'identification', title: '学生名义模型', enabled: true },
    { id: 'response-comparison', title: '名义模型响应对照', enabled: true },
    { id: 'metric-summary', title: '指标摘要', enabled: true },
  ],
  methodPanelIds: ['experiment-design', 'identification', 'black-box-control', 'metric-review'],
};

export const COMPOSITE_CONTROL_LAYOUT_PRESET: WorkbenchLayoutPreset = {
  id: 'composite-control',
  label: '复合校正工作台',
  defaultViewId: 'time-domain',
  viewConfigs: [
    { id: 'time-domain', title: '时域响应', enabled: true },
    { id: 'response-comparison', title: '响应与扰动对照', enabled: true },
    { id: 'control-effort', title: '控制量', enabled: true },
    { id: 'metric-summary', title: '结构与指标摘要', enabled: true },
  ],
  methodPanelIds: ['composite-compensation', 'serial-compensator'],
};
