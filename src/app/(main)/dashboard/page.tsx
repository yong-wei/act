import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Home, Users } from 'lucide-react';

import { UserMenu } from '@/components/shared/user-menu';
import { getServerAuthSession } from '@/lib/auth';
import {
  getPlatformCockpitHref,
  getStudentLearningIntentNavigationGroups,
  type PlatformRoleNavigationItem,
} from '@/lib/platform-role-navigation';
import { prisma } from '@/lib/prisma';
import { ensureUserProfile, initializeUserProgress } from '@/lib/user-sync';

const studentCoreEntries = getStudentLearningIntentNavigationGroups().flatMap((group) => group.entries);

const dashboardEntryMeta = {
  'student-simulations': {
    icon: '🚢',
    badge: '实时仿真',
    badgeColor: 'bg-blue-500/20 text-blue-400',
    iconBg: 'bg-blue-500/20 text-blue-400',
  },
  'student-knowledge': {
    icon: '📚',
    badge: '资源地图',
    badgeColor: 'bg-cyan-500/20 text-cyan-400',
    iconBg: 'bg-cyan-500/20 text-cyan-400',
  },
  'student-arena': {
    icon: '🏆',
    badge: '官方评测',
    badgeColor: 'bg-amber-500/20 text-amber-400',
    iconBg: 'bg-amber-500/20 text-amber-400',
  },
  'student-control-workbench': {
    icon: '🧭',
    badge: '控制实验',
    badgeColor: 'bg-violet-500/20 text-violet-400',
    iconBg: 'bg-violet-500/20 text-violet-400',
  },
  'student-adaptive-learning': {
    icon: '🧠',
    badge: '个性化',
    badgeColor: 'bg-emerald-500/20 text-emerald-400',
    iconBg: 'bg-emerald-500/20 text-emerald-400',
  },
  'student-interactive-learning': {
    icon: '🎓',
    badge: '互动课程',
    badgeColor: 'bg-fuchsia-500/20 text-fuchsia-400',
    iconBg: 'bg-fuchsia-500/20 text-fuchsia-400',
  },
  'platform-data-center': {
    icon: '📊',
    badge: '数据中心',
    badgeColor: 'bg-teal-500/20 text-teal-400',
    iconBg: 'bg-teal-500/20 text-teal-400',
  },
  'student-profile': {
    icon: '👤',
    badge: '能力画像',
    badgeColor: 'bg-purple-500/20 text-purple-400',
    iconBg: 'bg-purple-500/20 text-purple-400',
  },
} as const;

const quickStartEntryIds = [
  'student-simulations',
  'student-arena',
  'student-adaptive-learning',
] as const;

const quickStartEntries = quickStartEntryIds.flatMap((entryId) => {
  const entry = studentCoreEntries.find((candidate) => candidate.id === entryId);
  return entry ? [entry] : [];
});

function getDashboardEntryMeta(entry: PlatformRoleNavigationItem) {
  return dashboardEntryMeta[entry.id as keyof typeof dashboardEntryMeta] ?? {
    icon: '↗',
    badge: entry.actionLabel ?? '进入',
    badgeColor: 'bg-primary/15 text-primary',
    iconBg: 'bg-primary/15 text-primary',
  };
}

export default async function DashboardPage() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role === 'ADMIN') {
    redirect(getPlatformCockpitHref(session.user.role));
  }

  if (session.user.role === 'TEACHER') {
    redirect(getPlatformCockpitHref(session.user.role));
  }

  // 确保用户有档案和初始任务
  await ensureUserProfile(session.user.id);
  await initializeUserProgress(session.user.id);

  // 获取用户统计数据
  const [profile, missionStats, simulationCount] = await Promise.all([
    prisma.studentProfile.findUnique({
      where: { userId: session.user.id },
      select: {
        techScore: true,
        ethicsScore: true,
      },
    }),
    prisma.userProgress.aggregate({
      where: { userId: session.user.id },
      _count: {
        _all: true,
      },
    }),
    prisma.simulationLog.count({
      where: { userId: session.user.id },
    }),
  ]);

  const completedMissions = await prisma.userProgress.count({
    where: {
      userId: session.user.id,
      status: 'COMPLETED',
    },
  });

  return (
    <div className="surface-page">
      {/* 顶部导航栏 */}
      <header className="surface-topbar px-6 py-4">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between">
          <div className="flex items-center gap-6">
            <Link
              href="/"
              className="flex items-center gap-2 text-muted-foreground transition hover:text-foreground"
            >
              <Home className="h-5 w-5" />
              <span className="text-sm">返回首页</span>
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-foreground">AI-OBE 船舶智控平台</h1>
              <p className="text-sm text-muted-foreground">成果导向教育 · 智能控制实训</p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <UserMenu user={session.user} />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-8">
        {/* 欢迎区域 */}
        <div className="surface-card mb-8 bg-gradient-to-br from-card to-accent/75 p-8">
          <div className="mb-6">
            <h2 className="text-3xl font-bold text-foreground">
              欢迎回来，{session.user.name || '学员'}！
            </h2>
            <p className="mt-2 text-muted-foreground">
              继续你的船舶控制系统学习之旅，掌握 PID 控制理论与实践
            </p>
          </div>

          {/* 统计卡片 */}
          <div className="grid gap-4 md:grid-cols-4">
            <StatCard
              icon="🎯"
              label="完成任务"
              value={completedMissions}
              color="text-emerald-400"
            />
            <StatCard
              icon="🚢"
              label="仿真次数"
              value={simulationCount}
              color="text-blue-400"
            />
            <StatCard
              icon="⚙️"
              label="技术分"
              value={profile?.techScore?.toFixed(1) || '0.0'}
              color="text-amber-400"
            />
            <StatCard
              icon="🛡️"
              label="伦理分"
              value={profile?.ethicsScore || 100}
              color="text-purple-400"
            />
          </div>
        </div>

        {/* 加入课堂 / 班级 - 醒目入口 */}
        <div className="mb-8">
          <Link
            href="/classroom/join"
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary to-cyan-600 py-5 text-lg font-medium text-primary-foreground shadow-lg shadow-cyan-900/20 transition-all hover:from-primary/90 hover:to-cyan-500"
          >
            <Users className="h-6 w-6" />
            加入课堂 / 班级
            <span className="ml-2 text-sm opacity-80">输入课堂码或班级加入码</span>
          </Link>
        </div>

        {/* 功能模块网格 */}
        <div className="mb-8">
          <h3 className="mb-4 text-xl font-semibold text-foreground">学习模块</h3>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {studentCoreEntries.map((entry) => {
              const meta = getDashboardEntryMeta(entry);
              return (
                <FeatureCard
                  key={entry.id}
                  href={entry.href}
                  icon={<span className="text-3xl">{meta.icon}</span>}
                  title={entry.label}
                  description={entry.description}
                  badge={meta.badge}
                  badgeColor={meta.badgeColor}
                  iconBg={meta.iconBg}
                />
              );
            })}
          </div>
        </div>

        {/* 快速开始 */}
        <div className="surface-card p-6">
          <h3 className="mb-4 text-lg font-semibold text-foreground">快速开始</h3>
          <div className="grid gap-4 md:grid-cols-3">
            {quickStartEntries.map((entry) => {
                const meta = getDashboardEntryMeta(entry);
                return (
                  <QuickAction
                    key={entry.id}
                    href={entry.href}
                    icon={meta.icon}
                    title={entry.actionLabel ?? entry.label}
                    description={entry.description}
                  />
                );
              })}
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
        <span className="text-3xl">{icon}</span>
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className={`text-2xl font-bold ${color}`}>{value}</p>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  href,
  icon,
  title,
  description,
  badge,
  badgeColor,
  iconBg,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge: string;
  badgeColor: string;
  iconBg: string;
}) {
  return (
    <Link
      href={href}
      prefetch={href.startsWith('/simulations') ? false : undefined}
      className="surface-card-soft group relative overflow-hidden p-6 transition-all hover:border-primary/45 hover:bg-accent/85 hover:shadow-lg hover:shadow-primary/15"
    >
      <div className="mb-4 flex items-start justify-between">
        <div className={`rounded-lg p-3 ${iconBg}`}>{icon}</div>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${badgeColor}`}>
          {badge}
        </span>
      </div>
      <h4 className="mb-2 text-lg font-semibold text-foreground">{title}</h4>
      <p className="text-sm text-muted-foreground">{description}</p>
      <div className="mt-4 flex items-center text-sm font-medium text-primary">
        进入
        <svg
          className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
        </svg>
      </div>
    </Link>
  );
}

function QuickAction({
  href,
  icon,
  title,
  description,
}: {
  href: string;
  icon: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      prefetch={href.startsWith('/simulations') ? false : undefined}
      className="surface-card-soft flex items-center gap-4 p-4 transition-colors hover:border-primary/35 hover:bg-accent/70"
    >
      <span className="text-3xl">{icon}</span>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}
