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
import { getEvidenceSourceCatalog } from '@/lib/data-governance/evidence-source-catalog';

export const dynamic = 'force-dynamic';

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
      sourceCatalog: {
        totalSources: getEvidenceSourceCatalog().length,
        coverageCommand: 'npm run db:evidence-source-coverage -- --text',
        sources: getEvidenceSourceCatalog().map((source) => ({
          id: source.id,
          learningScope: source.learningScope,
          valueLevel: source.defaultValueLevel,
          eligibility: source.defaultEligibility,
          materializationReadiness: source.materializationReadiness,
        })),
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
