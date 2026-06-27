export interface AssessPromptRequest {
  userId?: string;
  sessionId?: string;
  prompt: string;
  structuredData?: Record<string, string>;
  auditTaskContext?: PromptAuditTaskContext;
  context: {
    taskType: 'pid-tuning' | 'controller-design' | 'system-analysis';
    difficulty: 'beginner' | 'intermediate' | 'advanced';
  };
}

export interface PromptAuditTaskContext {
  source?: string;
  assignment?: string;
  intent?: string;
  outputTarget?: 'answer' | 'prompt-history' | 'practice-candidate' | 'portfolio-draft';
}

export interface AssessPromptResponse {
  overallScore: number;
  dimensionScores: {
    completeness: number;
    precision: number;
    structurization: number;
    executability: number;
  };
  suggestions: Array<{
    dimension: string;
    issue: string;
    suggestion: string;
    example?: string;
  }>;
  metaPromptAnalysis: {
    detectedIntent: string;
    missingElements: string[];
    improvementPotential: number;
  };
}

export interface TrackConsistencyRequest {
  userId: string;
  designSessionId: string;
  promptVersion: number;
  promptContent: string;
  auditTaskContext?: PromptAuditTaskContext;
  designActions: Array<{
    timestamp: number;
    action: string;
    params: Record<string, number>;
  }>;
  finalResult: {
    overshoot?: number;
    settlingTime?: number;
    steadyStateError?: number;
    comfortIndex?: number;
    stabilityMargin?: number;
    [key: string]: number | undefined;
  };
}

export interface TrackConsistencyResponse {
  consistencyScore: number;
  alignmentAnalysis: {
    statedGoals: string[];
    actualOptimization: string[];
    mismatches: string[];
  };
  processQuality: {
    iterationCount: number;
    convergencePattern: 'steady' | 'oscillating' | 'diverging';
    explorationBreadth: number;
  };
}

interface PromptHistoryRecord {
  userId: string;
  sessionId: string;
  promptContent: string;
  auditTaskContext?: PromptAuditTaskContext;
  assessment: AssessPromptResponse;
  consistency?: TrackConsistencyResponse;
  version: number;
  createdAt: number;
}

interface PromptStore {
  historyByUser: Map<string, PromptHistoryRecord[]>;
}

declare global {
  // eslint-disable-next-line no-var
  var __promptAssessmentStore: PromptStore | undefined;
}

function getStore(): PromptStore {
  if (!globalThis.__promptAssessmentStore) {
    globalThis.__promptAssessmentStore = {
      historyByUser: new Map<string, PromptHistoryRecord[]>(),
    };
  }
  return globalThis.__promptAssessmentStore;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function hasAny(input: string, keywords: string[]): boolean {
  return keywords.some((keyword) => input.includes(keyword));
}

function detectGoals(prompt: string): string[] {
  const goals: string[] = [];
  if (hasAny(prompt, ['超调', 'overshoot'])) goals.push('控制超调');
  if (hasAny(prompt, ['调节时间', 'settling', '响应速度'])) goals.push('缩短调节时间');
  if (hasAny(prompt, ['稳态误差', 'steady-state'])) goals.push('降低稳态误差');
  if (hasAny(prompt, ['舒适', 'MSI', '横摇'])) goals.push('提升舒适度');
  if (hasAny(prompt, ['稳定裕度', '相位裕度', 'gain margin'])) goals.push('提升稳定裕度');
  return goals;
}

function evaluateCompleteness(prompt: string, structuredData?: Record<string, string>) {
  const checks = [
    hasAny(prompt, ['控制对象', '对象', 'ship', '系统']) || Boolean(structuredData?.['control-object']),
    hasAny(prompt, ['性能目标', '超调', '调节时间', '稳态误差']) || Boolean(structuredData?.['performance-goals']),
    hasAny(prompt, ['约束', '限制', '边界']) || Boolean(structuredData?.constraints),
  ];

  const score = Math.round((checks.filter(Boolean).length / checks.length) * 100);
  const missing: string[] = [];
  if (!checks[0]) missing.push('控制对象');
  if (!checks[1]) missing.push('性能目标');
  if (!checks[2]) missing.push('约束条件');

  return { score, missing };
}

function evaluatePrecision(prompt: string): number {
  const hasNumbers = /\d/.test(prompt);
  const hasUnits = /(°|deg|s|秒|%|rad\/s|m\/s)/i.test(prompt);
  const hasAmbiguous = /(尽量|可能|大概|差不多|合适即可)/.test(prompt);

  let score = 55;
  if (hasNumbers) score += 20;
  if (hasUnits) score += 15;
  if (!hasAmbiguous) score += 10;

  return clamp(score, 0, 100);
}

function evaluateStructurization(prompt: string): number {
  const hasSections = /(1\.|2\.|3\.|- |•|：)/.test(prompt);
  const hasLineBreaks = prompt.split('\n').filter((line) => line.trim().length > 0).length >= 3;
  const hasCauseEffect = /(因为|因此|所以|先.*再)/.test(prompt);

  let score = 50;
  if (hasSections) score += 25;
  if (hasLineBreaks) score += 15;
  if (hasCauseEffect) score += 10;

  return clamp(score, 0, 100);
}

function evaluateExecutability(prompt: string): number {
  const hasAction = /(调整|计算|验证|比较|输出|记录|评估)/.test(prompt);
  const hasInput = /(参数|输入|初值|条件)/.test(prompt);
  const hasOutput = /(结果|报告|指标|曲线|结论)/.test(prompt);

  let score = 45;
  if (hasAction) score += 20;
  if (hasInput) score += 15;
  if (hasOutput) score += 20;

  return clamp(score, 0, 100);
}

function detectIntent(prompt: string): string {
  if (hasAny(prompt, ['PID', '调参'])) return 'pid-tuning';
  if (hasAny(prompt, ['控制器设计', '补偿'])) return 'controller-design';
  return 'system-analysis';
}

export function assessPromptQuality(request: AssessPromptRequest): AssessPromptResponse {
  const prompt = request.prompt.trim();
  const completeness = evaluateCompleteness(prompt, request.structuredData);
  const precision = evaluatePrecision(prompt);
  const structurization = evaluateStructurization(prompt);
  const executability = evaluateExecutability(prompt);

  const overallScore = Math.round(
    completeness.score * 0.3 +
      precision * 0.25 +
      structurization * 0.25 +
      executability * 0.2
  );

  const suggestions: AssessPromptResponse['suggestions'] = [];
  if (completeness.score < 80) {
    suggestions.push({
      dimension: 'completeness',
      issue: '提示词要素不完整',
      suggestion: '补充控制对象、性能目标与约束边界，形成完整任务描述。',
      example: '对象：邮轮航向系统；目标：超调<15%；约束：相位裕度>30°。',
    });
  }

  if (precision < 75) {
    suggestions.push({
      dimension: 'precision',
      issue: '数值或单位表达不充分',
      suggestion: '尽量给出具体阈值与单位，减少模糊词。',
    });
  }

  if (structurization < 75) {
    suggestions.push({
      dimension: 'structurization',
      issue: '逻辑结构不清晰',
      suggestion: '按“输入-步骤-输出”三段式组织提示词。',
    });
  }

  if (executability < 75) {
    suggestions.push({
      dimension: 'executability',
      issue: '可执行指令不足',
      suggestion: '增加动作动词与交付物要求，如“计算并输出比较表”。',
    });
  }

  const missingElements = completeness.missing;
  const improvementPotential = clamp(100 - overallScore + missingElements.length * 5, 0, 100);

  const result: AssessPromptResponse = {
    overallScore,
    dimensionScores: {
      completeness: completeness.score,
      precision,
      structurization,
      executability,
    },
    suggestions,
    metaPromptAnalysis: {
      detectedIntent: detectIntent(prompt),
      missingElements,
      improvementPotential,
    },
  };

  const store = getStore();
  const userId = request.userId ?? 'demo-user';
  const sessionId = request.sessionId ?? `session-${userId}`;
  const current = store.historyByUser.get(userId) ?? [];

  current.push({
    userId,
    sessionId,
    promptContent: prompt,
    auditTaskContext: request.auditTaskContext,
    assessment: result,
    version: current.length + 1,
    createdAt: Date.now(),
  });

  store.historyByUser.set(userId, current);
  return result;
}

function detectOptimizationDirection(actions: TrackConsistencyRequest['designActions']): string[] {
  if (actions.length === 0) {
    return [];
  }

  const touched = new Set<string>();
  for (const action of actions) {
    if (Object.prototype.hasOwnProperty.call(action.params, 'kp')) touched.add('提高响应速度');
    if (Object.prototype.hasOwnProperty.call(action.params, 'kd')) touched.add('抑制超调与振荡');
    if (Object.prototype.hasOwnProperty.call(action.params, 'ki')) touched.add('减小稳态误差');
  }

  return Array.from(touched);
}

function convergencePattern(actions: TrackConsistencyRequest['designActions']): 'steady' | 'oscillating' | 'diverging' {
  if (actions.length < 3) {
    return 'steady';
  }

  const last = actions.slice(-4);
  const deltas = last.slice(1).map((action, index) => {
    const prev = last[index];
    const kpDelta = Math.abs((action.params.kp ?? 0) - (prev.params.kp ?? 0));
    const kdDelta = Math.abs((action.params.kd ?? 0) - (prev.params.kd ?? 0));
    return kpDelta + kdDelta;
  });

  const mean = deltas.reduce((sum, value) => sum + value, 0) / deltas.length;
  if (mean > 1.5) return 'diverging';

  const signChanges = deltas.filter((value, index) => index > 0 && Math.sign(value - deltas[index - 1]) !== 0).length;
  if (signChanges >= 2) return 'oscillating';

  return 'steady';
}

export function trackConsistency(request: TrackConsistencyRequest): TrackConsistencyResponse {
  const statedGoals = detectGoals(request.promptContent);
  const actualOptimization = detectOptimizationDirection(request.designActions);

  const goalMap: Record<string, string> = {
    控制超调: '抑制超调与振荡',
    缩短调节时间: '提高响应速度',
    降低稳态误差: '减小稳态误差',
    提升舒适度: '抑制超调与振荡',
    提升稳定裕度: '抑制超调与振荡',
  };

  const mismatches = statedGoals.filter((goal) => {
    const mapped = goalMap[goal];
    return mapped ? !actualOptimization.includes(mapped) : true;
  });

  const alignmentScore = statedGoals.length > 0 ? 1 - mismatches.length / statedGoals.length : 0.5;
  const actionCountScore = clamp(request.designActions.length / 8, 0, 1);

  const consistencyScore = Math.round((alignmentScore * 0.7 + actionCountScore * 0.3) * 100);

  const result: TrackConsistencyResponse = {
    consistencyScore,
    alignmentAnalysis: {
      statedGoals,
      actualOptimization,
      mismatches,
    },
    processQuality: {
      iterationCount: request.designActions.length,
      convergencePattern: convergencePattern(request.designActions),
      explorationBreadth: Number(
        clamp(
          new Set(request.designActions.map((action) => JSON.stringify(action.params))).size /
            Math.max(request.designActions.length, 1),
          0,
          1
        ).toFixed(2)
      ),
    },
  };

  const store = getStore();
  const existing = store.historyByUser.get(request.userId) ?? [];
  const current = existing[existing.length - 1];
  if (current) {
    current.consistency = result;
    current.auditTaskContext = request.auditTaskContext ?? current.auditTaskContext;
  }

  return result;
}

export function getPromptHistory(userId: string) {
  const store = getStore();
  return store.historyByUser.get(userId) ?? [];
}
