import { redirect } from 'next/navigation';
import Link from 'next/link';
import { Home, Users } from 'lucide-react';

import { UserMenu } from '@/components/shared/user-menu';
import { getServerAuthSession } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { ensureUserProfile, initializeUserProgress } from '@/lib/user-sync';

export default async function DashboardPage() {
  const session = await getServerAuthSession();

  if (!session?.user) {
    redirect('/login');
  }

  if (session.user.role === 'ADMIN') {
    redirect('/admin');
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

        {/* 加入课堂 - 醒目入口 */}
        <div className="mb-8">
          <Link
            href="/classroom/join"
            className="flex w-full items-center justify-center gap-3 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary to-cyan-600 py-5 text-lg font-medium text-primary-foreground shadow-lg shadow-cyan-900/20 transition-all hover:from-primary/90 hover:to-cyan-500"
          >
            <Users className="h-6 w-6" />
            加入课堂
            <span className="ml-2 text-sm opacity-80">输入6位课堂码</span>
          </Link>
        </div>

        {/* 功能模块网格 */}
        <div className="mb-8">
          <h3 className="mb-4 text-xl font-semibold text-foreground">学习模块</h3>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {/* 任务大厅 */}
            <FeatureCard
              href="/missions"
              icon={
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"
                  />
                </svg>
              }
              title="任务大厅"
              description="7 个渐进式学习任务，从入门到专家"
              badge={`${completedMissions} 已完成`}
              badgeColor="bg-emerald-500/20 text-emerald-400"
              iconBg="bg-emerald-500/20 text-emerald-400"
            />

            {/* 驱逐舰仿真 */}
            <FeatureCard
              href="/simulations/destroyer"
              icon={
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z"
                  />
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                  />
                </svg>
              }
              title="驱逐舰仿真"
              description="3D 可视化船舶航向控制仿真实验"
              badge="实时仿真"
              badgeColor="bg-blue-500/20 text-blue-400"
              iconBg="bg-blue-500/20 text-blue-400"
            />

            {/* AI 虚拟总工 */}
            <FeatureCard
              href="/ai/copilot"
              icon={
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  />
                </svg>
              }
              title="AI 虚拟总工"
              description="智能问答助教，PID 调参建议与优化"
              badge="AI 驱动"
              badgeColor="bg-amber-500/20 text-amber-400"
              iconBg="bg-amber-500/20 text-amber-400"
            />

            {/* 个人中心 */}
            <FeatureCard
              href="/profile"
              icon={
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              }
              title="个人中心"
              description="能力画像、学习统计、最近活动"
              badge="能力分析"
              badgeColor="bg-purple-500/20 text-purple-400"
              iconBg="bg-purple-500/20 text-purple-400"
            />

            {/* 伦理案例 */}
            <FeatureCard
              href="/ethics"
              icon={
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                  />
                </svg>
              }
              title="伦理案例"
              description="工程伦理教育、安全规范学习"
              badge="必修课程"
              badgeColor="bg-red-500/20 text-red-400"
              iconBg="bg-red-500/20 text-red-400"
            />

            {/* 知识库 */}
            <FeatureCard
              href="/knowledge"
              icon={
                <svg className="h-8 w-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
                  />
                </svg>
              }
              title="知识库"
              description="PID 控制理论、船舶动力学文档"
              badge="学习资料"
              badgeColor="bg-cyan-500/20 text-cyan-400"
              iconBg="bg-cyan-500/20 text-cyan-400"
            />
          </div>
        </div>

        {/* 快速开始 */}
        <div className="surface-card p-6">
          <h3 className="mb-4 text-lg font-semibold text-foreground">快速开始</h3>
          <div className="grid gap-4 md:grid-cols-3">
            <QuickAction
              href="/missions"
              icon="🎯"
              title="查看任务"
              description="继续学习进度"
            />
            <QuickAction
              href="/simulations/destroyer"
              icon="🚢"
              title="开始仿真"
              description="进入实验环境"
            />
            <QuickAction
              href="/ai/copilot"
              icon="🤖"
              title="咨询AI"
              description="获取学习帮助"
            />
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
