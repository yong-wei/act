import type {
  ChallengeObjectSource,
  ControllerMethod,
  LeaderboardType,
  MetricDefinition,
  ModelVisibility,
  WorkspaceMode,
} from './types';

export const ARENA_STUDENT_LEADERBOARD_TYPES: LeaderboardType[] = ['main', 'method', 'metric'];

export const arenaSourceLabels: Record<ChallengeObjectSource, string> = {
  typical: '典型对象',
  homework: '作业对象',
  'control-odyssey': '控制奥德赛',
  'virtual-simulation': '虚拟仿真对象',
  frontier: '前沿拓展对象',
};

export const arenaVisibilityLabels: Record<ModelVisibility, string> = {
  'white-box': '白箱模型',
  'gray-box': '灰箱模型',
  'black-box': '黑箱模型',
};

export const arenaMethodLabels: Record<ControllerMethod, string> = {
  'serial-compensator': '串联校正',
  pid: 'PID',
  'optimized-pid': '优化 PID',
  'composite-compensation': '复合校正',
  mpc: '模型预测控制',
  'black-box-control': '黑箱控制',
  'code-controller': '代码控制器',
};

export const arenaWorkspaceLabels: Record<WorkspaceMode, string> = {
  'multi-representation-linkage': '多表征联动工作台',
  'block-diagram-workbench': '框图工作台',
  'black-box-identification': '黑箱辨识与控制工作台',
  'predictive-control': '预测控制工作台',
  'control-odyssey': '控制奥德赛工作台',
};

export const arenaLeaderboardLabels: Record<LeaderboardType, string> = {
  main: '主榜',
  method: '方法榜',
  metric: '指标榜',
  pareto: 'Pareto 榜',
  class: '班级榜',
  season: '赛季榜',
};

export const arenaHardConstraintLabels: Record<string, string> = {
  closed_loop_stable: '闭环稳定',
  finite_response: '响应有限',
  controller_causal: '控制器因果',
  control_not_saturated: '控制量未严重饱和',
  hidden_scenarios_passed: '隐藏场景通过',
  safe_blackbox_batch: '黑箱批量评测完成',
  safety_constraints_passed: '安全约束通过',
  authorized_interface_only: '仅使用授权接口',
};

export const arenaTieBreakerLabels: Record<string, string> = {
  hardConstraintPass: '硬约束通过',
  score: '得分',
  submittedAt: '提交时间',
  controlEnergy: '控制能量',
  settlingTime: '调节时间',
  overshoot: '超调量',
};

export const arenaMetricLabels: Record<string, string> = {
  settlingTime: '调节时间',
  overshoot: '超调量',
  steadyStateError: '稳态误差',
  itae: 'ITAE 指标',
  controlEnergy: '控制能量',
  comfortBandPeak: '舒适频段峰值',
  hiddenScenarioWorst: '隐藏场景最差表现',
  phaseMargin: '相角裕度',
  gainMargin: '幅值裕度',
  bandwidth: '带宽',
};

export function formatArenaLeaderboardType(type: LeaderboardType): string {
  return arenaLeaderboardLabels[type] ?? type;
}

export function formatArenaHardConstraint(id: string): string {
  return arenaHardConstraintLabels[id] ?? id;
}

export function formatArenaTieBreaker(id: string): string {
  return arenaTieBreakerLabels[id] ?? id;
}

export function formatArenaMetric(id: string, metric?: MetricDefinition): string {
  return metric?.label ?? arenaMetricLabels[id] ?? id;
}

export function formatArenaMetricGoal(metric: MetricDefinition): string {
  const unit = metric.unit ?? '';
  if (metric.direction === 'maximize') {
    return `目标不低于 ${metric.idealValue}${unit}，低于 ${metric.unacceptableValue}${unit} 视为不可接受`;
  }
  if (metric.direction === 'target') {
    return `目标 ${metric.idealValue}${unit}，偏离至 ${metric.unacceptableValue}${unit} 视为不可接受`;
  }
  return `目标不高于 ${metric.idealValue}${unit}，高于 ${metric.unacceptableValue}${unit} 视为不可接受`;
}

export function formatArenaMetricExplanation(metric: MetricDefinition): string {
  if (metric.direction === 'maximize') return '数值越大越好';
  if (metric.direction === 'target') return '越接近目标越好';
  return '数值越小越好';
}
