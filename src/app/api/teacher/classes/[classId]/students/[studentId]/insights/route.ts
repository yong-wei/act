import { NextResponse } from 'next/server';

import { getServerAuthSession } from '@/lib/auth';
import {
  PORTRAIT_V2_DIMENSIONS,
  type PortraitV2DimensionId,
} from '@/lib/data-governance/kaq-objective-taxonomy';
import type { CumulativePortraitAvailabilityReason } from '@/lib/data-governance/cumulative-portrait-read-model';
import {
  createPrismaDiagnosisReportSnapshotStore,
  hasDiagnosisReportSnapshotPersistenceTable,
  readLatestControlCorrectionDiagnosisReportSnapshotFromPersistence,
} from '@/features/personalization/diagnosis/control-correction-diagnosis-profile';
import {
  materializeRoleBasedLearningDiagnosis,
  type RoleBasedLearningDiagnosis,
} from '@/features/personalization/diagnosis/role-based-learning-diagnosis';
import {
  isAuthoritativeConsumerRead,
  isConsumerUnauthorized,
  readTeacherStudentEvidencePort,
  viewerFromSession,
} from '@/features/learning-record/consumers/public-api';
import { resolveTeacherStudentPortraitAccess } from '@/lib/data-governance/portrait-reconciliation-access';
import { summarizeSubmissionEvidencePayload } from '@/lib/data-governance/submission-evidence-quality';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import {
  createDatabaseUnavailableResponse,
  isDatabaseConnectivityError,
} from '@/lib/service-availability';

export const dynamic = 'force-dynamic';

type SafeRisk = {
  type: 'constraint' | 'stagnation' | 'cross_domain';
  severity: 'low' | 'medium' | 'high';
  description: string;
  occurredAt: string | null;
};

type LatestFact = {
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
    overallScore: number | null;
    overallLevel: string | null;
    evidenceState: 'current' | 'no-evidence' | 'unavailable';
    availabilityReason: CumulativePortraitAvailabilityReason;
    evidenceAsOf: string | null;
    generatedAt: string | null;
    confidence: number | null;
    evidencedDimensionCount: number;
    missingDimensionCount: number;
    lastTrend: 'up' | 'stable' | 'down' | 'not-comparable' | null;
    lastRisk: SafeRisk[];
    strengths: string[];
    improvementAreas: string[];
  };
  dimensions: Array<{
    id: PortraitV2DimensionId;
    label: string;
    score: number | null;
    confidence: number | null;
    evidenceCount: number;
    evidenceAsOf: string | null;
    availabilityReason: 'available' | 'no-eligible-evidence';
    taskAttainment?: {
      state: 'EVIDENCE' | 'NO_EVIDENCE';
      completedTaskCount: number;
      relatedTaskCount: number;
      groupedTaskSummary: Array<{
        source: string;
        displayGroup: string;
        completedTaskCount: number;
        relatedTaskCount: number;
        tasks: Array<{ taskKey: string; displayName: string; completed: boolean }>;
      }>;
      evidenceAsOf: string | null;
      calculationVersion: string;
      limitations: string[];
    };
  }>;
  taskAttainment: {
    personal: TeacherStudentInsightsPayload['dimensions'][number]['taskAttainment'] | null;
    classAggregate: {
      meanRatio: number | null;
      meanScore: number | null;
      usableMemberCount: number;
      rosterTotal: number;
      missingMemberCount: number;
      relatedTaskCount: number | null;
      calculationVersion: string | null;
      limitations: string[];
    } | null;
  };
  classComparison: Array<{
    dimension: PortraitV2DimensionId;
    label: string;
    studentScore: number | null;
    classAverage: number | null;
    gap: number | null;
    includedCount: number;
    missingCount: number;
    availabilityReason:
      | 'available'
      | 'student-no-evidence'
      | 'class-no-evidence'
      | 'class-portrait-unavailable';
  }>;
  growthRecords: Array<{
    id: string;
    title: string;
    description: string;
    recordType: string;
    occurredAt: string;
  }>;
  latestActivity: {
    facts: LatestFact[];
    durableSubmissions: Array<{
      id: string;
      sessionId: string;
      lessonKey: string | null;
      stepId: string;
      submittedAt: string;
      sessionTitle: string;
      quality: string;
      sourceState: string;
      answerCount: number;
      questionSummaryCount: number;
      score: number | null;
    }>;
    sessionReports: Array<{
      sessionId: string;
      lessonKey: string | null;
      title: string;
      status: string;
      summary: string | null;
      updatedAt: string;
    }>;
  };
  overallDiagnosis: {
    conclusion: string;
    strengths: string[];
    improvementAreas: string[];
    limitations: string[];
  };
  goalSpecificDiagnosis: RoleBasedLearningDiagnosis;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ classId: string; studentId: string }> },
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { classId, studentId } = await params;
    const access = await resolveTeacherStudentPortraitAccess(prisma, {
      actorId: session.user.id,
      actorRole: session.user.role,
      classId,
      studentId,
    });
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }
    const { classData, studentProfile } = access;

    const [
      evidencePort,
      latestFacts,
      durableSubmissions,
      sessionReports,
      growthRecords,
    ] = await Promise.all([
      readTeacherStudentEvidencePort({
        db: prisma,
        viewer: viewerFromSession(session, [classId]),
        classId,
        studentId,
      }),
      prisma.learningFact.findMany({
        where: { userId: studentId },
        orderBy: [{ startedAt: 'desc' }, { id: 'desc' }],
        take: 8,
        select: {
          id: true,
          factType: true,
          moduleId: true,
          lessonId: true,
          sessionId: true,
          outcome: true,
          score: true,
          startedAt: true,
          finishedAt: true,
          timeSpent: true,
        },
      }),
      prisma.studentStepResponse.findMany({
        where: { userId: studentId },
        orderBy: [{ submittedAt: 'desc' }, { id: 'desc' }],
        take: 8,
        select: {
          id: true,
          sessionId: true,
          lessonKey: true,
          stepId: true,
          submittedAt: true,
          responseData: true,
          session: {
            select: { plan: { select: { title: true } } },
          },
        },
      }),
      prisma.studentSessionReport.findMany({
        where: { userId: studentId, reportType: 'student-summary' },
        orderBy: [{ updatedAt: 'desc' }, { id: 'desc' }],
        take: 6,
        select: {
          sessionId: true,
          lessonKey: true,
          status: true,
          summary: true,
          updatedAt: true,
          session: {
            select: { plan: { select: { title: true } } },
          },
        },
      }),
      prisma.growthRecord.findMany({
        where: { userId: studentId, invalidations: { none: {} } },
        orderBy: [{ occurredAt: 'desc' }, { id: 'desc' }],
        take: 12,
        select: {
          id: true,
          title: true,
          description: true,
          recordType: true,
          occurredAt: true,
        },
      }),
    ]);
    const portrait = evidencePort.student.portrait;
    const classPortrait = evidencePort.classPortrait;

    const dimensions = PORTRAIT_V2_DIMENSIONS.map(({ id, label }) => {
      const dimension = portrait.payload?.dimensions.find((item) => item.id === id);
      const hasEvidence = Boolean(dimension && dimension.evidenceSummary.totalCount > 0);
      return {
        id,
        label,
        score: hasEvidence ? roundTo(dimension!.score, 1) : null,
        confidence: hasEvidence ? roundTo(dimension!.confidence, 2) : null,
        evidenceCount: hasEvidence ? dimension!.evidenceSummary.totalCount : 0,
        evidenceAsOf: hasEvidence ? dimension!.freshness.asOf : null,
        availabilityReason: hasEvidence
          ? 'available' as const
          : 'no-eligible-evidence' as const,
        ...(dimension?.taskAttainment
          ? {
              taskAttainment: {
                state: dimension.taskAttainment.state,
                completedTaskCount: dimension.taskAttainment.completedTaskCount,
                relatedTaskCount: dimension.taskAttainment.relatedTaskCount,
                groupedTaskSummary: structuredClone(dimension.taskAttainment.groupedTaskSummary),
                evidenceAsOf: dimension.taskAttainment.evidenceAsOf,
                calculationVersion: dimension.taskAttainment.calculationVersion,
                limitations: [...dimension.taskAttainment.limitations],
              },
            }
          : {}),
      };
    });
    const strengths = dimensions
      .filter((dimension) => dimension.score !== null && dimension.score >= 75)
      .sort((left, right) => right.score! - left.score!)
      .slice(0, 3)
      .map((dimension) => dimension.label);
    const improvementAreas = dimensions
      .filter((dimension) => dimension.score !== null && dimension.score < 60)
      .sort((left, right) => left.score! - right.score!)
      .slice(0, 3)
      .map((dimension) => dimension.label);
    const safeRisks = portrait.lastRisk.map((risk) => ({
      type: risk.type,
      severity: risk.severity,
      description: describeRisk(risk.type),
      occurredAt: risk.occurredAt,
    }));

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
        },
      )
      : null;
    const goalSpecificDiagnosis = materializeRoleBasedLearningDiagnosis({
      view: 'teacher-student',
      goalId: 'control-correction',
      userId: session.user.id,
      targetUserId: studentId,
      classId,
      teacherClassIds: [classId],
      learnerState: portrait.generatedAt ? { generatedAt: portrait.generatedAt } : null,
      teacherReport: {
        classInfo: { classId, studentCount: 1 },
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
        overallScore: portrait.overallScore === null ? null : roundTo(portrait.overallScore, 1),
        overallLevel: levelForScore(portrait.overallScore),
        evidenceState: isAuthoritativeConsumerRead(evidencePort.student) && portrait.stateKind === 'SNAPSHOT'
          ? 'current'
          : portrait.stateKind === 'NO_EVIDENCE' || evidencePort.student.knownZero
            ? 'no-evidence'
            : 'unavailable',
        availabilityReason: portrait.availabilityReason,
        evidenceAsOf: portrait.evidenceAsOf,
        generatedAt: portrait.generatedAt,
        confidence: portrait.confidence === null ? null : roundTo(portrait.confidence, 2),
        evidencedDimensionCount: portrait.dimensionCoverage.evidencedDimensionIds.length,
        missingDimensionCount: portrait.dimensionCoverage.missingDimensionIds.length,
        lastTrend: portrait.lastTrend,
        lastRisk: safeRisks,
        strengths,
        improvementAreas,
      },
      dimensions,
      taskAttainment: {
        personal: dimensions.find((dimension) =>
          dimension.id === 'simulationValidationEvidence')?.taskAttainment ?? null,
        classAggregate: evidencePort.classRead.suppressed
          ? null
          : classPortrait.aggregate?.taskAttainment ?? null,
      },
      classComparison: dimensions.map((dimension) => {
        const classDimension = classPortrait.aggregate?.dimensions[dimension.id] ?? null;
        const classAverage = evidencePort.classRead.suppressed
          ? null
          : classDimension?.mean ?? null;
        const available = dimension.score !== null && classAverage !== null;
        return {
          dimension: dimension.id,
          label: dimension.label,
          studentScore: dimension.score,
          classAverage: classAverage === null ? null : roundTo(classAverage, 1),
          gap: available ? roundTo(dimension.score! - classAverage, 1) : null,
          includedCount: classDimension?.includedCount ?? 0,
          missingCount: classDimension?.missingCount ?? classPortrait.totalStudentCount,
          availabilityReason: available
            ? 'available' as const
            : dimension.score === null
              ? 'student-no-evidence' as const
              : classPortrait.stateKind !== 'SNAPSHOT'
                ? 'class-portrait-unavailable' as const
                : 'class-no-evidence' as const,
        };
      }),
      growthRecords: growthRecords.map((record) => ({
        id: record.id,
        title: record.title,
        description: record.description,
        recordType: record.recordType,
        occurredAt: record.occurredAt.toISOString(),
      })),
      latestActivity: {
        facts: latestFacts.map((fact) => ({
          ...fact,
          startedAt: fact.startedAt.toISOString(),
          finishedAt: fact.finishedAt?.toISOString() ?? null,
        })),
        durableSubmissions: durableSubmissions.map((submission) => {
          const quality = summarizeSubmissionEvidencePayload(submission.responseData);
          return {
            id: submission.id,
            sessionId: submission.sessionId,
            lessonKey: submission.lessonKey,
            stepId: submission.stepId,
            submittedAt: submission.submittedAt.toISOString(),
            sessionTitle: submission.session.plan.title,
            quality: quality.quality,
            sourceState: quality.sourceState,
            answerCount: quality.answerCount,
            questionSummaryCount: quality.questionSummaryCount,
            score: quality.score,
          };
        }),
        sessionReports: sessionReports.map((report) => ({
          sessionId: report.sessionId,
          lessonKey: report.lessonKey,
          title: report.session.plan.title,
          status: report.status,
          summary: report.summary,
          updatedAt: report.updatedAt.toISOString(),
        })),
      },
      overallDiagnosis: {
        conclusion: overallConclusion(portrait.overallScore, portrait.availabilityReason),
        strengths,
        improvementAreas,
        limitations: [
          ...dimensions
            .filter((dimension) => dimension.availabilityReason !== 'available')
            .map((dimension) => `${dimension.label}缺少合格证据`),
          ...(classPortrait.stateKind === 'SNAPSHOT'
            ? []
            : [`班级累计画像不可用：${classPortrait.availabilityReason}`]),
        ],
      },
      goalSpecificDiagnosis,
    };
    return NextResponse.json(payload);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (isConsumerUnauthorized(error)) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }
    console.error('[TeacherStudentInsights] Error:', error);
    if (isDatabaseConnectivityError(error)) {
      return createDatabaseUnavailableResponse();
    }
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

function levelForScore(score: number | null): string | null {
  if (score === null) return null;
  if (score >= 85) return '优秀';
  if (score >= 75) return '良好';
  if (score >= 60) return '达标';
  return '需提升';
}

function overallConclusion(
  score: number | null,
  availabilityReason: CumulativePortraitAvailabilityReason,
): string {
  if (score === null) return `累计能力达成不可用：${availabilityReason}`;
  return `累计能力达成 ${roundTo(score, 1)}，${levelForScore(score)}。`;
}

function describeRisk(type: SafeRisk['type']): string {
  if (type === 'constraint') return '累计证据显示仍存在约束风险。';
  if (type === 'stagnation') return '连续证据状态显示能力提升停滞。';
  return '累计证据显示跨域迁移能力存在风险。';
}

function roundTo(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
