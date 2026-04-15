import { NextResponse } from 'next/server';

import {
  COMPETENCY_DIMENSIONS,
  COMPETENCY_LEVELS,
  calculateOverallScore,
  getCompetencyLabel,
  type CompetencyDimension,
  type CompetencyVector,
} from '@/lib/data-governance/competency-model';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createDatabaseUnavailableResponse, isDatabaseConnectivityError } from '@/lib/service-availability';
import {
  normalizeInsightRiskLevel,
  parseStringList,
  rankStudentsByAttention,
  summarizeGovernanceState,
} from '@/features/teacher/teacher-insights';

type LevelDistribution = Record<keyof typeof COMPETENCY_LEVELS, number>;

interface TeacherClassInsightStudent {
  id: string;
  name: string;
  email: string | null;
  studentNumber: string | null;
  overallScore: number;
  overallLevel: string;
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  riskLabel: string;
  trendDirection: 'up' | 'stable' | 'down';
  recentTrend: string;
  strengths: string[];
  weaknesses: string[];
  riskBadges: string[];
  growthRecordCount: number;
  recommendationCount: number;
  factCount: number;
  lastSnapshotAt: string | null;
}

export interface TeacherClassInsightsPayload {
  classInfo: {
    id: string;
    name: string;
    code: string;
    description: string | null;
    semester: string | null;
    year: string | null;
    studentCount: number;
  };
  governance: ReturnType<typeof summarizeGovernanceState> & {
    totalStudents: number;
    coveredStudents: number;
    pendingStudents: number;
    classSnapshotAt: string | null;
    latestStudentSnapshotAt: string | null;
  };
  overview: {
    overallIndex: number;
    highRiskStudents: number;
    mediumRiskStudents: number;
    attentionStudents: number;
    averageFactCount: number;
  };
  ability: {
    dimensions: Array<{
      dimension: CompetencyDimension;
      label: string;
      mean: number;
      stdDev: number;
    }>;
    levelDistribution: LevelDistribution;
  };
  spotlightStudents: TeacherClassInsightStudent[];
  students: TeacherClassInsightStudent[];
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { classId } = await params;

    const classData = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        students: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });

    if (!classData) {
      return NextResponse.json({ error: '班级不存在' }, { status: 404 });
    }

    if (classData.teacherId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const studentIds = classData.students.map((student) => student.userId);
    const totalStudents = studentIds.length;

    const [
      classSnapshot,
      latestSnapshots,
      profileSummaries,
      riskFlags,
      growthCounts,
      recommendationCounts,
    ] = await Promise.all([
      prisma.classCompetencySnapshot.findFirst({
        where: { classId },
        orderBy: { snapshotAt: 'desc' },
      }),
      studentIds.length
        ? prisma.studentCompetencySnapshot.findMany({
            where: { userId: { in: studentIds } },
            orderBy: { snapshotAt: 'desc' },
            distinct: ['userId'],
          })
        : Promise.resolve([]),
      studentIds.length
        ? prisma.studentProfileSummary.findMany({
            where: { userId: { in: studentIds } },
          })
        : Promise.resolve([]),
      studentIds.length
        ? prisma.studentRiskFlag.findMany({
            where: {
              userId: { in: studentIds },
              isResolved: false,
            },
            orderBy: { triggeredAt: 'desc' },
          })
        : Promise.resolve([]),
      studentIds.length
        ? prisma.growthRecord.groupBy({
            by: ['userId'],
            where: { userId: { in: studentIds } },
            _count: { _all: true },
          })
        : Promise.resolve([]),
      studentIds.length
        ? prisma.learningRecommendation.groupBy({
            by: ['userId'],
            where: {
              userId: { in: studentIds },
              isCompleted: false,
            },
            _count: { _all: true },
          })
        : Promise.resolve([]),
    ]);

    const snapshotMap = new Map(latestSnapshots.map((snapshot) => [snapshot.userId, snapshot]));
    const summaryMap = new Map(profileSummaries.map((summary) => [summary.userId, summary]));
    const growthMap = new Map(growthCounts.map((entry) => [entry.userId, entry._count._all]));
    const recommendationMap = new Map(
      recommendationCounts.map((entry) => [entry.userId, entry._count._all])
    );
    const riskMap = riskFlags.reduce((accumulator, flag) => {
      const current = accumulator.get(flag.userId) ?? [];
      current.push(flag);
      accumulator.set(flag.userId, current);
      return accumulator;
    }, new Map<string, typeof riskFlags>());

    const students: TeacherClassInsightStudent[] = classData.students.map((studentProfile) => {
      const snapshot = snapshotMap.get(studentProfile.userId);
      const summary = summaryMap.get(studentProfile.userId);
      const studentRiskFlags = riskMap.get(studentProfile.userId) ?? [];
      const vector = snapshot?.competencyVector as CompetencyVector | undefined;
      const fallbackScore = vector ? calculateOverallScore(vector) : 0;
      const overallScore = Math.round((summary?.overallScore ?? fallbackScore) * 10) / 10;
      const riskLevel = normalizeInsightRiskLevel(
        summary?.riskLevel ??
          studentRiskFlags.find((flag) => flag.severity)?.severity ??
          null
      );

      return {
        id: studentProfile.user.id,
        name: studentProfile.user.name || '未命名学生',
        email: studentProfile.user.email,
        studentNumber: studentProfile.studentNumber,
        overallScore,
        overallLevel:
          summary?.overallLevel ||
          COMPETENCY_LEVELS[getCompetencyLevelKey(overallScore)].label,
        riskLevel,
        riskLabel: getRiskLabel(riskLevel),
        trendDirection:
          summary?.trendDirection === 'up' || summary?.trendDirection === 'down'
            ? summary.trendDirection
            : 'stable',
        recentTrend: summary?.recentTrend || '近期暂无治理趋势',
        strengths: parseStringList(summary?.strengthsJson),
        weaknesses: parseStringList(summary?.weaknessesJson),
        riskBadges:
          parseStringList(summary?.riskFlagsJson).length > 0
            ? parseStringList(summary?.riskFlagsJson)
            : studentRiskFlags.map((flag) => flag.description),
        growthRecordCount: growthMap.get(studentProfile.userId) ?? 0,
        recommendationCount: recommendationMap.get(studentProfile.userId) ?? 0,
        factCount: snapshot?.factCount ?? 0,
        lastSnapshotAt: snapshot?.snapshotAt.toISOString() ?? null,
      };
    });

    const coverageStudents = students.filter(
      (student) => student.lastSnapshotAt || student.overallScore > 0 || student.riskBadges.length > 0
    ).length;
    const latestStudentSnapshotAt =
      latestSnapshots[0]?.snapshotAt.toISOString() ?? null;
    const governanceBase = summarizeGovernanceState({
      totalStudents,
      coveredStudents: coverageStudents,
      classSnapshotAt: classSnapshot?.snapshotAt.toISOString() ?? null,
      latestStudentSnapshotAt,
    });

    const dimensionStats = COMPETENCY_DIMENSIONS.map((dimension) => {
      const classMean = extractClassMean(classSnapshot?.aggregateJson, dimension);
      const classStdDev = extractClassStdDev(classSnapshot?.aggregateJson, dimension);
      const fallbackScores = latestSnapshots
        .map((snapshot) => {
          const vector = snapshot.competencyVector as unknown as CompetencyVector;
          return vector?.[dimension]?.score ?? 0;
        })
        .filter((score) => Number.isFinite(score));
      const fallbackMean = fallbackScores.length
        ? roundTo(fallbackScores.reduce((sum, score) => sum + score, 0) / fallbackScores.length, 1)
        : 0;
      return {
        dimension,
        label: getCompetencyLabel(dimension),
        mean: classMean ?? fallbackMean,
        stdDev: classStdDev ?? 0,
      };
    });

    const levelDistribution =
      normalizeLevelDistribution(classSnapshot?.levelDistribution) ||
      students.reduce<LevelDistribution>(
        (accumulator, student) => {
          accumulator[getCompetencyLevelKey(student.overallScore)] += 1;
          return accumulator;
        },
        createEmptyLevelDistribution()
      );

    const payload: TeacherClassInsightsPayload = {
      classInfo: {
        id: classData.id,
        name: classData.name,
        code: classData.code,
        description: classData.description,
        semester: classData.semester,
        year: classData.year,
        studentCount: totalStudents,
      },
      governance: {
        ...governanceBase,
        totalStudents,
        coveredStudents: coverageStudents,
        pendingStudents: Math.max(totalStudents - coverageStudents, 0),
        classSnapshotAt: classSnapshot?.snapshotAt.toISOString() ?? null,
        latestStudentSnapshotAt,
      },
      overview: {
        overallIndex: roundTo(
          dimensionStats.reduce((sum, item) => sum + item.mean, 0) / dimensionStats.length,
          1
        ),
        highRiskStudents: students.filter((student) => student.riskLevel === 'high').length,
        mediumRiskStudents: students.filter((student) => student.riskLevel === 'medium').length,
        attentionStudents: students.filter((student) =>
          student.riskLevel === 'high' ||
          student.riskLevel === 'medium' ||
          student.overallScore < COMPETENCY_LEVELS.average.min
        ).length,
        averageFactCount: roundTo(
          students.reduce((sum, student) => sum + student.factCount, 0) / (students.length || 1),
          1
        ),
      },
      ability: {
        dimensions: dimensionStats,
        levelDistribution,
      },
      spotlightStudents: rankStudentsByAttention(students).slice(0, 5),
      students,
    };

    return NextResponse.json(payload);
  } catch (error) {
    console.error('[TeacherClassInsights] Error:', error);
    if (isDatabaseConnectivityError(error)) {
      return createDatabaseUnavailableResponse();
    }
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

function createEmptyLevelDistribution(): LevelDistribution {
  return {
    excellent: 0,
    good: 0,
    average: 0,
    needsImprovement: 0,
    atRisk: 0,
  };
}

function getCompetencyLevelKey(score: number): keyof typeof COMPETENCY_LEVELS {
  if (score >= COMPETENCY_LEVELS.excellent.min) return 'excellent';
  if (score >= COMPETENCY_LEVELS.good.min) return 'good';
  if (score >= COMPETENCY_LEVELS.average.min) return 'average';
  if (score >= COMPETENCY_LEVELS.needsImprovement.min) return 'needsImprovement';
  return 'atRisk';
}

function getRiskLabel(level: 'none' | 'low' | 'medium' | 'high') {
  if (level === 'high') return '高风险';
  if (level === 'medium') return '中风险';
  if (level === 'low') return '低风险';
  return '风险平稳';
}

function extractClassMean(aggregate: unknown, dimension: CompetencyDimension) {
  if (!aggregate || typeof aggregate !== 'object') return null;
  const entry = (aggregate as Record<string, { mean?: number }>)[dimension];
  return typeof entry?.mean === 'number' ? roundTo(entry.mean, 1) : null;
}

function extractClassStdDev(aggregate: unknown, dimension: CompetencyDimension) {
  if (!aggregate || typeof aggregate !== 'object') return null;
  const entry = (aggregate as Record<string, { stdDev?: number }>)[dimension];
  return typeof entry?.stdDev === 'number' ? roundTo(entry.stdDev, 1) : null;
}

function normalizeLevelDistribution(value: unknown): LevelDistribution | null {
  if (!value || typeof value !== 'object') return null;

  return {
    excellent: toCount((value as Record<string, unknown>).excellent),
    good: toCount((value as Record<string, unknown>).good),
    average: toCount((value as Record<string, unknown>).average),
    needsImprovement: toCount((value as Record<string, unknown>).needsImprovement),
    atRisk: toCount((value as Record<string, unknown>).atRisk),
  };
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function toCount(value: unknown) {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}
