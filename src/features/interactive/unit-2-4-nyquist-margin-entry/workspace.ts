export interface WorkspaceParameterChange {
  key: string;
  value: string | number | boolean;
  source: string;
}

export const RECONSTRUCTION_PARAMETER_DEFAULTS = {
  timeConstant: 1,
  probeFrequency: 1,
} as const;

export const WAVE_MEANING_TABS = [
  { key: 'start', label: '起点' },
  { key: 'end', label: '终点' },
  { key: 'direction', label: '方向' },
] as const;

export const BODE_SORT_BUCKETS = [
  { key: 'shallow', label: '转得较浅' },
  { key: 'deep', label: '转得更深' },
  { key: 'axis-near', label: '更贴近坐标轴' },
] as const;

export const BODE_WORKFLOW_STEPS = [
  '写标准型',
  '列转折频率',
  '判最低频段',
  '依次画趋势变化',
] as const;

export const WORKED_EXAMPLE_SEQUENCE = [
  { key: 'baseline', label: '定基线' },
  { key: 'break', label: '找折点' },
  { key: 'nyquist', label: '转成 Nyquist 锚点' },
  { key: 'result', label: '收束结果' },
] as const;
