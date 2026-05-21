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
import { summarizeLearningFactTypes } from '@/features/admin/states/system-usage-data';
import {
  buildEvidenceSourceCoverageReport,
  getEvidenceSourceCatalog,
  type EvidenceCoverageRow,
  type EvidenceSourceCoverageReport,
} from '@/lib/data-governance/evidence-source-catalog';
import { getStudentEvidenceFeatureCacheAdminSummary } from '@/lib/data-governance/student-evidence-feature-cache';
import { parseSessionGovernanceSummary } from '@/lib/classroom-session-statistics';

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
    simulationLogs,
    userAnswers,
    abilityAssessments,
    promptAssessments,
    designSessions,
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

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

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
    ]);

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
    const exclusionReasonsBySource = sourceCoverageReport.exclusions.reduce((accumulator, exclusion) => {
      const current = accumulator.get(exclusion.sourceId) ?? [];
      current.push(exclusion.reason);
      accumulator.set(exclusion.sourceId, current);
      return accumulator;
    }, new Map<string, string[]>());

    return NextResponse.json({
      status: 'healthy',
      timestamp: new Date().toISOString(),
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
      recentRiskFlags: recentRiskFlags.map((risk) => ({
        id: risk.id,
        userId: risk.userId,
        userName: risk.user.name || risk.user.email || risk.userId.slice(0, 8),
        flagType: risk.flagType,
        severity: risk.severity,
        description: risk.description,
        triggeredAt: risk.triggeredAt.toISOString(),
        isResolved: risk.isResolved,
      })),
      factTypeDistribution: summarizeLearningFactTypes(learningFacts),
      sessionQuality: summarizeSessionQuality(recentSessionQualityReports),
      featureCache,
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
            materializationReadiness: source.materializationReadiness,
            totalRows: coverage?.totalRows ?? 0,
            eligibleRows: coverage?.eligibleRows ?? 0,
            excludedRows: coverage?.excludedRows ?? 0,
            unsupportedRows: coverage?.unsupportedRows ?? 0,
            affectedUsers: coverage?.affectedUsers ?? 0,
            provenanceCounts: coverage?.provenanceCounts ?? {},
            exclusionReasons: exclusionReasonsBySource.get(source.id) ?? [],
          };
        }),
      },
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
