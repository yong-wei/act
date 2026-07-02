/**
 * Data Governance Status API
 *
 * Provides monitoring data for queues, snapshots, and system health.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import { redisClient } from '@/lib/redis-client';
import {
  buildAdminOperationIdempotencyKey,
  buildAdminOperationLedgerEntry,
  operationLedgerHeaders,
} from '@/lib/admin-operation-ledger';
import { persistAdminOperationLedger } from '@/lib/admin-operation-ledger-runtime';
import { summarizeLearningFactTypes } from '@/features/admin/states/system-usage-data';
import {
  buildEvidenceSourceCoverageReport,
  getEvidenceSourceCatalog,
  type EvidenceCoverageRow,
  type EvidenceSourceCoverageReport,
} from '@/lib/data-governance/evidence-source-catalog';
import { getStudentEvidenceFeatureCacheAdminSummary } from '@/lib/data-governance/student-evidence-feature-cache';
import { buildControlCorrectionSarDemoFixture } from '@/lib/data-governance/sar-diagnostics';
import { createSarPersistenceRepository } from '@/lib/data-governance/sar-persistence';
import {
  buildControlCorrectionSarRefreshSources,
  runSarProjectionRefresh,
  type SarArenaAuthorityInput,
  type SarRefreshSourceInput,
} from '@/lib/data-governance/sar-refresh';
import { parseSessionGovernanceSummary } from '@/lib/classroom-session-statistics';
import type {
  GovernanceActionAuditRecord,
  GovernanceRiskDispositionStatus,
} from '@/features/admin/admin-governance-action-contract';

export const dynamic = 'force-dynamic';

type SessionQualityStatus = 'green' | 'yellow' | 'red';
const SOURCE_COVERAGE_ROW_LIMIT = 400;

function readObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function compactSourceLabel(...values: unknown[]): string | null {
  return values
    .map((value) => typeof value === 'string' ? value.trim() : '')
    .find(Boolean) ?? null;
}

function readString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function readGovernanceAuditLog(value: unknown): GovernanceActionAuditRecord[] {
  const governance = readObject(readObject(value).adminGovernance);
  return Array.isArray(governance.auditLog)
    ? governance.auditLog.filter((item): item is GovernanceActionAuditRecord => (
        Boolean(
          item
          && typeof item === 'object'
          && !Array.isArray(item)
          && typeof (item as Record<string, unknown>).actorId === 'string'
          && typeof (item as Record<string, unknown>).action === 'string'
          && typeof (item as Record<string, unknown>).riskId === 'string'
          && typeof (item as Record<string, unknown>).recordedAt === 'string'
        )
      ))
    : [];
}

function readGovernanceAssignee(value: unknown): string | null {
  const governance = readObject(readObject(value).adminGovernance);
  return readString(governance.currentAssignee) ?? null;
}

function readUndoAvailable(value: unknown): boolean {
  const auditLog = readGovernanceAuditLog(value);
  const latestDisposition = [...auditLog].reverse().find((item) => (
    item.action === 'resolve'
    || item.action === 'ignore'
    || item.action === 'reopen'
    || item.action === 'undo'
  ));
  return Boolean(
    latestDisposition
    && (latestDisposition.action === 'resolve' || latestDisposition.action === 'ignore')
    && latestDisposition.undoAvailable === true
  );
}

function readGovernanceDisposition(value: {
  isResolved: boolean;
  resolutionNote?: string | null;
  evidenceJson: unknown;
}): GovernanceRiskDispositionStatus {
  const lastDisposition = readString(readObject(readObject(value.evidenceJson).adminGovernance).lastDisposition);
  if (value.isResolved && (lastDisposition === 'ignored' || lastDisposition === 'resolved')) {
    return lastDisposition;
  }
  if (!value.isResolved && lastDisposition === 'open') {
    return 'open';
  }
  const auditLog = readGovernanceAuditLog(value.evidenceJson);
  const latestDisposition = [...auditLog].reverse().find((item) => (
    item.action === 'resolve'
    || item.action === 'ignore'
    || item.action === 'reopen'
    || item.action === 'undo'
  ));
  if (!value.isResolved) return 'open';
  if (latestDisposition?.action === 'ignore' || latestDisposition?.outcome === 'ignored') return 'ignored';
  if (value.resolutionNote?.includes('忽略')) return 'ignored';
  return 'resolved';
}

function mapGovernanceRiskPayload(risk: {
  id: string;
  userId: string;
  flagType: string;
  severity: string;
  description: string;
  triggeredAt: Date;
  isResolved: boolean;
  resolvedAt?: Date | null;
  resolutionNote?: string | null;
  evidenceJson: unknown;
  user: {
    name: string | null;
    email: string | null;
  };
}) {
  const userToken = risk.userId.slice(0, 12);
  const userName = risk.user.name || `学生 ${userToken}`;
  const safeLabel = `${userName} · ${risk.flagType} · ${risk.severity}`;
  const affectedObjectLabel = `student:${userToken}`;
  return {
    id: risk.id,
    userId: risk.userId,
    userName,
    flagType: risk.flagType,
    severity: risk.severity,
    description: risk.description,
    triggeredAt: risk.triggeredAt.toISOString(),
    isResolved: risk.isResolved,
    resolvedAt: risk.resolvedAt?.toISOString() ?? null,
    resolutionNote: risk.resolutionNote ?? null,
    safeLabel,
    affectedObjectLabel,
    evidenceHref: `/admin/data-governance?tab=risks&riskId=${encodeURIComponent(risk.id)}&action=evidence`,
    currentAssignee: readGovernanceAssignee(risk.evidenceJson),
    dispositionStatus: readGovernanceDisposition(risk),
    undoAvailable: readUndoAvailable(risk.evidenceJson),
    auditTrail: readGovernanceAuditLog(risk.evidenceJson),
  };
}

function buildArenaPreviewBoundaryMetadata(row: {
  datasetHash: string;
  controllerHash: string;
  payload: unknown;
}) {
  const payload = readObject(row.payload);
  const existing = readObject(payload.metadata ?? readObject(readObject(payload.summary).previewBoundary));
  const replaySource = readObject(payload.replaySource);
  const artifact = readObject(replaySource.artifact);
  const artifactParams = readObject(artifact.params);
  const experiment = readObject(replaySource.experiment);

  return {
    evaluationVisibility: 'preview',
    officialEligible: false,
    modelRelation: readString(existing.modelRelation) ?? readString(artifactParams.representation) ?? readString(artifact.method),
    datasetHash: readString(existing.datasetHash) ?? row.datasetHash,
    controllerHash: readString(existing.controllerHash) ?? row.controllerHash,
    identificationModelId: readString(existing.identificationModelId) ?? readString(artifactParams.identificationModelId),
    sourceExperimentId: readString(existing.sourceExperimentId) ?? readString(experiment.id),
  };
}

function buildArenaVirtualSimulationRunEventData(row: {
  id: string;
  userId: string;
  taskId: string;
  datasetHash: string;
  controllerHash: string;
  scenarioId: string;
  simulationRunId?: string | null;
  payload: unknown;
}) {
  const payload = readObject(row.payload);
  return {
    ...payload,
    arenaPreviewDetailId: row.id,
    simulationRunId: row.simulationRunId ?? null,
    userId: row.userId,
    taskId: row.taskId,
    datasetHash: row.datasetHash,
    controllerHash: row.controllerHash,
    scenarioId: row.scenarioId,
    metadata: buildArenaPreviewBoundaryMetadata(row),
  };
}

function summarizeSessionQuality(
  reports: Array<{
    sessionId: string;
    lessonKey: string | null;
    status: string;
    summary: string | null;
    updatedAt: Date;
    reportData: unknown;
  }>,
) {
  const summary = {
    recentSessions: reports.length,
    green: 0,
    yellow: 0,
    red: 0,
    unknown: 0,
    latestReports: [] as Array<{
      sessionId: string;
      lessonKey: string | null;
      reportStatus: string;
      summary: string | null;
      updatedAt: string;
      qualityStatus: SessionQualityStatus | 'unknown';
      qualityReasons: string[];
    }>,
  };
  for (const report of reports) {
    const qualityStatus = parseSessionGovernanceSummary(report.reportData)?.qualityStatus ?? null;
    const status = qualityStatus?.status ?? null;
    if (status) {
      summary[status] += 1;
    } else {
      summary.unknown += 1;
    }
    summary.latestReports.push({
      sessionId: report.sessionId,
      lessonKey: report.lessonKey,
      reportStatus: report.status,
      summary: report.summary,
      updatedAt: report.updatedAt.toISOString(),
      qualityStatus: status ?? 'unknown',
      qualityReasons: qualityStatus?.reasons ?? [],
    });
  }
  return summary;
}

async function collectEvidenceSourceCoverageReport(): Promise<EvidenceSourceCoverageReport> {
  const [
    interactionLogs,
    studentStepResponses,
    simulationSessions,
    simulationLogs,
    userAnswers,
    abilityAssessments,
    promptAssessments,
    designSessions,
    arenaBlackBoxExperiments,
    arenaVirtualSimulationRuns,
    arenaSubmissions,
    arenaEvaluationRuns,
    learningFacts,
  ] = await Promise.all([
    prisma.interactionLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: SOURCE_COVERAGE_ROW_LIMIT,
      select: {
        id: true,
        userId: true,
        eventType: true,
        eventData: true,
        clientEventAt: true,
        createdAt: true,
      },
    }),
    prisma.studentStepResponse.findMany({
      orderBy: { submittedAt: 'desc' },
      take: SOURCE_COVERAGE_ROW_LIMIT,
      select: {
        id: true,
        userId: true,
        submittedAt: true,
      },
    }),
    prisma.simulationSession.findMany({
      orderBy: { createdAt: 'desc' },
      take: SOURCE_COVERAGE_ROW_LIMIT,
      select: {
        id: true,
        userId: true,
        module: true,
        simType: true,
        inputParams: true,
        artifacts: true,
        createdAt: true,
      },
    }),
    prisma.simulationLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: SOURCE_COVERAGE_ROW_LIMIT,
      select: {
        id: true,
        userId: true,
        inputParams: true,
        metrics: true,
        createdAt: true,
      },
    }),
    prisma.userAnswer.findMany({
      orderBy: { createdAt: 'desc' },
      take: SOURCE_COVERAGE_ROW_LIMIT,
      select: {
        id: true,
        userId: true,
        createdAt: true,
        question: {
          select: {
            source: true,
          },
        },
      },
    }),
    prisma.abilityAssessment.findMany({
      orderBy: { assessedAt: 'desc' },
      take: SOURCE_COVERAGE_ROW_LIMIT,
      select: {
        id: true,
        userId: true,
        assessedAt: true,
      },
    }),
    prisma.promptAssessment.findMany({
      orderBy: { createdAt: 'desc' },
      take: SOURCE_COVERAGE_ROW_LIMIT,
      select: {
        id: true,
        userId: true,
        sessionId: true,
        structuredData: true,
        createdAt: true,
      },
    }),
    prisma.designSession.findMany({
      orderBy: { startedAt: 'desc' },
      take: SOURCE_COVERAGE_ROW_LIMIT,
      select: {
        id: true,
        userId: true,
        taskType: true,
        designActions: true,
        startedAt: true,
      },
    }),
    prisma.arenaBlackBoxExperiment.findMany({
      orderBy: { createdAt: 'desc' },
      take: SOURCE_COVERAGE_ROW_LIMIT,
      select: {
        id: true,
        userId: true,
        taskId: true,
        signalType: true,
        payload: true,
        createdAt: true,
      },
    }),
    prisma.arenaVirtualSimulationRun.findMany({
      orderBy: { createdAt: 'desc' },
      take: SOURCE_COVERAGE_ROW_LIMIT,
      select: {
        id: true,
        userId: true,
        taskId: true,
        datasetHash: true,
        controllerHash: true,
        scenarioId: true,
        simulationRunId: true,
        payload: true,
        createdAt: true,
      },
    }),
    prisma.arenaSubmission.findMany({
      orderBy: { submittedAt: 'desc' },
      take: SOURCE_COVERAGE_ROW_LIMIT,
      select: {
        id: true,
        userId: true,
        taskId: true,
        classId: true,
        seasonId: true,
        publicationId: true,
        submittedAt: true,
      },
    }),
    prisma.arenaEvaluationRun.findMany({
      orderBy: { completedAt: 'desc' },
      take: SOURCE_COVERAGE_ROW_LIMIT,
      select: {
        id: true,
        taskId: true,
        metadata: true,
        completedAt: true,
      },
    }),
    prisma.learningFact.findMany({
      orderBy: { startedAt: 'desc' },
      take: SOURCE_COVERAGE_ROW_LIMIT,
      select: {
        id: true,
        userId: true,
        factType: true,
        sourceEventId: true,
        contextJson: true,
        startedAt: true,
      },
    }),
  ]);

  const rowsBySource = {
    InteractionLog: interactionLogs.map((row): EvidenceCoverageRow => ({
      id: row.id,
      userId: row.userId,
      occurredAt: row.clientEventAt ?? row.createdAt,
      eventType: row.eventType,
      eventData: row.eventData,
      sourceLabel: compactSourceLabel(
        readObject(row.eventData).source,
        readObject(row.eventData).sourceType,
        readObject(row.eventData).sourceSystem,
      ),
    })),
    StudentStepResponse: studentStepResponses.map((row): EvidenceCoverageRow => ({
      id: row.id,
      userId: row.userId,
      occurredAt: row.submittedAt,
    })),
    SimulationSession: simulationSessions.map((row): EvidenceCoverageRow => ({
      id: row.id,
      userId: row.userId,
      occurredAt: row.createdAt,
      eventData: {
        module: row.module,
        simType: row.simType,
        inputParams: row.inputParams,
        artifacts: row.artifacts,
      },
      sourceLabel: compactSourceLabel(
        readObject(row.inputParams).source,
        readObject(row.artifacts).source,
        row.module,
        row.simType,
      ),
    })),
    SimulationLog: simulationLogs.map((row): EvidenceCoverageRow => ({
      id: row.id,
      userId: row.userId,
      occurredAt: row.createdAt,
      eventData: {
        inputParams: row.inputParams,
        metrics: row.metrics,
      },
      sourceLabel: compactSourceLabel(
        readObject(row.inputParams).source,
        readObject(row.metrics).source,
      ),
    })),
    UserAnswer: userAnswers.map((row): EvidenceCoverageRow => ({
      id: row.id,
      userId: row.userId,
      occurredAt: row.createdAt,
      sourceLabel: row.question.source,
    })),
    AbilityAssessment: abilityAssessments.map((row): EvidenceCoverageRow => ({
      id: row.id,
      userId: row.userId,
      occurredAt: row.assessedAt,
    })),
    PromptAssessment: promptAssessments.map((row): EvidenceCoverageRow => ({
      id: row.id,
      userId: row.userId,
      occurredAt: row.createdAt,
      eventData: row.structuredData,
      sourceLabel: compactSourceLabel(row.sessionId, readObject(row.structuredData).source),
    })),
    DesignSession: designSessions.map((row): EvidenceCoverageRow => ({
      id: row.id,
      userId: row.userId,
      occurredAt: row.startedAt,
      eventData: { designActions: row.designActions },
      sourceLabel: row.taskType,
    })),
    ArenaBlackBoxExperiment: arenaBlackBoxExperiments.map((row): EvidenceCoverageRow => ({
      id: row.id,
      userId: row.userId,
      occurredAt: row.createdAt,
      eventData: row.payload,
      sourceLabel: compactSourceLabel(readObject(row.payload).source, row.signalType, row.taskId),
    })),
    ArenaVirtualSimulationRun: arenaVirtualSimulationRuns.map((row): EvidenceCoverageRow => ({
      id: row.id,
      userId: row.userId,
      occurredAt: row.createdAt,
      eventData: buildArenaVirtualSimulationRunEventData(row),
      sourceLabel: compactSourceLabel(
        readObject(row.payload).source,
        row.scenarioId,
        row.taskId,
        row.datasetHash,
        row.controllerHash,
      ),
    })),
    ArenaSubmission: arenaSubmissions.map((row): EvidenceCoverageRow => ({
      id: row.id,
      userId: row.userId,
      occurredAt: row.submittedAt,
      sourceLabel: compactSourceLabel(row.publicationId ? 'classroom-publication' : null, row.classId, row.seasonId, row.taskId),
    })),
    ArenaEvaluationRun: arenaEvaluationRuns.map((row): EvidenceCoverageRow => ({
      id: row.id,
      occurredAt: row.completedAt,
      eventData: row.metadata,
      sourceLabel: compactSourceLabel(readObject(row.metadata).source, row.taskId),
    })),
    LearningFact: learningFacts.map((row): EvidenceCoverageRow => ({
      id: row.id,
      userId: row.userId,
      occurredAt: row.startedAt,
      eventData: row.contextJson,
      sourceLabel: compactSourceLabel(row.factType, row.sourceEventId ?? undefined),
    })),
  };

  return buildEvidenceSourceCoverageReport({ rowsBySource });
}

async function collectSarArenaOfficialAuthority(): Promise<SarArenaAuthorityInput> {
  const submissions = await prisma.arenaSubmission.findMany({
    orderBy: { submittedAt: 'desc' },
    take: SOURCE_COVERAGE_ROW_LIMIT,
    select: {
      id: true,
      taskId: true,
      score: true,
      valid: true,
      submissionAttemptKey: true,
      submittedAt: true,
      evaluationRunId: true,
    },
  });
  const submissionEvaluationRunIds = Array.from(new Set(
    submissions.map((submission) => submission.evaluationRunId),
  )).sort((left, right) => left.localeCompare(right));
  const evaluationRuns = submissionEvaluationRunIds.length
    ? await prisma.arenaEvaluationRun.findMany({
        where: { id: { in: submissionEvaluationRunIds } },
        orderBy: { completedAt: 'desc' },
        select: {
          id: true,
          taskId: true,
          metrics: true,
          protocolVersion: true,
          completedAt: true,
        },
      })
    : [];
  const returnedEvaluationRunIds = new Set(evaluationRuns.map((run) => run.id));
  const officialSubmissions = submissions.filter((submission) => (
    returnedEvaluationRunIds.has(submission.evaluationRunId)
  ));
  const latestEvaluationCompletedAt = evaluationRuns
    .map((run) => run.completedAt.toISOString())
    .sort()
    .at(-1) ?? null;

  return {
    scoreSource: 'ArenaSubmission',
    validitySource: 'ArenaSubmission',
    rankingSource: 'ArenaSubmission',
    attemptPolicySource: 'ArenaSubmission',
    evaluationMetricsSource: 'ArenaEvaluationRun',
    auxiliarySources: ['LearningFact', 'SARTrace', 'KAQWriteback'],
    officialRecords: {
      submissionCount: officialSubmissions.length,
      evaluationRunCount: evaluationRuns.length,
      latestSubmissionAt: officialSubmissions[0]?.submittedAt.toISOString() ?? null,
      latestEvaluationCompletedAt,
      scoreRefs: officialSubmissions.map((submission) => `ArenaSubmission:${submission.id}:score:${submission.score}`),
      validityRefs: officialSubmissions.map((submission) => `ArenaSubmission:${submission.id}:valid:${submission.valid}`),
      rankingRefs: officialSubmissions.map((submission) => `ArenaSubmission:${submission.taskId}:score-rank`),
      attemptPolicyRefs: officialSubmissions.map((submission) => (
        `ArenaSubmission:${submission.id}:attempt:${submission.submissionAttemptKey ?? 'submission-order'}`
      )),
      evaluationMetricRefs: evaluationRuns.map((run) => `ArenaEvaluationRun:${run.id}:metrics:${run.protocolVersion}`),
    },
  };
}

function markSarRefreshPersistenceBlocked(
  sources: SarRefreshSourceInput[],
  blocked: boolean,
): SarRefreshSourceInput[] {
  if (!blocked) return sources;
  return sources.map((source) => (
    source.result
      ? {
          ...source,
          failureCount: Math.max(source.failureCount ?? 0, 1),
          retryState: 'blocked',
          limitations: [
            ...(source.limitations ?? []),
            'sar-persistence-file-path-required',
          ],
        }
      : source
  ));
}

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const requestedRiskId = request.nextUrl.searchParams.get('riskId')?.trim() || null;
    const requestedSurface = request.nextUrl.searchParams.get('surface')?.trim() || null;
    const requestedLessonPlanId = request.nextUrl.searchParams.get('lessonPlanId')?.trim() || null;
    const requestedTab = request.nextUrl.searchParams.get('tab')?.trim() || null;
    const requestedGraphNodeId = request.nextUrl.searchParams.get('graphNodeId')?.trim() || null;
    const requestedGraphAudit = request.nextUrl.searchParams.get('audit')?.trim() || null;
    const shouldRecordRefresh = request.nextUrl.searchParams.get('recordOperation') === 'refresh';
    const graphCenterAudit = requestedGraphNodeId
      ? {
          graphNodeId: requestedGraphNodeId,
          audit: requestedGraphAudit,
          preferredTab: requestedGraphAudit === 'overlay-limitations'
            ? 'cache' as const
            : requestedGraphAudit === 'resource-binding' || requestedGraphAudit === 'citation-readiness'
              ? 'sources' as const
              : 'overview' as const,
        }
      : null;
    const authoringLessonPlan = requestedSurface === 'authoring' && requestedLessonPlanId
      ? await prisma.lessonPlan.findUnique({
          where: { id: requestedLessonPlanId },
          select: { id: true },
        })
      : null;
    const authoringContext = requestedSurface === 'authoring'
      ? {
          surface: 'authoring' as const,
          lessonPlanId: requestedLessonPlanId,
          lessonPlanMissing: Boolean(requestedLessonPlanId && !authoringLessonPlan),
          requestedTab,
          reportHref: requestedLessonPlanId
            ? `/admin/data-governance?surface=authoring&tab=reports&lessonPlanId=${encodeURIComponent(requestedLessonPlanId)}`
            : '/admin/data-governance?surface=authoring&tab=reports',
          recoveryHref: requestedLessonPlanId
            ? `/admin/lesson-plans/${encodeURIComponent(requestedLessonPlanId)}/edit?returnTo=%2Fadmin%2Fdata-governance`
            : '/admin/lesson-plans',
        }
      : null;

    // Get queue stats from Redis
    const redis = redisClient.getClient();
    const queueStats = {
      eventIngestion: { waiting: 0, active: 0, completed: 0, failed: 0 },
      studentSnapshot: { waiting: 0, active: 0, completed: 0, failed: 0 },
      classSnapshot: { waiting: 0, active: 0, completed: 0, failed: 0 },
    };

    if (redis) {
      try {
        // BullMQ stores queue metadata in Redis
        const ingestionJobs = await redis.keys('bull:event-ingestion:*');
        const studentJobs = await redis.keys('bull:snapshot-student:*');
        const classJobs = await redis.keys('bull:snapshot-class:*');

        queueStats.eventIngestion.waiting = ingestionJobs.filter(k => k.includes(':wait')).length;
        queueStats.studentSnapshot.waiting = studentJobs.filter(k => k.includes(':wait')).length;
        queueStats.classSnapshot.waiting = classJobs.filter(k => k.includes(':wait')).length;
      } catch (error) {
        console.error('[DataGovernanceStatus] Error fetching queue stats:', error);
      }
    }

    // Get snapshot counts
    const [
      studentSnapshotCount,
      classSnapshotCount,
      learningFactCount,
      riskFlagCount,
      recentSnapshots,
      snapshotLeaders,
      recentRiskFlags,
      learningFacts,
      featureCache,
      recentSessionQualityReports,
      sourceCoverageReport,
      sarArenaAuthority,
    ] = await Promise.all([
      prisma.studentCompetencySnapshot.count(),
      prisma.classCompetencySnapshot.count(),
      prisma.learningFact.count(),
      prisma.studentRiskFlag.count({
        where: { isResolved: false },
      }),
      prisma.studentCompetencySnapshot.findMany({
        orderBy: { snapshotAt: 'desc' },
        take: 5,
        select: {
          userId: true,
          snapshotAt: true,
          factCount: true,
        },
      }),
      prisma.studentCompetencySnapshot.findMany({
        orderBy: { snapshotAt: 'desc' },
        take: 40,
        select: {
          userId: true,
          snapshotAt: true,
          factCount: true,
        },
      }),
      prisma.studentRiskFlag.findMany({
        where: { isResolved: false },
        orderBy: { triggeredAt: 'desc' },
        take: 8,
        select: {
          id: true,
          userId: true,
          flagType: true,
          severity: true,
          description: true,
          triggeredAt: true,
          isResolved: true,
          resolvedAt: true,
          resolutionNote: true,
          evidenceJson: true,
          user: {
            select: {
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.learningFact.findMany({
        orderBy: { createdAt: 'desc' },
        take: 400,
        select: {
          factType: true,
        },
      }),
      getStudentEvidenceFeatureCacheAdminSummary(prisma),
      prisma.classSessionReport.findMany({
        where: {
          reportType: 'class-summary',
          status: 'READY',
        },
        orderBy: {
          updatedAt: 'desc',
        },
        take: 20,
        select: {
          sessionId: true,
          lessonKey: true,
          status: true,
          summary: true,
          updatedAt: true,
          reportData: true,
        },
      }),
      collectEvidenceSourceCoverageReport(),
      collectSarArenaOfficialAuthority(),
    ]);
    const targetRiskFlag = requestedRiskId && !recentRiskFlags.some((risk) => risk.id === requestedRiskId)
      ? await prisma.studentRiskFlag.findUnique({
          where: { id: requestedRiskId },
          select: {
            id: true,
            userId: true,
            flagType: true,
            severity: true,
            description: true,
            triggeredAt: true,
            isResolved: true,
            resolvedAt: true,
            resolutionNote: true,
            evidenceJson: true,
            user: {
              select: {
                name: true,
                email: true,
              },
            },
          },
        })
      : null;

    // Get Redis buffer stats
    const today = new Date().toISOString().split('T')[0];
    let bufferedEventCount = 0;
    if (redis) {
      try {
        bufferedEventCount = await redis.llen(`event:buffer:secondary:${today}`);
      } catch {
        // Ignore Redis errors
      }
    }

    // Calculate freshness (time since last snapshot)
    const lastSnapshotTime = recentSnapshots[0]?.snapshotAt;
    const freshnessMinutes = lastSnapshotTime
      ? Math.round((Date.now() - new Date(lastSnapshotTime).getTime()) / (1000 * 60))
      : null;

    const snapshotUserIds = Array.from(
      new Set([...recentSnapshots.map((item) => item.userId), ...snapshotLeaders.map((item) => item.userId)])
    );
    const snapshotUsers = snapshotUserIds.length
      ? await prisma.user.findMany({
          where: { id: { in: snapshotUserIds } },
          select: {
            id: true,
            name: true,
            email: true,
          },
        })
      : [];
    const snapshotUserMap = new Map(
      snapshotUsers.map((user) => [user.id, user.name || user.email || user.id.slice(0, 8)])
    );

    const topSnapshotStudents = snapshotLeaders
      .reduce<Array<{ userId: string; snapshotAt: Date; factCount: number }>>((accumulator, item) => {
        const existing = accumulator.find((entry) => entry.userId === item.userId);
        if (!existing || item.factCount > existing.factCount) {
          return [
            ...accumulator.filter((entry) => entry.userId !== item.userId),
            item,
          ];
        }
        return accumulator;
      }, [])
      .sort((left, right) => right.factCount - left.factCount)
      .slice(0, 5);

    const sourceCoverageById = new Map(
      sourceCoverageReport.sources.map((source) => [source.sourceId, source])
    );
    const exclusionReasonsBySource = sourceCoverageReport.exclusions.reduce<Record<string, string[]>>(
      (accumulator, exclusion) => {
        accumulator[exclusion.sourceId] = [
          ...(accumulator[exclusion.sourceId] ?? []),
          exclusion.reason,
        ];
        return accumulator;
      },
      {},
    );

    const completedAt = new Date().toISOString();
    const sarDiagnostics = buildControlCorrectionSarDemoFixture(completedAt).report;
    const sarPersistenceFilePath = process.env.SAR_PERSISTENCE_FILE_PATH?.trim() || undefined;
    const sarPersistencePathMissing = shouldRecordRefresh && !sarPersistenceFilePath;
    const sarRefreshSources = markSarRefreshPersistenceBlocked(
      buildControlCorrectionSarRefreshSources(completedAt, {
        coverageSources: sourceCoverageReport.sources,
        arenaAuthority: sarArenaAuthority,
      }),
      sarPersistencePathMissing,
    );
    const sarRefresh = runSarProjectionRefresh({
      repository: createSarPersistenceRepository({
        filePath: sarPersistencePathMissing ? undefined : sarPersistenceFilePath,
        now: () => completedAt,
      }),
      sources: sarRefreshSources,
      now: completedAt,
      persist: shouldRecordRefresh && !sarPersistencePathMissing,
    });
    const sarRefreshHealth = sarRefresh.health;
    const operationLedger = shouldRecordRefresh
      ? buildAdminOperationLedgerEntry({
          kind: 'admin-governance-refresh',
          actorId: session.user.id,
          actorRole: session.user.role,
          scope: 'admin-data-governance-status',
          startedAt: completedAt,
          completedAt,
          outcome: sarPersistencePathMissing ? 'blocked' : 'completed',
          idempotencyKey: buildAdminOperationIdempotencyKey([
            'admin-governance-refresh',
            session.user.id,
            requestedRiskId ?? '',
            requestedSurface ?? '',
            requestedGraphNodeId ?? '',
            requestedGraphAudit ?? '',
          ]),
          rollback: {
            available: false,
            rationale: '数据治理刷新只读取状态，不修改业务数据，无需回滚。',
          },
          auditSummary: `数据治理状态刷新${sarPersistencePathMissing ? '被阻止' : '已完成'}：activeRiskFlags=${riskFlagCount}，learningFacts=${learningFactCount}，sarRefresh=${sarRefreshHealth.status}，sarStaleSources=${sarRefreshHealth.totals.staleSourceCount}，sarFailures=${sarRefreshHealth.totals.failureCount}。`,
          recoveryState: {
            status: sarPersistencePathMissing ? 'retry' : 'available',
            action: sarPersistencePathMissing
              ? '配置 SAR_PERSISTENCE_FILE_PATH 后重试刷新'
              : '复核治理风险或导出风险文件',
          },
        })
      : null;
    if (operationLedger) {
      sarRefreshHealth.operationEvidence = {
        operationId: operationLedger.operationId,
        idempotencyKey: operationLedger.idempotencyKey,
      };
    }
    if (operationLedger) {
      await persistAdminOperationLedger(operationLedger);
    }

    const payload = {
      status: 'healthy',
      timestamp: completedAt,
      operationLedger: operationLedger ?? undefined,
      authoringContext,
      graphCenterAudit,
      queues: queueStats,
      data: {
        studentSnapshots: studentSnapshotCount,
        classSnapshots: classSnapshotCount,
        learningFacts: learningFactCount,
        activeRiskFlags: riskFlagCount,
        bufferedEvents: bufferedEventCount,
      },
      freshness: {
        lastSnapshotMinutes: freshnessMinutes,
        status: freshnessMinutes && freshnessMinutes < 60 ? 'fresh' : 'stale',
      },
      recentSnapshots: recentSnapshots.map(s => ({
        userId: s.userId,
        userName: snapshotUserMap.get(s.userId) || s.userId.slice(0, 8),
        snapshotAt: s.snapshotAt.toISOString(),
        factCount: s.factCount,
      })),
      topSnapshotStudents: topSnapshotStudents.map((item) => ({
        userId: item.userId,
        userName: snapshotUserMap.get(item.userId) || item.userId.slice(0, 8),
        snapshotAt: item.snapshotAt.toISOString(),
        factCount: item.factCount,
      })),
      recentRiskFlags: recentRiskFlags.map(mapGovernanceRiskPayload),
      targetRiskFlag: targetRiskFlag ? mapGovernanceRiskPayload(targetRiskFlag) : null,
      factTypeDistribution: summarizeLearningFactTypes(learningFacts),
      sessionQuality: summarizeSessionQuality(recentSessionQualityReports),
      featureCache,
      sarDiagnostics,
      sarRefreshHealth,
      sourceCoverage: sourceCoverageReport,
      sourceCatalog: {
        totalSources: getEvidenceSourceCatalog().length,
        coverageCommand: 'npm run db:evidence-source-coverage -- --text',
        sources: getEvidenceSourceCatalog().map((source) => {
          const coverage = sourceCoverageById.get(source.id);
          return {
            id: source.id,
            learningScope: source.learningScope,
            valueLevel: source.defaultValueLevel,
            eligibility: source.defaultEligibility,
            materializationReadiness: coverage?.materializationReadiness ?? source.materializationReadiness,
            totalRows: coverage?.totalRows ?? 0,
            eligibleRows: coverage?.eligibleRows ?? 0,
            excludedRows: coverage?.excludedRows ?? 0,
            unsupportedRows: coverage?.unsupportedRows ?? 0,
            affectedUsers: coverage?.affectedUsers ?? 0,
            provenanceCounts: coverage?.provenanceCounts ?? {},
            readinessGapCounts: coverage?.readinessGapCounts ?? {},
            exclusionReasons: exclusionReasonsBySource[source.id] ?? [],
          };
        }),
      },
    };
    return NextResponse.json(payload, {
      headers: operationLedger ? operationLedgerHeaders(operationLedger) : undefined,
    });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[DataGovernanceStatus] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
