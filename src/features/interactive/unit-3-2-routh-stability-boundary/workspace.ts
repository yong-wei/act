export interface WorkspaceParameterChange {
  key: string;
  value: string | number | boolean;
  source: 'input' | 'select' | 'button';
}

export const BOUNDARY_MATCH_OPTIONS = {
  parameter: [
    { value: 'k=-2', label: 'k = -2' },
    { value: 'k=18', label: 'k = 18' },
    { value: 'stable-interval', label: '-2 < k < 18' },
  ],
  geometry: [
    { value: 'origin-root', label: '原点根边界' },
    { value: 'imaginary-pair', label: '纯虚根边界' },
    { value: 'inside-window', label: '稳定区内部' },
  ],
  meaning: [
    { value: 'touch-origin', label: '极点触到原点，系统触碰稳定底线' },
    { value: 'cross-axis', label: '共轭根逼近并穿越虚轴' },
    { value: 'all-left', label: '全部根仍在左半平面' },
  ],
} as const;

export const STATE_MATCH_OPTIONS = {
  curve: [
    { value: 'decay', label: '衰减收敛曲线' },
    { value: 'critical', label: '等幅振荡 / 边界停留曲线' },
    { value: 'diverge', label: '发散曲线' },
  ],
  pole: [
    { value: 'left-half', label: '左半平面极点' },
    { value: 'axis-boundary', label: '虚轴或原点边界根' },
    { value: 'right-half', label: '右半平面根' },
  ],
  state: [
    { value: 'stable', label: '稳定' },
    { value: 'critical', label: '临界稳定' },
    { value: 'unstable', label: '失稳' },
  ],
} as const;

export const CASE_BUCKETS = [
  { value: 'zero-head', label: '首位为 0' },
  { value: 'zero-row', label: '全零行' },
] as const;

export const CONSTRAINT_REASON_OPTIONS = [
  { value: 'interval-shrinks', label: '约束更强，所以可行区间收缩' },
  { value: 'shift-rewrites', label: '变量平移把竖线约束改写成普通判稳问题' },
  { value: 'same-as-before', label: '平移后区间不会变化' },
] as const;
