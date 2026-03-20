/**
 * Six-Dimensional Competency Model
 *
 * Defines the competency framework for student learning analytics.
 */

// Six primary competency dimensions
export interface CompetencyVector {
  controlModeling: CompetencyScore;      // 控制建模与分析能力
  parameterDesign: CompetencyScore;      // 参数设计与调优能力
  crossDomainTransfer: CompetencyScore;  // 跨域迁移与联动能力
  engineeringDecision: CompetencyScore;  // 工程决策与约束意识
  inquiryReflection: CompetencyScore;    // 探究反思与提示词设计能力
  selfDirectedLearning: CompetencyScore; // 自主学习进展能力
}

export interface CompetencyScore {
  score: number;        // 0-100 normalized
  trend: 'up' | 'stable' | 'down';
  confidence: number;   // 0-1 based on evidence
  evidenceCount: number;
  lastUpdated: string;
}

export type TrendDirection = 'up' | 'stable' | 'down';

export interface TrendVector {
  controlModeling: TrendDirection;
  parameterDesign: TrendDirection;
  crossDomainTransfer: TrendDirection;
  engineeringDecision: TrendDirection;
  inquiryReflection: TrendDirection;
  selfDirectedLearning: TrendDirection;
}

// Secondary metric mappings
export const COMPETENCY_MAPPINGS = {
  simulation: {
    metricAchievement: 'parameterDesign',
    iterationEfficiency: 'parameterDesign',
    retryQuality: 'selfDirectedLearning',
    constraintViolationRate: 'engineeringDecision',
    optimizationConvergence: 'parameterDesign',
    avgError: 'parameterDesign',
    maxRudderRate: 'engineeringDecision',
    energyConsumption: 'engineeringDecision',
    settlingTime: 'controlModeling',
  },
  assessment: {
    correctRate: 'controlModeling',
    crossDomainMigration: 'crossDomainTransfer',
    weakPointRecovery: 'selfDirectedLearning',
    conceptApplication: 'controlModeling',
    analysisDepth: 'controlModeling',
  },
  promptDesign: {
    completenessScore: 'inquiryReflection',
    precisionScore: 'inquiryReflection',
    structurizationScore: 'inquiryReflection',
    executabilityScore: 'parameterDesign',
    iterationDepth: 'selfDirectedLearning',
    overallScore: 'inquiryReflection',
  },
  aiInteraction: {
    appropriateUse: 'inquiryReflection',
    followUpQuality: 'selfDirectedLearning',
    misuseRecovery: 'engineeringDecision',
    wasHelpful: 'inquiryReflection',
  },
  ethics: {
    violationRate: 'engineeringDecision',
    remediationQuality: 'engineeringDecision',
    proactiveAwareness: 'engineeringDecision',
    isResolved: 'selfDirectedLearning',
  },
  design: {
    consistencyScore: 'parameterDesign',
    goalBehaviorAlignment: 'controlModeling',
    behaviorResultCoherence: 'crossDomainTransfer',
    iterationCount: 'selfDirectedLearning',
  },
} as const;

export type CompetencyDimension = keyof CompetencyVector;

export const COMPETENCY_DIMENSIONS: CompetencyDimension[] = [
  'controlModeling',
  'parameterDesign',
  'crossDomainTransfer',
  'engineeringDecision',
  'inquiryReflection',
  'selfDirectedLearning',
];

// Level definitions
export const COMPETENCY_LEVELS = {
  excellent: { min: 85, label: '优秀', color: '#22c55e' },
  good: { min: 70, label: '良好', color: '#3b82f6' },
  average: { min: 55, label: '中等', color: '#f59e0b' },
  needsImprovement: { min: 40, label: '需提升', color: '#f97316' },
  atRisk: { min: 0, label: '需关注', color: '#ef4444' },
} as const;

/**
 * Get competency level from score
 */
export function getCompetencyLevel(score: number): keyof typeof COMPETENCY_LEVELS {
  if (score >= COMPETENCY_LEVELS.excellent.min) return 'excellent';
  if (score >= COMPETENCY_LEVELS.good.min) return 'good';
  if (score >= COMPETENCY_LEVELS.average.min) return 'average';
  if (score >= COMPETENCY_LEVELS.needsImprovement.min) return 'needsImprovement';
  return 'atRisk';
}

/**
 * Get Chinese label for competency dimension
 */
export function getCompetencyLabel(dimension: CompetencyDimension): string {
  const labels: Record<CompetencyDimension, string> = {
    controlModeling: '控制建模与分析',
    parameterDesign: '参数设计与调优',
    crossDomainTransfer: '跨域迁移与联动',
    engineeringDecision: '工程决策与约束',
    inquiryReflection: '探究反思与提示词',
    selfDirectedLearning: '自主学习进展',
  };
  return labels[dimension];
}

/**
 * Get description for competency dimension
 */
export function getCompetencyDescription(dimension: CompetencyDimension): string {
  const descriptions: Record<CompetencyDimension, string> = {
    controlModeling: '理解控制系统原理，建立数学模型，进行时域/频域分析',
    parameterDesign: '设计控制器参数，优化系统性能，平衡各项指标',
    crossDomainTransfer: '将知识迁移到不同领域，建立跨域联系',
    engineeringDecision: '考虑工程约束，做出合理决策，识别风险',
    inquiryReflection: '有效使用AI助手，设计优质提示词，反思学习过程',
    selfDirectedLearning: '自主规划学习，识别薄弱环节，主动寻求帮助',
  };
  return descriptions[dimension];
}

/**
 * Create empty competency vector
 */
export function createEmptyCompetencyVector(): CompetencyVector {
  const now = new Date().toISOString();
  const emptyScore: CompetencyScore = {
    score: 0,
    trend: 'stable',
    confidence: 0,
    evidenceCount: 0,
    lastUpdated: now,
  };

  return {
    controlModeling: { ...emptyScore },
    parameterDesign: { ...emptyScore },
    crossDomainTransfer: { ...emptyScore },
    engineeringDecision: { ...emptyScore },
    inquiryReflection: { ...emptyScore },
    selfDirectedLearning: { ...emptyScore },
  };
}

/**
 * Calculate overall score from competency vector
 */
export function calculateOverallScore(vector: CompetencyVector): number {
  const scores = COMPETENCY_DIMENSIONS.map(d => vector[d].score);
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
  return Math.round(avg * 10) / 10;
}

/**
 * Calculate trend direction from score change
 */
export function calculateTrendDirection(
  current: number,
  previous: number,
  threshold: number = 5
): TrendDirection {
  const change = current - previous;
  if (change > threshold) return 'up';
  if (change < -threshold) return 'down';
  return 'stable';
}
