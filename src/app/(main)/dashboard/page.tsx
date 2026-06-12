import { redirect } from 'next/navigation';
import Link from 'next/link';
import {
  BookOpen,
  BrainCircuit,
  Compass,
  Database,
  Gauge,
  GraduationCap,
  Ship,
  ShieldCheck,
  Target,
  Trophy,
  UserCircle,
  Users,
} from 'lucide-react';

import { AppShell } from '@/components/platform/app-shell';
import { UserMenu } from '@/components/shared/user-menu';
import { buildLearnerDataRouteShell } from '@/features/adaptive/adaptive-learning-center-contracts';
import { getServerAuthSession } from '@/lib/auth';
import {
  getCommercialStudentEntryIntentGroups,
  getPlatformCockpitHref,
  getStudentLearningIntentNavigationGroups,
  resolveCommercialEntryHref,
  type PlatformRoleNavigationItem,
} from '@/lib/platform-role-navigation';
import { prisma } from '@/lib/prisma';
import { ensureUserProfile, initializeUserProgress } from '@/lib/user-sync';

const studentCoreEntries = getStudentLearningIntentNavigationGroups().flatMap((group) => group.entries);
const dashboardEntryIntentGroups = getCommercialStudentEntryIntentGroups();
const authenticatedProfileHref = '/profile';
const learnerDataShell = buildLearnerDataRouteShell('/dashboard');

type DashboardCommercialEntry = {
  intentGroup: (typeof dashboardEntryIntentGroups)[number];
  entry: PlatformRoleNavigationItem | null;
  href: string;
  key: string;
};

const dashboardCommercialEntries = dashboardEntryIntentGroups.flatMap<DashboardCommercialEntry>((intentGroup) => {
  if (intentGroup.intent === 'account-profile') {
    return [{
      intentGroup,
      entry: null,
      href: authenticatedProfileHref,
      key: intentGroup.intent,
    }];
  }

  return intentGroup.entryIds.flatMap((entryId) => {
    const entry = studentCoreEntries.find((candidate) => candidate.id === entryId);
    return entry
      ? [{
          intentGroup,
          entry,
          href: entry.href,
          key: entry.id,
        }]
      : [];
  });
});

const dashboardEntryMeta = {
  'student-simulations': {
    icon: <Ship className="h-6 w-6" />,
    badge: '实时仿真',
    badgeColor: 'bg-platform-action-subtle text-platform-action-primary',
    iconBg: 'bg-platform-action-subtle text-platform-action-primary',
  },
  'student-knowledge': {
    icon: <BookOpen className="h-6 w-6" />,
    badge: '资源地图',
    badgeColor: 'bg-platform-evidence-eligible/15 text-platform-evidence-eligible',
    iconBg: 'bg-platform-evidence-eligible/15 text-platform-evidence-eligible',
  },
  'student-arena': {
    icon: <Trophy className="h-6 w-6" />,
    badge: '官方评测',
    badgeColor: 'bg-platform-evaluation-official/15 text-platform-evaluation-official',
    iconBg: 'bg-platform-evaluation-official/15 text-platform-evaluation-official',
  },
  'student-control-workbench': {
    icon: <Compass className="h-6 w-6" />,
    badge: '控制实验',
    badgeColor: 'bg-platform-replay-ready/15 text-platform-replay-ready',
    iconBg: 'bg-platform-replay-ready/15 text-platform-replay-ready',
  },
  'student-adaptive-learning': {
    icon: <BrainCircuit className="h-6 w-6" />,
    badge: '个性化',
    badgeColor: 'bg-platform-evidence-eligible/15 text-platform-evidence-eligible',
    iconBg: 'bg-platform-evidence-eligible/15 text-platform-evidence-eligible',
  },
  'student-interactive-learning': {
    icon: <GraduationCap className="h-6 w-6" />,
    badge: '互动课程',
    badgeColor: 'bg-platform-action-subtle text-platform-action-primary',
    iconBg: 'bg-platform-action-subtle text-platform-action-primary',
  },
  'platform-data-center': {
    icon: <Database className="h-6 w-6" />,
    badge: '数据中心',
    badgeColor: 'bg-platform-evidence-context/15 text-platform-evidence-context',
    iconBg: 'bg-platform-evidence-context/15 text-platform-evidence-context',
  },
  'student-profile': {
    icon: <UserCircle className="h-6 w-6" />,
    badge: '能力画像',
    badgeColor: 'bg-platform-action-subtle text-platform-action-primary',
    iconBg: 'bg-platform-action-subtle text-platform-action-primary',
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
    icon: <Target className="h-6 w-6" />,
    badge: entry.actionLabel ?? '进入',
    badgeColor: 'bg-platform-action-subtle text-platform-action-primary',
    iconBg: 'bg-platform-action-subtle text-platform-action-primary',
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
    <AppShell
      viewerRole="student"
      title="学习者驾驶舱"
      subtitle="学习路径、证据状态与下一步行动"
      activeHref="/dashboard"
      userMenu={<UserMenu user={session.user} />}
      className="surface-page"
    >
      <section
        className="space-y-8"
        data-route-family={learnerDataShell.routeFamily}
        data-route-identity={learnerDataShell.routeIdentity}
        data-learner-record-surface={learnerDataShell.archetype}
      >
        <section
          className="surface-card mb-8 p-6"
          data-learner-record-priority="current-path"
          data-learner-record-evidence-confidence={profile?.techScore ? 'medium' : 'low'}
          data-learner-record-missing-source={simulationCount > 0 || completedMissions > 0 ? 'partial' : 'missing-learning-work'}
        >
          <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-primary">学习者记录</p>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">当前路径与下一步</h2>
              <p className="mt-2 text-sm text-subtle">
                系统优先依据课堂任务、仿真记录、Arena 结果和自适应练习生成学习路径；缺少来源时先补证据，再推荐下一步。
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <RecordSignal label="当前路径" value={completedMissions > 0 ? '任务推进中' : '等待首个任务'} />
              <RecordSignal label="证据置信" value={profile?.techScore ? '已形成画像' : '证据不足'} />
              <RecordSignal label="缺失来源" value="Arena/自适应证据按实际接入显示" />
              <RecordSignal label="复盘入口" value={`${completedMissions} 个任务`} />
            </div>
          </div>
          <div className="mt-5 flex flex-wrap gap-3">
            <Link
              href="/assessment/adaptive-practice?goal=control-correction&intent=practice"
              className="cta-primary rounded-lg px-4 py-2 text-sm"
              data-learner-record-next-action="adaptive-practice"
            >
              继续自适应练习
            </Link>
            <Link href="/profile/evidence" className="btn-ghost-themed rounded-lg px-4 py-2 text-sm">
              查看证据时间线
            </Link>
          </div>
        </section>

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
              icon={<Target className="h-7 w-7" />}
              label="完成任务"
              value={completedMissions}
              color="text-platform-evidence-eligible"
            />
            <StatCard
              icon={<Ship className="h-7 w-7" />}
              label="仿真次数"
              value={simulationCount}
              color="text-platform-action-primary"
            />
            <StatCard
              icon={<Gauge className="h-7 w-7" />}
              label="技术分"
              value={profile?.techScore?.toFixed(1) || '0.0'}
              color="text-platform-evidence-context"
            />
            <StatCard
              icon={<ShieldCheck className="h-7 w-7" />}
              label="伦理分"
              value={profile?.ethicsScore || 100}
              color="text-platform-evidence-eligible"
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
          <h3 className="mb-4 text-xl font-semibold text-foreground">学习入口地图</h3>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {dashboardCommercialEntries.map(({ intentGroup, entry, href, key }) => {
              const meta = entry ? getDashboardEntryMeta(entry) : dashboardEntryMeta['student-profile'];
              return (
                <FeatureCard
                  key={key}
                  href={href ?? resolveCommercialEntryHref(intentGroup.intent, true)}
                  icon={meta.icon}
                  title={`${intentGroup.label} · ${entry?.label ?? '个人中心'}`}
                  description={intentGroup.summary}
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
      </section>
    </AppShell>
  );
}

function RecordSignal({ label, value }: { label: string; value: string }) {
  return (
    <div className="surface-card-soft p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium text-foreground">{value}</p>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  color: string;
}) {
  return (
    <div className="surface-card-soft p-4">
      <div className="flex items-center gap-3">
        <span className="text-platform-fg-secondary">{icon}</span>
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
  icon: React.ReactNode;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      prefetch={href.startsWith('/simulations') ? false : undefined}
      className="surface-card-soft flex items-center gap-4 p-4 transition-colors hover:border-primary/35 hover:bg-accent/70"
    >
      <span className="text-platform-fg-secondary">{icon}</span>
      <div>
        <p className="font-medium text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </div>
    </Link>
  );
}
