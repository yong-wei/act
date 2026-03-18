/**
 * Class Competency Heatmap API
 *
 * Returns a heatmap view of student competencies across dimensions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { COMPETENCY_DIMENSIONS, type CompetencyDimension } from '@/lib/data-governance/competency-model';

export interface HeatmapData {
  students: Array<{
    id: string;
    name: string | null;
    avatar: string | null;
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
    const dimensionFilter = searchParams.get('dimension') as CompetencyDimension | null;

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
        dimensions: COMPETENCY_DIMENSIONS,
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

    // Get previous snapshots for change calculation (30 days ago)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const previousSnapshots = await prisma.$queryRaw<
      Array<{
        user_id: string;
        competency_vector: string;
        snapshot_at: Date;
      }>
    >`
      SELECT DISTINCT ON (user_id) 
        user_id,
        competency_vector::text,
        snapshot_at
      FROM "StudentCompetencySnapshot"
      WHERE user_id = ANY(${studentIds}::text[])
        AND snapshot_at <= ${thirtyDaysAgo}
      ORDER BY user_id, snapshot_at DESC
    `;

    // Get active risk flags for all students
    const riskFlags = await prisma.studentRiskFlag.findMany({
      where: {
        userId: { in: studentIds },
        isResolved: false,
      },
    });

    // Build heatmap matrix
    const dimensions = dimensionFilter
      ? [dimensionFilter]
      : COMPETENCY_DIMENSIONS;

    const matrix: HeatmapData['matrix'] = [];

    for (const snapshot of latestSnapshots) {
      const vector = snapshot.competencyVector as Record<string, { score: number }>;
      const prevSnapshot = previousSnapshots.find(
        ps => ps.user_id === snapshot.userId
      );
      const prevVector = prevSnapshot
        ? (JSON.parse(prevSnapshot.competency_vector) as Record<string, { score: number }>)
        : null;

      // Calculate risk level for this student
      const studentRisks = riskFlags.filter(rf => rf.userId === snapshot.userId);
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
        const currentScore = vector[dimension]?.score ?? 0;
        const previousScore = prevVector?.[dimension]?.score ?? currentScore;
        const change = Math.round((currentScore - previousScore) * 10) / 10;

        // Adjust risk level based on dimension-specific scores
        let dimensionRiskLevel = riskLevel;
        if (currentScore < 40) {
          dimensionRiskLevel = 'high';
        } else if (currentScore < 55 && dimensionRiskLevel === 'none') {
          dimensionRiskLevel = 'medium';
        }

        matrix.push({
          studentId: snapshot.userId,
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
    console.error('[ClassHeatmap] Error:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
