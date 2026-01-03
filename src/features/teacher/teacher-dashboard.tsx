'use client';

import Link from 'next/link';
import {
  BookOpen,
  GraduationCap,
  Plus,
  Play,
  Users,
  Radio,
  ChevronRight,
  Clock,
  Library,
} from 'lucide-react';

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
    <main className="mx-auto max-w-[1600px] px-6 py-8">
      {/* 欢迎区域 */}
      <div className="mb-8 rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-900 to-slate-800 p-8">
        <div className="mb-6">
          <h2 className="text-3xl font-bold text-white">
            欢迎回来，{user.name || '老师'}！
          </h2>
          <p className="mt-2 text-slate-400">
            管理您的班级和课程，开始互动教学
          </p>
        </div>

        {/* 统计卡片 */}
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard
            icon={<Users className="h-6 w-6" />}
            label="我的班级"
            value={stats.totalClasses}
            color="text-sky-400"
            iconBg="bg-sky-500/20"
          />
          <StatCard
            icon={<GraduationCap className="h-6 w-6" />}
            label="班级学生"
            value={stats.totalStudents}
            color="text-emerald-400"
            iconBg="bg-emerald-500/20"
          />
          <StatCard
            icon={<BookOpen className="h-6 w-6" />}
            label="教案数量"
            value={stats.totalPlans}
            color="text-amber-400"
            iconBg="bg-amber-500/20"
          />
          <StatCard
            icon={<Radio className="h-6 w-6" />}
            label="进行中课堂"
            value={stats.activeSessions}
            color="text-rose-400"
            iconBg="bg-rose-500/20"
          />
        </div>
      </div>

      {/* 快捷操作 */}
      <div className="mb-8 grid gap-4 md:grid-cols-4">
        <QuickAction
          href="/teacher/classes/new"
          icon={<Plus className="h-5 w-5" />}
          title="新建班级"
          description="创建班级并生成加入码"
          color="bg-sky-500/20 text-sky-400"
        />
        <QuickAction
          href="/teacher/lesson-plans/new"
          icon={<BookOpen className="h-5 w-5" />}
          title="新建教案"
          description="创建 BOPPPS 教学设计"
          color="bg-amber-500/20 text-amber-400"
        />
        <QuickAction
          href="/teacher/lesson-plans"
          icon={<Play className="h-5 w-5" />}
          title="开始上课"
          description="选择教案开始课堂"
          color="bg-emerald-500/20 text-emerald-400"
        />
        <QuickAction
          href="/teacher/resources"
          icon={<Library className="h-5 w-5" />}
          title="教学资源管理"
          description="管理互动组件与知识卡片"
          color="bg-purple-500/20 text-purple-400"
        />
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        {/* 进行中的课堂 */}
        {activeSessions.length > 0 && (
          <div className="lg:col-span-2">
            <div className="rounded-2xl border border-rose-500/30 bg-rose-500/5 p-6">
              <div className="mb-4 flex items-center justify-between">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-white">
                  <Radio className="h-5 w-5 animate-pulse text-rose-400" />
                  进行中的课堂
                </h3>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                {activeSessions.map((session) => (
                  <Link
                    key={session.id}
                    href={`/classroom/teacher/${session.id}`}
                    className="flex items-center justify-between rounded-xl border border-rose-500/20 bg-slate-900/50 p-4 transition hover:border-rose-500/40 hover:bg-slate-900"
                  >
                    <div>
                      <p className="font-medium text-white">{session.planTitle}</p>
                      <p className="mt-1 text-sm text-slate-400">
                        加入码: <span className="font-mono text-rose-400">{session.joinCode}</span>
                        {' · '}
                        {session.studentCount} 名学生在线
                      </p>
                    </div>
                    <ChevronRight className="h-5 w-5 text-slate-400" />
                  </Link>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* 我的班级 */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">我的班级</h3>
            <Link
              href="/teacher/classes"
              className="text-sm text-sky-400 hover:text-sky-300"
            >
              查看全部
            </Link>
          </div>
          {recentClasses.length === 0 ? (
            <div className="py-8 text-center">
              <Users className="mx-auto h-12 w-12 text-slate-600" />
              <p className="mt-2 text-slate-500">暂无班级</p>
              <Link
                href="/teacher/classes/new"
                className="mt-4 inline-block text-sm text-sky-400 hover:text-sky-300"
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
                  className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/50 p-4 transition hover:border-sky-500/50 hover:bg-slate-800"
                >
                  <div>
                    <p className="font-medium text-white">{cls.name}</p>
                    <p className="mt-1 text-xs text-slate-400">
                      班级码: <span className="font-mono text-sky-400">{cls.code}</span>
                      {' · '}
                      {cls.studentCount} 名学生
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-400" />
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* 我的教案 */}
        <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-lg font-semibold text-white">我的教案</h3>
            <Link
              href="/teacher/lesson-plans"
              className="text-sm text-amber-400 hover:text-amber-300"
            >
              查看全部
            </Link>
          </div>
          {recentPlans.length === 0 ? (
            <div className="py-8 text-center">
              <BookOpen className="mx-auto h-12 w-12 text-slate-600" />
              <p className="mt-2 text-slate-500">暂无教案</p>
              <Link
                href="/teacher/lesson-plans/new"
                className="mt-4 inline-block text-sm text-amber-400 hover:text-amber-300"
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
                  className="flex items-center justify-between rounded-xl border border-slate-700 bg-slate-800/50 p-4 transition hover:border-amber-500/50 hover:bg-slate-800"
                >
                  <div>
                    <p className="font-medium text-white">{plan.title}</p>
                    <p className="mt-1 flex items-center gap-1 text-xs text-slate-400">
                      <Clock className="h-3 w-3" />
                      {formatDate(plan.updatedAt)}
                    </p>
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-400" />
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
  iconBg,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
  iconBg: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-800/50 p-4">
      <div className="flex items-center gap-3">
        <div className={`rounded-lg p-2 ${iconBg} ${color}`}>{icon}</div>
        <div>
          <p className="text-xs text-slate-500">{label}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function QuickAction({
  href,
  icon,
  title,
  description,
  color,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  color: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-4 rounded-xl border border-slate-700 bg-slate-800/30 p-4 transition-colors hover:border-slate-600 hover:bg-slate-800/50"
    >
      <div className={`rounded-lg p-3 ${color}`}>{icon}</div>
      <div>
        <p className="font-medium text-white">{title}</p>
        <p className="text-xs text-slate-400">{description}</p>
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

  if (diffMins < 60) return `${diffMins} 分钟前`;
  if (diffHours < 24) return `${diffHours} 小时前`;
  if (diffDays < 7) return `${diffDays} 天前`;
  return date.toLocaleDateString('zh-CN');
}
