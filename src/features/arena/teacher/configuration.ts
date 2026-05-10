import {
  getArenaChallengeTask,
  getArenaLeaderboardPolicy,
  getArenaMetricProfile,
} from '../data/seed-challenges';
import type { ControllerMethod } from '../types';

export type ArenaPublicationVisibility = 'class' | 'course' | 'public';
export type ArenaTelemetryLevel = 'L0' | 'L1' | 'L2' | 'L3';

const publicationVisibilities: ArenaPublicationVisibility[] = ['class', 'course', 'public'];

export interface ArenaChallengeTemplate {
  id: string;
  name: string;
  description: string;
  defaultTaskId: string;
  defaultVisibility: ArenaPublicationVisibility;
  defaultLeaderboardPolicyId: string;
  targetSignal: string;
  disturbance: string;
  initialCondition: string;
  allowedMethods: ControllerMethod[];
  hardConstraints: string[];
  scoringMetricWeights: Record<string, number>;
  paretoEnabled: boolean;
  hiddenTestEnabled: boolean;
  gradeBinding: boolean;
  publicLeaderboard: boolean;
  telemetryLevel: ArenaTelemetryLevel;
}

export interface CreateArenaChallengePublicationInput {
  taskId: string;
  classId: string;
  visibility: ArenaPublicationVisibility;
  deadline: string;
  leaderboardPolicyId: string;
  homeworkBinding: boolean;
  templateId?: string;
  targetSignal?: string;
  disturbance?: string;
  initialCondition?: string;
  allowedMethods?: ControllerMethod[];
  hardConstraints?: string[];
  scoringMetricWeights?: Record<string, number>;
  paretoEnabled?: boolean;
  hiddenTestEnabled?: boolean;
  publicLeaderboard?: boolean;
  telemetryLevel?: ArenaTelemetryLevel;
}

export interface ArenaChallengePublication {
  id: string;
  taskId: string;
  classId: string;
  studentVisibility: ArenaPublicationVisibility;
  deadline: string;
  leaderboardPolicyId: string;
  homeworkBinding: boolean;
  templateId?: string;
  targetSignal: string;
  disturbance: string;
  initialCondition: string;
  allowedMethods: ControllerMethod[];
  hardConstraints: string[];
  scoringMetricWeights: Record<string, number>;
  paretoEnabled: boolean;
  hiddenTestEnabled: boolean;
  gradeBinding: boolean;
  publicLeaderboard: boolean;
  telemetryLevel: ArenaTelemetryLevel;
}

export interface ArenaHomeworkAssessmentInput {
  validSubmission: boolean;
  score: number;
  rank: number;
  diagnosticWeakMetrics: string[];
}

export interface ArenaHomeworkAssessment {
  gradeComponents: {
    completionScore: number;
    masteryScore: number;
    diagnosticScore: number;
    rankContribution: number;
  };
  summary: string;
}

export const ARENA_CHALLENGE_TEMPLATES: ArenaChallengeTemplate[] = [
  {
    id: 'template-serial-compensation-basic',
    name: '串联校正基础模板',
    description: '面向典型白箱对象，使用串联校正器完成时域指标达标。',
    defaultTaskId: 'task-second-order-lead-pid',
    defaultVisibility: 'course',
    defaultLeaderboardPolicyId: 'leaderboard-whitebox-default',
    targetSignal: '单位阶跃参考输入',
    disturbance: '无外加扰动，仅评估参考跟踪',
    initialCondition: '零初始状态',
    allowedMethods: ['serial-compensator'],
    hardConstraints: ['closed_loop_stable', 'finite_response', 'controller_causal'],
    scoringMetricWeights: { settlingTime: 0.3, overshoot: 0.25, steadyStateError: 0.25, itae: 0.2 },
    paretoEnabled: false,
    hiddenTestEnabled: false,
    gradeBinding: false,
    publicLeaderboard: false,
    telemetryLevel: 'L0',
  },
  {
    id: 'template-pid-tuning',
    name: 'PID 调参模板',
    description: '面向作业或课堂练习，限制为 PID 参数调节并保留班级榜。',
    defaultTaskId: 'task-integrator-low-frequency-balance',
    defaultVisibility: 'class',
    defaultLeaderboardPolicyId: 'leaderboard-class-homework',
    targetSignal: '单位阶跃参考输入',
    disturbance: '低频负载扰动',
    initialCondition: '零初始状态',
    allowedMethods: ['pid'],
    hardConstraints: ['closed_loop_stable', 'finite_response', 'controller_causal'],
    scoringMetricWeights: { steadyStateError: 0.35, settlingTime: 0.25, overshoot: 0.2, itae: 0.2 },
    paretoEnabled: false,
    hiddenTestEnabled: false,
    gradeBinding: true,
    publicLeaderboard: false,
    telemetryLevel: 'L0',
  },
  {
    id: 'template-composite-compensation',
    name: '复合校正模板',
    description: '面向框图式工作台，允许复合校正结构与串联校正结构比较。',
    defaultTaskId: 'task-third-order-block-diagram',
    defaultVisibility: 'course',
    defaultLeaderboardPolicyId: 'leaderboard-whitebox-default',
    targetSignal: '单位阶跃参考输入',
    disturbance: '输出端小幅阶跃扰动',
    initialCondition: '零初始状态',
    allowedMethods: ['composite-compensation', 'serial-compensator'],
    hardConstraints: ['closed_loop_stable', 'finite_response', 'controller_causal'],
    scoringMetricWeights: { settlingTime: 0.25, overshoot: 0.25, steadyStateError: 0.25, itae: 0.25 },
    paretoEnabled: false,
    hiddenTestEnabled: false,
    gradeBinding: false,
    publicLeaderboard: false,
    telemetryLevel: 'L1',
  },
  {
    id: 'template-blackbox-identification-control',
    name: '黑箱辨识控制模板',
    description: '面向黑箱辨识工作台，要求先采集实验数据并保存辨识模型。',
    defaultTaskId: 'task-cruise-roll-blackbox-identification',
    defaultVisibility: 'course',
    defaultLeaderboardPolicyId: 'leaderboard-pareto-exploration',
    targetSignal: '横摇角抑制目标',
    disturbance: '公开海况激励与隐藏海况扰动',
    initialCondition: '仿真后台默认海况初始状态',
    allowedMethods: ['black-box-control'],
    hardConstraints: ['scenario_batch_completed', 'safety_constraints_passed', 'authorized_interface_only'],
    scoringMetricWeights: { trackingError: 0.3, worstCaseDeviation: 0.3, controlEnergy: 0.2, constraintViolations: 0.2 },
    paretoEnabled: true,
    hiddenTestEnabled: true,
    gradeBinding: false,
    publicLeaderboard: false,
    telemetryLevel: 'L1',
  },
  {
    id: 'template-virtual-simulation-closed-loop',
    name: '虚拟仿真闭环挑战模板',
    description: '面向虚拟仿真对象，强调控制器导入、闭环预览和官方评测分离。',
    defaultTaskId: 'task-cruise-roll-blackbox-identification',
    defaultVisibility: 'course',
    defaultLeaderboardPolicyId: 'leaderboard-pareto-exploration',
    targetSignal: '多海况横摇舒适度目标',
    disturbance: '虚拟仿真后台海浪扰动集',
    initialCondition: '后台场景默认初始横摇状态',
    allowedMethods: ['black-box-control'],
    hardConstraints: ['scenario_batch_completed', 'safety_constraints_passed', 'authorized_interface_only'],
    scoringMetricWeights: { worstCaseDeviation: 0.35, trackingError: 0.25, controlEnergy: 0.2, constraintViolations: 0.2 },
    paretoEnabled: true,
    hiddenTestEnabled: true,
    gradeBinding: false,
    publicLeaderboard: false,
    telemetryLevel: 'L2',
  },
  {
    id: 'template-mpc-constrained-control',
    name: 'MPC 约束控制模板',
    description: '面向固定参数化 MPC，启用隐藏场景和约束控制评价。',
    defaultTaskId: 'task-ship-roll-mpc-hidden-scenarios',
    defaultVisibility: 'course',
    defaultLeaderboardPolicyId: 'leaderboard-pareto-exploration',
    targetSignal: '横摇角约束跟踪目标',
    disturbance: '隐藏扰动场景集',
    initialCondition: '零初始横摇角与角速度',
    allowedMethods: ['mpc'],
    hardConstraints: ['closed_loop_stable', 'finite_response', 'controller_causal', 'hidden_scenarios_passed'],
    scoringMetricWeights: { hiddenScenarioWorst: 0.35, settlingTime: 0.25, controlEnergy: 0.2, overshoot: 0.2 },
    paretoEnabled: true,
    hiddenTestEnabled: true,
    gradeBinding: false,
    publicLeaderboard: false,
    telemetryLevel: 'L1',
  },
];

export function getArenaChallengeTemplate(id: string): ArenaChallengeTemplate | undefined {
  return ARENA_CHALLENGE_TEMPLATES.find((template) => template.id === id);
}

function defaultMetricWeights(taskId: string): Record<string, number> {
  const task = getArenaChallengeTask(taskId);
  const profile = task ? getArenaMetricProfile(task.metricProfileId) : undefined;
  const metrics = profile?.rankingMetrics.map((metric) => metric.id) ?? task?.primaryMetrics ?? [];
  if (metrics.length === 0) return {};
  const weight = Math.round((1 / metrics.length) * 100) / 100;
  return Object.fromEntries(metrics.map((metricId) => [metricId, weight]));
}

function defaultHardConstraints(taskId: string): string[] {
  const task = getArenaChallengeTask(taskId);
  const profile = task ? getArenaMetricProfile(task.metricProfileId) : undefined;
  return profile?.hardConstraints ?? [];
}

function assertTemplateMatchesTask(template: ArenaChallengeTemplate, taskId: string) {
  if (template.defaultTaskId !== taskId) {
    throw new Error(`Arena task ${taskId} does not match template ${template.id}.`);
  }
}

function assertAllowedMethodsMatchTask(methods: ControllerMethod[], taskId: string) {
  const task = getArenaChallengeTask(taskId);
  const unsupported = methods.filter((method) => !task?.allowedMethods.includes(method));
  if (unsupported.length > 0) {
    throw new Error(`Template methods are not allowed for ${taskId}: ${unsupported.join(', ')}.`);
  }
}

export function createArenaChallengePublication(
  input: CreateArenaChallengePublicationInput,
): ArenaChallengePublication {
  if (!publicationVisibilities.includes(input.visibility)) {
    throw new Error(`Invalid Arena publication visibility: ${input.visibility}`);
  }
  if (!Number.isFinite(Date.parse(input.deadline))) {
    throw new Error(`Invalid Arena publication deadline: ${input.deadline}`);
  }

  const task = getArenaChallengeTask(input.taskId);
  if (!task) {
    throw new Error(`Unknown arena task: ${input.taskId}`);
  }
  const policy = getArenaLeaderboardPolicy(input.leaderboardPolicyId);
  if (!policy) {
    throw new Error(`Unknown leaderboard policy: ${input.leaderboardPolicyId}`);
  }
  if (task.leaderboardPolicyId !== policy.id) {
    throw new Error(`Leaderboard policy ${policy.id} is not configured for ${task.id}.`);
  }
  const missingTypes = task.leaderboardTypes.filter((type) => !policy.types.includes(type));
  if (missingTypes.length > 0) {
    throw new Error(`Leaderboard policy ${policy.id} does not cover task leaderboard types: ${missingTypes.join(', ')}.`);
  }
  if (input.homeworkBinding && !task.homeworkEligible) {
    throw new Error(`Arena task ${task.id} is not eligible for homework binding.`);
  }
  if (input.homeworkBinding && policy.visibility !== 'class') {
    throw new Error('Homework-bound Arena challenges must use a class-visible leaderboard policy.');
  }
  if (input.visibility !== policy.visibility) {
    throw new Error(`Publication visibility ${input.visibility} does not match leaderboard policy visibility ${policy.visibility}.`);
  }
  const template = input.templateId ? getArenaChallengeTemplate(input.templateId) : undefined;
  if (input.templateId && !template) {
    throw new Error(`Unknown Arena challenge template: ${input.templateId}`);
  }
  if (template) {
    assertTemplateMatchesTask(template, task.id);
  }
  const allowedMethods = input.allowedMethods ?? template?.allowedMethods ?? task.allowedMethods;
  assertAllowedMethodsMatchTask(allowedMethods, task.id);
  const paretoEnabled = input.paretoEnabled ?? template?.paretoEnabled ?? task.leaderboardTypes.includes('pareto');
  if (paretoEnabled && !policy.types.includes('pareto')) {
    throw new Error(`Pareto leaderboard is not supported by policy ${policy.id}.`);
  }
  const publicLeaderboard = input.publicLeaderboard ?? template?.publicLeaderboard ?? policy.visibility === 'public';
  if (publicLeaderboard && policy.visibility !== 'public') {
    throw new Error(`public leaderboard requires a public leaderboard policy, got ${policy.visibility}.`);
  }

  return {
    id: `arena-publication-${input.classId}-${input.taskId}`,
    taskId: input.taskId,
    classId: input.classId,
    studentVisibility: input.visibility,
    deadline: input.deadline,
    leaderboardPolicyId: input.leaderboardPolicyId,
    homeworkBinding: input.homeworkBinding,
    templateId: template?.id,
    targetSignal: input.targetSignal ?? template?.targetSignal ?? '单位阶跃参考输入',
    disturbance: input.disturbance ?? template?.disturbance ?? '无外加扰动',
    initialCondition: input.initialCondition ?? template?.initialCondition ?? '零初始状态',
    allowedMethods,
    hardConstraints: input.hardConstraints ?? template?.hardConstraints ?? defaultHardConstraints(task.id),
    scoringMetricWeights: input.scoringMetricWeights ?? template?.scoringMetricWeights ?? defaultMetricWeights(task.id),
    paretoEnabled,
    hiddenTestEnabled: input.hiddenTestEnabled ?? template?.hiddenTestEnabled ?? false,
    gradeBinding: input.homeworkBinding,
    publicLeaderboard,
    telemetryLevel: input.telemetryLevel ?? template?.telemetryLevel ?? 'L0',
  };
}

export function resolvePublishedArenaTasksForStudent(
  publications: readonly ArenaChallengePublication[],
  classId: string,
): ArenaChallengePublication[] {
  return publications.filter((publication) =>
    publication.studentVisibility !== 'class' || publication.classId === classId,
  );
}

export function deriveArenaHomeworkAssessment(
  input: ArenaHomeworkAssessmentInput,
): ArenaHomeworkAssessment {
  const completionScore = input.validSubmission ? 30 : 0;
  const masteryScore = input.validSubmission ? Math.round(Math.max(0, Math.min(100, input.score)) * 0.6) : 0;
  const diagnosticScore = Math.max(0, 10 - input.diagnosticWeakMetrics.length * 2);

  return {
    gradeComponents: {
      completionScore,
      masteryScore,
      diagnosticScore,
      rankContribution: 0,
    },
    summary: `作业评价由达标提交、指标掌握和诊断表现构成；排行榜第 ${input.rank} 名只用于比较，不直接换算为成绩。`,
  };
}
