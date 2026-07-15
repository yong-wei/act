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
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { buildClassScopedStudentProjections, CLASS_COMPETENCY_MATERIALIZATION_VERSION } from '@/lib/data-governance/class-scoped-learning-materialization';
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
  overallScore: number | null;
  overallLevel: string | null;
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
    overallIndex: number | null;
    highRiskStudents: number;
    mediumRiskStudents: number;
    attentionStudents: number;
    averageFactCount: number;
  };
  ability: {
    state: 'ready' | 'no-evidence';
    dimensions: Array<{
      dimension: CompetencyDimension;
      label: string;
      mean: number | null;
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
    const now = new Date();
    const currentEvidenceSince = new Date(now.getTime() - 30 * 24 * 60 * 60_000);
    const classSessionIds = studentIds.length
      ? (await prisma.classSession.findMany({
          where: { classId },
          select: { id: true },
        })).map((session) => session.id)
      : [];

    const [
      classSnapshot,
      arenaSubmissions,
      arenaLearningFacts,
      studentEvidenceFeatureCaches,
      classScopedEvidenceFactGroups,
      classScopedSimulationArenaFacts,
      recentSessionQualityReports,
    ] = await Promise.all([
      prisma.classCompetencySnapshot.findFirst({
        where: { classId, materializationVersion: CLASS_COMPETENCY_MATERIALIZATION_VERSION },
        orderBy: { snapshotAt: 'desc' },
      }),
      prismaArenaSubmissionStore.listSubmissions({ classId }),
      studentIds.length
        ? prisma.learningFact.findMany({
            where: {
              userId: { in: studentIds },
              factType: 'design',
              OR: buildTeacherScopedLearningFactScopeFilters(classId, classSessionIds),
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
              startedAt: { gte: currentEvidenceSince },
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
              startedAt: { gte: currentEvidenceSince },
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

    const cacheHealthByUserId = new Map(
      studentEvidenceFeatureCaches.map((cache) => [cache.userId, cache])
    );
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
    const classScopedProjectionMap = buildClassScopedStudentProjections(studentIds, classScopedSimulationArenaFacts as any);
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

    const hasCurrentClassEvidence = classScopedEvidenceFactGroups.some((group) => group._count._all > 0)
      || classScopedSimulationArenaFacts.length > 0;
    const noClassEvidence = !hasCurrentClassEvidence;
    const students: TeacherClassInsightStudent[] = classData.students.map((studentProfile) => {
      const scopedProjection = classScopedProjectionMap.get(studentProfile.userId);
      const hasCurrentEvidence = evidenceStatusMap.get(studentProfile.userId)?.state === 'ready' && Boolean(
        scopedProjection && scopedProjection.factCount > 0
      );
      const vector = scopedProjection?.competencyVector;
      const fallbackScore = vector ? calculateOverallScore(vector) : 0;
      const overallScore = hasCurrentEvidence
        ? Math.round(fallbackScore * 10) / 10
        : null;
      const riskLevel = normalizeInsightRiskLevel(null);

      return {
        id: studentProfile.user.id,
        name: studentProfile.user.name || '未命名学生',
        email: studentProfile.user.email,
        studentNumber: studentProfile.studentNumber,
        overallScore,
        overallLevel:
          hasCurrentEvidence && overallScore !== null
            ? COMPETENCY_LEVELS[getCompetencyLevelKey(overallScore)].label
            : null,
        riskLevel,
        riskLabel: getRiskLabel(riskLevel),
        trendDirection:
          'stable',
        recentTrend: hasCurrentEvidence ? '班级范围内暂无可比趋势' : '暂无当前证据',
        strengths: [],
        weaknesses: [],
        riskBadges: [],
        growthRecordCount: 0,
        recommendationCount: 0,
        factCount: hasCurrentEvidence ? scopedProjection?.factCount ?? 0 : 0,
        lastSnapshotAt: hasCurrentEvidence ? classSnapshot?.snapshotAt.toISOString() ?? null : null,
        evidenceStatus: evidenceStatusMap.get(studentProfile.userId)!,
      };
    });

    const coverageStudents = students.filter(
      (student) => student.factCount > 0
    ).length;
    const latestStudentSnapshotAt = classSnapshot?.snapshotAt.toISOString() ?? null;
    const governanceBase = summarizeGovernanceState({
      totalStudents,
      coveredStudents: coverageStudents,
      classSnapshotAt: classSnapshot?.snapshotAt.toISOString() ?? null,
      latestStudentSnapshotAt,
    });

    const dimensionStats = COMPETENCY_DIMENSIONS.map((dimension) => {
      const classMean = noClassEvidence ? null : extractClassMean(classSnapshot?.aggregateJson, dimension);
      const classStdDev = extractClassStdDev(classSnapshot?.aggregateJson, dimension);
      const fallbackScores = [...classScopedProjectionMap.values()]
        .map((projection) => {
          const vector = projection.competencyVector;
          return vector?.[dimension]?.score ?? 0;
        })
        .filter((score) => Number.isFinite(score));
      const fallbackMean = fallbackScores.length
        ? roundTo(fallbackScores.reduce((sum, score) => sum + score, 0) / fallbackScores.length, 1)
        : 0;
      return {
        dimension,
        label: getCompetencyLabel(dimension),
        mean: noClassEvidence ? null : classMean ?? fallbackMean,
        stdDev: classStdDev ?? 0,
      };
    });

    const levelDistribution =
      normalizeLevelDistribution(classSnapshot?.levelDistribution) ||
      students.reduce<LevelDistribution>(
        (accumulator, student) => {
          if (student.overallScore !== null) accumulator[getCompetencyLevelKey(student.overallScore)] += 1;
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
    const spotlightStudents = noClassEvidence ? [] : rankStudentsByAttention(
      students
        .filter((student): student is TeacherClassInsightStudent & { overallScore: number } => student.overallScore !== null)
        .map((student) => ({
          id: student.id,
          name: student.name,
          overallScore: student.overallScore,
          overallLevel: student.overallLevel ?? COMPETENCY_LEVELS[getCompetencyLevelKey(student.overallScore)].label,
          riskLevel: student.riskLevel,
          trendDirection: student.trendDirection,
          recentTrend: student.recentTrend,
          strengths: student.strengths,
          weaknesses: student.weaknesses,
          growthRecordCount: student.growthRecordCount,
          recommendationCount: student.recommendationCount,
        }))
    ).slice(0, 5).map((ranked) => students.find((student) => student.id === ranked.id)!);

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
        overallIndex: noClassEvidence ? null : roundTo(
          dimensionStats.reduce((sum, item) => sum + (item.mean ?? 0), 0) / dimensionStats.length,
          1
        ),
        highRiskStudents: noClassEvidence ? 0 : students.filter((student) => student.riskLevel === 'high').length,
        mediumRiskStudents: noClassEvidence ? 0 : students.filter((student) => student.riskLevel === 'medium').length,
        attentionStudents: noClassEvidence ? 0 : students.filter((student) =>
          student.riskLevel === 'high' ||
          student.riskLevel === 'medium' ||
          (student.overallScore ?? Number.POSITIVE_INFINITY) < COMPETENCY_LEVELS.average.min
        ).length,
        averageFactCount: roundTo(
          students.reduce((sum, student) => sum + student.factCount, 0) / (students.length || 1),
          1
        ),
      },
      ability: {
        state: noClassEvidence ? 'no-evidence' : 'ready',
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
      spotlightStudents,
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
