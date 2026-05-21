import type { ControllerMethod, ModelVisibility } from '@/features/arena/types';
import type {
  WorkbenchDesignFlow,
  WorkbenchDesignFlowStep,
  WorkbenchDesignStepId,
  AssignmentWorkbenchSessionContext,
  ChallengeWorkbenchSessionContext,
  ExploreWorkbenchSessionContext,
  OdysseyWorkbenchSessionContext,
  WorkbenchMode,
  WorkbenchViewId,
} from './contracts';

type StepTemplate = Omit<WorkbenchDesignFlowStep, 'status'>;
export type WorkbenchDesignFlowSource =
  | Omit<ChallengeWorkbenchSessionContext, 'designFlow'>
  | Omit<AssignmentWorkbenchSessionContext, 'designFlow'>
  | Omit<OdysseyWorkbenchSessionContext, 'designFlow'>
  | Omit<ExploreWorkbenchSessionContext, 'designFlow'>;

const METHOD_LABELS: Record<ControllerMethod, string> = {
  'serial-compensator': '串联校正',
  pid: 'PID',
  'optimized-pid': '优化 PID',
  'composite-compensation': '复合校正',
  mpc: '模型预测控制',
  'black-box-control': '黑箱控制',
  'code-controller': '代码控制器',
};

const FLOW_STEP_TEMPLATES: Record<WorkbenchDesignStepId, StepTemplate> = {
  'object-analysis': {
    id: 'object-analysis',
    title: '对象分析',
    description: '确认对象可见性、模型来源、评价指标和可用视图。',
    nextAction: '确认对象、指标和允许方法，再进入控制器设计。',
    viewIds: ['time-domain', 'bode', 'root-locus', 'nyquist'],
  },
  'experiment-planning': {
    id: 'experiment-planning',
    title: '实验数据',
    description: '规划黑箱实验信号，先取得可复用的数据证据。',
    nextAction: '先获取持久化实验数据，再建立学生名义模型。',
    viewIds: ['experiment-dataset'],
  },
  'nominal-model': {
    id: 'nominal-model',
    title: '名义模型',
    description: '用实验数据形成学生自己的对象近似模型。',
    nextAction: '检查名义模型响应，再进入控制器方案。',
    viewIds: ['identification', 'response-comparison'],
  },
  'controller-design': {
    id: 'controller-design',
    title: '控制器设计',
    description: '在允许的方法边界内调整控制器结构和参数。',
    nextAction: '选择允许方法并形成一版可评测控制器。',
    viewIds: ['time-domain', 'bode', 'root-locus', 'nyquist', 'control-effort'],
  },
  'performance-comparison': {
    id: 'performance-comparison',
    title: '性能对照',
    description: '对照未校正、名义模型和当前方案的响应差异。',
    nextAction: '比较响应和指标，保留改进来源清楚的方案。',
    viewIds: ['time-domain', 'response-comparison', 'metric-summary'],
  },
  'constraint-check': {
    id: 'constraint-check',
    title: '约束检查',
    description: '检查硬约束、控制量、隐藏场景或官方指标风险。',
    nextAction: '确认硬约束通过后再进入官方提交。',
    viewIds: ['control-effort', 'metric-summary'],
  },
  'official-submission': {
    id: 'official-submission',
    title: '官方提交',
    description: '通过竞技场官方评价和榜单入口提交方案。',
    nextAction: '提交前确认方案来自当前工作台的有效控制器。',
    viewIds: ['metric-summary'],
  },
  review: {
    id: 'review',
    title: '结果复盘',
    description: '复查官方结果，定位下一轮设计应改进的位置。',
    nextAction: '根据官方结果选择下一轮对象分析或参数修正入口。',
    viewIds: ['metric-summary', 'response-comparison'],
  },
};

const WHITE_BOX_FLOW: WorkbenchDesignStepId[] = [
  'object-analysis',
  'controller-design',
  'performance-comparison',
  'constraint-check',
  'official-submission',
  'review',
];

const BLACK_BOX_FLOW: WorkbenchDesignStepId[] = [
  'experiment-planning',
  'nominal-model',
  'controller-design',
  'performance-comparison',
  'constraint-check',
  'official-submission',
  'review',
];

function modeLabel(mode: WorkbenchMode) {
  if (mode === 'assignment') return '作业模式';
  if (mode === 'challenge') return '挑战模式';
  if (mode === 'odyssey') return '复盘模式';
  return '自由探索模式';
}

function visibilityLabel(visibility: ModelVisibility) {
  if (visibility === 'black-box') return '黑箱对象';
  if (visibility === 'gray-box') return '灰箱对象';
  return '白箱对象';
}

function buildContextLabel(session: WorkbenchDesignFlowSource) {
  const objectType = visibilityLabel(session.object.visibility);

  if (session.mode === 'assignment') {
    return `班级作业 · ${objectType}`;
  }
  if (session.mode === 'explore') {
    return `本地探索 · ${objectType}`;
  }
  if (session.mode === 'odyssey') {
    return `闯关复盘 · ${objectType}`;
  }
  return `竞技场挑战 · ${objectType}`;
}

function formatMethods(methods: ControllerMethod[]) {
  return methods.map((method) => METHOD_LABELS[method] ?? method).join('、');
}

function isStepLocked(
  stepId: WorkbenchDesignStepId,
  session: WorkbenchDesignFlowSource,
) {
  if (stepId === 'official-submission') {
    return !session.submissionPolicy.officialEvaluationEnabled;
  }
  if (stepId === 'review') {
    return true;
  }
  return false;
}

function resolveCurrentStepId(session: WorkbenchDesignFlowSource): WorkbenchDesignStepId {
  if (session.mode === 'odyssey') {
    return 'review';
  }
  if (session.object.visibility === 'black-box' || session.defaultPreset === 'blackbox-identification') {
    return 'experiment-planning';
  }
  if (session.defaultPreset === 'predictive-control') {
    return 'constraint-check';
  }
  return 'object-analysis';
}

function resolveFlowStepIds(session: WorkbenchDesignFlowSource) {
  if (session.object.visibility === 'black-box' || session.defaultPreset === 'blackbox-identification') {
    return BLACK_BOX_FLOW;
  }
  return WHITE_BOX_FLOW;
}

function filterStepViews(viewIds: WorkbenchViewId[], session: WorkbenchDesignFlowSource) {
  return viewIds.filter((viewId) => session.allowedViews.includes(viewId));
}

export function buildWorkbenchDesignFlow(session: WorkbenchDesignFlowSource): WorkbenchDesignFlow {
  const currentStepId = resolveCurrentStepId(session);
  const steps = resolveFlowStepIds(session).map((stepId) => {
    const template = FLOW_STEP_TEMPLATES[stepId];
    const status: WorkbenchDesignFlowStep['status'] = stepId === currentStepId
      ? 'active'
      : isStepLocked(stepId, session) ? 'locked' : 'available';
    return {
      ...template,
      viewIds: filterStepViews(template.viewIds, session),
      status,
    };
  });
  const currentStep = steps.find((step) => step.id === currentStepId) ?? steps[0];

  return {
    modeLabel: modeLabel(session.mode),
    contextLabel: buildContextLabel(session),
    taskLabel: 'task' in session ? session.task.title : session.title ?? '综合仿真工作台',
    objectLabel: session.object.name,
    methodBoundary: formatMethods(session.allowedMethods),
    currentStepId: currentStep.id,
    currentStep,
    nextAction: currentStep.nextAction,
    steps,
  };
}
