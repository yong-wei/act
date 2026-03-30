/**
 * 用户画像 API
 *
 * 统一返回学生个人中心所需的六维能力画像、最近活动和个性化补强信息。
 */

import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import {
  buildAdaptivePracticeSummary,
  buildCompetencyDimensions,
  buildProfileActivityFeed,
  dedupeRecommendations,
  getCompetencyLevelLabel,
  mapRecommendationsToResourceCards,
  type AdaptivePracticeSummary,
  type PersonalizedResourceCard,
  type ProfileActivityGroup,
  type ProfileActivityItem,
} from '@/lib/data-governance/profile-center';
import {
  calculateOverallScore,
  createEmptyCompetencyVector,
  getCompetencyLevel,
  type CompetencyDimension,
  type CompetencyVector,
} from '@/lib/data-governance/competency-model';
import { generateRecommendations } from '@/lib/data-governance/recommendation-engine';
import { getAbilityReport, getDiagnostic } from '@/features/assessment/adaptive-engine';

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
    overallScore: number;
    level: string;
    trend: string;
    strengths: string[];
    weaknesses: string[];
    dimensions: Array<{
      key: CompetencyDimension;
      label: string;
      description: string;
      score: number;
      trend: 'up' | 'stable' | 'down';
      confidence: number;
      evidenceCount: number;
    }>;
  };
  recentActivity: {
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
}

function parseStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  }
  return [];
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
    case 'lesson_step_view':
      return '进入课堂互动环节';
    case 'ai_query_submit':
      return '在互动页面中发起了 AI 追问';
    default:
      return '完成一次互动学习操作';
  }
}

function inferInteractionHref(resourceKey: string | null, sessionId: string | null) {
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

    const [
      user,
      profile,
      latestSnapshot,
      profileSummary,
      simulationLogs,
      ethicalLogs,
      missionProgress,
      interactionLogs,
      learningFacts,
      studentStates,
    ] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          name: true,
          email: true,
          role: true,
        },
      }),
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
      prisma.studentCompetencySnapshot.findFirst({
        where: { userId },
        orderBy: { snapshotAt: 'desc' },
      }),
      prisma.studentProfileSummary.findUnique({
        where: { userId },
      }),
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
    ]);

    if (!user) {
      return NextResponse.json({ error: '用户不存在' }, { status: 404 });
    }

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
    const competencyVector =
      (latestSnapshot?.competencyVector as CompetencyVector | null) ?? createEmptyCompetencyVector();
    const competencyDimensions = buildCompetencyDimensions(competencyVector);
    const overallScore = Math.round(
      (profileSummary?.overallScore ?? calculateOverallScore(competencyVector)) * 10
    ) / 10;
    const level =
      profileSummary?.overallLevel ??
      getCompetencyLevelLabel(getCompetencyLevel(overallScore));

    const totalSimulations = simulationLogs.length;
    const completedMissions = missionProgress.filter((item) => item.status === 'COMPLETED').length;
    const ethicalViolations = ethicalLogs.length;
    const totalSimulationTime = simulationLogs.reduce(
      (sum, log) => sum + (log.duration ?? 0),
      0
    );
    const averageScore =
      totalSimulations > 0
        ? Math.round(
            simulationLogs.reduce((sum, log) => sum + (log.score ?? 0), 0) / totalSimulations
          )
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
      href: inferInteractionHref(event.resourceKey, event.sessionId),
      badge: event.eventType === 'knowledge_card_open' ? '知识卡片' : '互动',
      dedupeKey: `${event.eventType}|${event.resourceKey ?? ''}|${event.sessionId ?? ''}|${event.lessonKey ?? ''}`,
    }));

    const assessmentActivities: ProfileActivityItem[] = learningFacts
      .filter((fact) => fact.factType === 'question')
      .map((fact) => ({
        id: fact.id,
        category: 'assessment',
        title:
          fact.moduleId === 'adaptive-practice'
            ? '完成自适应练习'
            : '完成一次题目练习',
        description: `${describeFactOutcome(fact.outcome)}${typeof fact.score === 'number' ? ` · 得分 ${Math.round(fact.score * 100)}` : ''}`,
        timestamp: fact.startedAt.toISOString(),
        href: '/assessment/adaptive-practice',
        badge: '评测',
        dedupeKey: `${fact.factType}|${fact.moduleId ?? ''}|${fact.startedAt.toISOString()}`,
      }));

    const recentActivity = buildProfileActivityFeed([
      ...classroomActivities,
      ...interactiveActivities,
      ...simulationActivities,
      ...assessmentActivities,
    ]);

    const adaptiveReport = getAbilityReport(userId);
    const adaptiveDiagnostic = getDiagnostic(userId);
    const recommendationCards = mapRecommendationsToResourceCards(
      dedupeRecommendations(await generateRecommendations(userId))
    ).slice(0, 4);

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
        overallScore,
        level,
        trend: profileSummary?.recentTrend ?? '近期表现平稳',
        strengths: parseStringList(profileSummary?.strengthsJson),
        weaknesses: parseStringList(profileSummary?.weaknessesJson),
        dimensions: competencyDimensions,
      },
      recentActivity,
      missionProgress: {
        total: totalMissions,
        completed: completedMissions,
        unlocked: missionProgress.filter((item) => item.status === 'UNLOCKED').length,
        locked: totalMissions - missionProgress.length,
      },
      personalizedReinforcement: {
        resources: recommendationCards,
        adaptivePractice: buildAdaptivePracticeSummary({
          estimatedAbility: adaptiveReport?.estimatedAbility ?? null,
          confidenceInterval: adaptiveReport?.confidenceInterval ?? null,
          timeline: adaptiveReport?.timeline ?? [],
          weakAreas: adaptiveDiagnostic?.weakAreas ?? [],
          recommendedFocus: adaptiveDiagnostic?.recommendedFocus ?? [],
        }),
      },
    };

    return NextResponse.json(response);
  } catch (error) {
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
      await prisma.studentProfile.upsert({
        where: { userId: session.user.id },
        update: { classId },
        create: {
          userId: session.user.id,
          classId,
        },
      });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('更新用户画像失败:', error);
    return NextResponse.json({ error: '服务器错误' }, { status: 500 });
  }
}
