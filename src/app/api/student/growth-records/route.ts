/**
 * Student Growth Records API
 *
 * Returns growth timeline records for the current student.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import {
  isPortraitV2ProfileEvidence,
  mapLearningFactsToPortraitEvidence,
} from '@/lib/data-governance/portrait-v2-incremental-update';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export type GrowthRecordType =
  | 'milestone'
  | 'simulation'
  | 'risk_resolved'
  | 'excellent_design'
  | 'achievement'
  | 'competency_evaluation'
  | 'learning_activity';

export interface GrowthRecord {
  id: string;
  type: GrowthRecordType;
  title: string;
  description: string;
  date: string;
  metadata: Record<string, unknown>;
  icon: string;
}

export interface GrowthRecordsResponse {
  records: GrowthRecord[];
  total: number;
  hasMore: boolean;
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerAuthSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const userId = session.user.id;
    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50);
    const startIdx = (page - 1) * limit;
    const endIdx = startIdx + limit;

    // Read the records needed for the requested merged timeline page. At most
    // ten generated learning activities can be inserted ahead of them.
    const records = await prisma.growthRecord.findMany({
      where: { userId },
      orderBy: { occurredAt: 'desc' },
      take: endIdx,
    });

    const total = await prisma.growthRecord.count({
      where: { userId },
    });

    // Map to response format
    const mappedRecords: GrowthRecord[] = records.map(record => ({
      id: record.id,
      type: record.recordType as GrowthRecordType,
      title: record.title,
      description: record.description,
      date: record.occurredAt.toISOString(),
      metadata: record.evidenceJson as unknown as Record<string, unknown>,
      icon: getIconForType(record.recordType as GrowthRecordType),
    }));

    // If no persisted records exist yet, retain the existing broader fallback
    // timeline (milestones, simulations, risks, achievements, and activities).
    if (total === 0) {
      const generatedRecords = await generateGrowthRecords(userId);
      return NextResponse.json({
        records: generatedRecords.slice(startIdx, endIdx),
        total: generatedRecords.length,
        hasMore: endIdx < generatedRecords.length,
      } as GrowthRecordsResponse);
    }

    const learningActivities = await generateLearningActivityGrowthRecords(userId);
    const mergedRecords = [...mappedRecords, ...learningActivities]
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

    const response: GrowthRecordsResponse = {
      records: mergedRecords.slice(startIdx, endIdx),
      total: total + learningActivities.length,
      hasMore: endIdx < total + learningActivities.length,
    };

    return NextResponse.json(response);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[GrowthRecordsAPI] Error:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

/**
 * Get icon name for record type
 */
function getIconForType(type: GrowthRecordType): string {
  const icons: Record<GrowthRecordType, string> = {
    milestone: 'Flag',
    simulation: 'Ship',
    risk_resolved: 'ShieldCheck',
    excellent_design: 'Award',
    achievement: 'Trophy',
    competency_evaluation: 'Sparkles',
    learning_activity: 'BookOpen',
  };
  return icons[type] || 'Star';
}

/**
 * Generate growth records from existing data sources
 */
async function generateGrowthRecords(userId: string): Promise<GrowthRecord[]> {
  const records: GrowthRecord[] = [];

  // Get milestones
  const milestones = await prisma.learningMilestone.findMany({
    where: { userId, status: 'COMPLETED' },
    orderBy: { completedAt: 'desc' },
    take: 10,
  });

  for (const milestone of milestones) {
    records.push({
      id: `milestone-${milestone.id}`,
      type: 'milestone',
      title: milestone.title,
      description: milestone.description || `完成学习目标: ${milestone.title}`,
      date: milestone.completedAt?.toISOString() || milestone.createdAt.toISOString(),
      metadata: { milestoneId: milestone.id },
      icon: 'Flag',
    });
  }

  // Get simulation breakthroughs
  const simulations = await prisma.simulationLog.findMany({
    where: {
      userId,
      score: { gte: 85 },
    },
    orderBy: { createdAt: 'desc' },
    take: 10,
  });

  for (const sim of simulations) {
    records.push({
      id: `simulation-${sim.id}`,
      type: 'simulation',
      title: '仿真突破',
      description: `在仿真中取得 ${Math.round(sim.score || 0)} 分的好成绩`,
      date: sim.createdAt.toISOString(),
      metadata: { simulationId: sim.id, score: sim.score },
      icon: 'Ship',
    });
  }

  // Get resolved risks
  const resolvedRisks = await prisma.studentRiskFlag.findMany({
    where: {
      userId,
      isResolved: true,
    },
    orderBy: { resolvedAt: 'desc' },
    take: 5,
  });

  for (const risk of resolvedRisks) {
    records.push({
      id: `risk-${risk.id}`,
      type: 'risk_resolved',
      title: '风险预警解除',
      description: risk.resolutionNote || `成功改进: ${risk.description}`,
      date: risk.resolvedAt?.toISOString() || risk.triggeredAt.toISOString(),
      metadata: { riskType: risk.flagType },
      icon: 'ShieldCheck',
    });
  }

  // Get achievements
  const achievements = await prisma.achievement.findMany({
    where: { userId },
    orderBy: { earnedAt: 'desc' },
    take: 10,
  });

  for (const achievement of achievements) {
    records.push({
      id: `achievement-${achievement.id}`,
      type: 'achievement',
      title: achievement.title,
      description: achievement.description,
      date: achievement.earnedAt.toISOString(),
      metadata: { achievementId: achievement.id },
      icon: 'Trophy',
    });
  }

  records.push(...await generateLearningActivityGrowthRecords(userId));

  // Sort by date descending
  records.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return records;
}

async function generateLearningActivityGrowthRecords(userId: string): Promise<GrowthRecord[]> {
  // Keep only facts that the canonical portrait mapper rejects as contribution
  // evidence. The timeline wording stays generic and omits private context.
  const learningFacts = await prisma.learningFact.findMany({
    where: { userId },
    select: {
      id: true,
      startedAt: true,
      outcome: true,
      score: true,
      competencyContribution: true,
      contextJson: true,
      createdAt: true,
    },
    orderBy: { startedAt: 'desc' },
    take: 10,
  });
  const noPortraitContributionIds = new Set(
    mapLearningFactsToPortraitEvidence(learningFacts)
      .evidence
      .filter((evidence) => !isPortraitV2ProfileEvidence(evidence))
      .map((evidence) => evidence.id),
  );

  const records: GrowthRecord[] = [];
  for (const activity of learningFacts) {
    if (!noPortraitContributionIds.has(activity.id)) continue;
    records.push({
      id: `learning-activity-${activity.id}`,
      type: 'learning_activity',
      title: '已记录学习活动',
      description: '系统已记录一项学习活动；该活动暂未形成可展示的能力画像证据。',
      date: activity.startedAt.toISOString(),
      metadata: { source: 'learning-fact' },
      icon: 'BookOpen',
    });
  }

  return records;
}
