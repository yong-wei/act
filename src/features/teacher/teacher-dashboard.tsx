'use client';

import { startTransition, useEffect, useRef, type ReactNode } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  BookOpen,
  ChevronRight,
  Clock,
  FileText,
  GraduationCap,
  History,
  Library,
  Plus,
  Radio,
  Users,
} from 'lucide-react';

import {
  TEACHER_DASHBOARD_PRIMARY_STATS,
  TEACHER_DASHBOARD_QUICK_ACTIONS,
  type TeacherDashboardIconKey,
  type TeacherDashboardPrimaryStat,
  type TeacherDashboardQuickAction,
} from './teacher-dashboard-config';
import {
  TEACHER_OPERATIONS_ANALYTICS_SLOTS,
  buildOperationsUnavailableSlot,
} from '@/features/admin/teacher-admin-governance-workspaces';

interface TeacherDashboardProps {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
  };
  stats: {
    totalClasses: number;
    totalStudents: number;
    totalPlans: number;
    activeSessions: number;
    finishedSessions: number;
  };
  recentClasses: Array<{
    id: string;
    name: string;
    code: string;
    studentCount: number;
    createdAt: string;
  }>;
  recentPlans: Array<{
    id: string;
    title: string;
    updatedAt: string;
  }>;
  activeSessions: Array<{
    id: string;
    planTitle: string;
    joinCode: string;
    studentCount: number;
    className?: string;
    classId?: string;
  }>;
  mode?: 'ready' | 'degraded';
}

export function TeacherDashboard({
  user,
  stats,
  recentClasses,
  recentPlans,
  activeSessions,
  mode = 'ready',
}: TeacherDashboardProps) {
  const router = useRouter();
  const refreshScheduledRef = useRef(false);

  useEffect(() => {
    refreshScheduledRef.current = false;
  }, [mode]);

  useEffect(() => {
    if (mode !== 'degraded') {
      return undefined;
    }

    let cancelled = false;

    const probeReadyz = async () => {
      if (refreshScheduledRef.current) {
        return;
      }

      try {
        const response = await fetch('/api/readyz', {
          cache: 'no-store',
        });
        if (!response.ok) {
          return;
        }

        const payload = (await response.json()) as { db?: boolean };
        if (!cancelled && payload.db) {
          refreshScheduledRef.current = true;
          startTransition(() => {
            router.refresh();
          });
        }
      } catch {
        // 降级恢复阶段忽略瞬时探测失败，等待下一轮轮询。
      }
    };

    void probeReadyz();
    const timer = window.setInterval(() => {
      void probeReadyz();
    }, 10000);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [mode, router]);

  const activeClassHref = resolveTeacherOperationsClassHref(activeSessions, recentClasses);
  const analyticsHref = `${activeClassHref}${activeClassHref === '/teacher/classes' ? '' : '/analytics-v2'}`;
  const preparationHref = recentPlans[0] ? `/teacher/lesson-plans/${recentPlans[0].id}/edit` : '/teacher/lesson-plans/new';
  const liveClassHref = activeSessions[0] ? `/classroom/teacher/${activeSessions[0].id}` : activeClassHref;
  const attentionItems = [
    {
      id: 'active-work',
      label: '当前课堂',
      value: activeSessions.length > 0 ? `${activeSessions.length} 个进行中` : '无进行中课堂',
      description: activeSessions[0]?.planTitle ?? '从班级或教案进入下一次课堂。',
      href: liveClassHref,
      action: activeSessions.length > 0 ? '继续课堂' : '查看班级',
    },
    {
      id: 'preparation',
      label: '备课动作',
      value: recentPlans.length > 0 ? `${recentPlans.length} 个近期教案` : '需要建立教案',
      description: recentPlans[0]?.title ?? '先创建教案，再发起课堂或绑定资源。',
      href: preparationHref,
      action: recentPlans.length > 0 ? '编辑教案' : '创建教案',
    },
    {
      id: 'evidence-review',
      label: '证据与学生',
      value: `${stats.totalStudents} 名学生`,
      description: '从班级进入学生证据、课堂表现与后续报告。',
      href: activeClassHref,
      action: '查看证据入口',
    },
    {
      id: 'history-report',
      label: '历史与报告',
      value: `${stats.finishedSessions} 节已结束`,
      description: '课堂历史保留回放、归档和报告入口。',
      href: '/teacher/history',
      action: '查看历史',
    },
    {
      id: 'analytics',
      label: '分析状态',
      value: stats.totalClasses > 0 ? '可从班级进入' : '等待班级数据',
      description: '分析未启用时显示明确状态，不生成占位指标。',
      href: analyticsHref,
      action: '查看分析状态',
    },
  ] as const;

  return (
    <main
      className="surface-page mx-auto max-w-[1600px] px-6 py-8"
      data-commercial-operations-workspace="teacher-operations"
      data-commercial-workspace-zone="instrument-area"
      data-operations-status-semantics={mode}
    >
      {mode === 'degraded' && (
        <div className="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-5 py-4 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-100">
          <p className="text-sm font-semibold">教师工作台已切换为降级模式</p>
          <p className="mt-1 text-sm">
            当前数据库连接暂不可用，班级、教案与课堂统计已临时隐藏。系统会自动重试，恢复后将自动刷新页面。
          </p>
        </div>
      )}

      <section
        className="surface-card mb-8 p-6"
        data-operations-first-viewport="teacher-attention"
        data-commercial-workspace-zone="command-bar"
      >
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <p className="text-sm font-medium text-subtle">教师运营台</p>
            <h2 className="mt-2 text-3xl font-bold text-foreground">欢迎回来，{user.name || '老师'}！</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-subtle">
              第一屏聚焦当前课堂、备课动作、证据入口、历史报告和分析可用性；目录入口保留为后续导航。
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/teacher/classes" className="btn-ghost-themed rounded-lg px-3 py-2 text-sm">
              班级
            </Link>
            <Link href="/teacher/lesson-plans" className="btn-ghost-themed rounded-lg px-3 py-2 text-sm">
              教案
            </Link>
            <Link href="/teacher/resources" className="btn-ghost-themed rounded-lg px-3 py-2 text-sm">
              资源
            </Link>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {attentionItems.map((item) => (
            <Link
              key={item.id}
              href={item.href}
              className="rounded-lg border border-border bg-muted/30 p-4 transition hover:border-primary/40 hover:bg-muted/50"
              data-teacher-operations-active-work={item.id === 'active-work' ? item.value : undefined}
              data-teacher-operations-pending-action={item.id}
            >
              <p className="text-xs font-medium text-subtle">{item.label}</p>
              <p className="mt-2 text-lg font-semibold text-foreground">{item.value}</p>
              <p className="mt-2 min-h-[48px] text-sm leading-6 text-subtle">{item.description}</p>
              <span className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-foreground">
                {item.action}
                <ChevronRight className="h-4 w-4" />
              </span>
            </Link>
          ))}
        </div>
      </section>

      <div className="teacher-home-hero mb-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-foreground">运营概览</h2>
          <p className="mt-2 text-subtle">班级、学生、教案和课堂历史用于判断后续教学动作。</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {TEACHER_DASHBOARD_PRIMARY_STATS.map((item) => (
            <StatCard key={item.label} config={item} value={stats[item.key]} />
          ))}
        </div>
      </div>

      <div className="mb-8 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {TEACHER_DASHBOARD_QUICK_ACTIONS.map((item) => (
          <QuickAction key={item.title} config={item} />
        ))}
      </div>

      <section
        className="surface-card mb-8 p-6"
        data-operations-analytics-slot-region="future-analytics"
        data-operations-status-semantics="feature-flagged"
      >
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-foreground">学习分析槽位</h3>
            <p className="mt-1 text-sm text-subtle">分析能力未启用时仅展示状态与可执行入口，不生成占位指标。</p>
          </div>
          <span className="rounded-full border border-border px-3 py-1 text-xs text-subtle">
            feature-flagged
          </span>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          {TEACHER_OPERATIONS_ANALYTICS_SLOTS.map((slot) => {
            const unavailableSlot = buildOperationsUnavailableSlot(slot);
            return (
              <div
                key={unavailableSlot.id}
                className="rounded-lg border border-border bg-muted/30 p-4"
                data-operations-unavailable-slot={unavailableSlot.id}
                data-operations-unavailable-state={unavailableSlot.state}
                data-operations-fabricates-metrics={String(unavailableSlot.fabricatesMetrics)}
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h4 className="font-medium text-foreground">{unavailableSlot.label}</h4>
                    <p className="mt-2 text-sm leading-6 text-subtle">
                      当前为显式未开放状态，可继续使用下方相邻操作。
                    </p>
                  </div>
                  <span className="rounded-full border border-border px-2 py-1 text-xs text-subtle">
                    {unavailableSlot.state}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {unavailableSlot.permittedAdjacentActions.map((action) => (
                    <span key={action} className="rounded-md border border-border px-2 py-1 text-xs text-subtle">
                      {action}
                    </span>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <div className="grid gap-8 lg:grid-cols-2">
        {activeSessions.length > 0 && (
          <div className="lg:col-span-2">
            <div className="teacher-home-live-shell">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-foreground">
                  <Radio className="h-5 w-5 animate-pulse text-rose-500 dark:text-rose-300" />
                  进行中的课堂
                </h3>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {activeSessions.map((session) => (
                  <Link
                    key={session.id}
                    href={`/classroom/teacher/${session.id}`}
                    className="teacher-home-list-item"
                  >
                    <div>
                      <p className="font-medium text-foreground">{session.planTitle}</p>
                      <p className="mt-1 text-sm text-subtle">
                        {session.className && (
                          <span className="text-sky-600 dark:text-sky-300">{session.className} · </span>
                        )}
                        加入码: <span className="font-mono text-rose-600 dark:text-rose-300">{session.joinCode}</span>
                        {' · '}
                        {session.studentCount} 人在线
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-subtle" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="surface-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">我的班级</h3>
            <Link
              href="/teacher/classes"
              className="text-sm text-sky-600 transition hover:text-sky-500 dark:text-sky-300 dark:hover:text-sky-200"
            >
              查看全部
            </Link>
          </div>
          {recentClasses.length === 0 ? (
            <div className="py-8 text-center">
              <Users className="mx-auto h-12 w-12 text-slate-500" />
              <p className="mt-2 text-subtle">暂无班级</p>
              <Link
                href="/teacher/classes/new"
                className="mt-4 inline-block text-sm text-sky-600 transition hover:text-sky-500 dark:text-sky-300 dark:hover:text-sky-200"
              >
                创建第一个班级
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentClasses.map((cls) => (
                <Link
                  key={cls.id}
                  href={`/teacher/classes/${cls.id}`}
                  className="teacher-home-list-item"
                >
                  <div>
                    <p className="font-medium text-foreground">{cls.name}</p>
                    <p className="mt-1 text-xs text-subtle">
                      班级码: <span className="font-mono text-sky-600 dark:text-sky-300">{cls.code}</span>
                      {' · '}
                      {cls.studentCount} 名学生
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-subtle" />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="surface-card p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-foreground">我的教案</h3>
            <Link
              href="/teacher/lesson-plans"
              className="text-sm text-amber-600 transition hover:text-amber-500 dark:text-amber-300 dark:hover:text-amber-200"
            >
              查看全部
            </Link>
          </div>
          {recentPlans.length === 0 ? (
            <div className="py-8 text-center">
              <BookOpen className="mx-auto h-12 w-12 text-slate-500" />
              <p className="mt-2 text-subtle">暂无教案</p>
              <Link
                href="/teacher/lesson-plans/new"
                className="mt-4 inline-block text-sm text-amber-600 transition hover:text-amber-500 dark:text-amber-300 dark:hover:text-amber-200"
              >
                创建第一个教案
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentPlans.map((plan) => (
                <Link
                  key={plan.id}
                  href={`/teacher/lesson-plans/${plan.id}/edit`}
                  className="teacher-home-list-item"
                >
                  <div>
                    <p className="font-medium text-foreground">{plan.title}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-subtle">
                      <Clock className="h-3 w-3" />
                      {formatDate(plan.updatedAt)}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-subtle" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export function resolveTeacherOperationsClassHref(
  activeSessions: TeacherDashboardProps['activeSessions'],
  recentClasses: TeacherDashboardProps['recentClasses'],
) {
  const classId = activeSessions.find((session) => session.classId)?.classId || recentClasses[0]?.id;
  return classId ? `/teacher/classes/${classId}` : '/teacher/classes';
}

function StatCard({ config, value }: { config: TeacherDashboardPrimaryStat; value: number }) {
  const content = (
    <div className={`teacher-home-stat-card ${config.href ? 'teacher-home-stat-card-link' : ''}`}>
      <div className="flex items-center gap-3">
        <div className={`teacher-home-stat-icon ${getToneClass(config.tone)}`}>
          {renderDashboardIcon(config.icon, 'h-6 w-6')}
        </div>
        <div>
          <p className="text-xs text-subtle">{config.label}</p>
          <p className="text-2xl font-bold text-foreground">{value}</p>
        </div>
      </div>
    </div>
  );

  if (config.href) {
    return <Link href={config.href}>{content}</Link>;
  }

  return content;
}

function QuickAction({ config }: { config: TeacherDashboardQuickAction }) {
  return (
    <Link href={config.href} className="teacher-home-action">
      <div className={`teacher-home-action-icon ${getToneClass(config.tone)}`}>
        {renderDashboardIcon(config.icon, 'h-5 w-5')}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-foreground">{config.title}</p>
        <p className="mt-1 text-sm text-subtle">{config.description}</p>
      </div>
    </Link>
  );
}

function renderDashboardIcon(icon: TeacherDashboardIconKey, className: string): ReactNode {
  if (icon === 'users') return <Users className={className} />;
  if (icon === 'graduation-cap') return <GraduationCap className={className} />;
  if (icon === 'book-open') return <BookOpen className={className} />;
  if (icon === 'radio') return <Radio className={className} />;
  if (icon === 'history') return <History className={className} />;
  if (icon === 'plus') return <Plus className={className} />;
  if (icon === 'file-text') return <FileText className={className} />;
  return <Library className={className} />;
}

function getToneClass(tone: TeacherDashboardPrimaryStat['tone'] | TeacherDashboardQuickAction['tone']) {
  if (tone === 'sky') return 'teacher-home-tone-sky';
  if (tone === 'emerald') return 'teacher-home-tone-emerald';
  if (tone === 'amber') return 'teacher-home-tone-amber';
  if (tone === 'rose') return 'teacher-home-tone-rose';
  if (tone === 'cyan') return 'teacher-home-tone-cyan';
  return 'teacher-home-tone-violet';
}

function formatDate(dateStr: string) {
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
}
