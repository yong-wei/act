import { NextResponse } from 'next/server';

import {
  COMPETENCY_LEVELS,
} from '@/lib/data-governance/competency-model';
import { PORTRAIT_V2_DIMENSIONS, type PortraitV2DimensionId } from '@/lib/data-governance/kaq-objective-taxonomy';
import {
  hasPortraitV2Evidence,
  resolvePrimaryPortraitV2,
  summarizePortraitV2,
  type PortraitV2ConsumerSummary,
} from '@/lib/data-governance/portrait-v2-consumer';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createDatabaseUnavailableResponse, isDatabaseConnectivityError } from '@/lib/service-availability';
import {
  normalizeInsightRiskLevel,
  parseStringList,
  rankStudentsByAttention,
  summarizeGovernanceState,
} from '@/features/teacher/teacher-insights';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  buildArenaClassEvidenceSummary,
  type ArenaClassEvidenceSummary,
} from '@/features/arena/evidence-summary';
import { prismaArenaSubmissionStore } from '@/features/arena/submissions/prisma-store';
import {
  buildTeacherClassScopedEvidenceStatusMap,
  buildTeacherScopedLearningFactScopeFilters,
  buildTeacherScopedSimulationArenaFeatureMap,
  summarizeTeacherEvidenceCoverage,
  summarizeTeacherSessionQualityReports,
  type TeacherRecentSessionQualitySummary,
  type TeacherStudentEvidenceStatus,
} from '@/lib/data-governance/teacher-evidence-governance';
import { STUDENT_EVIDENCE_FEATURE_LEARNING_FACT_SELECT } from '@/lib/data-governance/student-evidence-feature-cache';
import {
  createPrismaDiagnosisReportSnapshotStore,
  hasDiagnosisReportSnapshotPersistenceTable,
  readLatestControlCorrectionDiagnosisReportSnapshotFromPersistence,
} from '@/lib/data-governance/control-correction-diagnosis-profile';
import {
  materializeRoleBasedLearningDiagnosis,
  type RoleBasedLearningDiagnosis,
} from '@/lib/data-governance/role-based-learning-diagnosis';

export const dynamic = 'force-dynamic';

type LevelDistribution = Record<keyof typeof COMPETENCY_LEVELS, number>;

interface TeacherClassInsightStudent {
  id: string;
  name: string;
  email: string | null;
  studentNumber: string | null;
  overallScore: number;
  overallScoreSource: 'portrait-v2' | 'profile-summary-compatibility';
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
  portraitV2: PortraitV2ConsumerSummary;
  evidenceStatus: TeacherStudentEvidenceStatus;
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
    evidenceCoverage: ReturnType<typeof summarizeTeacherEvidenceCoverage>;
    recentSessionQuality: TeacherRecentSessionQualitySummary;
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
      dimension: PortraitV2DimensionId;
      label: string;
      mean: number;
      stdDev: number;
    }>;
    levelDistribution: LevelDistribution;
  };
  arena: ArenaClassEvidenceSummary;
  diagnosis: RoleBasedLearningDiagnosis;
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
    const classSessionIds = studentIds.length
      ? (await prisma.classSession.findMany({
          where: { classId },
          select: { id: true },
        })).map((session) => session.id)
      : [];

    const [
      classSnapshot,
      latestSnapshots,
      profileSummaries,
      riskFlags,
      growthCounts,
      recommendationCounts,
      arenaSubmissions,
      arenaLearningFacts,
      studentEvidenceFeatureCaches,
      classScopedEvidenceFactGroups,
      classScopedSimulationArenaFacts,
      recentSessionQualityReports,
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
      prismaArenaSubmissionStore.listSubmissions({ classId }),
      studentIds.length
        ? prisma.learningFact.findMany({
            where: {
              userId: { in: studentIds },
              factType: 'design',
            },
            orderBy: { startedAt: 'desc' },
            take: 200,
            select: {
              factType: true,
              moduleId: true,
              outcome: true,
              score: true,
              contextJson: true,
            },
          })
        : Promise.resolve([]),
      studentIds.length
        ? prisma.studentEvidenceFeatureCache.findMany({
            where: { userId: { in: studentIds } },
            select: {
              userId: true,
              payloadVersion: true,
              refreshedAt: true,
              statusMarkers: true,
              features: true,
            },
          })
        : Promise.resolve([]),
      studentIds.length
        ? prisma.learningFact.groupBy({
            by: ['userId', 'factType'],
            where: {
              userId: { in: studentIds },
              OR: buildTeacherScopedLearningFactScopeFilters(classId, classSessionIds),
            },
            _count: { _all: true },
            _min: { startedAt: true },
            _max: { startedAt: true },
          })
        : Promise.resolve([]),
      studentIds.length
        ? prisma.learningFact.findMany({
            where: {
              userId: { in: studentIds },
              OR: buildTeacherScopedLearningFactScopeFilters(classId, classSessionIds),
            },
            orderBy: { startedAt: 'desc' },
            select: STUDENT_EVIDENCE_FEATURE_LEARNING_FACT_SELECT,
          })
        : Promise.resolve([]),
      prisma.classSessionReport.findMany({
        where: {
          reportType: 'class-summary',
          session: { classId },
        },
        orderBy: { updatedAt: 'desc' },
        take: 8,
        select: {
          sessionId: true,
          lessonKey: true,
          status: true,
          summary: true,
          reportData: true,
          updatedAt: true,
          session: {
            select: {
              id: true,
              startTime: true,
              endTime: true,
              plan: {
                select: { title: true },
              },
            },
          },
        },
      }),
    ]);

    const snapshotMap = new Map(latestSnapshots.map((snapshot) => [snapshot.userId, snapshot]));
    const summaryMap = new Map(profileSummaries.map((summary) => [summary.userId, summary]));
    const growthMap = new Map(growthCounts.map((entry) => [entry.userId, entry._count._all]));
    const recommendationMap = new Map(
      recommendationCounts.map((entry) => [entry.userId, entry._count._all])
    );
    const riskByUserId = riskFlags.reduce<Record<string, typeof riskFlags>>(
      (accumulator, flag) => {
        accumulator[flag.userId] = [
          ...(accumulator[flag.userId] ?? []),
          flag,
        ];
        return accumulator;
      },
      {},
    );
    const cacheHealthByUserId = new Map(
      studentEvidenceFeatureCaches.map((cache) => [cache.userId, cache])
    );
    const resolvedPortraits = await Promise.all(studentIds.map(async (studentId) => {
        const resolution = await resolvePrimaryPortraitV2(prisma, studentId, 'reviewer', {
          legacySnapshot: snapshotMap.get(studentId) as Record<string, unknown> | null,
          featureCache: cacheHealthByUserId.get(studentId) as Record<string, unknown> | null,
        });
        return [studentId, resolution] as const;
      }));
    const portraitByUserId = new Map(
      resolvedPortraits
        .filter(([, resolution]) => hasPortraitV2Evidence(resolution.primaryPortrait))
        .map(([studentId, resolution]) => [studentId, summarizePortraitV2(resolution.primaryPortrait)] as const),
    );
    const now = new Date();
    const scopedSimulationArenaByUserId = buildTeacherScopedSimulationArenaFeatureMap(
      studentIds,
      classScopedSimulationArenaFacts,
      {
        classId,
        sessionIds: classSessionIds,
        now,
      },
    );
    const evidenceStatusMap = buildTeacherClassScopedEvidenceStatusMap(studentIds, classScopedEvidenceFactGroups, {
      now,
      cacheHealthByUserId,
      scopedSimulationArenaByUserId,
    });
    const evidenceCoverage = summarizeTeacherEvidenceCoverage(evidenceStatusMap.values());
    const recentSessionQuality = summarizeTeacherSessionQualityReports(recentSessionQualityReports);
    const diagnosisReportSnapshot = await hasDiagnosisReportSnapshotPersistenceTable(prisma)
      ? await readLatestControlCorrectionDiagnosisReportSnapshotFromPersistence(
        createPrismaDiagnosisReportSnapshotStore(prisma.diagnosisReportSnapshot),
        {
          view: 'teacher-class',
          goalId: 'control-correction',
          userId: session.user.id,
          classId,
          teacherClassIds: [classId],
        }
      )
      : null;

    const students: TeacherClassInsightStudent[] = classData.students.map((studentProfile) => {
      const snapshot = snapshotMap.get(studentProfile.userId);
      const summary = summaryMap.get(studentProfile.userId);
      const portraitV2 = portraitByUserId.get(studentProfile.userId) ?? summarizePortraitV2({
        userId: studentProfile.userId,
        payloadVersion: 'learner-portrait.v2',
        migrationVersion: 'portrait-v2-migration.v1',
        generatedAt: new Date().toISOString(),
        derivation: { kind: 'compatibility-derived', limitations: ['missing-native-portrait-v2-evidence'] },
        dimensions: [],
      });
      const studentRiskFlags = riskByUserId[studentProfile.userId] ?? [];
      const hasPortraitEvidence = portraitV2.dimensions.some((dimension) => dimension.evidenceCount > 0);
      const overallScore = Math.round(
        (hasPortraitEvidence ? portraitV2.overallScore : summary?.overallScore ?? portraitV2.overallScore) * 10
      ) / 10;
      const riskLevel = normalizeInsightRiskLevel(
        summary?.riskLevel ??
          studentRiskFlags.find((flag) => flag.severity)?.severity ??
          null
      );
      const portraitFactCount = portraitV2.dimensions.reduce(
        (count, dimension) => count + dimension.evidenceCount,
        0,
      );

      return {
        id: studentProfile.user.id,
        name: studentProfile.user.name || '未命名学生',
        email: studentProfile.user.email,
        studentNumber: studentProfile.studentNumber,
        overallScore,
        overallScoreSource: hasPortraitEvidence ? 'portrait-v2' : 'profile-summary-compatibility',
        overallLevel:
          hasPortraitEvidence
            ? COMPETENCY_LEVELS[getCompetencyLevelKey(overallScore)].label
            : summary?.overallLevel || COMPETENCY_LEVELS[getCompetencyLevelKey(overallScore)].label,
        riskLevel,
        riskLabel: getRiskLabel(riskLevel),
        trendDirection:
          summary?.trendDirection === 'up' || summary?.trendDirection === 'down'
            ? summary.trendDirection
            : 'stable',
        recentTrend: summary?.recentTrend || '近期暂无治理趋势',
        strengths: portraitV2.strengths.map((id) => portraitV2.dimensions.find((dimension) => dimension.id === id)?.label ?? id),
        weaknesses: portraitV2.weaknesses.map((id) => portraitV2.dimensions.find((dimension) => dimension.id === id)?.label ?? id),
        riskBadges:
          parseStringList(summary?.riskFlagsJson).length > 0
            ? parseStringList(summary?.riskFlagsJson)
            : studentRiskFlags.map((flag) => flag.description),
        growthRecordCount: growthMap.get(studentProfile.userId) ?? 0,
        recommendationCount: recommendationMap.get(studentProfile.userId) ?? 0,
        factCount: hasPortraitEvidence ? portraitFactCount : snapshot?.factCount ?? 0,
        lastSnapshotAt: hasPortraitEvidence ? portraitV2.generatedAt : snapshot?.snapshotAt.toISOString() ?? null,
        portraitV2,
        evidenceStatus: evidenceStatusMap.get(studentProfile.userId)!,
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

    const dimensionStats = PORTRAIT_V2_DIMENSIONS.map(({ id: dimension, label }) => {
      const classMean = extractClassMean(classSnapshot?.aggregateJson, dimension);
      const classStdDev = extractClassStdDev(classSnapshot?.aggregateJson, dimension);
      const fallbackScores = [...portraitByUserId.values()].flatMap((portrait) => {
        const portraitDimension = portrait.dimensions.find((item) => item.id === dimension);
        return portraitDimension && portraitDimension.evidenceCount > 0 && Number.isFinite(portraitDimension.score)
          ? [portraitDimension.score]
          : [];
      });
      const fallbackMean = fallbackScores.length
        ? roundTo(fallbackScores.reduce((sum, score) => sum + score, 0) / fallbackScores.length, 1)
        : 0;
      return {
        dimension,
        label,
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
    const diagnosis = materializeRoleBasedLearningDiagnosis({
      view: 'teacher-class',
      goalId: 'control-correction',
      userId: session.user.id,
      classId,
      teacherClassIds: [classId],
      teacherReport: {
        classInfo: {
          classId,
          studentCount: totalStudents,
        },
        metrics: {
          evidenceCoverage: {
            sourceCoverage: {
              readyStudents: evidenceCoverage.readyStudents,
              staleStudents: evidenceCoverage.staleStudents,
              missingStudents: evidenceCoverage.missingStudents,
              lowConfidenceStudents: evidenceCoverage.lowConfidenceStudents,
            },
            denominator: totalStudents,
          },
        },
        studentDrilldowns: students.map((student) => ({ userId: student.id })),
      },
      diagnosisReportSnapshot,
    });

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
        evidenceCoverage,
        recentSessionQuality,
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
      arena: buildArenaClassEvidenceSummary({
        classId,
        expectedStudentCount: totalStudents,
        submissions: arenaSubmissions,
        learningFacts: arenaLearningFacts,
      }),
      diagnosis,
      spotlightStudents: rankStudentsByAttention(students).slice(0, 5),
      students,
    };

    return NextResponse.json(payload);
  } catch (error) {
    rethrowIfNextDynamicError(error);
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

function extractClassMean(aggregate: unknown, dimension: PortraitV2DimensionId) {
  if (!aggregate || typeof aggregate !== 'object') return null;
  const record = aggregate as Record<string, unknown>;
  const entry = (record.dimensions && typeof record.dimensions === 'object'
    ? (record.dimensions as Record<string, { mean?: number }>)[dimension]
    : record[dimension]) as { mean?: number } | undefined;
  return typeof entry?.mean === 'number' ? roundTo(entry.mean, 1) : null;
}

function extractClassStdDev(aggregate: unknown, dimension: PortraitV2DimensionId) {
  if (!aggregate || typeof aggregate !== 'object') return null;
  const record = aggregate as Record<string, unknown>;
  const entry = (record.dimensions && typeof record.dimensions === 'object'
    ? (record.dimensions as Record<string, { stdDev?: number }>)[dimension]
    : record[dimension]) as { stdDev?: number } | undefined;
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
