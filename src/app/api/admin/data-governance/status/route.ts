/**
 * Data Governance Status API
 *
 * Provides monitoring data for queues, snapshots, and system health.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { redisClient } from '@/lib/redis-client';

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
        snapshotAt: s.snapshotAt.toISOString(),
        factCount: s.factCount,
      })),
    });
  } catch (error) {
    console.error('[DataGovernanceStatus] Error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
