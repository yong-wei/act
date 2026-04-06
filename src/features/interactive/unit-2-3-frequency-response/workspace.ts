export interface WorkspaceParameterChange {
  key: string;
  value: string | number | boolean;
  source: string;
}

export const RECONSTRUCTION_PARAMETER_DEFAULTS = {
  harmonics: 3,
  attenuation: 40,
} as const;

export const WAVE_MEANING_TABS = [
  { key: 'gain', label: '放大/衰减' },
  { key: 'phase', label: '超前/滞后' },
  { key: 'command', label: '命令/扰动' },
] as const;

export const BODE_SORT_BUCKETS = [
  { key: 'low-pass', label: '偏低频通过' },
  { key: 'high-pass', label: '偏高频通过' },
  { key: 'lagging', label: '明显滞后' },
] as const;

export const BODE_WORKFLOW_STEPS = [
  '写标准型',
  '列转折频率',
  '判最低频段',
  '依次画趋势变化',
] as const;

export const WORKED_EXAMPLE_SEQUENCE = [
  { key: 'omega', label: '识别频率' },
  { key: 'gjw', label: '计算 G(jω)' },
  { key: 'magphase', label: '求模与相位' },
  { key: 'output', label: '写稳态输出' },
] as const;
