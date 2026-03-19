'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
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
}

export function TeacherDashboard({
  user,
  stats,
  recentClasses,
  recentPlans,
  activeSessions,
}: TeacherDashboardProps) {
  return (
    <main className="surface-page mx-auto max-w-[1600px] px-6 py-8">
      <div className="teacher-home-hero mb-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-foreground">欢迎回来，{user.name || '老师'}！</h2>
          <p className="mt-2 text-subtle">从班级、教案和课堂历史进入日常教学工作流。</p>
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
