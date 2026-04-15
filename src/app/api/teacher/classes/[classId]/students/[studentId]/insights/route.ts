import { NextResponse } from 'next/server';

import {
  COMPETENCY_DIMENSIONS,
  calculateOverallScore,
  calculateTrendDirection,
  getCompetencyLabel,
  type CompetencyVector,
  type TrendVector,
} from '@/lib/data-governance/competency-model';
import { generateRecommendations } from '@/lib/data-governance/recommendation-engine';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createDatabaseUnavailableResponse, isDatabaseConnectivityError } from '@/lib/service-availability';
import { normalizeInsightRiskLevel, parseStringList } from '@/features/teacher/teacher-insights';

type TeacherStudentRiskItem = {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  triggeredAt: string;
  occurrenceCount: number;
  evidence: Record<string, unknown>;
};

type TeacherStudentGrowthItem = {
  id: string;
  title: string;
  description: string;
  recordType: string;
  occurredAt: string;
  evidence: Record<string, unknown>;
};

type TeacherStudentRecommendationItem = {
  id: string;
  type: string;
  title: string;
  description: string;
  reason: string;
  actionLabel: string;
  actionUrl: string;
  priority: number;
  estimatedTime?: string;
  tags: string[];
};

export interface TeacherStudentInsightsPayload {
  student: {
    id: string;
    name: string;
    email: string | null;
    studentNumber: string | null;
    classId: string;
    className: string;
  };
  overview: {
    overallScore: number;
    riskLevel: 'none' | 'low' | 'medium' | 'high';
    riskLabel: string;
    latestSnapshotAt: string | null;
    factCount: number;
    recommendedScaffolding: string;
  };
  snapshot: {
    current: {
      vector: CompetencyVector;
      snapshotAt: string;
      factCount: number;
    } | null;
    previous: {
      vector: CompetencyVector;
      snapshotAt: string;
    } | null;
    trendVector: TrendVector | null;
  };
  profileSummary: {
    overallLevel: string;
    recentTrend: string;
    trendDirection: string;
    strengths: string[];
    weaknesses: string[];
    recentActivities: string[];
  } | null;
  classComparison: Array<{
    dimension: string;
    label: string;
    studentScore: number;
    classAverage: number;
    gap: number;
  }>;
  riskFlags: TeacherStudentRiskItem[];
  growthRecords: TeacherStudentGrowthItem[];
  recommendations: TeacherStudentRecommendationItem[];
  evidenceSummary: Array<{
    dimension: string;
    label: string;
    items: Array<{ factType: string; outcome: string; score?: number }>;
  }>;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ classId: string; studentId: string }> }
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { classId, studentId } = await params;

    const classData = await prisma.class.findUnique({
      where: { id: classId },
      select: {
        id: true,
        name: true,
        teacherId: true,
      },
    });

    if (!classData) {
      return NextResponse.json({ error: '班级不存在' }, { status: 404 });
    }

    if (classData.teacherId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const studentProfile = await prisma.studentProfile.findFirst({
      where: {
        classId,
        userId: studentId,
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!studentProfile) {
      return NextResponse.json({ error: '学生不在该班级中' }, { status: 404 });
    }

    const [
      currentSnapshot,
      previousSnapshot,
      profileSummary,
      riskFlags,
      growthRecords,
      recommendations,
      classSnapshot,
    ] = await Promise.all([
      prisma.studentCompetencySnapshot.findFirst({
        where: { userId: studentId },
        orderBy: { snapshotAt: 'desc' },
      }),
      prisma.studentCompetencySnapshot.findFirst({
        where: {
          userId: studentId,
        },
        orderBy: { snapshotAt: 'desc' },
        skip: 1,
      }),
      prisma.studentProfileSummary.findUnique({
        where: { userId: studentId },
      }),
      prisma.studentRiskFlag.findMany({
        where: {
          userId: studentId,
          isResolved: false,
        },
        orderBy: { triggeredAt: 'desc' },
      }),
      prisma.growthRecord.findMany({
        where: { userId: studentId },
        orderBy: { occurredAt: 'desc' },
        take: 12,
      }),
      generateRecommendations(studentId),
      prisma.classCompetencySnapshot.findFirst({
        where: { classId },
        orderBy: { snapshotAt: 'desc' },
      }),
    ]);

    const currentVector = currentSnapshot?.competencyVector as CompetencyVector | null;
    const previousVector = previousSnapshot?.competencyVector as CompetencyVector | null;
    const trendVector = currentVector
      ? buildTrendVector(currentVector, previousVector)
      : null;
    const overallScore = currentVector ? roundTo(calculateOverallScore(currentVector), 1) : 0;
    const riskLevel = normalizeInsightRiskLevel(
      profileSummary?.riskLevel ??
        riskFlags.find((flag) => flag.severity)?.severity ??
        null
    );
    const classAggregate = (classSnapshot?.aggregateJson ?? {}) as Record<string, { mean?: number }>;
    const evidenceSummary = (currentSnapshot?.evidenceSummary ?? {}) as Record<
      string,
      Array<{ factType: string; outcome: string; score?: number }>
    >;

    const payload: TeacherStudentInsightsPayload = {
      student: {
        id: studentProfile.user.id,
        name: studentProfile.user.name || '未命名学生',
        email: studentProfile.user.email,
        studentNumber: studentProfile.studentNumber,
        classId,
        className: classData.name,
      },
      overview: {
        overallScore,
        riskLevel,
        riskLabel: getRiskLabel(riskLevel),
        latestSnapshotAt: currentSnapshot?.snapshotAt.toISOString() ?? null,
        factCount: currentSnapshot?.factCount ?? 0,
        recommendedScaffolding:
          profileSummary?.recommendedScaffolding || '当前暂无自动脚手架建议，可结合课堂观察补充判断。',
      },
      snapshot: {
        current: currentSnapshot
          ? {
              vector: currentVector!,
              snapshotAt: currentSnapshot.snapshotAt.toISOString(),
              factCount: currentSnapshot.factCount,
            }
          : null,
        previous: previousSnapshot
          ? {
              vector: previousVector!,
              snapshotAt: previousSnapshot.snapshotAt.toISOString(),
            }
          : null,
        trendVector,
      },
      profileSummary: profileSummary
        ? {
            overallLevel: profileSummary.overallLevel,
            recentTrend: profileSummary.recentTrend,
            trendDirection: profileSummary.trendDirection,
            strengths: parseStringList(profileSummary.strengthsJson),
            weaknesses: parseStringList(profileSummary.weaknessesJson),
            recentActivities: parseRecentActivities(profileSummary.recentActivityJson),
          }
        : null,
      classComparison: COMPETENCY_DIMENSIONS.map((dimension) => {
        const studentScore = currentVector?.[dimension]?.score ?? 0;
        const classAverage = roundTo(classAggregate[dimension]?.mean ?? 0, 1);
        return {
          dimension,
          label: getCompetencyLabel(dimension),
          studentScore: roundTo(studentScore, 1),
          classAverage,
          gap: roundTo(studentScore - classAverage, 1),
        };
      }),
      riskFlags: summarizeRiskFlags(riskFlags),
      growthRecords: growthRecords.map((record) => ({
        id: record.id,
        title: record.title,
        description: record.description,
        recordType: record.recordType,
        occurredAt: record.occurredAt.toISOString(),
        evidence: (record.evidenceJson ?? {}) as Record<string, unknown>,
      })),
      recommendations: recommendations.map((recommendation) => ({
        id: recommendation.id,
        type: recommendation.type,
        title: recommendation.title,
        description: recommendation.description,
        reason: recommendation.reason,
        actionLabel: recommendation.actionLabel,
        actionUrl: recommendation.actionUrl,
        priority: recommendation.priority,
        estimatedTime: recommendation.estimatedTime,
        tags: recommendation.tags,
      })),
      evidenceSummary: COMPETENCY_DIMENSIONS.map((dimension) => ({
        dimension,
        label: getCompetencyLabel(dimension),
        items: evidenceSummary[dimension] ?? [],
      })),
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error('[TeacherStudentInsights] Error:', error);
    if (isDatabaseConnectivityError(error)) {
      return createDatabaseUnavailableResponse();
    }
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

function buildTrendVector(current: CompetencyVector, previous: CompetencyVector | null): TrendVector {
  return COMPETENCY_DIMENSIONS.reduce((accumulator, dimension) => {
    const currentScore = current[dimension]?.score ?? 0;
    const previousScore = previous?.[dimension]?.score ?? currentScore;
    accumulator[dimension] = calculateTrendDirection(currentScore, previousScore, 3);
    return accumulator;
  }, {} as TrendVector);
}

function parseRecentActivities(value: unknown) {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => {
      if (typeof item === 'string') {
        return item;
      }

      if (item && typeof item === 'object') {
        const label =
          typeof (item as Record<string, unknown>).label === 'string'
            ? (item as Record<string, string>).label
            : typeof (item as Record<string, unknown>).title === 'string'
              ? (item as Record<string, string>).title
              : '';
        return label;
      }

      return '';
    })
    .filter((item) => item.length > 0);
}

function summarizeRiskFlags(
  flags: Array<{
    flagType: string;
    severity: string;
    description: string;
    triggeredAt: Date;
    evidenceJson: unknown;
  }>
): TeacherStudentRiskItem[] {
  const summaryMap = new Map<string, TeacherStudentRiskItem>();

  for (const flag of flags) {
    const key = `${flag.flagType}:${flag.severity}:${flag.description}`;
    const existing = summaryMap.get(key);

    if (!existing) {
      summaryMap.set(key, {
        type: flag.flagType,
        severity: flag.severity as 'low' | 'medium' | 'high',
        description: flag.description,
        triggeredAt: flag.triggeredAt.toISOString(),
        occurrenceCount: 1,
        evidence: (flag.evidenceJson ?? {}) as Record<string, unknown>,
      });
      continue;
    }

    existing.occurrenceCount += 1;
    if (flag.triggeredAt.getTime() > new Date(existing.triggeredAt).getTime()) {
      existing.triggeredAt = flag.triggeredAt.toISOString();
      existing.evidence = (flag.evidenceJson ?? {}) as Record<string, unknown>;
    }
  }

  return Array.from(summaryMap.values())
    .sort((left, right) => {
      const timeDiff =
        new Date(right.triggeredAt).getTime() - new Date(left.triggeredAt).getTime();
      if (timeDiff !== 0) return timeDiff;
      return right.occurrenceCount - left.occurrenceCount;
    })
    .slice(0, 6);
}

function getRiskLabel(level: 'none' | 'low' | 'medium' | 'high') {
  if (level === 'high') return '高风险';
  if (level === 'medium') return '中风险';
  if (level === 'low') return '低风险';
  return '风险平稳';
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
