'use client';

/**
 * 学生个人中心页面
 *
 * 展示学生六维能力画像、学习统计、最近活动与个性化补强路径。
 */

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { UserMenu } from '@/components/shared/user-menu';
import type { ArenaStudentPortfolio } from '@/features/arena/profile';

interface UserProfile {
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
      key: string;
      label: string;
      description: string;
      score: number;
      trend: 'up' | 'stable' | 'down';
      confidence: number;
      evidenceCount: number;
    }>;
  };
  recentActivity: {
    preview: ActivityItemData[];
    grouped: Array<{
      category: ActivityItemData['category'];
      label: string;
      items: ActivityItemData[];
    }>;
    total: number;
  };
  missionProgress: {
    total: number;
    completed: number;
    unlocked: number;
    locked: number;
  };
  personalizedReinforcement: {
    resources: Array<{
      id: string;
      type: 'interactive' | 'simulation' | 'knowledge' | 'assessment' | 'path';
      title: string;
      description: string;
      reason: string;
      actionUrl: string;
      actionLabel: string;
      priority: number;
      estimatedTime?: string;
      tags: string[];
    }>;
    adaptivePractice: {
      estimatedAbility: number | null;
      confidenceInterval: [number, number] | null;
      weakAreas: string[];
      recommendedFocus: string[];
      questionCount: number;
      actionUrl: string;
    };
  };
  arenaPortfolio: ArenaStudentPortfolio;
}

interface ActivityItemData {
  id: string;
  category: 'classroom' | 'interactive' | 'simulation' | 'assessment';
  title: string;
  description: string;
  timestamp: string;
  href?: string;
  badge?: string;
}

export default function ProfilePage() {
  const router = useRouter();
  const sessionData = useSession();
  const session = sessionData?.data;
  const status = sessionData?.status ?? 'loading';
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllActivities, setShowAllActivities] = useState(false);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role) {
      if (session.user.role !== 'STUDENT') {
        const redirectPath = session.user.role === 'ADMIN' ? '/admin' : '/teacher';
        router.replace(redirectPath);
        return;
      }
      void fetchProfile();
    }
  }, [status, session, router]);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/user/profile');
      if (!response.ok) {
        throw new Error('获取用户画像失败');
      }
      const data = await response.json();
      setProfile(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  };

  if (status === 'loading' || loading) {
    return (
      <div className="surface-page flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          <p className="text-subtle">加载中...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="surface-page flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-subtle">请先登录</p>
          <Link href="/login" className="cta-primary mt-4 inline-block rounded-lg px-6 py-2">
            前往登录
          </Link>
        </div>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="surface-page flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-red-400">{error || '加载失败'}</p>
          <button onClick={fetchProfile} className="btn-ghost-themed mt-4 rounded-lg px-6 py-2">
            重试
          </button>
        </div>
      </div>
    );
  }

  const missionCompletionRate =
    profile.missionProgress.total > 0
      ? (profile.missionProgress.completed / profile.missionProgress.total) * 100
      : 0;
  const topArenaRank = profile.arenaPortfolio.personalBestByTask[0];

  return (
    <div className="surface-page">
      <header className="surface-topbar px-6 py-4">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-subtle transition hover:text-foreground">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </Link>
            <h1 className="text-xl font-bold text-foreground">个人中心</h1>
          </div>
          <UserMenu user={profile.user} />
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-8">
        <div className="surface-card mb-8 bg-gradient-to-br from-card via-card to-accent/40 p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-3xl font-bold text-white">
                {profile.user.name?.charAt(0) || 'U'}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">{profile.user.name}</h2>
                <p className="text-subtle">
                  学号 {profile.profile?.studentNumber || '未设置'} · {profile.profile?.className || '未绑定班级'}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-4 text-sm text-subtle">
                  <span>
                    技术分 <span className="text-amber-500">{Math.round(profile.profile?.techScore || 0)}</span>
                  </span>
                  <span>
                    伦理分 <span className="text-emerald-500">{Math.round(profile.profile?.ethicsScore || 0)}</span>
                  </span>
                  <span>{profile.competency.trend}</span>
                </div>
              </div>
            </div>
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-6 py-4 text-center md:text-right">
              <div className="text-5xl font-bold text-amber-500">{profile.competency.overallScore}</div>
              <p className="text-lg font-medium text-foreground">{profile.competency.level}</p>
              <p className="text-sm text-subtle">六维能力综合得分</p>
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-[1.25fr_0.75fr]">
          <div className="surface-card p-6">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h3 className="text-lg font-semibold text-foreground">能力画像</h3>
                <p className="mt-1 text-sm text-subtle">
                  已对齐当前实际能力维度，聚焦控制建模、参数设计、跨域迁移、工程决策、探究反思与自主学习。
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {profile.competency.strengths.map((strength) => (
                  <span key={strength} className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-600 dark:text-emerald-300">
                    强项 · {strength}
                  </span>
                ))}
                {profile.competency.weaknesses.map((weakness) => (
                  <span key={weakness} className="rounded-full bg-amber-500/10 px-3 py-1 text-xs text-amber-700 dark:text-amber-300">
                    待补强 · {weakness}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {profile.competency.dimensions.map((dimension) => (
                <div key={dimension.key} className="surface-card-soft p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-medium text-foreground">{dimension.label}</p>
                      <p className="mt-1 text-xs leading-5 text-subtle">{dimension.description}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-foreground">{dimension.score}</div>
                      <div className={`text-xs ${trendClassName(dimension.trend)}`}>{trendText(dimension.trend)}</div>
                    </div>
                  </div>
                  <div className="mt-4 h-2 rounded-full bg-accent/85">
                    <div
                      className={`h-2 rounded-full ${scoreBarClassName(dimension.score)}`}
                      style={{ width: `${Math.max(0, Math.min(100, dimension.score))}%` }}
                    />
                  </div>
                  <div className="mt-2 flex items-center justify-between text-xs text-subtle">
                    <span>置信度 {Math.round(dimension.confidence * 100)}%</span>
                    <span>{dimension.evidenceCount} 条证据</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-6">
            <div className="surface-card p-6">
              <h3 className="mb-4 text-lg font-semibold text-foreground">学习统计</h3>
              <div className="space-y-4">
                <StatItem label="完成仿真" value={profile.statistics.totalSimulations} unit="次" color="text-blue-500" />
                <StatItem label="完成任务" value={profile.statistics.completedMissions} unit="个" color="text-emerald-500" />
                <StatItem label="伦理违规" value={profile.statistics.ethicalViolations} unit="次" color="text-red-500" />
                <StatItem
                  label="仿真时长"
                  value={Math.round(profile.statistics.totalSimulationTime / 60)}
                  unit="分钟"
                  color="text-amber-500"
                />
                <StatItem label="平均得分" value={profile.statistics.averageScore} unit="分" color="text-violet-500" />
              </div>
            </div>

            <div className="surface-card p-6">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-lg font-semibold text-foreground">竞技场画像</h3>
                <Link href="/arena" className="text-sm text-primary transition hover:text-primary/80">
                  进入竞技场 →
                </Link>
              </div>

              {profile.arenaPortfolio.submissionSummary.total === 0 ? (
                <p className="mt-4 text-sm text-subtle">暂无竞技场提交记录。</p>
              ) : (
                <div className="mt-4 space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <ArenaStat label="控制器" value={profile.arenaPortfolio.controllerCount} />
                    <ArenaStat label="辨识模型" value={profile.arenaPortfolio.identificationModels.length} />
                    <ArenaStat label="有效提交" value={profile.arenaPortfolio.submissionSummary.valid} />
                  </div>

                  <div className="surface-card-soft p-4">
                    <p className="text-xs text-subtle">最好榜单位置</p>
                    {topArenaRank ? (
                      <div className="mt-2">
                        <p className="font-medium text-foreground">{topArenaRank.taskTitle}</p>
                        <p className="mt-1 text-sm text-subtle">
                          第 {topArenaRank.rank} 名 · {Math.round(topArenaRank.bestScore)} 分
                        </p>
                      </div>
                    ) : (
                      <p className="mt-2 text-sm text-subtle">尚无进入正式榜单的有效方案</p>
                    )}
                  </div>

                  <div>
                    <p className="text-xs text-subtle">常失败对象</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {profile.arenaPortfolio.frequentFailureObjects.length > 0 ? (
                        profile.arenaPortfolio.frequentFailureObjects.map((object) => (
                          <span key={object.objectId} className="rounded-full bg-red-500/10 px-3 py-1 text-xs text-red-600 dark:text-red-300">
                            {object.objectName} · {object.failureCount} 次
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-subtle">暂无明显失败对象</span>
                      )}
                    </div>
                  </div>

                  <div>
                    <p className="text-xs text-subtle">提升明显指标</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {profile.arenaPortfolio.improvingMetrics.length > 0 ? (
                        profile.arenaPortfolio.improvingMetrics.map((metric) => (
                          <span key={`${metric.taskId}-${metric.metricId}`} className="rounded-full bg-emerald-500/10 px-3 py-1 text-xs text-emerald-600 dark:text-emerald-300">
                            {metric.metricLabel} +{Math.round(metric.delta * 100)}%
                          </span>
                        ))
                      ) : (
                        <span className="text-xs text-subtle">暂无可判定的指标提升</span>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="surface-card p-6">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-semibold text-foreground">任务进度</h3>
                <Link href="/missions" className="text-sm text-primary transition hover:text-primary/80">
                  查看全部 →
                </Link>
              </div>
              <div className="mt-4 h-4 rounded-full bg-accent/80">
                <div
                  className="h-4 rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                  style={{ width: `${missionCompletionRate}%` }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-sm text-subtle">
                <span>已完成 {profile.missionProgress.completed} / {profile.missionProgress.total}</span>
                <span>待解锁 {profile.missionProgress.locked}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <div className="surface-card p-6">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h3 className="text-lg font-semibold text-foreground">最近活动</h3>
                <p className="mt-1 text-sm text-subtle">
                  汇总课堂参与、仿真训练、互动页面和自适应题目等全部学习轨迹。
                </p>
              </div>
              {profile.recentActivity.total > 3 && (
                <button
                  onClick={() => setShowAllActivities((value) => !value)}
                  className="rounded-full border border-border/70 px-4 py-2 text-sm text-foreground transition hover:border-amber-500/40 hover:text-amber-600 dark:hover:text-amber-300"
                >
                  {showAllActivities ? '收起' : '查看全部'}
                </button>
              )}
            </div>

            {profile.recentActivity.total === 0 ? (
              <p className="py-10 text-center text-subtle">暂无活动记录</p>
            ) : showAllActivities ? (
              <div className="mt-6 space-y-6">
                {profile.recentActivity.grouped.map((group) => (
                  <div key={group.category}>
                    <div className="mb-3 flex items-center justify-between">
                      <h4 className="text-sm font-medium text-foreground">{group.label}</h4>
                      <span className="text-xs text-subtle">{group.items.length} 条</span>
                    </div>
                    <div className="space-y-3">
                      {group.items.map((activity) => (
                        <ActivityItem key={activity.id} activity={activity} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {profile.recentActivity.preview.map((activity) => (
                  <ActivityItem key={activity.id} activity={activity} />
                ))}
              </div>
            )}
          </div>

          <div className="surface-card p-6">
            <h3 className="text-lg font-semibold text-foreground">个性化补强路径</h3>
            <p className="mt-1 text-sm text-subtle">
              根据你当前状态推荐具体资源，并接入自适应习题系统继续诊断与练习。
            </p>

            <div className="mt-5 space-y-3">
              {profile.personalizedReinforcement.resources.length === 0 ? (
                <div className="surface-card-soft p-4 text-sm text-subtle">
                  暂无新的补强资源，建议先完成一次课堂或自适应练习以刷新推荐。
                </div>
              ) : (
                profile.personalizedReinforcement.resources.map((resource) => (
                  <Link
                    key={resource.id}
                    href={resource.actionUrl}
                    className="surface-card-soft block p-4 transition hover:border-amber-500/30 hover:bg-accent/70"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`rounded px-2 py-0.5 text-xs ${resourceTypeClassName(resource.type)}`}>
                            {resourceTypeLabel(resource.type)}
                          </span>
                          <span className="text-xs text-subtle">优先级 {resource.priority}</span>
                          {resource.estimatedTime && (
                            <span className="text-xs text-subtle">{resource.estimatedTime}</span>
                          )}
                        </div>
                        <p className="mt-2 font-medium text-foreground">{resource.title}</p>
                        <p className="mt-1 text-sm text-subtle">{resource.description}</p>
                        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">推荐原因：{resource.reason}</p>
                      </div>
                      <svg className="mt-1 h-5 w-5 text-subtle" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                      </svg>
                    </div>
                  </Link>
                ))
              )}
            </div>

            <div className="mt-6 rounded-2xl border border-violet-500/20 bg-violet-500/5 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h4 className="font-medium text-foreground">自适应习题诊断摘要</h4>
                  <p className="mt-1 text-sm text-subtle">
                    已记录 {profile.personalizedReinforcement.adaptivePractice.questionCount} 题，
                    当前能力估计 {profile.personalizedReinforcement.adaptivePractice.estimatedAbility ?? '未生成'}
                  </p>
                </div>
                <Link
                  href={profile.personalizedReinforcement.adaptivePractice.actionUrl}
                  className="rounded-full bg-violet-600 px-4 py-2 text-sm text-white transition hover:bg-violet-500"
                >
                  继续练习
                </Link>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                <div className="surface-card-soft p-3">
                  <p className="text-xs text-subtle">薄弱知识点</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {profile.personalizedReinforcement.adaptivePractice.weakAreas.length > 0 ? (
                      profile.personalizedReinforcement.adaptivePractice.weakAreas.map((area) => (
                        <span key={area} className="rounded-full bg-white/60 px-3 py-1 text-xs text-foreground dark:bg-slate-900/50">
                          {area}
                        </span>
                      ))
                    ) : (
                      <span className="text-xs text-subtle">暂无诊断数据</span>
                    )}
                  </div>
                </div>
                <div className="surface-card-soft p-3">
                  <p className="text-xs text-subtle">下一步聚焦</p>
                  <div className="mt-2 space-y-2">
                    {profile.personalizedReinforcement.adaptivePractice.recommendedFocus.length > 0 ? (
                      profile.personalizedReinforcement.adaptivePractice.recommendedFocus.map((focus) => (
                        <p key={focus} className="text-sm text-foreground">{focus}</p>
                      ))
                    ) : (
                      <span className="text-xs text-subtle">先完成一轮诊断后生成建议</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8">
          <h3 className="mb-4 text-lg font-semibold text-foreground">学习成长中心</h3>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <QuickAction
              href="/profile/growth"
              title="成长中枢"
              description="能力雷达、成长轨迹、下一步建议"
              iconPath="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
              badge="已联动"
              badgeColor="bg-emerald-500/20 text-emerald-400"
            />
            <QuickAction
              href="/profile/portfolio"
              title="学习档案"
              description="优秀作品、提示词收藏、仿真记录"
              iconPath="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
            <QuickAction
              href="/assessment/adaptive-practice"
              title="自适应练习"
              description="进入题库继续个性化补强"
              iconPath="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
              badge="推荐"
              badgeColor="bg-violet-500/20 text-violet-300"
            />
            <QuickAction
              href="/missions"
              title="任务大厅"
              description="查看学习任务进度"
              iconPath="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
            />
          </div>
        </div>
      </main>
    </div>
  );
}

function StatItem({
  label,
  value,
  unit,
  color,
}: {
  label: string;
  value: number;
  unit: string;
  color: string;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-subtle">{label}</span>
      <span className={`font-semibold ${color}`}>
        {value} <span className="text-sm text-subtle">{unit}</span>
      </span>
    </div>
  );
}

function ArenaStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="surface-card-soft p-3 text-center">
      <div className="text-2xl font-bold text-foreground">{value}</div>
      <div className="mt-1 text-xs text-subtle">{label}</div>
    </div>
  );
}

function ActivityItem({ activity }: { activity: ActivityItemData }) {
  const content = (
    <div className="surface-card-soft p-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <div className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-full ${activityCategoryClassName(activity.category)}`}>
            <ActivityIcon category={activity.category} />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <p className="font-medium text-foreground">{activity.title}</p>
              {activity.badge && (
                <span className="rounded-full bg-white/60 px-2 py-0.5 text-[11px] text-subtle dark:bg-slate-900/50">
                  {activity.badge}
                </span>
              )}
            </div>
            <p className="mt-1 text-sm text-subtle">{activity.description}</p>
          </div>
        </div>
        <span className="whitespace-nowrap text-xs text-subtle">{formatDate(activity.timestamp)}</span>
      </div>
    </div>
  );

  if (activity.href) {
    return <Link href={activity.href}>{content}</Link>;
  }

  return content;
}

function ActivityIcon({ category }: { category: ActivityItemData['category'] }) {
  const pathMap: Record<ActivityItemData['category'], string> = {
    classroom: 'M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422A12.083 12.083 0 0112 20.055 12.083 12.083 0 015.84 10.578L12 14z',
    interactive: 'M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z',
    simulation: 'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664zM21 12a9 9 0 11-18 0 9 9 0 0118 0z',
    assessment: 'M9 5H7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2',
  };

  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={pathMap[category]} />
    </svg>
  );
}

function QuickAction({
  href,
  title,
  description,
  iconPath,
  badge,
  badgeColor,
}: {
  href: string;
  title: string;
  description: string;
  iconPath: string;
  badge?: string;
  badgeColor?: string;
}) {
  return (
    <Link href={href} className="surface-card group block p-5 transition hover:border-amber-500/30 hover:bg-accent/70">
      <div className="flex items-start justify-between gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-300">
          <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={iconPath} />
          </svg>
        </div>
        {badge && (
          <span className={`rounded-full px-2 py-0.5 text-xs ${badgeColor ?? 'bg-accent text-foreground'}`}>
            {badge}
          </span>
        )}
      </div>
      <p className="mt-4 font-medium text-foreground">{title}</p>
      <p className="mt-1 text-sm text-subtle">{description}</p>
      <div className="mt-4 flex items-center text-sm text-primary transition group-hover:translate-x-1">
        进入
        <svg className="ml-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

function formatDate(dateStr: string) {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return '刚刚';
  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  return date.toLocaleDateString('zh-CN', { month: 'numeric', day: 'numeric' });
}

function trendText(trend: 'up' | 'stable' | 'down') {
  if (trend === 'up') return '上升';
  if (trend === 'down') return '下降';
  return '稳定';
}

function trendClassName(trend: 'up' | 'stable' | 'down') {
  if (trend === 'up') return 'text-emerald-600 dark:text-emerald-300';
  if (trend === 'down') return 'text-red-600 dark:text-red-300';
  return 'text-subtle';
}

function scoreBarClassName(score: number) {
  if (score >= 75) return 'bg-emerald-500';
  if (score >= 55) return 'bg-amber-500';
  return 'bg-red-500';
}

function activityCategoryClassName(category: ActivityItemData['category']) {
  if (category === 'classroom') return 'bg-blue-500/15 text-blue-500';
  if (category === 'interactive') return 'bg-violet-500/15 text-violet-500';
  if (category === 'simulation') return 'bg-emerald-500/15 text-emerald-500';
  return 'bg-amber-500/15 text-amber-600 dark:text-amber-300';
}

function resourceTypeLabel(type: UserProfile['personalizedReinforcement']['resources'][number]['type']) {
  if (type === 'interactive') return '互动模块';
  if (type === 'simulation') return '仿真';
  if (type === 'knowledge') return '知识卡片';
  if (type === 'assessment') return '题目/评测';
  return '学习路径';
}

function resourceTypeClassName(type: UserProfile['personalizedReinforcement']['resources'][number]['type']) {
  if (type === 'interactive') return 'bg-blue-500/15 text-blue-500';
  if (type === 'simulation') return 'bg-emerald-500/15 text-emerald-500';
  if (type === 'knowledge') return 'bg-amber-500/15 text-amber-700 dark:text-amber-300';
  if (type === 'assessment') return 'bg-violet-500/15 text-violet-500';
  return 'bg-slate-500/15 text-slate-500';
}
