/**
 * Risk Detection Engine
 *
 * Automatically detects learning risks from competency data and facts.
 */

import type { LearningFact } from '@prisma/client';
import type { CompetencyVector, TrendDirection } from './competency-model';
import { COMPETENCY_DIMENSIONS, calculateOverallScore } from './competency-model';

export type RiskType =
  | 'participation'
  | 'stagnation'
  | 'ai_misuse'
  | 'constraint'
  | 'cross_domain';

export type RiskSeverity = 'low' | 'medium' | 'high';

export interface RiskFlag {
  type: RiskType;
  severity: RiskSeverity;
  description: string;
  evidence: Record<string, unknown>;
  triggeredAt: Date;
}

export interface RiskDetectionContext {
  userId: string;
  facts: LearningFact[];
  competencyVector: CompetencyVector;
  previousSnapshot?: CompetencyVector;
  classAverage?: CompetencyVector;
}

// Risk detection rules
const RISK_RULES: Array<{
  type: RiskType;
  detect: (ctx: RiskDetectionContext) => Omit<RiskFlag, 'type' | 'triggeredAt'> | null;
}> = [
  {
    type: 'participation',
    detect: (ctx) => {
      // Check for low activity in recent period
      const recentFacts = ctx.facts.filter(
        f => f.startedAt > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      );

      if (recentFacts.length < 3) {
        return {
          severity: 'high',
          description: '近一周学习活跃度极低，可能已停止学习',
          evidence: { recentFactCount: recentFacts.length },
        };
      }

      if (recentFacts.length < 5) {
        return {
          severity: 'medium',
          description: '近一周学习活跃度较低',
          evidence: { recentFactCount: recentFacts.length },
        };
      }

      return null;
    },
  },
  {
    type: 'stagnation',
    detect: (ctx) => {
      if (!ctx.previousSnapshot) return null;

      const currentOverall = calculateOverallScore(ctx.competencyVector);
      const previousOverall = calculateOverallScore(ctx.previousSnapshot);
      const change = currentOverall - previousOverall;

      if (change < -10) {
        return {
          severity: 'high',
          description: '能力值出现明显下滑',
          evidence: { currentScore: currentOverall, previousScore: previousOverall, change },
        };
      }

      if (change < -5) {
        return {
          severity: 'medium',
          description: '能力值出现下滑趋势',
          evidence: { currentScore: currentOverall, previousScore: previousOverall, change },
        };
      }

      // Check for no improvement over 2 weeks
      const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
      const recentImprovement = ctx.facts.some(f => f.startedAt > twoWeeksAgo && f.outcome === 'success');

      if (!recentImprovement && currentOverall < 70) {
        return {
          severity: 'medium',
          description: '近两周无成功学习记录，能力值停滞',
          evidence: { currentScore: currentOverall },
        };
      }

      return null;
    },
  },
  {
    type: 'ai_misuse',
    detect: (ctx) => {
      const aiFacts = ctx.facts.filter(f => f.factType === 'ai_intervention');

      if (aiFacts.length < 5) return null;

      const recentAIFacts = aiFacts.filter(
        f => f.startedAt > new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
      );

      if (recentAIFacts.length < 5) return null;

      // High frequency but low success rate
      const failureRate = recentAIFacts.filter(f => f.outcome === 'failure').length / recentAIFacts.length;

      if (failureRate > 0.7) {
        return {
          severity: 'high',
          description: '高频使用AI助手但问题解决率低，可能存在依赖或误用',
          evidence: { totalCalls: recentAIFacts.length, failureRate },
        };
      }

      if (failureRate > 0.5) {
        return {
          severity: 'medium',
          description: '使用AI助手但效果不佳',
          evidence: { totalCalls: recentAIFacts.length, failureRate },
        };
      }

      return null;
    },
  },
  {
    type: 'constraint',
    detect: (ctx) => {
      const ethicalFacts = ctx.facts.filter(f => f.factType === 'ethical');
      const violations = ethicalFacts.filter(f => f.outcome === 'failure');

      if (violations.length >= 5) {
        return {
          severity: 'high',
          description: '多次违反工程约束或伦理规范',
          evidence: { violationCount: violations.length },
        };
      }

      if (violations.length >= 3) {
        return {
          severity: 'medium',
          description: '存在多次约束违规记录',
          evidence: { violationCount: violations.length },
        };
      }

      // Check simulation constraint violations
      const simFacts = ctx.facts.filter(f => f.factType === 'simulation');
      const poorConstraintScore = simFacts.filter(
        f => {
          const contribution = f.competencyContribution as Record<string, number> || {};
          return contribution.engineeringDecision < 0;
        }
      ).length;

      if (poorConstraintScore >= 3) {
        return {
          severity: 'medium',
          description: '仿真中多次忽视工程约束',
          evidence: { poorConstraintCount: poorConstraintScore },
        };
      }

      return null;
    },
  },
  {
    type: 'cross_domain',
    detect: (ctx) => {
      const controlScore = ctx.competencyVector.controlModeling.score;
      const crossDomainScore = ctx.competencyVector.crossDomainTransfer.score;

      // High in single domain but low in cross-domain
      if (controlScore > 75 && crossDomainScore < 50) {
        return {
          severity: 'high',
          description: '单点知识掌握较好但跨域迁移能力薄弱',
          evidence: { controlScore, crossDomainScore },
        };
      }

      if (controlScore > 65 && crossDomainScore < 45) {
        return {
          severity: 'medium',
          description: '跨域知识迁移能力有待提升',
          evidence: { controlScore, crossDomainScore },
        };
      }

      // Check for assessment pattern: single domain success, cross-domain failure
      const assessmentFacts = ctx.facts.filter(f => f.factType === 'question');
      const crossDomainAssessments = assessmentFacts.filter(f => {
        const contribution = f.competencyContribution as Record<string, number> || {};
        return contribution.crossDomainTransfer !== undefined;
      });

      if (crossDomainAssessments.length >= 3) {
        const crossDomainSuccess = crossDomainAssessments.filter(f => f.outcome === 'success').length;
        const crossDomainRate = crossDomainSuccess / crossDomainAssessments.length;

        if (crossDomainRate < 0.3) {
          return {
            severity: 'high',
            description: '跨域题目正确率极低，知识迁移存在明显障碍',
            evidence: { crossDomainRate, totalAttempts: crossDomainAssessments.length },
          };
        }
      }

      return null;
    },
  },
];

/**
 * Detect all risks for a student
 */
export function detectRisks(context: RiskDetectionContext): RiskFlag[] {
  const risks: RiskFlag[] = [];
  const now = new Date();

  for (const rule of RISK_RULES) {
    const detection = rule.detect(context);
    if (detection) {
      risks.push({
        type: rule.type,
        ...detection,
        triggeredAt: now,
      });
    }
  }

  return risks;
}

/**
 * Get risk level description
 */
export function getRiskLevelDescription(riskCount: number): string {
  if (riskCount === 0) return '无风险';
  if (riskCount === 1) return '低风险';
  if (riskCount <= 2) return '中风险';
  return '高风险';
}

/**
 * Get recommended scaffolding based on risks
 */
export function getRecommendedScaffolding(risks: RiskFlag[]): string {
  const riskTypes = new Set(risks.map(r => r.type));

  if (riskTypes.has('participation')) {
    return '建议教师主动关注，了解学习障碍，提供参与激励';
  }

  if (riskTypes.has('ai_misuse')) {
    return '引导学生正确使用AI助手：先独立思考，再针对性提问';
  }

  if (riskTypes.has('cross_domain')) {
    return '加强跨域概念联系，推荐联动练习和对比分析';
  }

  if (riskTypes.has('constraint')) {
    return '强化工程约束意识，在仿真前明确安全边界';
  }

  if (riskTypes.has('stagnation')) {
    return '调整学习路径难度，提供阶梯式挑战和及时反馈';
  }

  return '继续保持当前学习节奏';
}
