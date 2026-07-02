'use client';

/**
 * 任务大厅页面
 *
 * 展示所有学习任务和用户进度
 */

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { StudentFeedbackTaskPanel } from '@/features/assessment/student-feedback-task-panel';
import { useVerifiedFeedbackTaskContext } from '@/features/assessment/use-verified-feedback-task-context';
import { MissionCard, MissionCardSkeleton, type MissionData } from '@/features/mission/mission-card';
import { buildFeedbackTaskContext, buildFeedbackTaskHref } from '@/lib/student-feedback-task-contract';

interface MissionsResponse {
  missions: MissionData[];
  statistics: {
    total: number;
    completed: number;
    unlocked: number;
  };
}

export default function MissionsPage() {
  const sessionData = useSession();
  const status = sessionData?.status ?? 'loading';
  const router = useRouter();
  const searchParams = useSearchParams();
  const searchParamsKey = searchParams.toString();
  const [data, setData] = useState<MissionsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unlocked' | 'completed'>('all');
  const localFeedbackContext = buildFeedbackTaskContext({
    assignment: searchParams.get('assignment') ?? searchParams.get('q'),
    criterion: searchParams.get('criterion'),
    source: searchParams.get('source'),
    feedbackSource: searchParams.get('feedbackSource'),
    status: searchParams.get('status'),
    action: searchParams.get('action'),
    returnTo: searchParams.get('returnTo'),
    intent: searchParams.get('intent'),
    teacherInterventionId: searchParams.get('teacherInterventionId'),
  });
  const feedbackContext = useVerifiedFeedbackTaskContext(localFeedbackContext, searchParams);

  const fetchMissions = useCallback(async (paramsKey = searchParamsKey) => {
    try {
      setLoading(true);
      const currentParams = new URLSearchParams(paramsKey);
      const missionQuery = new URLSearchParams();
      const assignment = currentParams.get('assignment') ?? currentParams.get('q');
      if (assignment) missionQuery.set('assignment', assignment);
      if (currentParams.get('q')) missionQuery.set('q', currentParams.get('q') ?? '');
      if (currentParams.get('criterion')) missionQuery.set('criterion', currentParams.get('criterion') ?? '');
      if (currentParams.get('source')) missionQuery.set('source', currentParams.get('source') ?? '');
      if (currentParams.get('feedbackSource')) missionQuery.set('feedbackSource', currentParams.get('feedbackSource') ?? '');
      if (currentParams.get('status')) missionQuery.set('status', currentParams.get('status') ?? '');
      if (currentParams.get('action')) missionQuery.set('action', currentParams.get('action') ?? '');
      if (currentParams.get('returnTo')) missionQuery.set('returnTo', currentParams.get('returnTo') ?? '');
      if (currentParams.get('intent')) missionQuery.set('intent', currentParams.get('intent') ?? '');
      if (currentParams.get('teacherInterventionId')) missionQuery.set('teacherInterventionId', currentParams.get('teacherInterventionId') ?? '');
      const response = await fetch(`/api/missions?${missionQuery.toString()}`);
      if (!response.ok) {
        throw new Error('获取任务列表失败');
      }
      const result = await response.json();
      setData(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, [searchParamsKey]);

  useEffect(() => {
    if (status === 'authenticated') {
      void fetchMissions(searchParamsKey);
    }
  }, [fetchMissions, status, searchParamsKey]);

  const handleStartMission = (missionId: string) => {
    const href = feedbackContext
      ? buildFeedbackTaskHref(`/simulations/destroyer?mission=${encodeURIComponent(missionId)}`, feedbackContext, {
          intent: 'mission',
          status: feedbackContext.lifecycleState,
        })
      : `/simulations/destroyer?mission=${encodeURIComponent(missionId)}`;
    router.push(href);
  };

  if (status === 'loading' || loading) {
    return (
      <div className="surface-page" data-commercial-workspace="mission-workspace">
        <header className="surface-topbar px-6 py-4">
          <div className="flex w-full items-center gap-4">
            <div className="h-6 w-6 rounded bg-accent" />
            <div className="h-6 w-32 rounded bg-accent" />
          </div>
        </header>
        <main className="px-6 py-8">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <MissionCardSkeleton key={i} />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div className="surface-page flex items-center justify-center" data-commercial-workspace="mission-workspace">
        <div className="text-center">
          <p className="text-xl text-muted-foreground">请先登录</p>
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

  if (error) {
    return (
      <div className="surface-page flex items-center justify-center" data-commercial-workspace="mission-workspace">
        <div className="text-center">
          <p className="text-xl text-red-400">{error}</p>
          <button type="button"
            onClick={() => void fetchMissions()}
            className="btn-ghost-themed mt-4 rounded-lg border px-6 py-2"
          >
            重试
          </button>
        </div>
      </div>
    );
  }

  const filteredMissions = data?.missions.filter((mission) => {
    if (filter === 'all') return true;
    if (filter === 'unlocked') return mission.status === 'UNLOCKED';
    if (filter === 'completed') return mission.status === 'COMPLETED';
    return true;
  }) || [];

  return (
    <div className="surface-page" data-commercial-workspace="mission-workspace">
      {/* 头部导航 */}
      <header className="surface-topbar px-6 py-4">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-muted-foreground hover:text-foreground">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M15 19l-7-7 7-7"
                />
              </svg>
            </Link>
            <h1 className="text-xl font-bold text-foreground">任务大厅</h1>
          </div>
          <Link
            href="/profile"
            className="btn-ghost-themed rounded-lg border px-4 py-2 text-sm"
          >
            个人中心
          </Link>
        </div>
      </header>

      <main className="px-6 py-8">
        <StudentFeedbackTaskPanel context={feedbackContext} surface="missions" className="mb-6" />
        {/* 统计卡片 */}
        <div className="mb-8 grid gap-4 md:grid-cols-4">
          <StatCard
            icon="📚"
            label="全部任务"
            value={data?.statistics.total || 0}
            color="text-white"
          />
          <StatCard
            icon="🔓"
            label="已解锁"
            value={data?.statistics.unlocked || 0}
            color="text-amber-400"
          />
          <StatCard
            icon="✅"
            label="已完成"
            value={data?.statistics.completed || 0}
            color="text-emerald-400"
          />
          <StatCard
            icon="📈"
            label="完成率"
            value={`${data?.statistics.total ? Math.round((data.statistics.completed / data.statistics.total) * 100) : 0}%`}
            color="text-blue-400"
          />
        </div>

        {/* 进度条 */}
        <div className="mb-8">
          <div className="flex items-center justify-between text-sm text-muted-foreground">
            <span>学习进度</span>
            <span>
              {data?.statistics.completed || 0} / {data?.statistics.total || 0}
            </span>
          </div>
          <div className="mt-2 h-3 rounded-full bg-accent">
            <div
              className="h-full rounded-full bg-gradient-to-r from-amber-500 to-orange-500 transition-all duration-500"
              style={{
                width: `${data?.statistics.total ? (data.statistics.completed / data.statistics.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>

        {/* 筛选按钮 */}
        <div className="mb-6 flex gap-2">
          <FilterButton
            active={filter === 'all'}
            onClick={() => setFilter('all')}
            count={data?.missions.length || 0}
          >
            全部
          </FilterButton>
          <FilterButton
            active={filter === 'unlocked'}
            onClick={() => setFilter('unlocked')}
            count={data?.missions.filter((m) => m.status === 'UNLOCKED').length || 0}
          >
            可挑战
          </FilterButton>
          <FilterButton
            active={filter === 'completed'}
            onClick={() => setFilter('completed')}
            count={data?.missions.filter((m) => m.status === 'COMPLETED').length || 0}
          >
            已完成
          </FilterButton>
        </div>

        {/* 任务网格 */}
        {filteredMissions.length === 0 ? (
          <div className="surface-card p-12 text-center">
            <div className="text-6xl">🎯</div>
            <h3 className="mt-4 text-lg font-medium text-foreground">暂无任务</h3>
            <p className="mt-2 text-muted-foreground">
              {filter === 'all'
                ? '系统还没有配置任务，请联系管理员'
                : filter === 'unlocked'
                  ? '当前没有可挑战的任务'
                  : '你还没有完成任何任务，开始第一个挑战吧！'}
            </p>
            {filter !== 'all' && (
              <button type="button"
                onClick={() => setFilter('all')}
                className="btn-ghost-themed mt-4 rounded-lg border px-4 py-2"
              >
                查看全部
              </button>
            )}
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredMissions.map((mission) => (
              <MissionCard
                key={mission.id}
                mission={mission}
                launchHref={feedbackContext
                  ? buildFeedbackTaskHref(`/simulations/destroyer?mission=${encodeURIComponent(mission.id)}`, feedbackContext, {
                      intent: 'mission',
                      status: feedbackContext.lifecycleState,
                    })
                  : undefined}
                onStart={handleStartMission}
              />
            ))}
          </div>
        )}

        {/* 学习路径说明 */}
        <div className="surface-card mt-12 p-6">
          <h3 className="mb-4 text-lg font-semibold text-foreground">学习路径</h3>
          <div className="flex flex-wrap items-center gap-4">
            <PathNode label="入门" description="掌握基础操作" icon="🌱" active />
            <PathArrow />
            <PathNode label="进阶" description="理解 PID 控制" icon="📈" active={(data?.statistics.completed ?? 0) > 0} />
            <PathArrow />
            <PathNode label="挑战" description="复杂海况控制" icon="🌊" active={(data?.statistics.completed ?? 0) >= 3} />
            <PathArrow />
            <PathNode label="专家" description="成为控制专家" icon="🏆" active={(data?.statistics.completed ?? 0) >= 5} />
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: string;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="surface-card-soft p-4">
      <div className="flex items-center gap-3">
        <span className="text-2xl">{icon}</span>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function FilterButton({
  children,
  active,
  onClick,
  count,
}: {
  children: React.ReactNode;
  active: boolean;
  onClick: () => void;
  count: number;
}) {
  return (
    <button type="button"
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
        active
          ? 'bg-primary text-primary-foreground'
          : 'bg-accent text-muted-foreground hover:bg-accent/80 hover:text-foreground'
      }`}
    >
      {children}
      <span
        className={`rounded-full px-2 py-0.5 text-xs ${
          active ? 'bg-primary/85 text-primary-foreground' : 'bg-background text-muted-foreground'
        }`}
      >
        {count}
      </span>
    </button>
  );
}

function PathNode({
  label,
  description,
  icon,
  active,
}: {
  label: string;
  description: string;
  icon: string;
  active?: boolean;
}) {
  return (
    <div
      className={`flex items-center gap-3 rounded-lg p-3 transition-all ${
        active ? 'bg-primary/20' : 'bg-accent/60 opacity-60'
      }`}
    >
      <span className="text-2xl">{icon}</span>
      <div>
        <p className={`font-medium ${active ? 'text-primary' : 'text-muted-foreground'}`}>
          {label}
        </p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </div>
  );
}

function PathArrow() {
  return (
    <svg
      className="h-5 w-5 text-muted-foreground"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M9 5l7 7-7 7"
      />
    </svg>
  );
}
