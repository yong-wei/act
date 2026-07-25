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
      : {};

  const embeddedTitle = typeof eventData.title === 'string' ? eventData.title : null;
  if (embeddedTitle) {
    return embeddedTitle;
  }

  const targetLabel = typeof eventData.targetLabel === 'string' ? eventData.targetLabel : null;
  if (targetLabel) {
    switch (event.eventType) {
      case 'knowledge_card_open':
        return `知识卡片：${targetLabel}`;
      case 'knowledge_graph_node_focus':
        return `知识节点：${targetLabel}`;
      case 'resource_download':
        return `下载资料：${targetLabel}`;
      case 'resource_complete':
        return `完成资源学习：${targetLabel}`;
      case 'resource_play':
        return `播放资源：${targetLabel}`;
      case 'resource_open':
      case 'resource_view':
        return `查看资源：${targetLabel}`;
      case 'external_module_open':
        return `打开跨域模块：${targetLabel}`;
      default:
        return targetLabel;
    }
  }

  if (event.eventType === 'knowledge_card_open') {
    return `知识卡片：${event.resourceKey ?? '未命名资源'}`;
  }

  if (event.lessonKey) {
    return `互动环节：${event.lessonKey}`;
  }

  if (event.resourceKey) {
    return `互动探索：${event.resourceKey}`;
  }

  return '互动学习记录';
}

function inferInteractionDescription(eventType: string) {
  switch (eventType) {
    case 'knowledge_card_open':
      return '打开知识卡片进行补充学习';
    case 'knowledge_graph_node_focus':
      return '聚焦知识图谱节点并查看关联说明';
    case 'resource_open':
      return '打开了一项课堂外学习资源';
    case 'resource_play':
      return '开始播放课堂外媒体资源';
    case 'resource_progress':
      return '推进了一项课堂外媒体学习进度';
    case 'resource_download':
      return '下载了一份课堂外学习资料';
    case 'resource_complete':
      return '完成了一项课堂外资源学习';
    case 'resource_view':
      return '查看了一项课堂外资源';
    case 'external_module_open':
      return '进入跨域互动模块继续探索';
    case 'lesson_step_view':
      return '进入课堂互动环节';
    case 'ai_query_submit':
      return '在互动页面中发起了 AI 追问';
    default:
      return '完成一次互动学习操作';
  }
}

function inferInteractionHref(
  resourceKey: string | null,
  sessionId: string | null,
  eventData?: unknown,
) {
  const payload = eventData && typeof eventData === 'object'
    ? eventData as Record<string, unknown>
    : null;

  const originPath = payload && typeof payload.originPath === 'string' ? payload.originPath : null;
  if (originPath) {
    return originPath;
  }

  if (sessionId) {
    return `/classroom/student/${sessionId}`;
  }

  if (resourceKey?.includes('knowledge')) {
    return '/knowledge';
  }

  return '/interactive-learning';
}

export async function GET() {
  try {
    const session = await getServerAuthSession();

    if (!session?.user?.id) {
      return NextResponse.json({ error: '未授权' }, { status: 401 });
    }

    const userId = session.user.id;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
      },
    });

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

    if (user.role === 'STUDENT') {
      await Promise.all([
        ensureUserProfile(userId),
        initializeUserProgress(userId),
      ]);
    }

    const [
      profile,
      cumulativePortrait,
      simulationLogs,
      simulationStats,
      ethicalLogs,
      missionProgress,
      interactionLogs,
      learningFacts,
      studentStates,
      userArenaSubmissions,
    ] = await Promise.all([
      prisma.studentProfile.findUnique({
        where: { userId },
        select: {
          studentNumber: true,
          classId: true,
          className: true,
          techScore: true,
          ethicsScore: true,
        },
      }),
      readCurrentCumulativePortrait(prisma, userId, 'student'),
      prisma.simulationLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          controlMode: true,
          createdAt: true,
          score: true,
          duration: true,
        },
      }),
      prisma.simulationLog.aggregate({
        where: { userId },
        _count: {
          _all: true,
        },
        _sum: {
          duration: true,
        },
        _avg: {
          score: true,
        },
      }),
      prisma.ethicalLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
      }),
      prisma.userProgress.findMany({
        where: { userId },
        include: {
          mission: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      }),
      prisma.interactionLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 40,
        select: {
          id: true,
          eventType: true,
          resourceKey: true,
          sessionId: true,
          lessonKey: true,
          eventData: true,
          createdAt: true,
        },
      }),
      prisma.learningFact.findMany({
        where: { userId },
        orderBy: { startedAt: 'desc' },
        take: 40,
        select: {
          id: true,
          factType: true,
          moduleId: true,
          sessionId: true,
          startedAt: true,
          outcome: true,
          score: true,
          timeSpent: true,
          contextJson: true,
        },
      }),
      prisma.studentState.findMany({
        where: { userId },
        orderBy: { submittedAt: 'desc' },
        take: 10,
        select: {
          sessionId: true,
          submittedAt: true,
        },
      }),
      prismaArenaSubmissionStore.listSubmissions({ userId }),
    ]);

    const arenaTaskIds = Array.from(new Set(userArenaSubmissions.map((submission) => submission.taskId)));
    const arenaPortfolioSubmissions = arenaTaskIds.length > 0
      ? await prismaArenaSubmissionStore.listSubmissions({ taskIds: arenaTaskIds })
      : [];

    const sessionIds = Array.from(new Set(studentStates.map((item) => item.sessionId)));
    const classSessions =
      sessionIds.length > 0
        ? await prisma.classSession.findMany({
            where: {
              id: {
                in: sessionIds,
              },
            },
            select: {
              id: true,
              joinCode: true,
              plan: {
                select: {
                  title: true,
                },
              },
              class: {
                select: {
                  name: true,
                },
              },
            },
          })
        : [];

    const sessionMap = new Map(classSessions.map((item) => [item.id, item]));
    const portraitPayload = cumulativePortrait.stateKind === 'SNAPSHOT'
      ? cumulativePortrait.payload
      : null;
    const portraitSummary = portraitPayload
      ? summarizePortraitForProfile(portraitPayload)
      : null;
    const competencyDimensions = portraitPayload
      ? buildPortraitV2Dimensions(portraitPayload).map((dimension) => {
          const available = cumulativePortrait.dimensionCoverage.evidencedDimensionIds.some(
            (dimensionId) => dimensionId === dimension.key,
          );
          return {
            ...dimension,
            score: available ? dimension.score : null,
            confidence: available ? dimension.confidence : null,
            availabilityReason: available ? 'available' as const : 'no-eligible-evidence' as const,
          };
        })
      : [];
    const overallScore = cumulativePortrait.overallScore;
    const level = overallScore === null
      ? null
      : getCompetencyLevelLabel(getCompetencyLevel(overallScore));
    const portraitLabels = new Map(
      portraitSummary?.dimensions.map((dimension) => [dimension.id, dimension.label]) ?? []
    );

    const totalSimulations = simulationStats._count._all;
    const completedMissions = missionProgress.filter((item) => item.status === 'COMPLETED').length;
    const ethicalViolations = ethicalLogs.length;
    const totalSimulationTime = simulationStats._sum.duration ?? 0;
    const averageScore =
      totalSimulations > 0
        ? Math.round(simulationStats._avg.score ?? 0)
        : 0;

    const totalMissions = await prisma.mission.count();

    const classroomActivities: ProfileActivityItem[] = studentStates.map((state) => {
      const relatedSession = sessionMap.get(state.sessionId);
      return {
        id: `classroom-${state.sessionId}`,
        category: 'classroom',
        title: `加入课堂：${relatedSession?.plan.title ?? '未命名课堂'}`,
        description: `${relatedSession?.class?.name ?? profile?.className ?? '未绑定班级'} · 课堂码 ${relatedSession?.joinCode ?? '------'}`,
        timestamp: state.submittedAt.toISOString(),
        href: `/classroom/student/${state.sessionId}`,
        badge: '课堂',
        dedupeKey: `classroom-${state.sessionId}`,
      };
    });

    const simulationActivities: ProfileActivityItem[] = simulationLogs.map((log) => ({
      id: log.id,
      category: 'simulation',
      title: `完成仿真：${log.controlMode?.toUpperCase() ?? 'PID'} 模式`,
      description: `得分 ${Math.round(log.score ?? 0)} · 用时 ${Math.max(1, Math.round((log.duration ?? 0) / 60))} 分钟`,
      timestamp: log.createdAt.toISOString(),
      href: '/simulations/destroyer',
      badge: '仿真',
    }));

    const interactiveActivities: ProfileActivityItem[] = interactionLogs.map((event) => ({
      id: event.id,
      category: 'interactive',
      title: inferInteractionTitle(event),
      description: inferInteractionDescription(event.eventType),
      timestamp: event.createdAt.toISOString(),
      href: inferInteractionHref(event.resourceKey, event.sessionId, event.eventData),
      badge:
        event.eventType === 'knowledge_card_open'
          ? '知识卡片'
          : event.eventType === 'knowledge_graph_node_focus'
            ? '知识图谱'
            : event.eventType === 'resource_complete'
              ? '资源完成'
              : event.eventType.startsWith('resource_')
                ? '资源'
                : event.eventType === 'external_module_open'
                  ? '跨域模块'
                  : '互动',
      dedupeKey: `${event.eventType}|${event.resourceKey ?? ''}|${event.sessionId ?? ''}|${event.lessonKey ?? ''}`,
    }));

    const assessmentActivities: ProfileActivityItem[] = learningFacts
      .filter((fact) => fact.factType === 'question')
      .map((fact) => ({
        id: fact.id,
        category: 'assessment',
        title:
          isAdaptiveAssessmentModule(fact.moduleId)
            ? '完成自适应练习'
            : '完成一次题目练习',
        description: `${describeFactOutcome(fact.outcome)}${typeof fact.score === 'number' ? ` · 得分 ${formatFactScore(fact.score)}` : ''}`,
        timestamp: fact.startedAt.toISOString(),
        href: isAdaptiveAssessmentModule(fact.moduleId)
          ? '/assessment/adaptive-practice?intent=practice'
          : '/assessment/adaptive-practice',
        badge: '评测',
        dedupeKey: `${fact.factType}|${fact.moduleId ?? ''}|${fact.startedAt.toISOString()}`,
      }));

    const latestActivity = buildProfileActivityFeed([
      ...classroomActivities,
      ...interactiveActivities,
      ...simulationActivities,
      ...assessmentActivities,
    ]);

    const adaptiveReport = await getAbilityReportWithPersistenceFallback(userId);
    const adaptiveDiagnostic = await getDiagnosticWithPersistenceFallback(userId);

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
      arenaPortfolio: buildArenaStudentPortfolio(arenaPortfolioSubmissions, userId),
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
