import type { ArenaCompanionContext } from './arena-companion-context';

export type InterventionType = 'failure-analysis' | 'constraint-hint' | 'guidance' | 'encouragement';

export interface AttemptRecord {
  attemptNumber: number;
  params: Record<string, number>;
  result: {
    overshoot?: number;
    settlingTime?: number;
    comfortIndex?: number;
    stabilityMargin?: number;
    [key: string]: number | undefined;
  };
  isSuccessful: boolean;
}

export interface StudentState {
  currentTask: string;
  attemptHistory: AttemptRecord[];
  currentAttempt: number;
  timeSinceLastAttempt?: number;
}

export interface InterventionRules {
  afterFailedAttempts: number;
  onStagnation: boolean;
  onConstraintViolation: boolean;
}

export interface InterventionDecision {
  shouldIntervene: boolean;
  reason: 'multiple_failures' | 'stagnation' | 'constraint_violation' | 'none';
  interventionType?: InterventionType;
}

export interface InterventionPayload {
  feedbackType: InterventionType;
  content: string;
  suggestedNextSteps: string[];
  relatedConcepts: string[];
  highlightParams: string[];
  showTrendPrediction: boolean;
}

const DEFAULT_RULES: InterventionRules = {
  afterFailedAttempts: 2,
  onStagnation: true,
  onConstraintViolation: true,
};

function pickLargestParamDelta(history: AttemptRecord[], allowedParamIds?: string[]): string[] {
  if (history.length < 2) {
    return allowedParamIds?.slice(0, 2) ?? ['kp', 'ki', 'kd'];
  }

  const latest = history[history.length - 1]?.params ?? {};
  const prev = history[history.length - 2]?.params ?? {};

  const keys = Array.from(new Set([...Object.keys(latest), ...Object.keys(prev)]))
    .filter((key) => !allowedParamIds || allowedParamIds.includes(key));
  const scored = keys.map((key) => ({
    key,
    delta: Math.abs((latest[key] ?? 0) - (prev[key] ?? 0)),
  }));

  scored.sort((a, b) => b.delta - a.delta);
  return scored.slice(0, 2).map((item) => item.key);
}

function detectConstraintViolation(history: AttemptRecord[]): boolean {
  const latest = history[history.length - 1];
  if (!latest) {
    return false;
  }

  const overshoot = latest.result.overshoot ?? 0;
  const comfortIndex = latest.result.comfortIndex ?? 0;
  const stabilityMargin = latest.result.stabilityMargin ?? 100;

  return overshoot > 35 || comfortIndex > 40 || stabilityMargin < 20;
}

function findArenaMetricRisks(
  history: AttemptRecord[],
  context: ArenaCompanionContext,
) {
  const latest = history[history.length - 1];
  if (!latest) return [];

  return context.metrics.flatMap((metric) => {
    const value = latest.result[metric.id];
    if (value === undefined) return [];

    const unacceptable = metric.direction === 'minimize'
      ? value > metric.unacceptableValue
      : metric.direction === 'maximize'
      ? value < metric.unacceptableValue
      : Math.abs(value - metric.idealValue) > metric.unacceptableValue;

    return unacceptable ? [{ metric, value }] : [];
  });
}

function detectStagnation(history: AttemptRecord[]): boolean {
  if (history.length < 3) {
    return false;
  }

  const recent = history.slice(-3);
  const settled = recent.map((item) => item.result.settlingTime ?? 0);
  const spread = Math.max(...settled) - Math.min(...settled);

  return spread < 2 && recent.every((item) => !item.isSuccessful);
}

export function shouldIntervene(
  state: StudentState,
  rules: Partial<InterventionRules> = {},
  arenaContext?: ArenaCompanionContext,
): InterventionDecision {
  const mergedRules: InterventionRules = {
    ...DEFAULT_RULES,
    ...rules,
  };

  const failedAttempts = state.attemptHistory.filter((attempt) => !attempt.isSuccessful).length;

  const hasConstraintViolation = arenaContext
    ? findArenaMetricRisks(state.attemptHistory, arenaContext).length > 0
    : detectConstraintViolation(state.attemptHistory);
  if (mergedRules.onConstraintViolation && hasConstraintViolation) {
    return {
      shouldIntervene: true,
      reason: 'constraint_violation',
      interventionType: 'constraint-hint',
    };
  }

  if (failedAttempts >= mergedRules.afterFailedAttempts) {
    return {
      shouldIntervene: true,
      reason: 'multiple_failures',
      interventionType: 'failure-analysis',
    };
  }

  if (mergedRules.onStagnation && (detectStagnation(state.attemptHistory) || (state.timeSinceLastAttempt ?? 0) > 300)) {
    return {
      shouldIntervene: true,
      reason: 'stagnation',
      interventionType: 'guidance',
    };
  }

  return {
    shouldIntervene: false,
    reason: 'none',
  };
}

function buildFailureAnalysis(state: StudentState): InterventionPayload {
  const latest = state.attemptHistory[state.attemptHistory.length - 1];
  const overshoot = latest?.result.overshoot ?? 0;
  const settling = latest?.result.settlingTime ?? 0;

  const emphasis =
    overshoot > 25
      ? '当前主要问题是阻尼不足，导致超调偏大。'
      : settling > 60
      ? '当前主要问题是响应偏慢，系统收敛效率不足。'
      : '当前问题是多指标权衡未形成清晰策略。';

  return {
    feedbackType: 'failure-analysis',
    content: `你已经进行了多次尝试，${emphasis}建议先固定两个参数，仅改变一个参数观察指标单调性，再进行下一轮调整。`,
    suggestedNextSteps: [
      '先设定一项主目标（如超调<15%），其余指标作为约束',
      '单参数扫描：每次仅调整 kp 或 kd，记录 3 组对比结果',
      '根据趋势决定是否需要加入积分环节',
    ],
    relatedConcepts: ['阻尼比', '相位裕度', '灵敏度函数'],
    highlightParams: pickLargestParamDelta(state.attemptHistory),
    showTrendPrediction: true,
  };
}

function buildConstraintHint(state: StudentState): InterventionPayload {
  const latest = state.attemptHistory[state.attemptHistory.length - 1];
  const overshoot = latest?.result.overshoot ?? 0;
  const comfort = latest?.result.comfortIndex ?? 0;
  const margin = latest?.result.stabilityMargin ?? 0;

  const violationText = [
    overshoot > 35 ? '超调量接近或超过约束上限' : null,
    comfort > 40 ? '舒适度指标恶化' : null,
    margin < 20 ? '稳定裕度偏低' : null,
  ]
    .filter(Boolean)
    .join('；');

  return {
    feedbackType: 'constraint-hint',
    content: `检测到约束边界风险：${violationText || '当前参数已接近安全边界'}。请先回到可行域，再追求性能提升。`,
    suggestedNextSteps: [
      '优先恢复相位裕度到 30° 以上',
      '将 kp 调整幅度限制在每轮 ±10%',
      '在每次调参后先检查约束，再判断性能收益',
    ],
    relatedConcepts: ['可行域', '鲁棒稳定性', '约束优化'],
    highlightParams: ['kp', 'kd'],
    showTrendPrediction: true,
  };
}

function buildGuidance(state: StudentState): InterventionPayload {
  const latest = state.attemptHistory[state.attemptHistory.length - 1];
  const confidenceTip = latest?.isSuccessful
    ? '你已接近目标，可尝试小步精调。'
    : '你可能陷入局部搜索，建议切换探索方向。';

  return {
    feedbackType: 'guidance',
    content: `${confidenceTip}建议先画出“参数变化-指标变化”轨迹，确认当前方向是否仍有收益。`,
    suggestedNextSteps: [
      '重新设定搜索起点，避免在同一区域来回调整',
      '采用“两步法”：先稳后快，分阶段优化',
      '保留每轮最优参数，避免回退丢失有效方案',
    ],
    relatedConcepts: ['探索策略', 'Pareto 前沿', '局部最优'],
    highlightParams: pickLargestParamDelta(state.attemptHistory),
    showTrendPrediction: true,
  };
}

function formatArenaMetricRisk(
  risk: ReturnType<typeof findArenaMetricRisks>[number],
) {
  const unit = risk.metric.unit ?? '';
  return `${risk.metric.label}为 ${risk.value}${unit}，练习边界为 ${risk.metric.unacceptableValue}${unit}`;
}

function buildArenaIntervention(
  decision: InterventionDecision,
  state: StudentState,
  context: ArenaCompanionContext,
): InterventionPayload {
  const parameterIds = context.parameters.map((parameter) => parameter.id);
  const highlights = pickLargestParamDelta(state.attemptHistory, parameterIds);
  const prefix = `当前 ${context.methodLabel} 练习记录`;
  const boundary = '本建议仅解释当前练习记录，不构成成绩或错因归因。';

  if (!decision.shouldIntervene || !decision.interventionType) {
    return {
      feedbackType: 'encouragement',
      content: `${prefix}尚未显示需要主动介入的风险。${boundary}`,
      suggestedNextSteps: [context.learningActions[0] ?? '继续记录参数与指标的对应关系。'],
      relatedConcepts: context.relatedConcepts,
      highlightParams: highlights,
      showTrendPrediction: false,
    };
  }

  if (decision.interventionType === 'constraint-hint') {
    const risks = findArenaMetricRisks(state.attemptHistory, context);
    const observations = risks.map(formatArenaMetricRisk).join('；');
    return {
      feedbackType: 'constraint-hint',
      content: `${prefix}出现练习指标风险：${observations}。${context.learningActions[0]}${boundary}`,
      suggestedNextSteps: [
        '先将出现风险的练习指标带回登记边界内，再比较性能改善。',
        context.learningActions[0] ?? '逐项记录参数与指标变化。',
      ],
      relatedConcepts: context.relatedConcepts,
      highlightParams: highlights,
      showTrendPrediction: true,
    };
  }

  if (decision.interventionType === 'failure-analysis') {
    return {
      feedbackType: 'failure-analysis',
      content: `${prefix}已出现多次未成功的练习记录。${context.learningActions[0]}${boundary}`,
      suggestedNextSteps: [
        context.learningActions[0] ?? '重新设置一组可比较的练习参数。',
        '保留一组对照记录，确认下一次调整是否改善了同一指标。',
      ],
      relatedConcepts: context.relatedConcepts,
      highlightParams: highlights,
      showTrendPrediction: true,
    };
  }

  return {
    feedbackType: 'guidance',
    content: `${prefix}的连续尝试尚未形成清晰改善趋势。${context.learningActions[0]}${boundary}`,
    suggestedNextSteps: [
      context.learningActions[0] ?? '重新选择一项参数作为本轮观察重点。',
      '使用同一组指标比较本轮与上一轮练习。',
    ],
    relatedConcepts: context.relatedConcepts,
    highlightParams: highlights,
    showTrendPrediction: true,
  };
}

export function generateIntervention(
  decision: InterventionDecision,
  state: StudentState,
  arenaContext?: ArenaCompanionContext,
): InterventionPayload {
  if (arenaContext) {
    return buildArenaIntervention(decision, state, arenaContext);
  }
  if (!decision.shouldIntervene || !decision.interventionType) {
    return {
      feedbackType: 'encouragement',
      content: '当前探索节奏良好，继续基于指标反馈做小步迭代。',
      suggestedNextSteps: ['继续记录每次参数变化与指标变化关系'],
      relatedConcepts: ['迭代优化'],
      highlightParams: ['kp'],
      showTrendPrediction: false,
    };
  }

  if (decision.interventionType === 'failure-analysis') {
    return buildFailureAnalysis(state);
  }

  if (decision.interventionType === 'constraint-hint') {
    return buildConstraintHint(state);
  }

  return buildGuidance(state);
}
