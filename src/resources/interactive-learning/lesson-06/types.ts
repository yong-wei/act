/**
 * Lesson-06 控制奥德赛·指标裁判席 类型定义
 *
 * 课程主题：时域性能指标与控制效果评价
 */

// ========== BOPPPS 教学阶段配置 ==========

export interface BOPPPSPhaseConfig {
  id: string;
  stage: BOPPPSStage;
  title: string;
  duration: number;
  color: string;
  resourceId?: string;
  componentType: ComponentType;
}

export type BOPPPSStage =
  | 'BRIDGE_IN'
  | 'OBJECTIVE'
  | 'PRE_ASSESSMENT'
  | 'PARTICIPATORY'
  | 'POST_ASSESSMENT'
  | 'SUMMARY';

export type ComponentType =
  | 'video'
  | 'poll'
  | 'objective'
  | 'interactive-widget'
  | 'knowledge-card'
  | 'simulation'
  | 'assessment'
  | 'ai-report';

// ========== AI 角色配置 ==========

export interface AIPersonaConfig {
  id: string;
  name: string;
  nameChinese: string;
  role: string;
  avatar?: string;
  systemPrompt: string;
  proactive: boolean;
}

export const AI_PERSONAS: Record<string, AIPersonaConfig> = {
  'chief-judge': {
    id: 'chief-judge',
    name: 'Chief Judge',
    nameChinese: '裁判长',
    role: '控制奥德赛指标裁判席负责人',
    systemPrompt: `你是控制奥德赛的裁判长。你的职责是帮助学生理解“时域性能指标”的判分逻辑。
在教学过程中，你应该：
1. 强调稳定、准确、快速之间的权衡
2. 用裁判视角解释上升时间、调节时间与超调量的意义
3. 当学生追求极限速度时提醒超调与稳态误差风险
4. 用竞赛语气激励学生改进控制策略`,
    proactive: true,
  },
  'score-analyst': {
    id: 'score-analyst',
    name: 'Score Analyst',
    nameChinese: '评分分析官',
    role: '负责指标分析与改进建议的AI助手',
    systemPrompt: `你是控制奥德赛的评分分析官。你的职责是根据指标给出改进建议。
在教学过程中，你应该：
1. 解读曲线中的关键时间点
2. 指出超调量、调节时间偏离标准的原因
3. 给出调参方向（提高阻尼/加快响应等）
4. 强调评价指标需要可解释、可复现`,
    proactive: true,
  },
};

// ========== 指标定义与阈值 ==========

export interface PerformanceMetricDefinition {
  id: string;
  name: string;
  symbol: string;
  description: string;
  judgeFocus: string;
}

export const PERFORMANCE_METRIC_DEFINITIONS: PerformanceMetricDefinition[] = [
  {
    id: 'rise-time',
    name: '上升时间',
    symbol: 't_r',
    description: '阶跃响应从终值 10% 上升到 90% 的时间（也可取 0~100% 定义）。',
    judgeFocus: '衡量响应速度。',
  },
  {
    id: 'peak-time',
    name: '峰值时间',
    symbol: 't_p',
    description: '响应达到最大峰值时对应的时间。',
    judgeFocus: '反映系统第一次“冲刺”的时刻。',
  },
  {
    id: 'settling-time',
    name: '调节时间',
    symbol: 't_s',
    description: '响应进入并保持在 ±5% 误差带内所需的时间。',
    judgeFocus: '衡量系统稳定下来的速度。',
  },
  {
    id: 'overshoot',
    name: '超调量',
    symbol: 'σ%',
    description: '峰值超过目标值的百分比。',
    judgeFocus: '衡量“冲过头”的程度。',
  },
  {
    id: 'steady-error',
    name: '稳态误差',
    symbol: 'e_ss',
    description: '系统稳定后输出与目标值之间的残余误差。',
    judgeFocus: '衡量最终精度。',
  },
];

export const JUDGE_THRESHOLDS = {
  overshoot: 10,
  settlingTime: 4.0,
  riseTime: 1.2,
  steadyStateError: 0.02,
};

// ========== BOPPPS 教学流程 ==========

export const LESSON_06_BOPPPS_FLOW: BOPPPSPhaseConfig[] = [
  {
    id: 'bridge-in',
    stage: 'BRIDGE_IN',
    title: '导入：指标裁判席开场',
    duration: 3,
    color: 'emerald',
    resourceId: 'video-judge-contrast',
    componentType: 'video',
  },
  {
    id: 'bridge-poll',
    stage: 'BRIDGE_IN',
    title: '投票：好控制的标准',
    duration: 0,
    color: 'emerald',
    resourceId: 'poll-judge-criteria',
    componentType: 'poll',
  },
  {
    id: 'objective',
    stage: 'OBJECTIVE',
    title: '学习目标',
    duration: 2,
    color: 'blue',
    resourceId: 'card-lesson-objectives',
    componentType: 'objective',
  },
  {
    id: 'pretest',
    stage: 'PRE_ASSESSMENT',
    title: '前测：指标速判',
    duration: 5,
    color: 'amber',
    resourceId: 'widget-metric-quick-check',
    componentType: 'interactive-widget',
  },
  {
    id: 'part-handbook',
    stage: 'PARTICIPATORY',
    title: '指标裁判手册',
    duration: 6,
    color: 'red',
    resourceId: 'card-metric-handbook',
    componentType: 'knowledge-card',
  },
  {
    id: 'part-judge-bench',
    stage: 'PARTICIPATORY',
    title: '裁判席计分器',
    duration: 15,
    color: 'red',
    resourceId: 'sim-judge-bench',
    componentType: 'interactive-widget',
  },
  {
    id: 'posttest',
    stage: 'POST_ASSESSMENT',
    title: '后测：参数提交',
    duration: 3,
    color: 'violet',
    resourceId: 'quiz-judge-assessment',
    componentType: 'assessment',
  },
  {
    id: 'summary',
    stage: 'SUMMARY',
    title: '总结：裁判席报告',
    duration: 2,
    color: 'slate',
    resourceId: 'report-judge-summary',
    componentType: 'ai-report',
  },
];

// ========== 评分公式 ==========

export interface AssessmentScoring {
  baseScore: number;
  msiWeight: number;
  penaltyPerViolation: number;
}

export const LESSON_06_SCORING: AssessmentScoring = {
  baseScore: 100,
  msiWeight: 1.2,
  penaltyPerViolation: 8,
};

export function calculateJudgeScore(msi: number, violationCount: number): number {
  const { baseScore, msiWeight, penaltyPerViolation } = LESSON_06_SCORING;
  const msiPenalty = baseScore * (1 - 1 / (1 + msi * msiWeight));
  const violationPenalty = penaltyPerViolation * violationCount;
  return Math.max(0, Math.round(baseScore - msiPenalty - violationPenalty));
}
