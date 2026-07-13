import { NextResponse } from 'next/server';

import {
  COMPETENCY_DIMENSIONS,
  calculateTrendDirection,
  type CompetencyVector,
  type TrendVector,
} from '@/lib/data-governance/competency-model';
// PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: legacy vector is retained only for trend and evidence compatibility.
import {
  mapLegacyCompetencyDimensionToPortraitV2,
  PORTRAIT_V2_DIMENSIONS,
  type PortraitV2DimensionId,
} from '@/lib/data-governance/kaq-objective-taxonomy';
import {
  hasPortraitV2Evidence,
  resolvePrimaryPortraitV2,
  summarizePortraitV2,
  type PortraitV2ConsumerSummary,
} from '@/lib/data-governance/portrait-v2-consumer';
import {
  generateRecommendations,
  type RecommendationRationale,
} from '@/lib/data-governance/recommendation-engine';
import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import { createDatabaseUnavailableResponse, isDatabaseConnectivityError } from '@/lib/service-availability';
import { normalizeInsightRiskLevel, parseStringList } from '@/features/teacher/teacher-insights';
import { summarizeSubmissionEvidencePayload } from '@/lib/data-governance/submission-evidence-quality';
import {
  STUDENT_EVIDENCE_FEATURE_LEARNING_FACT_SELECT,
  buildStudentEvidenceFeaturePayload,
  readStudentEvidenceFeatures,
  type StudentEvidenceFeatureLearningFact,
} from '@/lib/data-governance/student-evidence-feature-cache';
import {
  buildTeacherScopedLearningFactScopeFilters,
  buildTeacherStudentEvidenceStatus,
  type TeacherSessionQualityStatus,
  type TeacherStudentEvidenceStatus,
} from '@/lib/data-governance/teacher-evidence-governance';
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

type TeacherStudentRiskItem = {
  type: string;
  severity: 'low' | 'medium' | 'high';
  description: string;
  triggeredAt: string;
  occurrenceCount: number;
};

type TeacherStudentGrowthItem = {
  id: string;
  title: string;
  description: string;
  recordType: string;
  occurredAt: string;
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
  rationale: RecommendationRationale;
};

type TeacherStudentEvidenceItem = {
  factType: string;
  outcome: string;
  score?: number;
  moduleId?: string | null;
  lessonId?: string | null;
  sourceLogId?: string | null;
  evidenceTitle?: string;
  stepId?: string;
  questionSummaries?: Array<{
    questionId?: string;
    prompt?: string;
    studentAnswerRedacted?: boolean;
    referenceAnswer?: string;
    isCorrect?: boolean;
  }>;
};

type TeacherStudentEvidenceDrawer = {
  featureCache: TeacherStudentEvidenceStatus & {
    rawReadExceptions: string[];
  };
  recentFacts: Array<{
    id: string;
    factType: string;
    moduleId: string | null;
    lessonId: string | null;
    sessionId: string | null;
    outcome: string;
    score: number | null;
    startedAt: string;
    finishedAt: string | null;
    timeSpent: number | null;
  }>;
  durableSubmissions: Array<{
    id: string;
    sessionId: string;
    lessonKey: string | null;
    stepId: string;
    attemptKey: string | null;
    submittedAt: string;
    sessionTitle: string;
    quality: string;
    reason: string;
    sourceState: string;
    schemaVersion: string | null;
    scoreableObjectiveSubmissions: number;
    answerCount: number;
    questionSummaryCount: number;
    score: number | null;
  }>;
  sessionQuality: Array<{
    sessionId: string;
    lessonKey: string | null;
    title: string;
    startTime: string | null;
    endTime: string | null;
    updatedAt: string | null;
    qualityStatus: TeacherSessionQualityStatus;
    qualityReasons: string[];
    summary: string | null;
    studentReport: {
      interactionLogs: number;
      learningFacts: number;
      durableSubmissions: number;
    };
  }>;
  limits: {
    recentFacts: number;
    durableSubmissions: number;
    sessionQuality: number;
  };
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
    portraitV2: PortraitV2ConsumerSummary;
    riskLevel: 'none' | 'low' | 'medium' | 'high';
    riskLabel: string;
    latestSnapshotAt: string | null;
    factCount: number;
    recommendedScaffolding: string;
  };
  snapshot: {
    current: {
      portrait: PortraitV2ConsumerSummary;
      vector: CompetencyVector;
      // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: source identifies compatibility metadata only.
      legacyCompatibility: {
        authority: 'legacy-compatibility-only';
        source: 'StudentCompetencySnapshot' | 'StudentEvidenceFeatureCache' | 'fallback-empty';
      };
      snapshotAt: string;
      factCount: number;
    } | null;
    previous: {
      vector: CompetencyVector;
      legacyCompatibility: {
        authority: 'legacy-compatibility-only';
      };
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
    items: TeacherStudentEvidenceItem[];
  }>;
  evidenceDrawer: TeacherStudentEvidenceDrawer;
  diagnosis: RoleBasedLearningDiagnosis;
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

    const scopedClassSessions = await prisma.classSession.findMany({
      where: { classId },
      select: { id: true },
    });
    const scopedSessionIds = scopedClassSessions.map((session) => session.id);

    const [
      currentSnapshot,
      previousSnapshot,
      profileSummary,
      riskFlags,
      growthRecords,
      recommendations,
      classSnapshot,
      studentEvidenceFeatureRead,
      scopedFeatureFacts,
      durableSubmissions,
      studentSessionReports,
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
      readStudentEvidenceFeatures(prisma, studentId),
      prisma.learningFact.findMany({
        where: {
          userId: studentId,
          OR: buildTeacherScopedLearningFactScopeFilters(classId, scopedSessionIds),
        },
        orderBy: { startedAt: 'desc' },
        select: STUDENT_EVIDENCE_FEATURE_LEARNING_FACT_SELECT,
      }),
      prisma.studentStepResponse.findMany({
        where: {
          userId: studentId,
          session: { classId },
        },
        orderBy: { submittedAt: 'desc' },
        take: 8,
        select: {
          id: true,
          sessionId: true,
          lessonKey: true,
          stepId: true,
          attemptKey: true,
          submittedAt: true,
          responseData: true,
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
      prisma.studentSessionReport.findMany({
        where: {
          userId: studentId,
          reportType: 'student-summary',
          session: { classId },
        },
        orderBy: { updatedAt: 'desc' },
        take: 6,
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

    const currentVector = currentSnapshot?.competencyVector as CompetencyVector | null;
    const previousVector = previousSnapshot?.competencyVector as CompetencyVector | null;
    const trendVector = currentVector
      ? buildTrendVector(currentVector, previousVector)
      : null;
    const portraitResolution = await resolvePrimaryPortraitV2(prisma, studentId, 'reviewer', {
      legacySnapshot: currentSnapshot as Record<string, unknown> | null,
      featureCache: studentEvidenceFeatureRead.cache as Record<string, unknown> | null,
    });
    const portraitV2 = summarizePortraitV2(portraitResolution.primaryPortrait);
    const hasPortraitV2Data = hasPortraitV2Evidence(portraitResolution.primaryPortrait);
    const portraitFactCount = portraitV2.dimensions.reduce((sum, dimension) => sum + dimension.evidenceCount, 0);
    const overallScore = roundTo(portraitV2.overallScore, 1);
    const snapshotVector = currentVector ?? portraitResolution.legacyCompatibility.vector;
    const snapshotAt = currentSnapshot?.snapshotAt.toISOString() ?? (
      hasPortraitV2Data ? portraitV2.generatedAt : null
    );
    const factCount = currentSnapshot?.factCount ?? (hasPortraitV2Data ? portraitFactCount : 0);
    const riskLevel = normalizeInsightRiskLevel(
      profileSummary?.riskLevel ??
        riskFlags.find((flag) => flag.severity)?.severity ??
        null
    );
    const classAggregate = (classSnapshot?.aggregateJson ?? {}) as Record<string, unknown>;
    const evidenceSummary = sanitizeEvidenceSummary(
      (currentSnapshot?.evidenceSummary ?? {}) as Record<string, TeacherStudentEvidenceItem[]>
    );
    const portraitEvidenceSummary = buildPortraitEvidenceSummary(evidenceSummary);
    const recentFacts = scopedFeatureFacts.slice(0, 8);
    const drawerSessionIds = Array.from(new Set([
      ...recentFacts.map((fact) => fact.sessionId).filter(isNonEmptyString),
      ...durableSubmissions.map((submission) => submission.sessionId),
      ...studentSessionReports.map((report) => report.sessionId),
    ]));
    const classSessionReports = drawerSessionIds.length
      ? await prisma.classSessionReport.findMany({
          where: {
            sessionId: { in: drawerSessionIds },
            reportType: 'class-summary',
          },
          select: {
            sessionId: true,
            status: true,
            summary: true,
            reportData: true,
            updatedAt: true,
          },
      })
      : [];
    const drawerNow = new Date();
    const scopedFeatureCache = buildTeacherScopedFeatureCacheRecord(
      studentId,
      scopedFeatureFacts,
      drawerNow,
    );
    const evidenceDrawer = buildEvidenceDrawer({
      studentId,
      featureRead: studentEvidenceFeatureRead,
      scopedFeatureCache,
      scopedFeatureState: scopedFeatureFacts.length > 0 ? undefined : 'missing',
      now: drawerNow,
      recentFacts,
      durableSubmissions,
      studentSessionReports,
      classSessionReports,
    });
    const diagnosisReportSnapshot = await hasDiagnosisReportSnapshotPersistenceTable(prisma)
      ? await readLatestControlCorrectionDiagnosisReportSnapshotFromPersistence(
        createPrismaDiagnosisReportSnapshotStore(prisma.diagnosisReportSnapshot),
        {
          view: 'teacher-student',
          goalId: 'control-correction',
          userId: session.user.id,
          targetUserId: studentId,
          classId,
          teacherClassIds: [classId],
        }
      )
      : null;
    const diagnosis = materializeRoleBasedLearningDiagnosis({
      view: 'teacher-student',
      goalId: 'control-correction',
      userId: session.user.id,
      targetUserId: studentId,
      classId,
      teacherClassIds: [classId],
      learnerState: snapshotAt
        ? { generatedAt: snapshotAt }
        : null,
      featureCache: studentEvidenceFeatureRead.cache,
      teacherReport: {
        classInfo: {
          classId,
          studentCount: 1,
        },
        studentDrilldowns: [{ userId: studentId }],
      },
      diagnosisReportSnapshot,
    });

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
        portraitV2,
        riskLevel,
        riskLabel: getRiskLabel(riskLevel),
        latestSnapshotAt: snapshotAt,
        factCount,
        recommendedScaffolding:
          profileSummary?.recommendedScaffolding || '当前暂无自动脚手架建议，可结合课堂观察补充判断。',
      },
      snapshot: {
        current: currentSnapshot || hasPortraitV2Data
          ? {
              portrait: portraitV2,
              vector: snapshotVector,
              legacyCompatibility: {
                authority: 'legacy-compatibility-only',
                source: portraitResolution.legacyCompatibility.source,
              },
              snapshotAt: snapshotAt!,
              factCount,
            }
          : null,
        previous: previousSnapshot
          ? {
              vector: previousVector!,
              legacyCompatibility: {
                authority: 'legacy-compatibility-only',
              },
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
      classComparison: PORTRAIT_V2_DIMENSIONS.map(({ id: dimension, label }) => {
        const studentScore = portraitV2.dimensions.find((item) => item.id === dimension)?.score ?? 0;
        const classAverage = roundTo(extractClassMean(classAggregate, dimension) ?? 0, 1);
        return {
          dimension,
          label,
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
        rationale: recommendation.rationale,
      })),
      evidenceSummary: PORTRAIT_V2_DIMENSIONS.map(({ id: dimension, label }) => ({
        dimension,
        label,
        items: portraitEvidenceSummary[dimension] ?? [],
      })),
      evidenceDrawer,
      diagnosis,
    };

    return NextResponse.json(payload);
  } catch (error) {
    rethrowIfNextDynamicError(error);
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

function buildPortraitEvidenceSummary(
  legacySummary: Record<string, TeacherStudentEvidenceItem[]>,
): Record<string, TeacherStudentEvidenceItem[]> {
  return Object.fromEntries(PORTRAIT_V2_DIMENSIONS.map(({ id }) => [
    id,
    // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: map historical evidence into v2 dimensions only.
    COMPETENCY_DIMENSIONS.flatMap((legacyDimension) =>
      mapLegacyCompetencyDimensionToPortraitV2(legacyDimension).targetDimensions.includes(id)
        ? legacySummary[legacyDimension] ?? []
        : []
    ).slice(0, 6),
  ]));
}

function extractClassMean(aggregate: Record<string, unknown>, dimension: PortraitV2DimensionId): number | null {
  const nested = readObject(aggregate.dimensions)[dimension];
  const legacy = aggregate[dimension];
  const entry = readObject(nested ?? legacy);
  return typeof entry.mean === 'number' && Number.isFinite(entry.mean) ? entry.mean : null;
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
      });
      continue;
    }

    existing.occurrenceCount += 1;
    if (flag.triggeredAt.getTime() > new Date(existing.triggeredAt).getTime()) {
      existing.triggeredAt = flag.triggeredAt.toISOString();
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

function buildEvidenceDrawer(input: {
  studentId: string;
  featureRead: Awaited<ReturnType<typeof readStudentEvidenceFeatures>>;
  scopedFeatureCache: Record<string, unknown>;
  scopedFeatureState?: TeacherStudentEvidenceStatus['state'];
  now: Date;
  recentFacts: Array<{
    id: string;
    factType: string;
    moduleId: string | null;
    lessonId: string | null;
    sessionId: string | null;
    outcome: string;
    score: number | null;
    startedAt: Date;
    finishedAt: Date | null;
    timeSpent: number | null;
  }>;
  durableSubmissions: Array<{
    id: string;
    sessionId: string;
    lessonKey: string | null;
    stepId: string;
    attemptKey: string | null;
    submittedAt: Date;
    responseData: unknown;
    session: {
      id: string;
      startTime: Date;
      endTime: Date | null;
      plan: { title: string };
    };
  }>;
  studentSessionReports: Array<{
    sessionId: string;
    lessonKey: string | null;
    summary: string | null;
    reportData: unknown;
    updatedAt: Date;
    session: {
      id: string;
      startTime: Date;
      endTime: Date | null;
      plan: { title: string };
    };
  }>;
  classSessionReports: Array<{
    sessionId: string;
    summary: string | null;
    reportData: unknown;
    updatedAt: Date;
  }>;
}): TeacherStudentEvidenceDrawer {
  const featureCache = buildTeacherStudentEvidenceStatus(input.studentId, input.scopedFeatureCache, {
    readState: input.scopedFeatureState,
    now: input.now,
  });
  const classReportMap = new Map(input.classSessionReports.map((report) => [report.sessionId, report]));

  return {
    featureCache: {
      ...featureCache,
      rawReadExceptions: input.featureRead.rawReadExceptions,
    },
    recentFacts: input.recentFacts.map((fact) => ({
      id: fact.id,
      factType: fact.factType,
      moduleId: fact.moduleId,
      lessonId: fact.lessonId,
      sessionId: fact.sessionId,
      outcome: fact.outcome,
      score: fact.score,
      startedAt: fact.startedAt.toISOString(),
      finishedAt: fact.finishedAt?.toISOString() ?? null,
      timeSpent: fact.timeSpent,
    })),
    durableSubmissions: input.durableSubmissions.map((submission) => {
      const quality = summarizeSubmissionEvidencePayload(submission.responseData);
      return {
        id: submission.id,
        sessionId: submission.sessionId,
        lessonKey: submission.lessonKey,
        stepId: submission.stepId,
        attemptKey: submission.attemptKey,
        submittedAt: submission.submittedAt.toISOString(),
        sessionTitle: submission.session.plan.title,
        quality: quality.quality,
        reason: quality.reason,
        sourceState: quality.sourceState,
        schemaVersion: quality.schemaVersion,
        scoreableObjectiveSubmissions: quality.scoreableObjectiveSubmissions,
        answerCount: quality.answerCount,
        questionSummaryCount: quality.questionSummaryCount,
        score: quality.score,
      };
    }),
    sessionQuality: input.studentSessionReports.map((report) => {
      const classReport = classReportMap.get(report.sessionId);
      const classReportData = readObject(classReport?.reportData);
      const qualityStatus = readObject(classReportData.qualityStatus);
      const studentReport = readObject(report.reportData);

      return {
        sessionId: report.sessionId,
        lessonKey: report.lessonKey,
        title: report.session.plan.title,
        startTime: report.session.startTime.toISOString(),
        endTime: report.session.endTime?.toISOString() ?? null,
        updatedAt: report.updatedAt.toISOString(),
        qualityStatus: normalizeSessionQualityStatus(qualityStatus.status),
        qualityReasons: stringArray(qualityStatus.reasons),
        summary: classReport?.summary ?? report.summary,
        studentReport: {
          interactionLogs: numberValue(studentReport.interactionLogs),
          learningFacts: numberValue(studentReport.learningFacts),
          durableSubmissions: numberValue(studentReport.durableSubmissions),
        },
      };
    }),
    limits: {
      recentFacts: 8,
      durableSubmissions: 8,
      sessionQuality: 6,
    },
  };
}

function buildTeacherScopedFeatureCacheRecord(
  studentId: string,
  facts: StudentEvidenceFeatureLearningFact[],
  now: Date,
): Record<string, unknown> {
  const payload = buildStudentEvidenceFeaturePayload({
    userId: studentId,
    facts,
    now,
  });
  const lastSourceFactAt = payload.evidenceWindow.lastStartedAt
    ? new Date(payload.evidenceWindow.lastStartedAt)
    : null;

  return {
    userId: studentId,
    payloadVersion: payload.payloadVersion,
    refreshedAt: now,
    lastSourceFactAt,
    sourceFactCount: payload.sourceCounts.LearningFact,
    evidenceWindow: payload.evidenceWindow,
    sourceCounts: payload.sourceCounts,
    sourceCoverage: payload.sourceCoverage,
    confidenceMarkers: payload.confidence,
    statusMarkers: payload.statusMarkers,
    features: payload.features,
  };
}

function sanitizeEvidenceSummary(
  summary: Record<string, TeacherStudentEvidenceItem[]>
): Record<string, TeacherStudentEvidenceItem[]> {
  return Object.fromEntries(
    Object.entries(summary).map(([dimension, items]) => [
      dimension,
      Array.isArray(items)
        ? items.slice(0, 6).map((item) => ({
            factType: item.factType,
            outcome: item.outcome,
            score: item.score,
            moduleId: item.moduleId,
            lessonId: item.lessonId,
            sourceLogId: item.sourceLogId,
            evidenceTitle: truncateOptionalText(item.evidenceTitle),
            stepId: item.stepId,
            questionSummaries: item.questionSummaries?.slice(0, 3).map((question) => ({
              questionId: question.questionId,
              prompt: truncateOptionalText(question.prompt),
              studentAnswerRedacted: typeof (question as { studentAnswer?: unknown }).studentAnswer === 'string' &&
                ((question as { studentAnswer?: string }).studentAnswer?.length ?? 0) > 0,
              referenceAnswer: truncateOptionalText(question.referenceAnswer),
              isCorrect: question.isCorrect,
            })),
          }))
        : [],
    ]),
  );
}

function truncateOptionalText(value: string | undefined, maxLength: number = 96) {
  if (typeof value !== 'string') return undefined;
  return value.length > maxLength ? `${value.slice(0, maxLength)}...` : value;
}

function normalizeSessionQualityStatus(value: unknown): TeacherSessionQualityStatus {
  return value === 'green' || value === 'yellow' || value === 'red' ? value : 'unknown';
}

function isNonEmptyString(value: string | null): value is string {
  return typeof value === 'string' && value.length > 0;
}

function readObject(value: unknown): Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function stringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === 'string' && item.length > 0);
}

function numberValue(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
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
