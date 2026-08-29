import { NextResponse } from 'next/server';

import { buildArenaClassEvidenceSummary } from '@/features/arena/evidence-summary';
import { prismaArenaSubmissionStore } from '@/features/arena/submissions/prisma-store';
import {
  isConsumerUnauthorized,
  readTeacherClassEvidencePort,
  viewerFromSession,
} from '@/features/learning-record/consumers/public-api';
import { summarizeGovernanceState } from '@/features/teacher/teacher-insights';
import { getServerAuthSession } from '@/lib/auth';
import { COMPETENCY_LEVELS } from '@/lib/data-governance/competency-model';
import type {
  CumulativeClassPortraitReadModel,
  CumulativePortraitReadModel,
} from '@/lib/data-governance/cumulative-portrait-read-model';
import {
  PORTRAIT_V2_DIMENSIONS,
  type PortraitV2DimensionId,
} from '@/lib/data-governance/kaq-objective-taxonomy';
import {
  CUMULATIVE_ATTAINMENT_LABEL,
  getUnsupportedTeacherAttainmentScopeError,
} from '@/lib/data-governance/teacher-attainment-scope';
import { buildTeacherScopedLearningFactScopeFilters } from '@/lib/data-governance/teacher-evidence-governance';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { prisma } from '@/lib/prisma';
import {
  createDatabaseUnavailableResponse,
  isDatabaseConnectivityError,
} from '@/lib/service-availability';

export const dynamic = 'force-dynamic';

type LevelDistribution = Record<keyof typeof COMPETENCY_LEVELS, number>;
type StudentPortrait = CumulativePortraitReadModel;

interface TeacherClassInsightStudent {
  id: string;
  name: string;
  email: string | null;
  studentNumber: string | null;
  overallScore: number | null;
  overallLevel: string | null;
  overallScoreSource: 'native-portrait-v2' | null;
  riskLevel: 'none' | 'low' | 'medium' | 'high';
  riskLabel: string;
  trendDirection: 'up' | 'stable' | 'down' | 'not-comparable';
  strengths: string[];
  weaknesses: string[];
  riskBadges: string[];
  factCount: number;
  lastSnapshotAt: string | null;
  portraitV2: StudentPortrait['payload'];
  availabilityReason: StudentPortrait['availabilityReason'];
  evidenceStatus: {
    state: 'ready' | 'missing';
    refreshedAt: string | null;
    lastEvidenceAt: string | null;
    confidence: {
      level: 'none' | 'low' | 'medium' | 'high';
      score: number;
      evidenceCount: number;
      sourceCompleteness: number;
    };
    statusMarkers: Array<'low-confidence' | 'missing-source'>;
  };
}

export interface TeacherClassInsightsPayload {
  scope: 'cumulative';
  scopeLabel: typeof CUMULATIVE_ATTAINMENT_LABEL;
  availability: {
    state: CumulativeClassPortraitReadModel['stateKind'];
    reason: CumulativeClassPortraitReadModel['availabilityReason'];
  };
  classInfo: {
    id: string;
    name: string;
    code: string;
    description: string | null;
    semester: string | null;
    year: string | null;
    studentCount: number;
  };
  governance: ReturnType<typeof summarizeGovernanceState> & {
    totalStudents: number;
    coveredStudents: number;
    pendingStudents: number;
    classSnapshotAt: string | null;
    latestStudentSnapshotAt: string | null;
  };
  overview: {
    overallIndex: number | null;
    highRiskStudents: number;
    mediumRiskStudents: number;
    attentionStudents: number;
    averageFactCount: number;
  };
  ability: {
    state: 'ready' | 'no-evidence' | 'unavailable';
    dimensions: Array<{
      dimension: PortraitV2DimensionId;
      label: string;
      mean: number | null;
      meanConfidence: number | null;
      includedCount: number;
      missingCount: number;
    }>;
    taskAttainment: NonNullable<CumulativeClassPortraitReadModel['aggregate']>['taskAttainment'] | null;
    levelDistribution: LevelDistribution;
  };
  trendDistribution: CumulativeClassPortraitReadModel['trendDistribution'];
  riskDistribution: CumulativeClassPortraitReadModel['riskDistribution'];
  diagnosis: CumulativeClassPortraitReadModel['diagnosis'];
  arena: ReturnType<typeof buildArenaClassEvidenceSummary>;
  spotlightStudents: TeacherClassInsightStudent[];
  students: TeacherClassInsightStudent[];
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ classId: string }> },
) {
  try {
    const session = await getServerAuthSession();
    if (!session?.user?.id) {
      return NextResponse.json({ error: '未登录' }, { status: 401 });
    }

    const { classId } = await params;
    const classData = await prisma.class.findUnique({
      where: { id: classId },
      include: {
        students: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                email: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!classData) {
      return NextResponse.json({ error: '班级不存在' }, { status: 404 });
    }
    if (classData.teacherId !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }

    const requestedScope = new URL(request.url).searchParams.get('scope');
    const unsupportedScopeError = getUnsupportedTeacherAttainmentScopeError(requestedScope);
    if (unsupportedScopeError) {
      return NextResponse.json(unsupportedScopeError, { status: 400 });
    }

    const memberUserIds = classData.students.map((profile) => profile.userId);
    const teacherPort = await readTeacherClassEvidencePort({
      db: prisma,
      viewer: viewerFromSession(session, [classId]),
      classId,
      memberUserIds,
    });
    const classPortrait = teacherPort.classPortrait;
    const portraits = teacherPort.learnerPortraits;
    const [classSessionIds, classArenaSubmissions] = await Promise.all([
      prisma.classSession.findMany({
        where: { classId },
        select: { id: true },
      }).then((sessions) => sessions.map((session) => session.id)),
      prismaArenaSubmissionStore.listSubmissions({ classId }),
    ]);
    const arenaSubmissions = classArenaSubmissions.filter(({ userId }) =>
      typeof userId === 'string' && memberUserIds.includes(userId));
    const arenaLearningFacts = memberUserIds.length
      ? await prisma.learningFact.findMany({
          where: {
            userId: { in: memberUserIds },
            factType: 'design',
            OR: buildTeacherScopedLearningFactScopeFilters(classId, classSessionIds),
          },
          orderBy: { startedAt: 'desc' },
          take: 200,
          select: {
            factType: true,
            moduleId: true,
            outcome: true,
            score: true,
            contextJson: true,
          },
        })
      : [];
    const students = classData.students.map((profile) =>
      buildStudent(profile, portraits.get(profile.userId)!));
    const coveredStudents = students.filter((student) =>
      student.availabilityReason === 'available').length;
    const latestStudentSnapshotAt = students
      .flatMap((student) => student.lastSnapshotAt ? [student.lastSnapshotAt] : [])
      .sort()
      .at(-1) ?? null;
    const governanceBase = summarizeGovernanceState({
      totalStudents: students.length,
      coveredStudents,
      classSnapshotAt: classPortrait.generatedAt,
      latestStudentSnapshotAt,
    });
    const highRiskStudents = students.filter((student) => student.riskLevel === 'high').length;
    const mediumRiskStudents = students.filter((student) => student.riskLevel === 'medium').length;
    const attentionStudents = students.filter((student) =>
      student.riskLevel === 'high' ||
      student.riskLevel === 'medium' ||
      (student.overallScore !== null &&
        student.overallScore < COMPETENCY_LEVELS.average.min)).length;
    const abilityDimensions = PORTRAIT_V2_DIMENSIONS.map(({ id, label }) => {
      const aggregate = classPortrait.aggregate?.dimensions[id];
      return {
        dimension: id,
        label,
        mean: teacherPort.classRead.suppressed ? null : (aggregate?.mean ?? null),
        meanConfidence: teacherPort.classRead.suppressed ? null : (aggregate?.meanConfidence ?? null),
        includedCount: aggregate?.includedCount ?? 0,
        missingCount: aggregate?.missingCount ?? students.length,
      };
    });

    const payload: TeacherClassInsightsPayload = {
      scope: 'cumulative',
      scopeLabel: CUMULATIVE_ATTAINMENT_LABEL,
      availability: {
        state: classPortrait.stateKind,
        reason: classPortrait.availabilityReason,
      },
      classInfo: {
        id: classData.id,
        name: classData.name,
        code: classData.code,
        description: classData.description,
        semester: classData.semester,
        year: classData.year,
        studentCount: students.length,
      },
      governance: {
        ...governanceBase,
        totalStudents: students.length,
        coveredStudents,
        pendingStudents: Math.max(students.length - coveredStudents, 0),
        classSnapshotAt: classPortrait.generatedAt,
        latestStudentSnapshotAt,
      },
      overview: {
        overallIndex: teacherPort.classRead.aggregates?.averageScore ?? null,
        highRiskStudents,
        mediumRiskStudents,
        attentionStudents,
        averageFactCount: roundTo(
          students.reduce((total, student) => total + student.factCount, 0) /
            (students.length || 1),
          1,
        ),
      },
      ability: {
        state: classPortrait.stateKind === 'UNAVAILABLE'
          ? 'unavailable'
          : classPortrait.activeStudentCount > 0 ? 'ready' : 'no-evidence',
        dimensions: abilityDimensions,
        taskAttainment: teacherPort.classRead.suppressed
          ? null
          : classPortrait.aggregate?.taskAttainment ?? null,
        levelDistribution: students.reduce<LevelDistribution>((distribution, student) => {
          if (student.overallScore !== null) {
            distribution[getCompetencyLevelKey(student.overallScore)] += 1;
          }
          return distribution;
        }, createEmptyLevelDistribution()),
      },
      trendDistribution: classPortrait.trendDistribution,
      riskDistribution: classPortrait.riskDistribution,
      diagnosis: classPortrait.diagnosis,
      arena: buildArenaClassEvidenceSummary({
        classId,
        expectedStudentCount: students.length,
        submissions: arenaSubmissions,
        learningFacts: arenaLearningFacts,
      }),
      spotlightStudents: [...students]
        .filter((student) => student.riskLevel !== 'none' || student.overallScore !== null)
        .sort(compareAttention)
        .slice(0, 5),
      students,
    };
    return NextResponse.json(payload);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    if (isConsumerUnauthorized(error)) {
      return NextResponse.json({ error: '权限不足' }, { status: 403 });
    }
    console.error('[TeacherClassInsights] Error:', error);
    if (isDatabaseConnectivityError(error)) {
      return createDatabaseUnavailableResponse();
    }
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

function buildStudent(
  profile: {
    userId: string;
    studentNumber: string | null;
    user: { id: string; name: string | null; email: string | null };
  },
  portrait: CumulativePortraitReadModel,
): TeacherClassInsightStudent {
  const dimensions = portrait.payload?.dimensions.filter((dimension) =>
    dimension.evidenceSummary.totalCount > 0) ?? [];
  const ordered = [...dimensions].sort((left, right) => right.score - left.score);
  const evidenceCount = dimensions.reduce((total, dimension) =>
    total + dimension.evidenceSummary.totalCount, 0);
  const riskLevel = highestRisk(portrait.lastRisk.map((risk) => risk.severity));
  const confidenceScore = portrait.confidence ?? 0;
  return {
    id: profile.user.id,
    name: profile.user.name || '未命名学生',
    email: profile.user.email,
    studentNumber: profile.studentNumber,
    overallScore: portrait.availabilityReason === 'available' ? portrait.overallScore : null,
    overallLevel: portrait.overallScore === null
      ? null
      : COMPETENCY_LEVELS[getCompetencyLevelKey(portrait.overallScore)].label,
    overallScoreSource: portrait.availabilityReason === 'available'
      ? 'native-portrait-v2'
      : null,
    riskLevel,
    riskLabel: getRiskLabel(riskLevel),
    trendDirection: portrait.lastTrend ?? 'not-comparable',
    strengths: ordered.slice(0, 2).map((dimension) => dimension.label),
    weaknesses: ordered.slice(-2).reverse().map((dimension) => dimension.label),
    riskBadges: portrait.lastRisk.map((risk) => `${risk.type}:${risk.severity}`),
    factCount: evidenceCount,
    lastSnapshotAt: portrait.generatedAt,
    portraitV2: portrait.payload,
    availabilityReason: portrait.availabilityReason,
    evidenceStatus: {
      state: portrait.availabilityReason === 'available' ? 'ready' : 'missing',
      refreshedAt: portrait.generatedAt,
      lastEvidenceAt: portrait.evidenceAsOf,
      confidence: {
        level: confidenceLevel(confidenceScore, evidenceCount),
        score: confidenceScore,
        evidenceCount,
        sourceCompleteness: portrait.dimensionCoverage.evidencedDimensionIds.length /
          PORTRAIT_V2_DIMENSIONS.length,
      },
      statusMarkers: portrait.availabilityReason === 'available'
        ? confidenceScore < 0.5 ? ['low-confidence'] : []
        : ['missing-source'],
    },
  };
}

function createEmptyLevelDistribution(): LevelDistribution {
  return {
    excellent: 0,
    good: 0,
    average: 0,
    needsImprovement: 0,
    atRisk: 0,
  };
}

function getCompetencyLevelKey(score: number): keyof typeof COMPETENCY_LEVELS {
  if (score >= COMPETENCY_LEVELS.excellent.min) return 'excellent';
  if (score >= COMPETENCY_LEVELS.good.min) return 'good';
  if (score >= COMPETENCY_LEVELS.average.min) return 'average';
  if (score >= COMPETENCY_LEVELS.needsImprovement.min) return 'needsImprovement';
  return 'atRisk';
}

function highestRisk(levels: Array<'low' | 'medium' | 'high'>) {
  if (levels.includes('high')) return 'high';
  if (levels.includes('medium')) return 'medium';
  if (levels.includes('low')) return 'low';
  return 'none';
}

function getRiskLabel(level: 'none' | 'low' | 'medium' | 'high') {
  if (level === 'high') return '高风险';
  if (level === 'medium') return '中风险';
  if (level === 'low') return '低风险';
  return '风险平稳';
}

function confidenceLevel(score: number, evidenceCount: number) {
  if (evidenceCount === 0) return 'none';
  if (score >= 0.75) return 'high';
  if (score >= 0.5) return 'medium';
  return 'low';
}

function compareAttention(left: TeacherClassInsightStudent, right: TeacherClassInsightStudent) {
  const priority = { high: 0, medium: 1, low: 2, none: 3 };
  return priority[left.riskLevel] - priority[right.riskLevel] ||
    (left.overallScore ?? Number.POSITIVE_INFINITY) -
      (right.overallScore ?? Number.POSITIVE_INFINITY);
}

function roundTo(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
