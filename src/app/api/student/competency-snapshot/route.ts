/**
 * Student Competency Snapshot API
 *
 * Returns comprehensive competency data for the current student.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calculateTrendVector, generateEvidenceSummary } from '@/lib/data-governance/competency-engine';
import type { CompetencyVector, TrendVector } from '@/lib/data-governance/competency-model';
import type { RiskFlag } from '@/lib/data-governance/risk-detector';

export interface StudentSnapshotResponse {
  currentSnapshot: {
    vector: CompetencyVector;
    snapshotAt: string;
    factCount: number;
  };
  previousSnapshot: {
    vector: CompetencyVector;
    snapshotAt: string;
  } | null;
  trendVector: TrendVector;
  evidenceSummary: Record<string, Array<{ factType: string; outcome: string; score?: number }>>;
  riskFlags: RiskFlag[];
  recommendations: Array<{
    type: 'immediate' | 'weekly' | 'challenge';
    title: string;
    description: string;
    actionUrl?: string;
    priority: number;
  }>;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuthSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') as '7d' | '30d' | '90d' | null;

    // Calculate date range
    const now = new Date();
    const daysMap = { '7d': 7, '30d': 30, '90d': 90 };
    const days = timeRange && daysMap[timeRange] ? daysMap[timeRange] : 30;
    const startDate = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    // Get current snapshot
    const currentSnapshot = await prisma.studentCompetencySnapshot.findFirst({
      where: { userId },
      orderBy: { snapshotAt: 'desc' },
    });

    if (!currentSnapshot) {
      return NextResponse.json({
        currentSnapshot: null,
        previousSnapshot: null,
        trendVector: null,
        evidenceSummary: {},
        riskFlags: [],
        recommendations: [],
      } as unknown as StudentSnapshotResponse);
    }

    // Get previous snapshot for trend calculation
    const previousSnapshot = await prisma.studentCompetencySnapshot.findFirst({
      where: {
        userId,
        snapshotAt: {
          lt: currentSnapshot.snapshotAt,
        },
      },
      orderBy: { snapshotAt: 'desc' },
    });

    // Get evidence summary from current snapshot
    const evidenceSummary = (currentSnapshot.evidenceSummary as unknown as Record<
      string,
      Array<{ factType: string; outcome: string; score?: number }>
    >) || {};

    // Get risk flags
    const riskFlags = await prisma.studentRiskFlag.findMany({
      where: {
        userId,
        isResolved: false,
      },
      orderBy: { triggeredAt: 'desc' },
      take: 10,
    });

    // Calculate trend vector
    const currentVector = currentSnapshot.competencyVector as unknown as CompetencyVector;
    const previousVector = previousSnapshot?.competencyVector as unknown as CompetencyVector | undefined;
    const trendVector = previousVector
      ? calculateTrendVector(currentVector, previousVector)
      : (Object.fromEntries(
          Object.keys(currentVector).map((k) => [k, 'stable'])
        ) as unknown as TrendVector);

    // Generate basic recommendations based on snapshot data
    const recommendations = generateSnapshotRecommendations(
      currentVector,
      riskFlags.map((rf) => ({
        type: rf.flagType as RiskFlag['type'],
        severity: rf.severity as RiskFlag['severity'],
        description: rf.description,
        evidence: rf.evidenceJson as Record<string, unknown>,
        triggeredAt: rf.triggeredAt,
      })),
      evidenceSummary
    );

    const response: StudentSnapshotResponse = {
      currentSnapshot: {
        vector: currentVector,
        snapshotAt: currentSnapshot.snapshotAt.toISOString(),
        factCount: currentSnapshot.factCount,
      },
      previousSnapshot: previousSnapshot
        ? {
            vector: previousVector!,
            snapshotAt: previousSnapshot.snapshotAt.toISOString(),
          }
        : null,
      trendVector,
      evidenceSummary,
      riskFlags: riskFlags.map((rf) => ({
        type: rf.flagType as RiskFlag['type'],
        severity: rf.severity as RiskFlag['severity'],
        description: rf.description,
        evidence: rf.evidenceJson as unknown as Record<string, unknown>,
        triggeredAt: rf.triggeredAt,
      })),
      recommendations,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('[StudentSnapshot] Error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

/**
 * Generate recommendations based on snapshot data
 */
function generateSnapshotRecommendations(
  vector: CompetencyVector,
  riskFlags: RiskFlag[],
  _evidenceSummary: Record<string, Array<{ factType: string; outcome: string; score?: number }>>
): StudentSnapshotResponse['recommendations'] {
  const recommendations: StudentSnapshotResponse['recommendations'] = [];

  // Find weakest dimensions
  const dimensions = Object.entries(vector)
    .map(([key, value]) => ({ dimension: key, score: value.score }))
    .sort((a, b) => a.score - b.score);

  const weakestDimension = dimensions[0];
  const secondWeakest = dimensions[1];

  // Immediate recommendations based on risks
  for (const risk of riskFlags) {
    switch (risk.type) {
      case 'ai_misuse':
        recommendations.push({
          type: 'immediate',
          title: '优化AI使用方式',
          description: '你近期频繁使用AI助手但问题解决率较低。建议先独立思考，再针对性地提问。',
          actionUrl: '/ai/copilot',
          priority: 90,
        });
        break;
      case 'constraint':
        recommendations.push({
          type: 'immediate',
          title: '强化工程约束意识',
          description: '仿真中多次忽视工程约束。建议在调整参数前明确安全边界。',
          actionUrl: '/simulations/destroyer',
          priority: 85,
        });
        break;
      case 'participation':
        recommendations.push({
          type: 'immediate',
          title: '增加学习活跃度',
          description: '近一周学习活跃度较低，建议每天保持至少30分钟的学习时间。',
          actionUrl: '/missions',
          priority: 95,
        });
        break;
      case 'cross_domain':
        recommendations.push({
          type: 'immediate',
          title: '加强跨域知识联系',
          description: '单点知识掌握较好，但跨域迁移能力需要提升。',
          actionUrl: '/interactive-learning',
          priority: 80,
        });
        break;
    }
  }

  // Weekly recommendations based on weak dimensions
  if (weakestDimension.score < 60) {
    const dimensionNames: Record<string, string> = {
      controlModeling: '控制建模',
      parameterDesign: '参数设计',
      crossDomainTransfer: '跨域迁移',
      engineeringDecision: '工程决策',
      inquiryReflection: '探究反思',
      selfDirectedLearning: '自主学习',
    };

    recommendations.push({
      type: 'weekly',
      title: `提升${dimensionNames[weakestDimension.dimension]}能力`,
      description: `这是你的薄弱领域（${Math.round(weakestDimension.score)}分），建议本周重点练习相关任务。`,
      actionUrl: '/missions',
      priority: 70,
    });
  }

  if (secondWeakest && secondWeakest.score < 65) {
    recommendations.push({
      type: 'weekly',
      title: '巩固基础能力',
      description: '多维度能力有待提升，建议系统复习基础知识。',
      actionUrl: '/knowledge',
      priority: 60,
    });
  }

  // Challenge recommendations
  const strongDimensions = dimensions.filter((d) => d.score > 75);
  if (strongDimensions.length > 0) {
    recommendations.push({
      type: 'challenge',
      title: '挑战高难度任务',
      description: `你在${strongDimensions.map((d) => d.dimension).join('、')}方面表现优秀，可以尝试专家级任务。`,
      actionUrl: '/missions',
      priority: 50,
    });
  }

  // Sort by priority
  return recommendations.sort((a, b) => b.priority - a.priority);
}
