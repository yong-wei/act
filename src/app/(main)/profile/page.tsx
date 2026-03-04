'use client';

/**
 * 学生个人中心页面
 *
 * 展示学生能力画像、学习统计、最近活动
 */


import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  CompetencyRadar,
  calculateOverallScore,
  getCompetencyLevel,
  type CompetencyData,
} from '@/features/dashboard/competency-radar';
import { UserMenu } from '@/components/shared/user-menu';

interface UserProfile {
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
    totalSimulationTime: number;
    averageScore: number;
  };
  competency: CompetencyData;
  recentActivity: Array<{
    id: string;
    type: 'simulation' | 'mission' | 'violation';
    title: string;
    timestamp: string;
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

export default function ProfilePage() {
  const router = useRouter();
  const sessionData = useSession();
  const session = sessionData?.data;
  const status = sessionData?.status ?? 'loading';
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 非学生角色重定向
  useEffect(() => {
    if (status === 'authenticated' && session?.user?.role) {
      if (session.user.role !== 'STUDENT') {
        const redirectPath = session.user.role === 'ADMIN' ? '/admin' : '/teacher';
        router.replace(redirectPath);
        return;
      }
      fetchProfile();
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
          <Link
            href="/login"
            className="cta-primary mt-4 inline-block rounded-lg px-6 py-2"
          >
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
          <button
            onClick={fetchProfile}
            className="btn-ghost-themed mt-4 rounded-lg px-6 py-2"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  const overallScore = calculateOverallScore(profile.competency);
  const competencyLevel = getCompetencyLevel(overallScore);
  const trackingRows = [
    { key: 'computational', label: '计算能力' },
    { key: 'crossDomain', label: '跨域映射' },
    { key: 'designTradeoff', label: '设计权衡' },
    { key: 'poleTimeMapping', label: '极点-时域映射' },
    { key: 'frequencyStability', label: '频域稳定判读' },
  ] as const;

  return (
    <div className="surface-page">
      {/* 头部导航 */}
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
          <div className="flex items-center gap-3">
            <UserMenu user={profile.user} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-8">
        {/* 用户卡片 */}
        <div className="surface-card mb-8 bg-gradient-to-br from-card via-card to-accent/40 p-6">
          <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-br from-amber-500 to-orange-600 text-3xl font-bold text-white">
                {profile.user.name?.charAt(0) || 'U'}
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground">{profile.user.name}</h2>
                <p className="text-subtle">
                  {profile.profile?.classId || '未设置班级'} · {profile.user.role === 'STUDENT' ? '学生' : profile.user.role}
                </p>
                <div className="mt-2 flex items-center gap-4">
                  <span className="text-sm text-slate-500">
                    技术分: <span className="text-amber-400">{profile.profile?.techScore || 0}</span>
                  </span>
                  <span className="text-sm text-slate-500">
                    伦理分: <span className="text-emerald-400">{profile.profile?.ethicsScore || 100}</span>
                  </span>
                </div>
              </div>
            </div>
            <div className="text-center md:text-right">
              <div className="text-5xl font-bold text-amber-400">{overallScore}</div>
              <p className={`text-lg font-medium ${competencyLevel.color}`}>{competencyLevel.level}</p>
              <p className="text-sm text-slate-500">{competencyLevel.description}</p>
            </div>
          </div>
        </div>

        <div className="grid gap-8 lg:grid-cols-3">
          {/* 左侧：能力雷达图 */}
          <div className="lg:col-span-2">
            <div className="surface-card p-6">
              <h3 className="mb-4 text-lg font-semibold text-foreground">能力画像</h3>
              <CompetencyRadar data={profile.competency} size="lg" />
              <div className="mt-4 grid grid-cols-5 gap-2">
                {Object.entries(profile.competency).map(([key, value]) => {
                  const labels: Record<string, string> = {
                    steadyStateAccuracy: '稳态精度',
                    dynamicResponse: '动态响应',
                    robustness: '鲁棒性',
                    safety: '安全性',
                    energyEfficiency: '能耗控制',
                  };
                  return (
                    <div key={key} className="text-center">
                      <div className="text-2xl font-bold text-foreground">{value}</div>
                      <div className="text-xs text-slate-500">{labels[key]}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* 右侧：统计数据 */}
          <div className="space-y-6">
            {/* 学习统计 */}
            <div className="surface-card p-6">
              <h3 className="mb-4 text-lg font-semibold text-foreground">学习统计</h3>
              <div className="space-y-4">
                <StatItem
                  label="完成仿真"
                  value={profile.statistics.totalSimulations}
                  unit="次"
                  color="text-blue-400"
                />
                <StatItem
                  label="完成任务"
                  value={profile.statistics.completedMissions}
                  unit="个"
                  color="text-emerald-400"
                />
                <StatItem
                  label="伦理违规"
                  value={profile.statistics.ethicalViolations}
                  unit="次"
                  color="text-red-400"
                />
                <StatItem
                  label="仿真时长"
                  value={Math.round(profile.statistics.totalSimulationTime / 60)}
                  unit="分钟"
                  color="text-amber-400"
                />
                <StatItem
                  label="平均得分"
                  value={profile.statistics.averageScore}
                  unit="分"
                  color="text-purple-400"
                />
              </div>
            </div>

            {/* 任务进度 */}
            <div className="surface-card p-6">
              <h3 className="mb-4 text-lg font-semibold text-foreground">任务进度</h3>
              <div className="relative h-4 rounded-full bg-accent/80">
                <div
                  className="absolute left-0 top-0 h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500"
                  style={{
                    width: `${
                      profile.missionProgress.total > 0
                        ? (profile.missionProgress.completed / profile.missionProgress.total) * 100
                        : 0
                    }%`,
                  }}
                />
              </div>
              <div className="mt-3 flex justify-between text-sm">
                <span className="text-slate-400">
                  已完成 <span className="text-amber-400">{profile.missionProgress.completed}</span> /{' '}
                  {profile.missionProgress.total}
                </span>
                <Link href="/missions" className="text-primary transition hover:text-primary/80">
                  查看全部 →
                </Link>
              </div>
            </div>
          </div>
        </div>

        {/* 课前 vs 课后能力追踪 + 补强路径 */}
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          <div className="surface-card p-6">
            <h3 className="mb-4 text-lg font-semibold text-foreground">能力追踪（课前 vs 课后）</h3>
            <div className="space-y-3">
              {trackingRows.map((row) => {
                const pre = profile.abilityTracking.pre[row.key];
                const post = profile.abilityTracking.post[row.key];
                const delta = profile.abilityTracking.delta[row.key];
                return (
                  <div key={row.key} className="surface-card-soft p-3">
                    <div className="mb-2 flex items-center justify-between text-sm">
                      <span className="text-subtle">{row.label}</span>
                      <span className={delta >= 0 ? 'text-emerald-300' : 'text-red-300'}>
                        {delta >= 0 ? '+' : ''}{delta}
                      </span>
                    </div>
                    <div className="h-2 rounded-full bg-accent/85">
                      <div
                        className="h-2 rounded-full bg-slate-500"
                        style={{ width: `${Math.max(0, Math.min(100, pre))}%` }}
                      />
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-accent/85">
                      <div
                        className="h-2 rounded-full bg-emerald-500"
                        style={{ width: `${Math.max(0, Math.min(100, post))}%` }}
                      />
                    </div>
                    <p className="mt-2 text-xs text-slate-500">
                      课前 {pre} → 课后 {post}
                    </p>
                  </div>
                );
              })}
            </div>
            <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              当前短板：{profile.abilityTracking.weakTagLabel}（{profile.abilityTracking.postWeakTag}）
            </div>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-400">
              <span>提示词结构分：<span className="text-violet-300">{profile.promptStructuringScore ?? '-'}</span></span>
              <span>设计效果分：<span className="text-emerald-300">{profile.designEffectScore ?? '-'}</span></span>
            </div>
          </div>

          <div className="surface-card p-6">
            <h3 className="mb-4 text-lg font-semibold text-foreground">个性化补强路径</h3>
            <div className="space-y-3">
              {profile.reinforcementPaths.map((path) => (
                <div key={path.id} className="surface-card-soft p-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium text-foreground">{path.title}</p>
                    <span className="text-xs text-amber-300">{path.estimatedTime} min</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-400">{path.description}</p>
                </div>
              ))}
            </div>
            <h4 className="mt-5 text-sm font-medium text-slate-200">推荐题单</h4>
            <div className="mt-2 space-y-2">
              {profile.recommendedQuestions.map((question) => (
                <div key={question.id} className="surface-card-soft p-3 text-sm text-slate-200">
                  <p className="line-clamp-2">{question.stem}</p>
                  <p className="mt-1 text-xs text-slate-500">
                    难度 {question.difficulty.toFixed(2)} · {question.knowledgeTags.join(' / ')}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 最近活动 */}
        <div className="surface-card mt-8 p-6">
          <h3 className="mb-4 text-lg font-semibold text-foreground">最近活动</h3>
          {profile.recentActivity.length === 0 ? (
            <p className="text-center text-slate-500 py-8">暂无活动记录</p>
          ) : (
            <div className="space-y-3">
              {profile.recentActivity.map((activity) => (
                <ActivityItem key={activity.id} activity={activity} />
              ))}
            </div>
          )}
        </div>

        {/* 快捷操作 */}
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          <QuickAction
            href="/simulations/destroyer"
            icon={
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            title="开始仿真"
            description="进入驱逐舰航向控制仿真"
          />
          <QuickAction
            href="/ai/copilot"
            icon={
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            }
            title="AI 助教"
            description="咨询虚拟总工程师"
          />
          <QuickAction
            href="/missions"
            icon={
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            }
            title="任务大厅"
            description="查看学习任务进度"
          />
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
      <span className="text-slate-400">{label}</span>
      <span className={`font-semibold ${color}`}>
        {value} <span className="text-sm text-slate-500">{unit}</span>
      </span>
    </div>
  );
}

function ActivityItem({
  activity,
}: {
  activity: {
    id: string;
    type: 'simulation' | 'mission' | 'violation';
    title: string;
    timestamp: string;
    result?: string;
  };
}) {
  const typeStyles = {
    simulation: 'bg-blue-500/20 text-blue-400',
    mission: 'bg-emerald-500/20 text-emerald-400',
    violation: 'bg-red-500/20 text-red-400',
  };

  const typeIcons = {
    simulation: '🚢',
    mission: '✅',
    violation: '⚠️',
  };

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 60) return `${diffMins} 分钟前`;
    if (diffHours < 24) return `${diffHours} 小时前`;
    if (diffDays < 7) return `${diffDays} 天前`;
    return date.toLocaleDateString('zh-CN');
  };

  return (
    <div className="surface-card-soft flex items-center gap-4 px-4 py-3">
      <span className={`rounded-lg px-2 py-1 text-sm ${typeStyles[activity.type]}`}>
        {typeIcons[activity.type]}
      </span>
      <div className="flex-1">
        <p className="text-sm text-foreground">{activity.title}</p>
        <p className="text-xs text-slate-500">{formatDate(activity.timestamp)}</p>
      </div>
      {activity.result && (
        <span className="text-sm text-slate-400">{activity.result}</span>
      )}
    </div>
  );
}

function QuickAction({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      prefetch={href.startsWith('/simulations') ? false : undefined}
      className="surface-card-soft flex items-center gap-4 p-4 transition-colors hover:border-amber-500/40 hover:bg-accent/70"
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-500/20 text-amber-400">
        {icon}
      </div>
      <div>
        <h4 className="font-medium text-foreground">{title}</h4>
        <p className="text-sm text-subtle">{description}</p>
      </div>
    </Link>
  );
}
