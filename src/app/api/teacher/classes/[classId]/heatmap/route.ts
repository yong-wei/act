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
} from '@/lib/data-governance/portrait-v2-consumer';
import {
  buildClassScopedStudentProjections,
  CUMULATIVE_CLASS_COMPETENCY_MATERIALIZATION_VERSION,
} from '@/lib/data-governance/class-scoped-learning-materialization';
import { buildTeacherScopedLearningFactScopeFilters } from '@/lib/data-governance/teacher-evidence-governance';
// PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: the scoped legacy vector is a non-authoritative v2 projection input.
import type { CompetencyVector } from '@/lib/data-governance/competency-model';
import {
  derivePortraitV2Compatibility,
  projectPortraitV2ForConsumer,
  readLatestValidNativePortraitV2Snapshots,
} from '@/lib/data-governance/portrait-v2-model';
import { createDatabaseUnavailableResponse, isDatabaseConnectivityError } from '@/lib/service-availability';
import {
  getTeacherAttainmentScopeLabel,
  parseTeacherAttainmentScope,
  type TeacherAttainmentScope,
} from '@/lib/data-governance/teacher-attainment-scope';

export const dynamic = 'force-dynamic';

export interface HeatmapData {
  scope: TeacherAttainmentScope;
  scopeLabel: string;
  nearStageChangeApplicable: boolean;
  coverage: {
    rosterStudents: number;
    coveredStudents: number;
  };
  students: Array<{
    id: string;
    name: string | null;
    avatar: string | null;
    studentNumber: string | null;
    coverageState: 'covered' | 'no-evidence';
  }>;
  dimensions: string[];
  matrix: Array<{
    studentId: string;
    dimension: string;
    score: number;
    change: number | null;
    riskLevel: 'none' | 'low' | 'medium' | 'high' | null;
  }>;
  lastUpdated: string;
}

// Cache TTL: 15 minutes
const CACHE_TTL = 15 * 60;

type ScopedFactClock = {
  startedAt: Date;
  finishedAt: Date | null;
};

// PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: this helper exposes only a v2 compatibility projection.
function buildScopedPortrait(
  userId: string,
  vector: CompetencyVector,
  facts: ScopedFactClock[],
  now: Date,
) {
  const snapshotTime = Math.max(...facts.map((fact) => (fact.finishedAt ?? fact.startedAt).getTime()));
  const snapshotAt = new Date(snapshotTime);
  // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: normalize the non-authoritative vector to scoped fact time.
  const compatibilityVector = Object.fromEntries(Object.entries(vector).map(([dimension, value]) => [
    dimension,
    {
      ...value,
      // The projection calculator stamps its execution time. A compatibility
      // portrait must instead carry the latest timestamp of its scoped facts.
      lastUpdated: snapshotAt.toISOString(),
    },
  ])) as CompetencyVector;
  // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: legacy sourceFamily is compatibility provenance, not authority.
  return projectPortraitV2ForConsumer(derivePortraitV2Compatibility({
    userId,
    snapshotAt: snapshotAt.toISOString(),
    // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: source and vector are compatibility-only.
    sourceFamily: 'StudentCompetencySnapshot',
    vector: compatibilityVector,
    now,
  }), 'reviewer');
}

function latestFactTimestamp(facts: ScopedFactClock[]) {
  if (facts.length === 0) return null;
  return new Date(Math.max(...facts.map((fact) => (fact.finishedAt ?? fact.startedAt).getTime()))).toISOString();
}

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
    const scope = parseTeacherAttainmentScope(searchParams.get('scope'));
    if (!scope) {
      return NextResponse.json({ error: '无效的学情范围' }, { status: 400 });
    }
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
        scope,
        scopeLabel: getTeacherAttainmentScopeLabel(scope),
        nearStageChangeApplicable: scope === 'recent',
        coverage: { rosterStudents: 0, coveredStudents: 0 },
        students: [],
        dimensions: PORTRAIT_V2_DIMENSIONS.map((dimension) => dimension.id),
        matrix: [],
        lastUpdated: new Date().toISOString(),
      } as HeatmapData);
    }

    const now = new Date();
    if (scope === 'cumulative') {
      const [classSnapshot, portraitByUserId] = await Promise.all([
        prisma.classCompetencySnapshot.findFirst({
          where: {
            classId,
            materializationVersion: CUMULATIVE_CLASS_COMPETENCY_MATERIALIZATION_VERSION,
          },
          orderBy: { snapshotAt: 'desc' },
        }),
        readLatestValidNativePortraitV2Snapshots(prisma, studentIds, 'reviewer', { now }),
      ]);
      const dimensions: PortraitV2DimensionId[] = dimensionFilter
        ? [dimensionFilter]
        : PORTRAIT_V2_DIMENSIONS.map((dimension) => dimension.id);
      const matrix: HeatmapData['matrix'] = [];

      for (const studentId of studentIds) {
        const portrait = portraitByUserId.get(studentId);
        if (!portrait || !hasPortraitV2Evidence(portrait)) continue;
        for (const dimension of dimensions) {
          const value = portrait.dimensions.find((item) => item.id === dimension);
          if (!value || value.evidenceSummary.totalCount <= 0) continue;
          matrix.push({
            studentId,
            dimension,
            score: Math.round(value.score),
            change: null,
            riskLevel: null,
          });
        }
      }

      const response: HeatmapData = {
        scope,
        scopeLabel: getTeacherAttainmentScopeLabel(scope),
        nearStageChangeApplicable: false,
        coverage: {
          rosterStudents: studentIds.length,
          coveredStudents: [...portraitByUserId.values()].filter(hasPortraitV2Evidence).length,
        },
        students: classStudents.map((student) => ({
          id: student.user.id,
          name: student.user.name,
          avatar: student.user.image,
          studentNumber: student.studentNumber,
          coverageState: portraitByUserId.get(student.userId)
            && hasPortraitV2Evidence(portraitByUserId.get(student.userId)!)
            ? 'covered'
            : 'no-evidence',
        })),
        dimensions,
        matrix,
        lastUpdated: classSnapshot?.snapshotAt.toISOString()
          ?? [...portraitByUserId.values()].map((portrait) => portrait.generatedAt).sort().at(-1)
          ?? now.toISOString(),
      };
      const headers = new Headers();
      headers.set('Cache-Control', `private, max-age=${CACHE_TTL}`);
      return NextResponse.json(response, { headers });
    }

    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60_000);
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60_000);
    const classSessionIds = (await prisma.classSession.findMany({
      where: { classId },
      select: { id: true },
    })).map((classSession) => classSession.id);
    const scopedFacts = await prisma.learningFact.findMany({
      where: {
        userId: { in: studentIds },
        startedAt: { gte: sixtyDaysAgo },
        OR: buildTeacherScopedLearningFactScopeFilters(classId, classSessionIds),
      },
      orderBy: { startedAt: 'desc' },
    });
    const currentFacts = scopedFacts.filter((fact) => fact.startedAt >= thirtyDaysAgo);
    const previousFacts = scopedFacts.filter((fact) => fact.startedAt < thirtyDaysAgo);
    // The buckets are already bounded here; do not apply the calculator's
    // moving 30-day cutoff again to the 30-60 day comparison bucket.
    const currentProjectionByUserId = buildClassScopedStudentProjections(studentIds, currentFacts, 'all');
    const previousProjectionByUserId = buildClassScopedStudentProjections(studentIds, previousFacts, 'all');
    // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: scoped vectors are projected before heatmap consumption.
    const currentPortraitByUserId = new Map([...currentProjectionByUserId].map(([studentId, projection]) => [
      studentId,
      buildScopedPortrait(studentId, projection.competencyVector, currentFacts.filter((fact) => fact.userId === studentId), now),
    ] as const));
    // PORTRAIT_V2_LEGACY_COMPATIBILITY_ADAPTER: previous scoped vectors remain comparison-only compatibility data.
    const previousPortraitByUserId = new Map([...previousProjectionByUserId].map(([studentId, projection]) => [
      studentId,
      buildScopedPortrait(studentId, projection.competencyVector, previousFacts.filter((fact) => fact.userId === studentId), now),
    ] as const));

    // Build heatmap matrix
    const dimensions: PortraitV2DimensionId[] = dimensionFilter
      ? [dimensionFilter]
      : PORTRAIT_V2_DIMENSIONS.map((dimension) => dimension.id);

    const matrix: HeatmapData['matrix'] = [];

    for (const studentId of studentIds) {
      const currentPortrait = currentPortraitByUserId.get(studentId);
      if (!currentPortrait) continue;
      if (!hasPortraitV2Evidence(currentPortrait)) continue;
      const previousPortrait = previousPortraitByUserId.get(studentId) ?? null;

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
        let dimensionRiskLevel: HeatmapData['matrix'][0]['riskLevel'] = 'none';
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
      scope,
      scopeLabel: getTeacherAttainmentScopeLabel(scope),
      nearStageChangeApplicable: true,
      coverage: {
        rosterStudents: studentIds.length,
        coveredStudents: currentPortraitByUserId.size,
      },
      students: classStudents.map(cs => ({
        id: cs.user.id,
        name: cs.user.name,
        avatar: cs.user.image,
        studentNumber: cs.studentNumber,
        coverageState: currentPortraitByUserId.has(cs.userId) ? 'covered' : 'no-evidence',
      })),
      dimensions,
      matrix,
      lastUpdated: latestFactTimestamp(currentFacts) ?? now.toISOString(),
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
