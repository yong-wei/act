/**
 * Recommendation Engine
 *
 * Generates personalized learning recommendations based on competency data.
 */

import { prisma } from '@/lib/prisma';
import type { CompetencyVector, CompetencyDimension } from './competency-model';
import { COMPETENCY_DIMENSIONS, getCompetencyLabel, getCompetencyLevel } from './competency-model';
import type { RiskFlag } from './risk-detector';
import { getRecommendedScaffolding } from './risk-detector';
import {
  readStudentEvidenceFeatures,
  type StudentEvidenceCoverageState,
  type StudentEvidenceStatusMarker,
  type StudentSimulationArenaFeatureSummary,
  type StudentSimulationArenaWeakMetric,
  type StudentPathEvidenceFeatureSummary,
  type StudentPathEvidenceSourceReference,
  type StudentEvidenceWindow,
} from './student-evidence-feature-cache';
import {
  isAdaptiveLearnerStateServiceEnabled,
  readPathPlannerLearnerState,
  type AdaptiveLearnerState,
} from './adaptive-learner-state-service';

export type RecommendationType = 'immediate' | 'weekly' | 'challenge';
export type RecommendationEvidenceBasis =
  | 'student-evidence-feature-cache'
  | 'approved-snapshot'
  | 'governed-facts'
  | 'fallback';
export type RecommendationEvidenceRole = 'direct' | 'risk' | 'aggregate' | 'context';
export type RecommendationConfidenceState = 'ready' | 'stale' | 'missing' | 'partial' | 'low-confidence';

export interface RecommendationRationale {
  reasonCode: string;
  evidenceBasis: RecommendationEvidenceBasis;
  evidenceRole: RecommendationEvidenceRole;
  contextOnly: boolean;
  evidenceWindow: StudentEvidenceWindow;
  evidenceCount: number;
  sourceCoverage: Record<'LearningFact' | 'StudentCompetencySnapshot' | 'StudentProfileSummary', StudentEvidenceCoverageState>;
  confidence: {
    state: RecommendationConfidenceState;
    level: 'none' | 'low' | 'medium' | 'high';
    score: number;
    markers: StudentEvidenceStatusMarker[];
  };
  simulationArena?: RecommendationSimulationArenaRationale;
  pathExecution?: RecommendationPathExecutionRationale;
}

export interface RecommendationSimulationArenaRationale {
  readiness: 'ready' | 'partial' | 'low-confidence' | 'missing';
  evidenceKinds: Array<'official-evaluation' | 'course-launched' | 'standalone' | 'preview-only' | 'agent-assisted'>;
  evidenceCount: number;
  traceReferenceCount: number;
  sourceCoverage: StudentSimulationArenaFeatureSummary['allTime']['sourceCoverage'];
  replayConfidence: StudentSimulationArenaFeatureSummary['allTime']['replayConfidence'];
  interventionOutcome: StudentSimulationArenaFeatureSummary['allTime']['interventionOutcome'];
  weakMetrics: StudentSimulationArenaWeakMetric[];
  qualityMarkers: StudentSimulationArenaFeatureSummary['allTime']['qualityMarkers'];
}

export interface RecommendationPathExecutionRationale {
  readiness: 'ready' | 'partial' | 'low-confidence' | 'missing';
  featureGroup: 'pathExecution';
  evidenceWindow: StudentEvidenceWindow;
  evidenceCount: number;
  sourceCoverage: StudentPathEvidenceFeatureSummary['allTime']['sourceCoverage'];
  confidence: StudentPathEvidenceFeatureSummary['allTime']['confidence'];
  interventionOutcome: StudentPathEvidenceFeatureSummary['allTime']['interventionOutcome'];
  sourceReferences: StudentPathEvidenceSourceReference[];
}

export interface Recommendation {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  reason: string;
  rationale: RecommendationRationale;
  actionUrl: string;
  actionLabel: string;
  priority: number; // 0-100
  estimatedTime?: string;
  tags: string[];
  expiresAt?: Date;
}

export interface RecommendationContext {
  userId: string;
  competencyVector: CompetencyVector;
  riskFlags: RiskFlag[];
  recentFacts: Array<{
    factType: string;
    outcome: string;
    startedAt: Date;
    score?: number;
  }>;
  learnerState: AdaptiveLearnerState | null;
  evidence: RecommendationEvidenceContext;
  learningHistory: {
    totalMissions: number;
    completedMissions: number;
    lastActive: Date | null;
    streakDays: number;
  };
}

interface RecommendationEvidenceContext {
  basis: RecommendationEvidenceBasis;
  readState: 'ready' | 'stale' | 'missing';
  evidenceWindow: StudentEvidenceWindow;
  evidenceCount: number;
  sourceCoverage: Record<'LearningFact' | 'StudentCompetencySnapshot' | 'StudentProfileSummary', StudentEvidenceCoverageState>;
  confidence: {
    level: 'none' | 'low' | 'medium' | 'high';
    score: number;
  };
  statusMarkers: StudentEvidenceStatusMarker[];
  simulationArena?: StudentSimulationArenaFeatureSummary;
  pathExecution?: StudentPathEvidenceFeatureSummary;
}

// Recommendation rule definitions
interface RecommendationRule {
  id: string;
  type: RecommendationType;
  evidenceRole: RecommendationEvidenceRole;
  condition: (ctx: RecommendationContext) => boolean;
  generate: (ctx: RecommendationContext) => Omit<Recommendation, 'id' | 'type' | 'priority' | 'rationale'> & { priority: number };
}

// Rule set for generating recommendations
const RECOMMENDATION_RULES: RecommendationRule[] = [
  // Immediate: AI misuse risk
  {
    id: 'ai-misuse-intervention',
    type: 'immediate',
    evidenceRole: 'risk',
    condition: (ctx) => ctx.riskFlags.some(r => r.type === 'ai_misuse' && r.severity === 'high'),
    generate: () => ({
      title: '优化AI使用方式',
      description: '你近期频繁使用AI助手但问题解决率较低。建议先独立思考5分钟，再针对性地提问。',
      reason: '检测到AI误用风险：高频使用但效果不佳',
      actionUrl: '/ai/copilot',
      actionLabel: '开始对话',
      priority: 95,
      estimatedTime: '15分钟',
      tags: ['AI协作', '学习方法'],
    }),
  },

  // Immediate: Participation risk
  {
    id: 'participation-intervention',
    type: 'immediate',
    evidenceRole: 'risk',
    condition: (ctx) => ctx.riskFlags.some(r => r.type === 'participation'),
    generate: () => ({
      title: '恢复学习节奏',
      description: '近一周学习活跃度较低。建议从一个小任务开始，重建学习习惯。',
      reason: '检测到参与度风险：近期活跃度下降',
      actionUrl: '/missions',
      actionLabel: '查看任务',
      priority: 90,
      estimatedTime: '20分钟',
      tags: ['学习习惯', '任务'],
    }),
  },

  // Immediate: Constraint violation risk
  {
    id: 'constraint-intervention',
    type: 'immediate',
    evidenceRole: 'risk',
    condition: (ctx) => ctx.riskFlags.some(r => r.type === 'constraint' && r.severity === 'high'),
    generate: () => ({
      title: '强化工程约束意识',
      description: '仿真中多次忽视工程约束（如舵角速度、横摇角）。建议重新学习安全边界设定。',
      reason: '检测到约束意识薄弱：多次违反工程规范',
      actionUrl: '/ethics',
      actionLabel: '学习伦理规范',
      priority: 88,
      estimatedTime: '10分钟',
      tags: ['工程伦理', '安全规范'],
    }),
  },

  // Immediate: Cross-domain weakness
  {
    id: 'cross-domain-boost',
    type: 'immediate',
    evidenceRole: 'direct',
    condition: (ctx) => {
      const crossScore = ctx.competencyVector.crossDomainTransfer.score;
      const controlScore = ctx.competencyVector.controlModeling.score;
      return controlScore > 70 && crossScore < 50;
    },
    generate: () => ({
      title: '练习跨域知识迁移',
      description: '单点知识掌握较好但跨域迁移能力薄弱。推荐进行联动练习，建立知识联系。',
      reason: '跨域迁移能力显著落后于其他能力',
      actionUrl: '/interactive-learning/courses/unit-2-1-modeling-language',
      actionLabel: '开始联动练习',
      priority: 85,
      estimatedTime: '25分钟',
      tags: ['跨域迁移', '联动练习'],
    }),
  },

  // Immediate: Stagnation risk
  {
    id: 'stagnation-recovery',
    type: 'immediate',
    evidenceRole: 'risk',
    condition: (ctx) => ctx.riskFlags.some(r => r.type === 'stagnation'),
    generate: () => ({
      title: '突破学习瓶颈',
      description: '近期能力值出现停滞。建议尝试不同类型的学习任务，调整学习策略。',
      reason: '检测到学习停滞：近期无显著提升',
      actionUrl: '/assessment/diagnostic',
      actionLabel: '进行诊断评估',
      priority: 82,
      estimatedTime: '15分钟',
      tags: ['诊断', '学习策略'],
    }),
  },

  // Weekly: Weak dimension practice (always generate for dimensions < 60)
  {
    id: 'weak-dimension-practice',
    type: 'weekly',
    evidenceRole: 'direct',
    condition: (ctx) => {
      const weakestScore = Math.min(...COMPETENCY_DIMENSIONS.map(d => ctx.competencyVector[d].score));
      return weakestScore < 60;
    },
    generate: (ctx) => {
      const weakest = COMPETENCY_DIMENSIONS.reduce((min, d) =>
        ctx.competencyVector[d].score < ctx.competencyVector[min].score ? d : min
      );
      const label = getCompetencyLabel(weakest);
      const score = Math.round(ctx.competencyVector[weakest].score);

      return {
        title: `提升${label}能力`,
        description: `这是你的薄弱领域（${score}分）。本周建议重点练习相关任务，系统提升该项能力。`,
        reason: `${label}是当前最薄弱环节`,
        actionUrl: '/missions',
        actionLabel: '查看推荐任务',
        priority: 75,
        estimatedTime: '3小时/周',
        tags: ['专项提升', label],
      };
    },
  },

  // Weekly: AI prompt design improvement
  {
    id: 'prompt-design-improvement',
    type: 'weekly',
    evidenceRole: 'direct',
    condition: (ctx) => {
      const reflectionScore = ctx.competencyVector.inquiryReflection.score;
      return reflectionScore < 65 && reflectionScore > 40;
    },
    generate: () => ({
      title: '优化提示词设计',
      description: '你的AI交互反思能力有提升空间。学习如何设计更有效的提示词，获得更好的AI辅助效果。',
      reason: '探究反思与提示词设计能力有待提升',
      actionUrl: '/evaluation',
      actionLabel: '练习提示词设计',
      priority: 70,
      estimatedTime: '30分钟',
      tags: ['AI协作', '提示词设计'],
    }),
  },

  // Weekly: Engineering decision practice
  {
    id: 'engineering-decision-practice',
    type: 'weekly',
    evidenceRole: 'direct',
    condition: (ctx) => ctx.competencyVector.engineeringDecision.score < 60,
    generate: () => ({
      title: '工程决策训练',
      description: '通过仿真实验强化工程约束意识，学习在多目标间做出权衡决策。',
      reason: '工程决策与约束意识需要加强',
      actionUrl: '/simulations/destroyer',
      actionLabel: '开始仿真',
      priority: 72,
      estimatedTime: '40分钟',
      tags: ['仿真', '工程决策'],
    }),
  },

  // Weekly: Knowledge graph exploration
  {
    id: 'knowledge-graph-exploration',
    type: 'weekly',
    evidenceRole: 'context',
    condition: (ctx) => ctx.learningHistory.completedMissions < 5,
    generate: () => ({
      title: '探索知识图谱',
      description: '作为新学员，建议先了解自动控制原理的知识结构，找到学习路径。',
      reason: '新学员：建议先建立知识框架',
      actionUrl: '/knowledge',
      actionLabel: '浏览知识图谱',
      priority: 65,
      estimatedTime: '20分钟',
      tags: ['知识图谱', '学习规划'],
    }),
  },

  // Challenge: Expert mission
  {
    id: 'expert-mission-challenge',
    type: 'challenge',
    evidenceRole: 'direct',
    condition: (ctx) => {
      const avgScore = COMPETENCY_DIMENSIONS.reduce((sum, d) => sum + ctx.competencyVector[d].score, 0)
        / COMPETENCY_DIMENSIONS.length;
      return avgScore > 75;
    },
    generate: () => ({
      title: '挑战专家级任务',
      description: '你的整体能力水平优秀！尝试专家级任务，进一步提升实战能力。',
      reason: '整体能力水平达到优秀，适合挑战高难度任务',
      actionUrl: '/missions?difficulty=expert',
      actionLabel: '查看专家任务',
      priority: 60,
      estimatedTime: '60分钟',
      tags: ['挑战', '专家级'],
    }),
  },

  // Challenge: Ethics sandbox
  {
    id: 'ethics-sandbox-challenge',
    type: 'challenge',
    evidenceRole: 'direct',
    condition: (ctx) => {
      return ctx.competencyVector.engineeringDecision.score > 70;
    },
    generate: () => ({
      title: '伦理决策挑战',
      description: '在伦理沙盒中面对复杂的工程伦理困境，锻炼决策能力和责任意识。',
      reason: '工程决策能力良好，适合挑战伦理困境',
      actionUrl: '/ethics',
      actionLabel: '进入伦理沙盒',
      priority: 55,
      estimatedTime: '30分钟',
      tags: ['伦理', '决策挑战'],
    }),
  },

  // Challenge: Design optimization
  {
    id: 'design-optimization-challenge',
    type: 'challenge',
    evidenceRole: 'direct',
    condition: (ctx) => {
      return ctx.competencyVector.parameterDesign.score > 70
        && ctx.competencyVector.controlModeling.score > 65;
    },
    generate: () => ({
      title: '参数优化大师',
      description: '设计一个满足多约束条件的控制系统，在指标间寻找最优平衡点。',
      reason: '参数设计与控制建模能力较强，适合综合优化挑战',
      actionUrl: '/simulations/destroyer?mode=optimization',
      actionLabel: '开始优化挑战',
      priority: 58,
      estimatedTime: '45分钟',
      tags: ['优化', '综合设计'],
    }),
  },

  // Challenge: Self-directed project
  {
    id: 'self-directed-project',
    type: 'challenge',
    evidenceRole: 'context',
    condition: (ctx) => {
      return ctx.competencyVector.selfDirectedLearning.score > 70
        && ctx.learningHistory.streakDays >= 7;
    },
    generate: () => ({
      title: '自主学习项目',
      description: '你展现了良好的自主学习能力。尝试独立完成一个综合项目，从需求分析到方案设计。',
      reason: '自主学习能力强，适合独立项目',
      actionUrl: '/missions?type=project',
      actionLabel: '选择项目',
      priority: 52,
      estimatedTime: '2小时',
      tags: ['自主学习', '综合项目'],
    }),
  },
];

/**
 * Generate recommendations for a user
 */
export async function generateRecommendations(userId: string): Promise<Recommendation[]> {
  const latestSnapshot = await prisma.studentCompetencySnapshot.findFirst({
    where: { userId },
    orderBy: [{ snapshotAt: 'desc' }, { id: 'desc' }],
  });
  const derivationState = (latestSnapshot?.evidenceSummary as any)?._derivation?.state;
  if (derivationState === 'no-recent-evidence' || derivationState === 'no-evidence-after-revocation') return [];
  // Get context data
  const context = await buildRecommendationContext(userId);

  // Apply rules to generate recommendations
  const recommendations: Recommendation[] = [];

  for (const rule of RECOMMENDATION_RULES) {
    try {
      if (rule.condition(context)) {
        const generated = rule.generate(context);
        recommendations.push({
          id: `${rule.id}-${Date.now()}`,
          type: rule.type,
          rationale: buildRecommendationRationale(rule, context),
          ...generated,
        });
      }
    } catch (error) {
      console.error(`[RecommendationEngine] Rule ${rule.id} failed:`, error);
    }
  }

  // Sort by priority (descending)
  recommendations.sort((a, b) => b.priority - a.priority);

  // Limit total recommendations
  const maxRecommendations = 8;
  return recommendations.slice(0, maxRecommendations);
}

/**
 * Build recommendation context from database
 */
async function buildRecommendationContext(userId: string): Promise<RecommendationContext> {
  const featureRead = await readStudentEvidenceFeatures(prisma, userId);
  const featureCache = normalizeFeatureCache(featureRead.cache);
  const cachedVector = getCachedCompetencyVector(featureCache);
  const learnerState = isAdaptiveLearnerStateServiceEnabled()
    ? await readPathPlannerLearnerState(prisma, userId).catch((error) => {
        console.error('[RecommendationEngine] Learner state read failed:', error);
        return null;
      })
    : null;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [
    snapshot,
    riskFlags,
    recentFacts,
    totalMissions,
    completedMissions,
    lastFact,
  ] = await Promise.all([
    cachedVector
      ? Promise.resolve(null)
      : prisma.studentCompetencySnapshot.findFirst({
          where: { userId },
          orderBy: [
            { snapshotAt: 'desc' },
            { id: 'desc' },
          ],
        }),
    prisma.studentRiskFlag.findMany({
      where: { userId, isResolved: false },
    }),
    prisma.learningFact.findMany({
      where: {
        userId,
        startedAt: { gte: thirtyDaysAgo },
      },
      orderBy: { startedAt: 'desc' },
      take: 50,
      select: {
        factType: true,
        outcome: true,
        startedAt: true,
        score: true,
      },
    }),
    prisma.userProgress.count({
      where: { userId },
    }),
    prisma.userProgress.count({
      where: { userId, status: 'COMPLETED' },
    }),
    prisma.learningFact.findFirst({
      where: { userId },
      orderBy: { startedAt: 'desc' },
      select: { startedAt: true },
    }),
  ]);

  const streakDays = calculateStreak(recentFacts.map(f => f.startedAt));
  const learnerStateVector = isLearnerStateUsableForDirectPersonalization(learnerState)
    ? learnerState.primaryCompetencies.vector
    : null;
  const competencyVector =
    learnerStateVector ??
    cachedVector ??
    (snapshot?.competencyVector as unknown as CompetencyVector | null) ??
    createEmptyVector();

  return {
    userId,
    competencyVector,
    riskFlags: riskFlags.map(rf => ({
      type: rf.flagType as RiskFlag['type'],
      severity: rf.severity as RiskFlag['severity'],
      description: rf.description,
      evidence: rf.evidenceJson as unknown as Record<string, unknown>,
      triggeredAt: rf.triggeredAt,
    })),
    recentFacts: recentFacts.map(f => ({
      ...f,
      score: f.score ?? undefined,
    })),
    learnerState,
    evidence: buildRecommendationEvidenceContext({
      featureReadState: featureRead.state,
      featureCache,
      recentFacts,
      hasSnapshot: Boolean(cachedVector || snapshot),
    }),
    learningHistory: {
      totalMissions,
      completedMissions,
      lastActive: lastFact?.startedAt || null,
      streakDays,
    },
  };
}

function isLearnerStateUsableForDirectPersonalization(
  learnerState: AdaptiveLearnerState | null
): learnerState is AdaptiveLearnerState {
  if (!learnerState) {
    return false;
  }

  const blockedMarkers: StudentEvidenceStatusMarker[] = [
    'stale',
    'partial',
    'low-confidence',
    'missing-source',
  ];

  return learnerState.evidence.readState === 'ready' &&
    learnerState.evidence.sourceCoverage.StudentCompetencySnapshot === 'available' &&
    learnerState.evidence.sourceCoverage.LearningFact !== 'missing' &&
    learnerState.evidence.confidence.evidenceCount > 0 &&
    learnerState.evidence.confidence.sourceCompleteness >= 0.5 &&
    !blockedMarkers.some((marker) => learnerState.evidence.statusMarkers.includes(marker));
}

function buildRecommendationRationale(
  rule: RecommendationRule,
  context: RecommendationContext
): RecommendationRationale {
  const simulationArena = buildRecommendationSimulationArenaRationale(context.evidence.simulationArena);
  const pathExecution = buildRecommendationPathExecutionRationale(context.evidence.pathExecution);
  const confidenceState = resolveRationaleConfidenceState(
    resolveConfidenceState(context.evidence),
    simulationArena,
    pathExecution,
  );

  return {
    reasonCode: rule.id,
    evidenceBasis: context.evidence.basis,
    evidenceRole: rule.evidenceRole,
    contextOnly: rule.evidenceRole === 'context',
    evidenceWindow: context.evidence.evidenceWindow,
    evidenceCount: context.evidence.evidenceCount,
    sourceCoverage: context.evidence.sourceCoverage,
    confidence: {
      state: confidenceState,
      level: capContextOnlyConfidence(rule.evidenceRole, context.evidence.confidence.level),
      score: context.evidence.confidence.score,
      markers: context.evidence.statusMarkers,
    },
    ...(simulationArena ? { simulationArena } : {}),
    ...(pathExecution ? { pathExecution } : {}),
  };
}

function buildRecommendationEvidenceContext(input: {
  featureReadState: 'ready' | 'stale' | 'missing';
  featureCache: Record<string, unknown> | null;
  recentFacts: Array<{ startedAt: Date }>;
  hasSnapshot: boolean;
}): RecommendationEvidenceContext {
  if (input.featureCache) {
    const sourceCounts = getObject(input.featureCache.sourceCounts);
    const confidence = normalizeConfidence(input.featureCache.confidenceMarkers);
    return {
      basis: 'student-evidence-feature-cache',
      readState: input.featureReadState,
      evidenceWindow: normalizeEvidenceWindow(input.featureCache.evidenceWindow),
      evidenceCount: confidence.evidenceCount || numberValue(sourceCounts.LearningFact),
      sourceCoverage: normalizeSourceCoverage(input.featureCache.sourceCoverage),
      confidence: {
        level: confidence.level,
        score: confidence.score,
      },
      statusMarkers: normalizeStatusMarkers(input.featureCache.statusMarkers),
      simulationArena: normalizeSimulationArenaFeature(input.featureCache.features),
      pathExecution: normalizePathExecutionFeature(input.featureCache.features),
    };
  }

  const evidenceCount = input.recentFacts.length;
  return {
    basis: input.hasSnapshot
      ? 'approved-snapshot'
      : evidenceCount > 0
        ? 'governed-facts'
        : 'fallback',
    readState: 'missing',
    evidenceWindow: buildRecentFactWindow(input.recentFacts),
    evidenceCount,
    sourceCoverage: {
      LearningFact: evidenceCount > 0 ? 'available' : 'missing',
      StudentCompetencySnapshot: input.hasSnapshot ? 'available' : 'missing',
      StudentProfileSummary: 'missing',
    },
    confidence: {
      level: input.hasSnapshot || evidenceCount > 0 ? 'low' : 'none',
      score: input.hasSnapshot || evidenceCount > 0 ? 0.25 : 0,
    },
    statusMarkers: ['missing-source'],
  };
}

function normalizeFeatureCache(cache: Record<string, unknown> | null): Record<string, unknown> | null {
  return isObject(cache) ? cache : null;
}

function getCachedCompetencyVector(cache: Record<string, unknown> | null): CompetencyVector | null {
  const features = getObject(cache?.features);
  const approvedAggregates = getObject(features.approvedAggregates);
  const latestSnapshot = getObject(approvedAggregates.latestSnapshot);
  const vector = latestSnapshot.competencyVector;

  return isCompetencyVector(vector) ? vector as CompetencyVector : null;
}

function normalizeSimulationArenaFeature(value: unknown): StudentSimulationArenaFeatureSummary | undefined {
  const features = getObject(value);
  const simulationArena = getObject(features.simulationArena);
  if (Object.keys(simulationArena).length === 0) {
    return undefined;
  }

  return {
    recent30d: normalizeSimulationArenaWindow(simulationArena.recent30d),
    allTime: normalizeSimulationArenaWindow(simulationArena.allTime),
  };
}

function normalizePathExecutionFeature(value: unknown): StudentPathEvidenceFeatureSummary | undefined {
  const features = getObject(value);
  const pathExecution = getObject(features.pathExecution);
  if (Object.keys(pathExecution).length === 0) {
    return undefined;
  }

  return {
    recent30d: normalizePathExecutionWindow(pathExecution.recent30d),
    allTime: normalizePathExecutionWindow(pathExecution.allTime),
  };
}

function normalizePathExecutionWindow(
  value: unknown
): StudentPathEvidenceFeatureSummary['allTime'] {
  const window = getObject(value);
  const sourceCoverage = getObject(window.sourceCoverage);
  return {
    window: normalizeEvidenceWindow(window.window),
    evidenceCount: numberValue(window.evidenceCount),
    adoptionCount: numberValue(window.adoptionCount),
    completionCount: numberValue(window.completionCount),
    deviationCount: numberValue(window.deviationCount),
    fallbackCount: numberValue(window.fallbackCount),
    terminalValidationCount: numberValue(window.terminalValidationCount),
    sourceCoverage: {
      adoption: normalizeCoverageState(sourceCoverage.adoption),
      completion: normalizeCoverageState(sourceCoverage.completion),
      deviation: normalizeCoverageState(sourceCoverage.deviation),
      fallback: normalizeCoverageState(sourceCoverage.fallback),
      terminalValidation: normalizeCoverageState(sourceCoverage.terminalValidation),
      interventionOutcome: normalizeCoverageState(sourceCoverage.interventionOutcome),
    },
    confidence: normalizePathExecutionConfidence(window.confidence),
    interventionOutcome: normalizePathExecutionInterventionOutcome(window.interventionOutcome),
    terminalValidation: normalizePathExecutionTerminalValidation(window.terminalValidation),
    sourceReferences: normalizePathExecutionSourceReferences(window.sourceReferences),
  };
}

function normalizePathExecutionTerminalValidation(
  value: unknown,
): StudentPathEvidenceFeatureSummary['allTime']['terminalValidation'] {
  const terminalValidation = getObject(value);
  return {
    latestState: typeof terminalValidation.latestState === 'string' ? terminalValidation.latestState : null,
    completedCount: numberValue(terminalValidation.completedCount),
    failedCount: numberValue(terminalValidation.failedCount),
    lowConfidenceCount: numberValue(terminalValidation.lowConfidenceCount),
    fallbackRequiredCount: numberValue(terminalValidation.fallbackRequiredCount),
    lowConfidenceMarkers: stringList(terminalValidation.lowConfidenceMarkers),
    failureReasons: stringList(terminalValidation.failureReasons),
  };
}

function normalizePathExecutionConfidence(
  value: unknown
): StudentPathEvidenceFeatureSummary['allTime']['confidence'] {
  const confidence = getObject(value);
  const level = confidence.level;
  return {
    level: level === 'none' || level === 'low' || level === 'medium' || level === 'high'
      ? level
      : 'none',
    score: numberValue(confidence.score),
    lowConfidenceCount: numberValue(confidence.lowConfidenceCount),
  };
}

function normalizePathExecutionInterventionOutcome(
  value: unknown
): StudentPathEvidenceFeatureSummary['allTime']['interventionOutcome'] {
  const interventionOutcome = getObject(value);
  return {
    acceptedCount: numberValue(interventionOutcome.acceptedCount),
    completedCount: numberValue(interventionOutcome.completedCount),
    dismissedCount: numberValue(interventionOutcome.dismissedCount),
    ignoredCount: numberValue(interventionOutcome.ignoredCount),
    rejectedCount: numberValue(interventionOutcome.rejectedCount),
    partiallyAcceptedCount: numberValue(interventionOutcome.partiallyAcceptedCount),
    lowConfidenceCount: numberValue(interventionOutcome.lowConfidenceCount),
  };
}

function normalizePathExecutionSourceReferences(value: unknown): StudentPathEvidenceSourceReference[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      const ref = getObject(item);
      const sourceType = ref.sourceType;
      const sourceId = stringOrNull(ref.sourceId);
      const pathId = stringOrNull(ref.pathId);
      const occurredAt = stringOrNull(ref.occurredAt);
      const privacyLevel = ref.privacyLevel;
      if (
        !sourceId ||
        !pathId ||
        !occurredAt ||
        (
          sourceType !== 'LearningPathExecution' &&
          sourceType !== 'LearningPathDeviation' &&
          sourceType !== 'LearningPathIntervention'
        ) ||
        (privacyLevel !== 'student-visible' && privacyLevel !== 'teacher-scoped')
      ) {
        return null;
      }
      return {
        sourceType,
        sourceId,
        pathId,
        nodeId: stringOrNull(ref.nodeId),
        occurredAt,
        privacyLevel,
        ...(stringOrNull(ref.status) ? { status: stringOrNull(ref.status)! } : {}),
        ...(stringOrNull(ref.resourceType) ? { resourceType: stringOrNull(ref.resourceType)! } : {}),
        ...(stringOrNull(ref.deviationType) ? { deviationType: stringOrNull(ref.deviationType)! } : {}),
        ...(stringOrNull(ref.interventionKind) ? { interventionKind: stringOrNull(ref.interventionKind)! } : {}),
        ...(stringOrNull(ref.studentOutcome) ? { studentOutcome: stringOrNull(ref.studentOutcome)! } : {}),
      };
    })
    .filter((item): item is StudentPathEvidenceSourceReference => Boolean(item));
}

function normalizeSimulationArenaWindow(
  value: unknown
): StudentSimulationArenaFeatureSummary['allTime'] {
  const window = getObject(value);
  const sourceCoverage = getObject(window.sourceCoverage);
  return {
    window: normalizeEvidenceWindow(window.window),
    evidenceCount: numberValue(window.evidenceCount),
    completedCount: numberValue(window.completedCount),
    officialCount: numberValue(window.officialCount),
    previewCount: numberValue(window.previewCount),
    agentAssistedCount: numberValue(window.agentAssistedCount),
    courseLaunchedCount: numberValue(window.courseLaunchedCount),
    standaloneCount: numberValue(window.standaloneCount),
    traceReferenceCount: numberValue(window.traceReferenceCount),
    sourceCoverage: {
      simulation: normalizeCoverageState(sourceCoverage.simulation),
      arena: normalizeCoverageState(sourceCoverage.arena),
      traceReferences: normalizeCoverageState(sourceCoverage.traceReferences),
      replayConfidence: normalizeCoverageState(sourceCoverage.replayConfidence),
    },
    replayConfidence: normalizeSimulationArenaReplayConfidence(window.replayConfidence),
    interventionOutcome: normalizeSimulationArenaInterventionOutcome(window.interventionOutcome),
    weakMetrics: normalizeSimulationArenaWeakMetrics(window.weakMetrics),
    qualityMarkers: normalizeSimulationArenaQualityMarkers(window.qualityMarkers),
    traceReferences: [],
  };
}

function normalizeSimulationArenaReplayConfidence(
  value: unknown
): StudentSimulationArenaFeatureSummary['allTime']['replayConfidence'] {
  const replayConfidence = getObject(value);
  return {
    average: typeof replayConfidence.average === 'number' && Number.isFinite(replayConfidence.average)
      ? replayConfidence.average
      : null,
    highConfidenceCount: numberValue(replayConfidence.highConfidenceCount),
    lowConfidenceCount: numberValue(replayConfidence.lowConfidenceCount),
    missingCount: numberValue(replayConfidence.missingCount),
  };
}

function normalizeSimulationArenaInterventionOutcome(
  value: unknown
): StudentSimulationArenaFeatureSummary['allTime']['interventionOutcome'] {
  const interventionOutcome = getObject(value);
  return {
    reviewedCount: numberValue(interventionOutcome.reviewedCount),
    improvedCount: numberValue(interventionOutcome.improvedCount),
    lowConfidenceCount: numberValue(interventionOutcome.lowConfidenceCount),
  };
}

function normalizeSimulationArenaWeakMetrics(value: unknown): StudentSimulationArenaWeakMetric[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value
    .map((item) => {
      const metric = getObject(item);
      const metricId = stringOrNull(metric.metricId);
      if (!metricId) return null;
      return {
        metricId,
        affectedFactCount: numberValue(metric.affectedFactCount),
        lowestValue: numberValue(metric.lowestValue),
      };
    })
    .filter((item): item is StudentSimulationArenaWeakMetric => Boolean(item));
}

function normalizeSimulationArenaQualityMarkers(
  value: unknown
): StudentSimulationArenaFeatureSummary['allTime']['qualityMarkers'] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is StudentSimulationArenaFeatureSummary['allTime']['qualityMarkers'][number] =>
    item === 'low-confidence' ||
    item === 'preview-only' ||
    item === 'standalone-only' ||
    item === 'stale' ||
    item === 'partial'
  );
}

function buildRecommendationSimulationArenaRationale(
  simulationArena: StudentSimulationArenaFeatureSummary | undefined
): RecommendationSimulationArenaRationale | undefined {
  if (!simulationArena) {
    return undefined;
  }

  const allTime = simulationArena.allTime;
  const evidenceKinds: RecommendationSimulationArenaRationale['evidenceKinds'] = [];
  if (allTime.officialCount > 0) evidenceKinds.push('official-evaluation');
  if (allTime.courseLaunchedCount > 0) evidenceKinds.push('course-launched');
  if (allTime.previewCount > 0) evidenceKinds.push('preview-only');
  if (numberValue(allTime.agentAssistedCount) > 0) evidenceKinds.push('agent-assisted');
  if (allTime.standaloneCount > 0) evidenceKinds.push('standalone');

  return {
    readiness: resolveSimulationArenaReadiness(allTime),
    evidenceKinds,
    evidenceCount: allTime.evidenceCount,
    traceReferenceCount: allTime.traceReferenceCount,
    sourceCoverage: allTime.sourceCoverage,
    replayConfidence: allTime.replayConfidence,
    interventionOutcome: allTime.interventionOutcome,
    weakMetrics: allTime.weakMetrics,
    qualityMarkers: allTime.qualityMarkers,
  };
}

function buildRecommendationPathExecutionRationale(
  pathExecution: StudentPathEvidenceFeatureSummary | undefined
): RecommendationPathExecutionRationale | undefined {
  if (!pathExecution || pathExecution.allTime.evidenceCount === 0) {
    return undefined;
  }
  const allTime = pathExecution.allTime;
  return {
    readiness: resolvePathExecutionReadiness(allTime),
    featureGroup: 'pathExecution',
    evidenceWindow: allTime.window,
    evidenceCount: allTime.evidenceCount,
    sourceCoverage: allTime.sourceCoverage,
    confidence: allTime.confidence,
    interventionOutcome: allTime.interventionOutcome,
    sourceReferences: allTime.sourceReferences.filter((ref) => ref.privacyLevel === 'student-visible'),
  };
}

function resolvePathExecutionReadiness(
  window: StudentPathEvidenceFeatureSummary['allTime']
): RecommendationPathExecutionRationale['readiness'] {
  if (window.evidenceCount === 0) {
    return 'missing';
  }
  if (window.confidence.level === 'low') {
    return 'low-confidence';
  }
  if (
    window.confidence.lowConfidenceCount > 0 ||
    Object.values(window.sourceCoverage).some((coverage) => coverage !== 'available')
  ) {
    return 'partial';
  }
  return 'ready';
}

function resolveSimulationArenaReadiness(
  window: StudentSimulationArenaFeatureSummary['allTime']
): RecommendationSimulationArenaRationale['readiness'] {
  if (window.evidenceCount === 0) {
    return 'missing';
  }
  if (
    window.qualityMarkers.includes('low-confidence') ||
    window.qualityMarkers.includes('preview-only') ||
    window.qualityMarkers.includes('standalone-only')
  ) {
    return 'low-confidence';
  }
  if (
    window.qualityMarkers.includes('partial') ||
    window.sourceCoverage.traceReferences !== 'available' ||
    window.sourceCoverage.replayConfidence !== 'available'
  ) {
    return 'partial';
  }
  return 'ready';
}

function isCompetencyVector(value: unknown): value is CompetencyVector {
  if (!isObject(value)) {
    return false;
  }

  return COMPETENCY_DIMENSIONS.every((dimension) => {
    const entry = value[dimension];
    return isObject(entry) && Number.isFinite(entry.score);
  });
}

function normalizeEvidenceWindow(value: unknown): StudentEvidenceWindow {
  const window = getObject(value);
  return {
    firstStartedAt: stringOrNull(window.firstStartedAt),
    lastStartedAt: stringOrNull(window.lastStartedAt),
    daysCovered: numberValue(window.daysCovered),
  };
}

function buildRecentFactWindow(facts: Array<{ startedAt: Date }>): StudentEvidenceWindow {
  if (facts.length === 0) {
    return {
      firstStartedAt: null,
      lastStartedAt: null,
      daysCovered: 0,
    };
  }

  const sorted = [...facts].sort((left, right) => left.startedAt.getTime() - right.startedAt.getTime());
  const first = sorted[0].startedAt;
  const last = sorted[sorted.length - 1].startedAt;

  return {
    firstStartedAt: first.toISOString(),
    lastStartedAt: last.toISOString(),
    daysCovered: Math.ceil((last.getTime() - first.getTime()) / 86400000),
  };
}

function normalizeSourceCoverage(
  value: unknown
): RecommendationEvidenceContext['sourceCoverage'] {
  const coverage = getObject(value);
  return {
    LearningFact: normalizeCoverageState(coverage.LearningFact),
    StudentCompetencySnapshot: normalizeCoverageState(coverage.StudentCompetencySnapshot),
    StudentProfileSummary: normalizeCoverageState(coverage.StudentProfileSummary),
  };
}

function normalizeCoverageState(value: unknown): StudentEvidenceCoverageState {
  return value === 'available' || value === 'partial' || value === 'missing'
    ? value
    : 'missing';
}

function normalizeConfidence(value: unknown): {
  level: RecommendationEvidenceContext['confidence']['level'];
  score: number;
  evidenceCount: number;
} {
  const confidence = getObject(value);
  const level = confidence.level;
  return {
    level: level === 'none' || level === 'low' || level === 'medium' || level === 'high'
      ? level
      : 'none',
    score: numberValue(confidence.score),
    evidenceCount: numberValue(confidence.evidenceCount),
  };
}

function normalizeStatusMarkers(value: unknown): StudentEvidenceStatusMarker[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is StudentEvidenceStatusMarker =>
    item === 'stale' ||
    item === 'partial' ||
    item === 'low-confidence' ||
    item === 'missing-source'
  );
}

function resolveConfidenceState(evidence: RecommendationEvidenceContext): RecommendationConfidenceState {
  if (evidence.readState === 'missing' || evidence.readState === 'stale') {
    return evidence.readState;
  }
  if (evidence.statusMarkers.includes('partial')) {
    return 'partial';
  }
  if (evidence.statusMarkers.includes('low-confidence') || evidence.statusMarkers.includes('missing-source')) {
    return 'low-confidence';
  }
  return 'ready';
}

function resolveRationaleConfidenceState(
  baseState: RecommendationConfidenceState,
  simulationArena: RecommendationSimulationArenaRationale | undefined,
  pathExecution: RecommendationPathExecutionRationale | undefined
): RecommendationConfidenceState {
  if (!simulationArena && !pathExecution) {
    return baseState;
  }
  if (baseState !== 'ready') {
    return baseState;
  }
  if (simulationArena?.readiness === 'low-confidence') {
    return 'low-confidence';
  }
  if (simulationArena?.readiness === 'partial') {
    return 'partial';
  }
  if (pathExecution?.readiness === 'low-confidence') {
    return 'low-confidence';
  }
  if (pathExecution?.readiness === 'partial') {
    return 'partial';
  }
  return baseState;
}

function capContextOnlyConfidence(
  role: RecommendationEvidenceRole,
  level: RecommendationRationale['confidence']['level']
) {
  if (role === 'context' && level === 'high') {
    return 'medium';
  }
  return level;
}

function getObject(value: unknown): Record<string, unknown> {
  return isObject(value) ? value : {};
}

function isObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringOrNull(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

/**
 * Calculate consecutive active days
 */
function calculateStreak(dates: Date[]): number {
  if (dates.length === 0) return 0;

  const uniqueDays = new Set(dates.map(d => d.toISOString().split('T')[0]));
  const sortedDays = Array.from(uniqueDays).sort().reverse();

  let streak = 0;
  const today = new Date().toISOString().split('T')[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

  // Check if active today or yesterday
  if (sortedDays[0] !== today && sortedDays[0] !== yesterday) {
    return 0;
  }

  for (let i = 0; i < sortedDays.length; i++) {
    const expectedDate = new Date();
    expectedDate.setDate(expectedDate.getDate() - i);
    const expectedStr = expectedDate.toISOString().split('T')[0];

    if (sortedDays[i] === expectedStr || (i === 0 && sortedDays[i] === yesterday)) {
      streak++;
    } else if (i > 0 || sortedDays[i] !== today) {
      break;
    }
  }

  return streak;
}

/**
 * Create empty competency vector
 */
function createEmptyVector(): CompetencyVector {
  const now = new Date().toISOString();
  const empty = {
    score: 0,
    trend: 'stable' as const,
    confidence: 0,
    evidenceCount: 0,
    lastUpdated: now,
  };

  return {
    controlModeling: { ...empty },
    parameterDesign: { ...empty },
    crossDomainTransfer: { ...empty },
    engineeringDecision: { ...empty },
    inquiryReflection: { ...empty },
    selfDirectedLearning: { ...empty },
  };
}

/**
 * Get recommendation by ID
 */
export async function getRecommendationById(
  userId: string,
  recommendationId: string
): Promise<Recommendation | null> {
  const recommendations = await generateRecommendations(userId);
  return recommendations.find(r => r.id === recommendationId) || null;
}

/**
 * Dismiss a recommendation (mark as seen/not relevant)
 */
export async function dismissRecommendation(
  _userId: string,
  _recommendationId: string
): Promise<void> {
  // In a full implementation, this would store dismissed recommendations
  // to prevent them from reappearing
  console.log('[RecommendationEngine] Dismissal not yet implemented');
}

// Re-export for convenience
export { getRecommendedScaffolding, getCompetencyLabel, getCompetencyLevel };
