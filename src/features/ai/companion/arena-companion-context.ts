import {
  getArenaChallengeTask,
  getArenaMetricProfile,
} from '@/features/arena/data/seed-challenges';
import type {
  ControllerMethod,
  MetricDefinition,
} from '@/features/arena/types';

export interface ArenaCompanionParameter {
  id: string;
  label: string;
  initialValue: number;
}

interface MethodCompanionDefinition {
  label: string;
  parameters: ArenaCompanionParameter[];
  relatedConcepts: string[];
  learningActions: string[];
}

export interface ArenaCompanionContext {
  taskId: string;
  taskTitle: string;
  method: ControllerMethod;
  methodLabel: string;
  parameters: ArenaCompanionParameter[];
  metrics: MetricDefinition[];
  relatedConcepts: string[];
  learningActions: string[];
}

export class ArenaCompanionContextError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ArenaCompanionContextError';
  }
}

const methodDefinitions: Record<ControllerMethod, MethodCompanionDefinition> = {
  pid: {
    label: 'PID',
    parameters: [
      { id: 'kp', label: 'Kp', initialValue: 1.2 },
      { id: 'ki', label: 'Ki', initialValue: 0.1 },
      { id: 'kd', label: 'Kd', initialValue: 0.4 },
    ],
    relatedConcepts: ['比例积分微分控制', '阻尼比', '稳态误差'],
    learningActions: ['固定其他增益后小步调整一个 PID 参数，比较同一组时域指标。'],
  },
  'serial-compensator': {
    label: '串联校正',
    parameters: [
      { id: 'gain', label: '校正增益', initialValue: 1 },
      { id: 'zero', label: '校正零点', initialValue: 1 },
      { id: 'pole', label: '校正极点', initialValue: 5 },
    ],
    relatedConcepts: ['超前滞后校正', '根轨迹', '频率响应'],
    learningActions: ['先确定需要改善的频段，再改变零极点位置并复查响应指标。'],
  },
  'optimized-pid': {
    label: '优化辅助 PID',
    parameters: [
      { id: 'speedWeight', label: '速度权重', initialValue: 1.2 },
      { id: 'energyWeight', label: '能量权重', initialValue: 0.7 },
      { id: 'robustnessWeight', label: '鲁棒权重', initialValue: 1.4 },
      { id: 'overshootWeight', label: '超调权重', initialValue: 0.9 },
      { id: 'searchBudget', label: '搜索预算', initialValue: 80 },
    ],
    relatedConcepts: ['多目标优化', '权重设计', '鲁棒性'],
    learningActions: ['一次只改变一项优化权重，记录速度、能量和鲁棒性的取舍。'],
  },
  'composite-compensation': {
    label: '复合校正',
    parameters: [
      { id: 'prefilterGain', label: '前置滤波增益', initialValue: 1 },
      { id: 'forwardGain', label: '前向通道增益', initialValue: 1 },
      { id: 'localFeedbackGain', label: '局部反馈增益', initialValue: 0.5 },
      { id: 'disturbanceCompensation', label: '扰动补偿', initialValue: 0.3 },
      { id: 'controlLimit', label: '控制限幅', initialValue: 4 },
    ],
    relatedConcepts: ['复合控制', '局部反馈', '扰动抑制'],
    learningActions: ['分别检查前向、反馈和扰动补偿通道对指标的影响，再组合调整。'],
  },
  mpc: {
    label: '预测控制',
    parameters: [
      { id: 'predictionHorizon', label: '预测时域', initialValue: 18 },
      { id: 'controlHorizon', label: '控制时域', initialValue: 5 },
      { id: 'outputWeight', label: '输出误差权重', initialValue: 1.4 },
      { id: 'controlWeight', label: '控制量权重', initialValue: 0.32 },
      { id: 'terminalWeight', label: '终端权重', initialValue: 2 },
      { id: 'inputLimit', label: '输入限幅', initialValue: 4.5 },
      { id: 'sampleTime', label: '采样时间', initialValue: 0.1 },
    ],
    relatedConcepts: ['模型预测控制', '约束优化', '滚动时域'],
    learningActions: ['围绕预测时域、控制时域和权重进行受约束的预测控制探索。'],
  },
  'black-box-control': {
    label: '黑箱辨识与控制',
    parameters: [
      { id: 'identificationQuality', label: '辨识质量', initialValue: 0.82 },
      { id: 'experimentCount', label: '实验次数', initialValue: 6 },
      { id: 'controllerGain', label: '控制增益', initialValue: 1.6 },
      { id: 'dampingCompensation', label: '阻尼补偿', initialValue: 0.72 },
      { id: 'energyBudget', label: '能耗预算', initialValue: 12 },
    ],
    relatedConcepts: ['系统辨识', '实验设计', '鲁棒控制'],
    learningActions: ['先补足实验覆盖并复核名义模型，再调整黑箱控制器参数。'],
  },
  'code-controller': {
    label: '代码控制器',
    parameters: [
      { id: 'runtimeLimitMs', label: '运行时限', initialValue: 100 },
      { id: 'memoryLimitMb', label: '内存限额', initialValue: 64 },
    ],
    relatedConcepts: ['实时控制', '确定性执行', '资源约束'],
    learningActions: ['先验证控制器在资源边界内的确定性行为，再比较练习指标。'],
  },
};

const CLIENT_AUTHORED_ARENA_COMPANION_COURSE_ID = 'simulation-companion';
const CLIENT_AUTHORED_ARENA_COMPANION_ID_PREFIXES = [
  'arena:',
  'arena-companion:',
  'arena-official:',
  'ai-companion:',
] as const;

export function isClientAuthoredArenaCompanionScope(input: {
  courseId?: string | null;
  pageId?: string | null;
  resourceId?: string | null;
  pathNodeId?: string | null;
  arenaTaskId?: string | null;
  method?: string | null;
}): boolean {
  if (input.arenaTaskId || input.method) return true;
  if (input.courseId === CLIENT_AUTHORED_ARENA_COMPANION_COURSE_ID) return true;
  return [input.pageId, input.resourceId, input.pathNodeId].some((value) => (
    typeof value === 'string'
    && CLIENT_AUTHORED_ARENA_COMPANION_ID_PREFIXES.some((prefix) => value.startsWith(prefix))
  ));
}

function requireTask(taskId: string) {
  const task = getArenaChallengeTask(taskId);
  if (!task) {
    throw new ArenaCompanionContextError(`未登记的竞技场任务：${taskId}`);
  }
  return task;
}

export function getArenaCompanionAllowedMethods(taskId: string): ControllerMethod[] {
  const task = requireTask(taskId);
  return [...task.allowedMethods];
}

export function resolveArenaCompanionContext(
  taskId: string,
  method: ControllerMethod,
): ArenaCompanionContext {
  const task = requireTask(taskId);
  if (!task.allowedMethods.includes(method)) {
    throw new ArenaCompanionContextError(`任务 ${taskId} 不允许控制方法 ${method}`);
  }

  const metricProfile = getArenaMetricProfile(task.metricProfileId);
  if (!metricProfile) {
    throw new ArenaCompanionContextError(`任务 ${taskId} 缺少指标档案 ${task.metricProfileId}`);
  }

  const definition = methodDefinitions[method];
  return {
    taskId: task.id,
    taskTitle: task.title,
    method,
    methodLabel: definition.label,
    parameters: definition.parameters.map((parameter) => ({ ...parameter })),
    metrics: metricProfile.rankingMetrics.map((metric) => ({ ...metric })),
    relatedConcepts: [...definition.relatedConcepts],
    learningActions: [...definition.learningActions],
  };
}
