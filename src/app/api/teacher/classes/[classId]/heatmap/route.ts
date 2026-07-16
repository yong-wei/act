/**
 * Class Competency Heatmap API
 *
 * Returns a heatmap view of student competencies across dimensions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import { PORTRAIT_V2_DIMENSIONS, type PortraitV2DimensionId } from '@/lib/data-governance/kaq-objective-taxonomy';
import {
  hasPortraitV2Evidence,
  resolvePrimaryPortraitV2,
  selectPortraitV2WithCompatibilityFallback,
} from '@/lib/data-governance/portrait-v2-consumer';
import { createDatabaseUnavailableResponse, isDatabaseConnectivityError } from '@/lib/service-availability';

export const dynamic = 'force-dynamic';

export interface HeatmapData {
  students: Array<{
    id: string;
    name: string | null;
    avatar: string | null;
    studentNumber: string | null;
  }>;
  dimensions: string[];
  matrix: Array<{
    studentId: string;
    dimension: string;
    score: number;
    change: number;
    riskLevel: 'none' | 'low' | 'medium' | 'high';
  }>;
  lastUpdated: string;
}

// Cache TTL: 15 minutes
const CACHE_TTL = 15 * 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> }
) {
  try {
    const session = await getServerAuthSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    if (session.user.role !== 'TEACHER' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const { classId } = await params;
    const { searchParams } = new URL(request.url);
    const requestedDimension = searchParams.get('dimension');
    const dimensionFilter = PORTRAIT_V2_DIMENSIONS.some((dimension) => dimension.id === requestedDimension)
      ? requestedDimension as PortraitV2DimensionId
      : null;

    // Verify class ownership
    const classInfo = await prisma.class.findUnique({
      where: { id: classId },
      select: { teacherId: true },
    });

    if (!classInfo) {
      return NextResponse.json({ error: '班级不存在' }, { status: 404 });
    }

    if (session.user.role !== 'ADMIN' && classInfo.teacherId !== session.user.id) {
      return NextResponse.json({ error: '仅可查看本人班级数据' }, { status: 403 });
    }

    // Get all students in the class via StudentProfile
    const classStudents = await prisma.studentProfile.findMany({
      where: { classId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            image: true,
          },
        },
      },
    });

    const studentIds = classStudents.map(cs => cs.userId);

    if (studentIds.length === 0) {
      return NextResponse.json({
        students: [],
        dimensions: PORTRAIT_V2_DIMENSIONS.map((dimension) => dimension.id),
        matrix: [],
        lastUpdated: new Date().toISOString(),
      } as HeatmapData);
    }

    // Get latest competency snapshots for all students
    const latestSnapshots = await prisma.studentCompetencySnapshot.findMany({
      where: {
        userId: { in: studentIds },
      },
      orderBy: { snapshotAt: 'desc' },
      distinct: ['userId'],
    });

    const latestPortraitSnapshots = await prisma.studentPortraitV2Snapshot.findMany({
      where: { userId: { in: studentIds } },
      orderBy: { snapshotAt: 'desc' },
      distinct: ['userId'],
    });

    // Get previous snapshots for change calculation (30 days ago)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const previousSnapshots = await prisma.studentCompetencySnapshot.findMany({
      where: {
        userId: { in: studentIds },
        snapshotAt: { lte: thirtyDaysAgo },
      },
      orderBy: [{ userId: 'asc' }, { snapshotAt: 'desc' }],
    });
    const previousSnapshotByUserId = previousSnapshots.reduce<Record<string, (typeof previousSnapshots)[number]>>(
      (accumulator, snapshot) => {
        if (!accumulator[snapshot.userId]) {
          accumulator[snapshot.userId] = snapshot;
        }
        return accumulator;
      },
      {},
    );

    const previousPortraitSnapshots = await prisma.studentPortraitV2Snapshot.findMany({
      where: {
        userId: { in: studentIds },
        snapshotAt: { lte: thirtyDaysAgo },
      },
      orderBy: [{ userId: 'asc' }, { snapshotAt: 'desc' }],
    });
    const previousPortraitSnapshotByUserId = previousPortraitSnapshots.reduce<Record<string, (typeof previousPortraitSnapshots)[number]>>(
      (accumulator, snapshot) => {
        if (!accumulator[snapshot.userId]) {
          accumulator[snapshot.userId] = snapshot;
        }
        return accumulator;
      },
      {},
    );

    const latestSnapshotByUserId = new Map(latestSnapshots.map((snapshot) => [snapshot.userId, snapshot]));
    const latestPortraitSnapshotByUserId = new Map(latestPortraitSnapshots.map((snapshot) => [snapshot.userId, snapshot]));
    const featureCaches = await prisma.studentEvidenceFeatureCache.findMany({
      where: { userId: { in: studentIds } },
      select: { userId: true, features: true },
    });
    const featureCacheByUserId = new Map(featureCaches.map((cache) => [cache.userId, cache]));
    const resolvedPortraitByUserId = new Map(
      await Promise.all(studentIds.map(async (studentId) => {
        const resolution = await resolvePrimaryPortraitV2(
          {
            studentPortraitV2Snapshot: {
              findFirst: async () => latestPortraitSnapshotByUserId.get(studentId) ?? null,
            },
          },
          studentId,
          'reviewer',
          {
            legacySnapshot: latestSnapshotByUserId.get(studentId) as Record<string, unknown> | null,
            featureCache: featureCacheByUserId.get(studentId) as Record<string, unknown> | null,
          },
        );
        return [studentId, resolution] as const;
      })),
    );
    // Get active risk flags for all students
    const riskFlags = await prisma.studentRiskFlag.findMany({
      where: {
        userId: { in: studentIds },
        isResolved: false,
      },
    });

    // Build heatmap matrix
    const dimensions: PortraitV2DimensionId[] = dimensionFilter
      ? [dimensionFilter]
      : PORTRAIT_V2_DIMENSIONS.map((dimension) => dimension.id);

    const matrix: HeatmapData['matrix'] = [];

    for (const studentId of studentIds) {
      const resolution = resolvedPortraitByUserId.get(studentId);
      if (!resolution) continue;
      const currentPortrait = selectPortraitV2WithCompatibilityFallback(resolution, 'reviewer');
      if (!hasPortraitV2Evidence(currentPortrait)) continue;
      const previousPortraitSnapshot = previousPortraitSnapshotByUserId[studentId];
      const previousLegacySnapshot = previousSnapshotByUserId[studentId];
      const previousResolution = previousPortraitSnapshot || previousLegacySnapshot
        ? await resolvePrimaryPortraitV2(
            {
              studentPortraitV2Snapshot: {
                findFirst: async () => previousPortraitSnapshot,
              },
            },
            studentId,
            'reviewer',
            {
              legacySnapshot: previousLegacySnapshot as Record<string, unknown> | null,
            },
          )
        : null;
      const previousPortrait = previousResolution
        ? selectPortraitV2WithCompatibilityFallback(previousResolution, 'reviewer')
        : null;

      // Calculate risk level for this student
      const studentRisks = riskFlags.filter(rf => rf.userId === studentId);
      const hasHighRisk = studentRisks.some(r => r.severity === 'high');
      const hasMediumRisk = studentRisks.some(r => r.severity === 'medium');
      const riskLevel: HeatmapData['matrix'][0]['riskLevel'] = hasHighRisk
        ? 'high'
        : hasMediumRisk
          ? 'medium'
          : studentRisks.length > 0
            ? 'low'
            : 'none';

      for (const dimension of dimensions) {
        const currentDimension = currentPortrait.dimensions.find((item) => item.id === dimension);
        if (!currentDimension || currentDimension.evidenceSummary.totalCount <= 0) continue;

        const currentScore = currentDimension.score;
        const previousDimension = previousPortrait?.dimensions.find((item) => item.id === dimension);
        const previousScore = previousDimension && previousDimension.evidenceSummary.totalCount > 0
          ? previousDimension.score
          : currentScore;
        const change = Math.round((currentScore - previousScore) * 10) / 10;

        // Adjust risk level based on dimension-specific scores
        let dimensionRiskLevel = riskLevel;
        if (currentScore < 40) {
          dimensionRiskLevel = 'high';
        } else if (currentScore < 55 && dimensionRiskLevel === 'none') {
          dimensionRiskLevel = 'medium';
        }

        matrix.push({
          studentId,
          dimension,
          score: Math.round(currentScore),
          change,
          riskLevel: dimensionRiskLevel,
        });
      }
    }

    // Build response
    const response: HeatmapData = {
      students: classStudents.map(cs => ({
        id: cs.user.id,
        name: cs.user.name,
        avatar: cs.user.image,
        studentNumber: cs.studentNumber,
      })),
      dimensions,
      matrix,
      lastUpdated: new Date().toISOString(),
    };

    // Set cache headers
    const headers = new Headers();
    headers.set('Cache-Control', `private, max-age=${CACHE_TTL}`);

    return NextResponse.json(response, { headers });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[ClassHeatmap] Error:', error);
    if (isDatabaseConnectivityError(error)) {
      return createDatabaseUnavailableResponse();
    }
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
