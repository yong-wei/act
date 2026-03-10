/**
 * 用户画像 API
 *
 * 获取用户的能力画像数据，包括仿真统计、能力雷达图数据
 */

import { NextResponse } from 'next/server';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { computeCompetencyFromSimulations, type CompetencyData } from '@/lib/competency';
import { getUserExtracurricularSnapshot } from '@/lib/extracurricular-analytics';

export interface UserProfileResponse {
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  profile: {
    classId: string | null;
    techScore: number;
    ethicsScore: number;
  } | null;
  statistics: {
    totalSimulations: number;
    completedMissions: number;
    ethicalViolations: number;
    totalSimulationTime: number; // 秒
    averageScore: number;
  };
  competency: CompetencyData;
  recentActivity: Array<{
    id: string;
    type: 'simulation' | 'mission' | 'violation';
    title: string;
    timestamp: Date;
    result?: string;
  }>;
  missionProgress: {
    total: number;
    completed: number;
    unlocked: number;
    locked: number;
  };
  abilityTracking: {
    pre: {
      computational: number;
      crossDomain: number;
      designTradeoff: number;
      poleTimeMapping: number;
      frequencyStability: number;
    };
    post: {
      computational: number;
      crossDomain: number;
      designTradeoff: number;
      poleTimeMapping: number;
      frequencyStability: number;
    };
    delta: {
      computational: number;
      crossDomain: number;
      designTradeoff: number;
      poleTimeMapping: number;
      frequencyStability: number;
    };
    preWeakTag: string;
    postWeakTag: string;
    weakTagLabel: string;
  };
  reinforcementPaths: Array<{
    id: string;
    title: string;
    description: string;
    estimatedTime: number;
  }>;
  recommendedQuestions: Array<{
    id: string;
    stem: string;
    difficulty: number;
    knowledgeTags: string[];
  }>;
  promptStructuringScore: number | null;
  designEffectScore: number | null;
}

export async function GET() {
  try {
    const session = await getServerAuthSession();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      );
    }

    const userId = session.user.id;

    // 并行获取用户数据
    const [user, profile, simulationLogs, ethicalLogs, missionProgress, extracurricularSnapshot] = await Promise.all([
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
          classId: true,
          techScore: true,
          ethicsScore: true,
        },
      }),
      prisma.simulationLog.findMany({
        where: { userId },
        orderBy: { createdAt: 'desc' },
        take: 100, // 最近100条仿真记录
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
      getUserExtracurricularSnapshot(userId),
    ]);

    if (!user) {
      return NextResponse.json(
        { error: '用户不存在' },
        { status: 404 }
      );
    }

    // 计算统计数据
    const totalSimulations = simulationLogs.length;
    const completedMissions = missionProgress.filter((p) => p.status === 'COMPLETED').length;
    const ethicalViolations = ethicalLogs.length;
    const totalSimulationTime = simulationLogs.reduce(
      (acc, log) => acc + (log.duration || 0),
      0
    );
    const averageScore =
      totalSimulations > 0
        ? simulationLogs.reduce((acc, log) => acc + (log.score || 0), 0) / totalSimulations
        : 0;

    // 计算能力雷达图数据
    const competencyInput = simulationLogs.map((log) => {
      const metrics = log.metrics as Record<string, number> | null;
      const inputParams = log.inputParams as Record<string, number> | null;
      return {
        avgError: metrics?.avgError || 100,
        maxRudderRate: metrics?.maxRudderRate || 3,
        settlingTime: metrics?.settlingTime,
        overshoot: metrics?.overshoot,
        seaStateLevel: inputParams?.seaStateLevel || 3,
        isEthicalViolation: log.isEthicalViolation,
      };
    });

    const competency = computeCompetencyFromSimulations(competencyInput);

    // 构建最近活动
    const recentActivity: UserProfileResponse['recentActivity'] = [];

    // 添加最近仿真
    simulationLogs.slice(0, 5).forEach((log) => {
      recentActivity.push({
        id: log.id,
        type: 'simulation',
        title: `仿真练习 - ${log.controlMode?.toUpperCase() || 'PID'} 模式`,
        timestamp: log.createdAt,
        result: log.score ? `得分: ${log.score}` : undefined,
      });
    });

    // 添加最近违规
    ethicalLogs.slice(0, 3).forEach((log) => {
      recentActivity.push({
        id: log.id,
        type: 'violation',
        title: `伦理违规 - ${log.violationType}`,
        timestamp: log.createdAt,
        result: log.studentJustification ? '已整改' : '待整改',
      });
    });

    // 按时间排序
    recentActivity.sort(
      (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // 计算任务进度
    const totalMissions = await prisma.mission.count();
    const missionStats = {
      total: totalMissions,
      completed: missionProgress.filter((p) => p.status === 'COMPLETED').length,
      unlocked: missionProgress.filter((p) => p.status === 'UNLOCKED').length,
      locked: totalMissions - missionProgress.length,
    };

    const response: UserProfileResponse = {
      user: {
        id: user.id,
        name: user.name || '未设置',
        email: user.email || '',
        role: user.role,
      },
      profile: profile
        ? {
            classId: profile.classId,
            techScore: profile.techScore,
            ethicsScore: profile.ethicsScore,
          }
        : null,
      statistics: {
        totalSimulations,
        completedMissions,
        ethicalViolations,
        totalSimulationTime,
        averageScore: Math.round(averageScore),
      },
      competency,
      recentActivity: recentActivity.slice(0, 10),
      missionProgress: missionStats,
      abilityTracking: {
        pre: extracurricularSnapshot.pre,
        post: extracurricularSnapshot.post,
        delta: extracurricularSnapshot.delta,
        preWeakTag: extracurricularSnapshot.preWeakTag,
        postWeakTag: extracurricularSnapshot.postWeakTag,
        weakTagLabel: extracurricularSnapshot.weakTagLabel,
      },
      reinforcementPaths: extracurricularSnapshot.reinforcementPaths,
      recommendedQuestions: extracurricularSnapshot.recommendedQuestions,
      promptStructuringScore: extracurricularSnapshot.promptStructuringScore,
      designEffectScore: extracurricularSnapshot.designEffectScore,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('获取用户画像失败:', error);
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}

// 更新用户 profile
export async function PATCH(request: Request) {
  try {
    const session = await getServerAuthSession();

    if (!session?.user?.id) {
      return NextResponse.json(
        { error: '未授权' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { name, classId } = body;

    // 更新用户名称
    if (name) {
      await prisma.user.update({
        where: { id: session.user.id },
        data: { name },
      });
    }

    // 更新或创建 StudentProfile
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
    return NextResponse.json(
      { error: '服务器错误' },
      { status: 500 }
    );
  }
}
