/**
 * 用户画像 API
 *
 * 统一返回学生个人中心所需的累计七维 portrait v2、最新活动和个性化补强信息。
 */

import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import { requestCumulativeLearnerReconciliation } from '@/lib/data-governance/cumulative-snapshot-jobs';
import { prisma } from '@/lib/prisma';
import {
  buildAdaptivePracticeSummary,
  buildPortraitV2Dimensions,
  buildProfileActivityFeed,
  getCompetencyLevelLabel,
  summarizePortraitForProfile,
  type AdaptivePracticeSummary,
  type PersonalizedResourceCard,
  type ProfileActivityGroup,
  type ProfileActivityItem,
} from '@/lib/data-governance/profile-center';
import { getCompetencyLevel } from '@/lib/data-governance/competency-model';
import {
  readCurrentCumulativePortrait,
  type CumulativePortraitAvailabilityReason,
  type CumulativePortraitReadModel,
} from '@/lib/data-governance/cumulative-portrait-read-model';
import {
  getAbilityReportWithPersistenceFallback,
  getDiagnosticWithPersistenceFallback,
} from '@/features/assessment/adaptive-persistence';
import { buildArenaStudentPortfolio, type ArenaStudentPortfolio } from '@/features/arena/profile';
import { prismaArenaSubmissionStore } from '@/features/arena/submissions/prisma-store';
import {
  buildArenaStudentEvidenceSummary,
  type ArenaStudentEvidenceSummary,
} from '@/features/arena/evidence-summary';
import { ensureUserProfile, initializeUserProgress } from '@/lib/user-sync';

export const dynamic = 'force-dynamic';

export interface UserProfileResponse {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  profile: {
    studentNumber: string | null;
    classId: string | null;
    className: string | null;
    techScore: number;
    ethicsScore: number;
  } | null;
  statistics: {
    totalSimulations: number;
    completedMissions: number;
    ethicalViolations: number;
    totalSimulationTime: number;
    averageScore: number;
  };
  competency: {
    model: 'portrait-v2-cumulative';
    availability: {
      state: CumulativePortraitReadModel['stateKind'];
      reason: CumulativePortraitAvailabilityReason;
    };
    limitations: string[];
    overallScore: number | null;
    level: string | null;
    confidence: number | null;
    lastTrend: CumulativePortraitReadModel['lastTrend'];
    lastRisk: CumulativePortraitReadModel['lastRisk'];
    evidenceAsOf: string | null;
    generatedAt: string | null;
    strengths: string[];
    improvementAreas: string[];
    dimensions: Array<{
      key: string;
      label: string;
      description: string;
      score: number | null;
      trend: 'up' | 'stable' | 'down';
      confidence: number | null;
      evidenceCount: number;
      freshness: { state: string; asOf: string | null; evidenceAgeDays: number | null };
      limitations: string[];
      calculationVersion: string;
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
  };
  latestActivity: {
    preview: ProfileActivityItem[];
    grouped: ProfileActivityGroup[];
    total: number;
  };
  missionProgress: {
    total: number;
    completed: number;
    unlocked: number;
    locked: number;
  };
  personalizedReinforcement: {
    resources: PersonalizedResourceCard[];
    adaptivePractice: AdaptivePracticeSummary;
  };
  arenaPortfolio: ArenaStudentPortfolio;
  arenaSummary: ArenaStudentEvidenceSummary;
}

function describeFactOutcome(outcome: string) {
  switch (outcome) {
    case 'success':
      return '表现稳定';
    case 'partial':
      return '完成了一部分';
    case 'failure':
      return '仍需继续补强';
    default:
      return '已记录一次练习';
  }
}

function isAdaptiveAssessmentModule(moduleId: string | null | undefined): boolean {
  return moduleId === 'adaptive-practice' || moduleId === 'adaptive-assessment';
}

function formatFactScore(score: number): number {
  return Math.round(score > 1 ? score : score * 100);
}

function inferInteractionTitle(event: {
  eventType: string;
  resourceKey: string | null;
  lessonKey: string | null;
  eventData: unknown;
}) {
  const eventData =
    event.eventData && typeof event.eventData === 'object'
      ? (event.eventData as Record<string, unknown>)
      : ({} as Record<string, unknown>);

  if (event.eventType === 'simulation' || event.eventType === 'simulation_complete') {
    const taskTitle =
      typeof eventData.taskTitle === 'string' ? eventData.taskTitle : null;
    const scenario =
      typeof eventData.scenario === 'string' ? eventData.scenario : null;
    if (taskTitle && scenario) return `${taskTitle}（${scenario}）`;
    if (taskTitle) return taskTitle;
    return '航行仿真练习';
  }
  if (event.eventType === 'assessment') {
    return event.lessonKey ?? '能力评估';
  }
  if (event.eventType === 'ethics_case') {
    return '伦理情景讨论';
  }
  if (event.eventType === 'video_watched') {
    return event.lessonKey ?? '观看视频';
  }
  return event.resourceKey ?? event.lessonKey ?? '完成一项活动';
}

function inferInteractionOutcome(event: {
  eventType: string;
  eventData: unknown;
  pointsEarned: number;
}) {
  if (event.eventType === 'simulation_complete') {
    const eventData =
      event.eventData && typeof event.eventData === 'object'
        ? (event.eventData as Record<string, unknown>)
        : null;
    if (typeof eventData?.score === 'number' && eventData.score >= 60) return 'success';
    if (typeof eventData?.score === 'number' && eventData.score > 0) return 'partial';
    return 'failure';
  }
  if (event.pointsEarned > 0) return 'success';
  return 'completed';
}

export async function GET() {
  try {
    const session = await getServerAuthSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const userId = session.user.id;
    const [user, userProgress, userArenaSubmissions] = await Promise.all([
      prisma.user.findUniqueOrThrow({ where: { id: userId } }),
      initializeUserProgress(userId),
      prismaArenaSubmissionStore.listSubmissions({ userId }),
    ]);

    await ensureUserProfile(userId);
    const profile = await prisma.studentProfile.findUnique({ where: { userId } });
    const missionProgress = await prisma.missionProgress.findMany({
      where: { userId },
      include: { mission: true },
    });

    const completedMissions = missionProgress.filter((m) => m.status === 'COMPLETED').length;
    const totalMissions = missionProgress.length;

    const totalSimulationTime =
      (await prisma.event.aggregate({
        where: { userId, eventType: 'simulation' },
        _sum: { duration: true },
      }))._sum.duration ?? 0;

    const totalSimulations = await prisma.event.count({
      where: { userId, eventType: 'simulation' },
    });

    const averageScore = totalSimulations
      ? (await prisma.event.aggregate({
          where: { userId, eventType: 'simulation' },
          _avg: { pointsEarned: true },
        }))._avg.pointsEarned ?? 0
      : 0;

    const ethicalViolations = userProgress.ethicalViolations ?? 0;

    const competencyDimensions = buildPortraitV2Dimensions(userProgress, {
      completedLessons: completedMissions,
      totalLessons: totalMissions,
      completedSimulations: totalSimulations,
      ethicalViolations,
    });

    const portraitLabels = getCompetencyLevelLabel();

    const cumulativePortrait = await readCurrentCumulativePortrait(userId);

    const portraitSummary = summarizePortraitForProfile(cumulativePortrait, competencyDimensions);
    const overallScore = portraitSummary?.overallScore ?? null;
    const level = portraitSummary?.overallScore != null ? getCompetencyLevel(portraitSummary.overallScore).label : null;
    const adaptiveReport = await getAbilityReportWithPersistenceFallback(userId);
    const adaptiveDiagnostic = await getDiagnosticWithPersistenceFallback(userId);

    const learningFacts = await prisma.learningFact.findMany({
      where: { userId },
      orderBy: { timestamp: 'desc' },
    });

    const latestActivity = buildProfileActivityFeed(learningFacts, 10);

    const arenaTaskIds = [
      ...new Set(userArenaSubmissions.map((sub) => sub.taskId)),
    ];
    const arenaPortfolioSubmissions = arenaTaskIds.length > 0
      ? await prismaArenaSubmissionStore.listSubmissions({ taskIds: arenaTaskIds })
      : [];

    const trainingRuns = await prisma.simulationRun.findMany({
      where: {
        userId,
        summary: {
          path: ['arenaTraining', 'taskId'],
          not: null,
        },
      },
      select: {
        summary: true,
        completedAt: true,
      },
      orderBy: { completedAt: 'desc' },
      take: 50,
    });

    const mappedTrainingRuns = trainingRuns
      .filter((run) => {
        const summary = run.summary as Record<string, unknown> | null;
        const arenaTraining = summary?.arenaTraining as Record<string, unknown> | undefined;
        return arenaTraining?.taskId != null;
      })
      .map((run) => {
        const summary = run.summary as Record<string, unknown> | null;
        const arenaTraining = summary?.arenaTraining as Record<string, unknown> | undefined;
        return {
          taskId: String(arenaTraining?.taskId ?? ''),
          scenarioId: String(arenaTraining?.scenarioId ?? ''),
          completedAt: run.completedAt?.toISOString() ?? new Date().toISOString(),
          evaluationVisibility: String(arenaTraining?.evaluationVisibility ?? 'preview'),
          officialEligible: Boolean(arenaTraining?.officialEligible ?? false),
          trackingError: typeof summary?.trackingError === 'number' ? summary.trackingError : undefined,
          maxDeviation: typeof summary?.maxDeviation === 'number' ? summary.maxDeviation : undefined,
          controlEnergy: typeof summary?.controlEnergy === 'number' ? summary.controlEnergy : undefined,
          safetyViolations: typeof summary?.safetyViolations === 'number' ? summary.safetyViolations : undefined,
          smoothness: typeof summary?.smoothness === 'number' ? summary.smoothness : undefined,
        };
      });

    const response: UserProfileResponse = {
      user: {
        id: user.id,
        name: user.name || '未设置',
        email: user.email || '',
        role: user.role,
      },
      profile: profile
        ? {
            studentNumber: profile.studentNumber ?? null,
            classId: profile.classId ?? null,
            className: profile.className ?? null,
            techScore: profile.techScore,
            ethicsScore: profile.ethicsScore,
          }
        : null,
      statistics: {
        totalSimulations,
        completedMissions,
        ethicalViolations,
        totalSimulationTime,
        averageScore,
      },
      competency: {
        model: 'portrait-v2-cumulative',
        availability: {
          state: cumulativePortrait.stateKind,
          reason: cumulativePortrait.availabilityReason,
        },
        limitations: portraitSummary?.limitations ?? [],
        overallScore,
        level,
        confidence: cumulativePortrait.confidence,
        lastTrend: cumulativePortrait.lastTrend,
        lastRisk: cumulativePortrait.lastRisk,
        evidenceAsOf: cumulativePortrait.evidenceAsOf,
        generatedAt: cumulativePortrait.generatedAt,
        strengths: portraitSummary?.strengths.map((id) => portraitLabels.get(id) ?? id) ?? [],
        improvementAreas: portraitSummary?.weaknesses.map((id) => portraitLabels.get(id) ?? id) ?? [],
        dimensions: competencyDimensions,
      },
      latestActivity,
      missionProgress: {
        total: totalMissions,
        completed: completedMissions,
        unlocked: missionProgress.filter((item) => item.status === 'UNLOCKED').length,
        locked: totalMissions - missionProgress.length,
      },
      personalizedReinforcement: {
        resources: [],
        adaptivePractice: buildAdaptivePracticeSummary({
          estimatedAbility: adaptiveReport?.estimatedAbility ?? null,
          confidenceInterval: adaptiveReport?.confidenceInterval ?? null,
          timeline: adaptiveReport?.timeline ?? [],
          weakAreas: adaptiveDiagnostic?.weakAreas ?? [],
          recommendedFocus: adaptiveDiagnostic?.recommendedFocus ?? [],
        }),
      },
      arenaPortfolio: buildArenaStudentPortfolio(arenaPortfolioSubmissions, userId, mappedTrainingRuns),
      arenaSummary: buildArenaStudentEvidenceSummary({
        userId,
        submissions: userArenaSubmissions,
        learningFacts,
      }),
    };

    return NextResponse.json(response);
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('获取用户画像失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getServerAuthSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const body = await request.json();
    const { name, classId } = body;

    if (name) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { name },
      });
    }

    if (classId !== undefined) {
      await prisma.$transaction(async (tx) => {
        const previousProfile = await tx.studentProfile.findUnique({
          where: { userId: session.user.id },
          select: { classId: true },
        });
        await tx.studentProfile.upsert({
          where: { userId: session.user.id },
          update: { classId },
          create: {
            userId: session.user.id,
            classId,
          },
        });
        await requestCumulativeLearnerReconciliation(tx, {
          userId: session.user.id,
          classIds: [previousProfile?.classId, classId].filter(
            (candidate): candidate is string => typeof candidate === 'string',
          ),
          reason: 'class-membership:profile-update',
        });
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('更新用户画像失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
