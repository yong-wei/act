import { NextRequest, NextResponse } from 'next/server';

import {
  isConsumerUnauthorized,
  readTeacherClassEvidencePort,
  viewerFromSession,
} from '@/features/learning-record/consumers/public-api';
import { getServerAuthSession } from '@/lib/auth';
import type { CumulativeClassPortraitReadModel } from '@/lib/data-governance/cumulative-portrait-read-model';
import {
  PORTRAIT_V2_DIMENSIONS,
  type PortraitV2DimensionId,
} from '@/lib/data-governance/kaq-objective-taxonomy';
import {
  CUMULATIVE_ATTAINMENT_LABEL,
  getUnsupportedTeacherAttainmentScopeError,
} from '@/lib/data-governance/teacher-attainment-scope';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import {
  createDatabaseUnavailableResponse,
  isDatabaseConnectivityError,
} from '@/lib/service-availability';

export const dynamic = 'force-dynamic';

export interface HeatmapData {
  scope: 'cumulative';
  scopeLabel: typeof CUMULATIVE_ATTAINMENT_LABEL;
  availability: {
    state: CumulativeClassPortraitReadModel['stateKind'];
    reason: CumulativeClassPortraitReadModel['availabilityReason'];
  };
  coverage: {
    rosterStudents: number;
    coveredStudents: number;
    noEvidenceStudents: number;
    unavailableStudents: number;
  };
  students: Array<{
    id: string;
    name: string | null;
    avatar: string | null;
    studentNumber: string | null;
    coverageState: 'covered' | 'no-evidence' | 'unavailable';
    availabilityReason: string;
    trendDirection: 'up' | 'stable' | 'down' | 'not-comparable';
    riskLevel: 'none' | 'low' | 'medium' | 'high';
  }>;
  dimensions: PortraitV2DimensionId[];
  matrix: Array<{
    studentId: string;
    dimension: PortraitV2DimensionId;
    score: number;
    confidence: number;
    change: null;
    riskLevel: 'none' | 'low' | 'medium' | 'high';
  }>;
  trendDistribution: CumulativeClassPortraitReadModel['trendDistribution'];
  riskDistribution: CumulativeClassPortraitReadModel['riskDistribution'];
  diagnosis: CumulativeClassPortraitReadModel['diagnosis'];
  lastUpdated: string | null;
}

const CACHE_TTL = 15 * 60;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ classId: string }> },
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

    const { searchParams } = new URL(request.url);
    const unsupportedScopeError = getUnsupportedTeacherAttainmentScopeError(
      searchParams.get('scope'),
    );
    if (unsupportedScopeError) {
      return NextResponse.json(unsupportedScopeError, { status: 400 });
    }
    const requestedDimension = searchParams.get('dimension');
    const dimensionFilter = PORTRAIT_V2_DIMENSIONS.some(({ id }) => id === requestedDimension)
      ? requestedDimension as PortraitV2DimensionId
      : null;
    const dimensions = dimensionFilter
      ? [dimensionFilter]
      : PORTRAIT_V2_DIMENSIONS.map(({ id }) => id);

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
      orderBy: { createdAt: 'asc' },
    });
    const teacherPort = await readTeacherClassEvidencePort({
      db: prisma,
      viewer: viewerFromSession(session, [classId]),
      classId,
      memberUserIds: classStudents.map((profile) => profile.userId),
    });
    const classPortrait = teacherPort.classPortrait;
    const portraits = teacherPort.learnerPortraits;
    const studentRows: HeatmapData['students'] = classStudents.map((profile) => {
      const portrait = portraits.get(profile.userId)!;
      return {
        id: profile.user.id,
        name: profile.user.name,
        avatar: profile.user.image,
        studentNumber: profile.studentNumber,
        coverageState: portrait.stateKind === 'SNAPSHOT'
          ? 'covered'
          : portrait.stateKind === 'NO_EVIDENCE' ? 'no-evidence' : 'unavailable',
        availabilityReason: portrait.availabilityReason,
        trendDirection: portrait.lastTrend ?? 'not-comparable',
        riskLevel: highestRisk(portrait.lastRisk.map((risk) => risk.severity)),
      };
    });
    const matrix: HeatmapData['matrix'] = [];
    for (const profile of classStudents) {
      const portrait = portraits.get(profile.userId)!;
      if (portrait.stateKind !== 'SNAPSHOT' || !portrait.payload) continue;
      const riskLevel = highestRisk(portrait.lastRisk.map((risk) => risk.severity));
      for (const dimension of dimensions) {
        const value = portrait.payload.dimensions.find((item) => item.id === dimension);
        if (!value || value.evidenceSummary.totalCount <= 0) continue;
        matrix.push({
          studentId: profile.userId,
          dimension,
          score: Math.round(value.score * 10) / 10,
          confidence: value.confidence,
          change: null,
          riskLevel,
        });
      }
    }

    const response: HeatmapData = {
      scope: 'cumulative',
      scopeLabel: CUMULATIVE_ATTAINMENT_LABEL,
      availability: {
        state: classPortrait.stateKind,
        reason: classPortrait.availabilityReason,
      },
      coverage: {
        rosterStudents: studentRows.length,
        coveredStudents: studentRows.filter((student) => student.coverageState === 'covered').length,
        noEvidenceStudents: studentRows.filter((student) =>
          student.coverageState === 'no-evidence').length,
        unavailableStudents: studentRows.filter((student) =>
          student.coverageState === 'unavailable').length,
      },
      students: studentRows,
      dimensions,
      matrix,
      trendDistribution: classPortrait.trendDistribution,
      riskDistribution: classPortrait.riskDistribution,
      diagnosis: classPortrait.diagnosis,
      lastUpdated: classPortrait.generatedAt,
    };
    const headers = new Headers();
    headers.set('Cache-Control', `private, max-age=${CACHE_TTL}`);
    return NextResponse.json(response, { headers });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (isConsumerUnauthorized(error)) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }
    console.error('[ClassHeatmap] Error:', error);
    if (isDatabaseConnectivityError(error)) {
      return createDatabaseUnavailableResponse();
    }
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

function highestRisk(levels: Array<'low' | 'medium' | 'high'>) {
  if (levels.includes('high')) return 'high';
  if (levels.includes('medium')) return 'medium';
  if (levels.includes('low')) return 'low';
  return 'none';
}
