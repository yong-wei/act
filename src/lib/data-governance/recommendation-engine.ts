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

export type RecommendationType = 'immediate' | 'weekly' | 'challenge';

export interface Recommendation {
  id: string;
  type: RecommendationType;
  title: string;
  description: string;
  reason: string;
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
  learningHistory: {
    totalMissions: number;
    completedMissions: number;
    lastActive: Date | null;
    streakDays: number;
  };
}

// Recommendation rule definitions
interface RecommendationRule {
  id: string;
  type: RecommendationType;
  condition: (ctx: RecommendationContext) => boolean;
  generate: (ctx: RecommendationContext) => Omit<Recommendation, 'id' | 'type' | 'priority'> & { priority: number };
}

// Rule set for generating recommendations
const RECOMMENDATION_RULES: RecommendationRule[] = [
  // Immediate: AI misuse risk
  {
    id: 'ai-misuse-intervention',
    type: 'immediate',
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
    condition: (ctx) => {
      const crossScore = ctx.competencyVector.crossDomainTransfer.score;
      const controlScore = ctx.competencyVector.controlModeling.score;
      return controlScore > 70 && crossScore < 50;
    },
    generate: () => ({
      title: '练习跨域知识迁移',
      description: '单点知识掌握较好但跨域迁移能力薄弱。推荐进行联动练习，建立知识联系。',
      reason: '跨域迁移能力显著落后于其他能力',
      actionUrl: '/interactive-learning/lesson-02',
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
  // Get latest competency snapshot
  const snapshot = await prisma.studentCompetencySnapshot.findFirst({
    where: { userId },
    orderBy: { snapshotAt: 'desc' },
  });

  // Get risk flags
  const riskFlags = await prisma.studentRiskFlag.findMany({
    where: { userId, isResolved: false },
  });

  // Get recent learning facts
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const recentFacts = await prisma.learningFact.findMany({
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
  });

  // Calculate learning history stats
  const totalMissions = await prisma.userProgress.count({
    where: { userId },
  });

  const completedMissions = await prisma.userProgress.count({
    where: { userId, status: 'COMPLETED' },
  });

  const lastFact = await prisma.learningFact.findFirst({
    where: { userId },
    orderBy: { startedAt: 'desc' },
    select: { startedAt: true },
  });

  // Calculate streak (consecutive days with activity)
  const streakDays = calculateStreak(recentFacts.map(f => f.startedAt));

  return {
    userId,
    competencyVector: (snapshot?.competencyVector as unknown as CompetencyVector)
      || createEmptyVector(),
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
    learningHistory: {
      totalMissions,
      completedMissions,
      lastActive: lastFact?.startedAt || null,
      streakDays,
    },
  };
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
