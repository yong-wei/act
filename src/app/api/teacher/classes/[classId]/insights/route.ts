import { NextResponse } from 'next/server';

import {
  COMPETENCY_LEVELS,
  calculateOverallScore,
} from '@/lib/data-governance/competency-model';
import { PORTRAIT_V2_DIMENSIONS, type PortraitV2DimensionId } from '@/lib/data-governance/kaq-objective-taxonomy';
import {
  summarizePortraitV2,
  hasPortraitV2Evidence,
  type PortraitV2ConsumerSummary,
} from '@/lib/data-governance/portrait-v2-consumer';
import {
  derivePortraitV2Compatibility,
  projectPortraitV2ForConsumer,
  readLatestValidNativePortraitV2Snapshots,
} from '@/lib/data-governance/portrait-v2-model';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { createDatabaseUnavailableResponse, isDatabaseConnectivityError } from '@/lib/service-availability';
import {
  normalizeInsightRiskLevel,
  rankStudentsByAttention,
  summarizeGovernanceState,
} from '@/features/teacher/teacher-insights';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  buildClassScopedStudentProjections,
  CLASS_COMPETENCY_MATERIALIZATION_VERSION,
  CUMULATIVE_CLASS_COMPETENCY_MATERIALIZATION_VERSION,
} from '@/lib/data-governance/class-scoped-learning-materialization';
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
import {
  getTeacherAttainmentScopeLabel,
  parseTeacherAttainmentScope,
  type TeacherAttainmentScope,
} from '@/lib/data-governance/teacher-attainment-scope';

export const dynamic = 'force-dynamic';

type LifecycleBoundary = 'no-recent-evidence' | 'no-evidence-after-revocation';

function readLifecycleBoundary(snapshot: unknown): LifecycleBoundary | null {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return null;
  const evidenceSummary = (snapshot as { evidenceSummary?: unknown }).evidenceSummary;
  if (!evidenceSummary || typeof evidenceSummary !== 'object' || Array.isArray(evidenceSummary)) return null;
  const derivation = (evidenceSummary as { _derivation?: unknown })._derivation;
  if (!derivation || typeof derivation !== 'object' || Array.isArray(derivation)) return null;
  const state = (derivation as { state?: unknown }).state;
  return state === 'no-recent-evidence' || state === 'no-evidence-after-revocation'
    ? state
    : null;
}

type LevelDistribution = Record<keyof typeof COMPETENCY_LEVELS, number>;

interface TeacherClassInsightStudent {
  id: string;
  name: string;
  email: string | null;
  studentNumber: string | null;
  overallScore: number | null;
  overallLevel: string | null;
  overallScoreSource: 'class-scoped-compatibility' | 'native-portrait-v2' | null;
  riskLevel: 'none' | 'low' | 'medium' | 'high' | null;
  riskLabel: string | null;
  trendDirection: 'up' | 'stable' | 'down' | null;
  recentTrend: string | null;
  strengths: string[];
  weaknesses: string[];
  riskBadges: string[];
  growthRecordCount: number;
  recommendationCount: number;
  factCount: number;
  lastSnapshotAt: string | null;
  portraitV2: PortraitV2ConsumerSummary | null;
  evidenceStatus: TeacherStudentEvidenceStatus;
}

export interface TeacherClassInsightsPayload {
  scope: TeacherAttainmentScope;
  scopeLabel: string;
  nearStageChangeApplicable: boolean;
  recentSignalsApplicable: boolean;
  recentOnlySignals: Array<'activity' | 'risk' | 'classroom-quality' | 'trend'>;
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
    highRiskStudents: number | null;
    mediumRiskStudents: number | null;
    attentionStudents: number | null;
    averageFactCount: number;
  };
  ability: {
    state: 'ready' | 'no-evidence';
    dimensions: Array<{
      dimension: PortraitV2DimensionId;
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
  request: Request,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { classId } = await params;
    const scope = parseTeacherAttainmentScope(new URL(request.url).searchParams.get('scope'));
    if (!scope) {
      return NextResponse.json({ error: '无效的学情范围' }, { status: 400 });
    }

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
      latestSnapshots,
      arenaSubmissions,
      arenaLearningFacts,
      studentEvidenceFeatureCaches,
      classScopedEvidenceFactGroups,
      classScopedSimulationArenaFacts,
      recentSessionQualityReports,
      nativePortraitByUserId,
    ] = await Promise.all([
      prisma.classCompetencySnapshot.findFirst({
        where: {
          classId,
          materializationVersion: scope === 'cumulative'
            ? CUMULATIVE_CLASS_COMPETENCY_MATERIALIZATION_VERSION
            : CLASS_COMPETENCY_MATERIALIZATION_VERSION,
        },
        orderBy: { snapshotAt: 'desc' },
      }),
      studentIds.length
        ? prisma.studentCompetencySnapshot.findMany({
            where: { userId: { in: studentIds } },
            orderBy: { snapshotAt: 'desc' },
            distinct: ['userId'],
          })
        : Promise.resolve([]),
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
      scope === 'cumulative'
        ? readLatestValidNativePortraitV2Snapshots(prisma, studentIds, 'reviewer', { now })
        : Promise.resolve(new Map()),
    ]);

    const cacheHealthByUserId = new Map(
      studentEvidenceFeatureCaches.map((cache) => [cache.userId, cache])
    );
    const snapshotMap = new Map(latestSnapshots.map((snapshot) => [snapshot.userId, snapshot]));
    const classScopedProjectionMap = buildClassScopedStudentProjections(
      studentIds,
      classScopedSimulationArenaFacts as any,
    );
    // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: class-scoped legacy vectors are non-authoritative v2 projections.
    const scopedPortraitByUserId = new Map([...classScopedProjectionMap].map(([studentId, projection]) => {
      const projected = projectPortraitV2ForConsumer(derivePortraitV2Compatibility({
        userId: studentId,
        snapshotAt: now.toISOString(),
        // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: source and vector are compatibility-only.
        sourceFamily: 'StudentCompetencySnapshot',
        vector: projection.competencyVector,
        now,
      }), 'reviewer');
      return [studentId, summarizePortraitV2(projected)] as const;
    }));
    const nativePortraitSummaryByUserId = new Map([...nativePortraitByUserId].map(([studentId, portrait]) => [
      studentId,
      summarizePortraitV2(portrait),
    ] as const));
    const attainmentPortraitByUserId = scope === 'cumulative'
      ? nativePortraitSummaryByUserId
      : scopedPortraitByUserId;
    const lifecycleBoundaryByUserId = new Map(studentIds.map((studentId) => [
      studentId,
      classScopedProjectionMap.has(studentId)
        ? null
        : readLifecycleBoundary(snapshotMap.get(studentId)),
    ] as const));
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

    const hasRecentClassEvidence = classScopedEvidenceFactGroups.some((group) => group._count._all > 0)
      || classScopedSimulationArenaFacts.length > 0;
    const hasAttainmentEvidence = scope === 'cumulative'
      ? [...nativePortraitByUserId.values()].some(hasPortraitV2Evidence)
      : hasRecentClassEvidence;
    const noClassEvidence = !hasAttainmentEvidence;
    const students: TeacherClassInsightStudent[] = classData.students.map((studentProfile) => {
      const scopedProjection = classScopedProjectionMap.get(studentProfile.userId);
      const resolvedPortrait = attainmentPortraitByUserId.get(studentProfile.userId);
      const lifecycleBoundary = lifecycleBoundaryByUserId.get(studentProfile.userId) ?? null;
      const hasCurrentEvidence = scope === 'cumulative'
        ? Boolean(nativePortraitByUserId.get(studentProfile.userId)
          && hasPortraitV2Evidence(nativePortraitByUserId.get(studentProfile.userId)!))
        : Boolean(scopedProjection && scopedProjection.factCount > 0);
      // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: this vector only supplies class-scoped compatibility scoring.
      const vector = scopedProjection?.competencyVector;
      const emptyPortrait = summarizePortraitV2({
        userId: studentProfile.userId,
        payloadVersion: 'learner-portrait.v2',
        migrationVersion: 'portrait-v2-migration.v1',
        generatedAt: now.toISOString(),
        derivation: {
          kind: 'compatibility-derived',
          limitations: lifecycleBoundary
            ? [`lifecycle-boundary:${lifecycleBoundary}`]
            : ['missing-native-portrait-v2-evidence'],
        },
        dimensions: [],
      });
      const portraitV2 = hasCurrentEvidence
        ? resolvedPortrait ?? (scope === 'recent' ? emptyPortrait : null)
        : scope === 'recent' ? emptyPortrait : null;
      const fallbackScore = scope === 'cumulative'
        ? resolvedPortrait?.overallScore ?? 0
        : vector ? calculateOverallScore(vector) : 0;
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
        overallScoreSource: hasCurrentEvidence
          ? scope === 'cumulative' ? 'native-portrait-v2' : 'class-scoped-compatibility'
          : null,
        overallLevel:
          hasCurrentEvidence && overallScore !== null
            ? COMPETENCY_LEVELS[getCompetencyLevelKey(overallScore)].label
            : null,
        riskLevel: scope === 'cumulative' ? null : riskLevel,
        riskLabel: scope === 'cumulative' ? null : getRiskLabel(riskLevel),
        trendDirection: scope === 'cumulative' ? null : 'stable',
        recentTrend: scope === 'cumulative'
          ? null
          : hasCurrentEvidence ? '班级范围内暂无可比趋势' : '暂无当前证据',
        strengths: [],
        weaknesses: [],
        riskBadges: [],
        growthRecordCount: 0,
        recommendationCount: 0,
        factCount: hasCurrentEvidence
          ? scope === 'cumulative'
            ? resolvedPortrait?.dimensions.reduce((sum, dimension) => sum + dimension.evidenceCount, 0) ?? 0
            : scopedProjection?.factCount ?? 0
          : 0,
        lastSnapshotAt: hasCurrentEvidence
          ? scope === 'cumulative'
            ? resolvedPortrait?.generatedAt ?? null
            : classSnapshot?.snapshotAt.toISOString() ?? null
          : null,
        portraitV2,
        evidenceStatus: evidenceStatusMap.get(studentProfile.userId)!,
      };
    });

    const coverageStudents = scope === 'cumulative'
      ? [...nativePortraitByUserId.values()].filter(hasPortraitV2Evidence).length
      : [...classScopedProjectionMap.values()].filter((projection) => projection.factCount > 0).length;
    const latestStudentSnapshotAt = scope === 'cumulative'
      ? [...nativePortraitSummaryByUserId.values()]
          .map((portrait) => portrait.generatedAt)
          .sort()
          .at(-1) ?? null
      : hasRecentClassEvidence
        ? classSnapshot?.snapshotAt.toISOString() ?? null
        : null;
    const governanceBase = summarizeGovernanceState({
      totalStudents,
      coveredStudents: coverageStudents,
      classSnapshotAt: classSnapshot?.snapshotAt.toISOString() ?? null,
      latestStudentSnapshotAt,
    });

    const dimensionStats = PORTRAIT_V2_DIMENSIONS.map(({ id: dimension, label }) => {
      const classMean = noClassEvidence ? null : extractClassMean(classSnapshot?.aggregateJson, dimension);
      const classStdDev = extractClassStdDev(classSnapshot?.aggregateJson, dimension);
      const fallbackScores = [...attainmentPortraitByUserId.values()].flatMap((portrait) => {
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
        mean: noClassEvidence ? null : classMean ?? (fallbackScores.length > 0 ? fallbackMean : null),
        stdDev: classStdDev ?? 0,
      };
    });

    const levelDistribution = noClassEvidence
      ? createEmptyLevelDistribution()
      : normalizeLevelDistribution(classSnapshot?.levelDistribution) ||
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
    const spotlightStudents = noClassEvidence || scope === 'cumulative' ? [] : rankStudentsByAttention(
      students
        .filter((student): student is TeacherClassInsightStudent & { overallScore: number } => student.overallScore !== null)
        .map((student) => ({
          id: student.id,
          name: student.name,
          overallScore: student.overallScore,
          overallLevel: student.overallLevel ?? COMPETENCY_LEVELS[getCompetencyLevelKey(student.overallScore)].label,
          riskLevel: student.riskLevel!,
          trendDirection: student.trendDirection!,
          recentTrend: student.recentTrend!,
          strengths: student.strengths,
          weaknesses: student.weaknesses,
          growthRecordCount: student.growthRecordCount,
          recommendationCount: student.recommendationCount,
      }))
    ).slice(0, 5).map((ranked) => students.find((student) => student.id === ranked.id)!);
    const coveredDimensionMeans = dimensionStats.flatMap((dimension) =>
      dimension.mean === null ? [] : [dimension.mean]
    );

    const payload: TeacherClassInsightsPayload = {
      scope,
      scopeLabel: getTeacherAttainmentScopeLabel(scope),
      nearStageChangeApplicable: scope === 'recent',
      recentSignalsApplicable: scope === 'recent',
      recentOnlySignals: ['activity', 'risk', 'classroom-quality', 'trend'],
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
        overallIndex: noClassEvidence || coveredDimensionMeans.length === 0
          ? null
          : roundTo(
              coveredDimensionMeans.reduce((sum, mean) => sum + mean, 0) / coveredDimensionMeans.length,
              1,
            ),
        highRiskStudents: scope === 'cumulative' ? null : noClassEvidence ? 0 : students.filter((student) => student.riskLevel === 'high').length,
        mediumRiskStudents: scope === 'cumulative' ? null : noClassEvidence ? 0 : students.filter((student) => student.riskLevel === 'medium').length,
        attentionStudents: scope === 'cumulative' ? null : noClassEvidence ? 0 : students.filter((student) =>
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
