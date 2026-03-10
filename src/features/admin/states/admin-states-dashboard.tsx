'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  ArrowLeft,
  BarChart3,
  BookOpenCheck,
  Gamepad2,
  GraduationCap,
  MessagesSquare,
  Radar,
  Ship,
  Users,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '@/components/providers/theme-provider';
import { UserMenu } from '@/components/shared/user-menu';
import { adminStatesMockData } from './stats-data';

type AdminStatesDashboardProps = {
  currentUser: {
    id: string;
    name?: string | null;
    email?: string | null;
    role: 'ADMIN';
  };
};

const numberFormatter = new Intl.NumberFormat('zh-CN');
const percentFormatter = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 });

const MODULE_COLORS = ['#22d3ee', '#38bdf8', '#34d399', '#f59e0b', '#a78bfa', '#f97316'];

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

export function AdminStatesDashboard({ currentUser }: AdminStatesDashboardProps) {
  const { mounted, theme } = useTheme();
  const isDark = mounted ? theme === 'dark' : true;
  const axisColor = isDark ? '#94a3b8' : '#334155';
  const gridColor = isDark ? 'rgba(100,116,139,0.25)' : 'rgba(148,163,184,0.35)';
  const chartTooltipStyle = {
    background: isDark ? '#0f172a' : '#ffffff',
    border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
    borderRadius: '8px',
    color: isDark ? '#e2e8f0' : '#0f172a',
  };
  const chartTooltipLabelStyle = {
    color: isDark ? '#e2e8f0' : '#0f172a',
    fontWeight: 600,
  };
  const chartTooltipItemStyle = {
    color: isDark ? '#cbd5e1' : '#334155',
  };
  const chartLegendStyle = {
    color: isDark ? '#cbd5e1' : '#334155',
    fontSize: '12px',
  };

  const totals = {
    interactionTotal: adminStatesMockData.interactionByType.reduce((sum, item) => sum + item.count, 0),
    simulationVisitTotal: adminStatesMockData.simulationVisits.reduce((sum, item) => sum + item.visits, 0),
    monthlyVisitTotal: adminStatesMockData.monthlyTrend.reduce((sum, item) => sum + item.totalVisits, 0),
  };

  const estimates = {
    exerciseAttemptsTotal:
      adminStatesMockData.userScale.students * adminStatesMockData.estimatedPerStudent.exerciseAttempts,
    simulationMinutesTotal:
      adminStatesMockData.userScale.students * adminStatesMockData.estimatedPerStudent.simulationMinutes,
    odysseyTotal:
      adminStatesMockData.userScale.students * adminStatesMockData.estimatedPerStudent.controlOdysseyVisits,
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100">
      <header className="border-b border-slate-200 bg-gradient-to-b from-slate-100 via-white to-slate-50 dark:border-cyan-500/30 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="mx-auto max-w-[1600px] px-6 py-6">
          <Link
            href="/admin"
            className="mb-4 inline-flex items-center gap-2 text-sm text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            返回管理后台
          </Link>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.28em] text-cyan-700/80 dark:text-cyan-300/65">Platform States</p>
              <h1 className="mt-1 text-2xl font-semibold text-slate-900 dark:text-white">系统使用量统计</h1>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
                学期：{adminStatesMockData.semester} · 数据生成时间：{adminStatesMockData.generatedAt}
              </p>
            </div>
            <UserMenu user={currentUser} />
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1600px] gap-6 px-6 py-6">
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<Users className="h-5 w-5 text-cyan-700 dark:text-cyan-200" />}
            title="用户规模"
            value={`${formatNumber(adminStatesMockData.userScale.students)} 学生`}
            description={`教师 ${adminStatesMockData.userScale.teachers} · 管理员 ${adminStatesMockData.userScale.admins}`}
          />
          <MetricCard
            icon={<MessagesSquare className="h-5 w-5 text-cyan-700 dark:text-cyan-200" />}
            title="互动总量"
            value={formatNumber(totals.interactionTotal)}
            description={`人均 ${adminStatesMockData.estimatedPerStudent.interactiveActions} 次`}
          />
          <MetricCard
            icon={<Ship className="h-5 w-5 text-cyan-700 dark:text-cyan-200" />}
            title="仿真访问总量"
            value={formatNumber(totals.simulationVisitTotal)}
            description={`7类仿真分项统计`}
          />
          <MetricCard
            icon={<Gamepad2 className="h-5 w-5 text-cyan-700 dark:text-cyan-200" />}
            title="Control Odyssey"
            value={formatNumber(adminStatesMockData.controlOdysseyVisits)}
            description="高频训练访问模块"
          />
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <Panel title="月度访问量变化" subtitle="平台总体访问、互动量、仿真访问趋势">
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={adminStatesMockData.monthlyTrend}>
                  <defs>
                    <linearGradient id="visitGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3ee" stopOpacity={0.45} />
                      <stop offset="95%" stopColor="#22d3ee" stopOpacity={0.03} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                  <XAxis dataKey="month" stroke={axisColor} />
                  <YAxis stroke={axisColor} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip
                    formatter={(value) => formatNumber(Number(value) || 0)}
                    contentStyle={chartTooltipStyle}
                    labelStyle={chartTooltipLabelStyle}
                    itemStyle={chartTooltipItemStyle}
                  />
                  <Legend wrapperStyle={chartLegendStyle} />
                  <Area
                    type="monotone"
                    dataKey="totalVisits"
                    name="总访问量"
                    stroke="#22d3ee"
                    fill="url(#visitGradient)"
                    strokeWidth={2}
                  />
                  <Line type="monotone" dataKey="interactions" name="互动量" stroke="#34d399" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="simulationVisits" name="仿真访问量" stroke="#f59e0b" strokeWidth={2} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="模块访问结构占比" subtitle="按平台核心模块拆分">
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={adminStatesMockData.moduleVisitShare}
                    dataKey="visits"
                    nameKey="module"
                    outerRadius={110}
                    innerRadius={52}
                    paddingAngle={2}
                  >
                    {adminStatesMockData.moduleVisitShare.map((entry, index) => (
                      <Cell key={entry.module} fill={MODULE_COLORS[index % MODULE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value) => formatNumber(Number(value) || 0)}
                    contentStyle={chartTooltipStyle}
                    labelStyle={chartTooltipLabelStyle}
                    itemStyle={chartTooltipItemStyle}
                  />
                  <Legend wrapperStyle={chartLegendStyle} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <Panel title="互动环节统计（按类型）" subtitle="课堂活动与学习行为拆分">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={adminStatesMockData.interactionByType} layout="vertical" margin={{ left: 42 }}>
                  <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                  <XAxis type="number" stroke={axisColor} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <YAxis type="category" dataKey="type" stroke={axisColor} width={112} />
                  <Tooltip
                    formatter={(value) => formatNumber(Number(value) || 0)}
                    contentStyle={chartTooltipStyle}
                    labelStyle={chartTooltipLabelStyle}
                    itemStyle={chartTooltipItemStyle}
                  />
                  <Bar dataKey="count" fill="#22d3ee" radius={[0, 8, 8, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>

          <Panel title="虚拟仿真访问量（7类分项）" subtitle="按具体仿真场景统计访问量">
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={adminStatesMockData.simulationVisits}>
                  <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                  <XAxis dataKey="simulation" stroke={axisColor} tick={{ fontSize: 11 }} interval={0} angle={-15} height={58} />
                  <YAxis stroke={axisColor} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                  <Tooltip
                    formatter={(value) => formatNumber(Number(value) || 0)}
                    contentStyle={chartTooltipStyle}
                    labelStyle={chartTooltipLabelStyle}
                    itemStyle={chartTooltipItemStyle}
                  />
                  <Bar dataKey="visits" fill="#38bdf8" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </section>

        <section className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
          <Panel title="完整学习周期负载" subtitle="按 1,890 名学生完整学习口径统计">
            <div className="grid gap-3 md:grid-cols-2">
              <StatLine icon={<BookOpenCheck className="h-4 w-4" />} label="习题尝试总量" value={formatNumber(estimates.exerciseAttemptsTotal)} />
              <StatLine icon={<Ship className="h-4 w-4" />} label="仿真总时长（分钟）" value={formatNumber(estimates.simulationMinutesTotal)} />
              <StatLine icon={<Gamepad2 className="h-4 w-4" />} label="Control Odyssey 总访问" value={formatNumber(estimates.odysseyTotal)} />
              <StatLine
                icon={<Radar className="h-4 w-4" />}
                label="知识图谱交互总量"
                value={formatNumber(adminStatesMockData.userScale.students * adminStatesMockData.estimatedPerStudent.knowledgeGraphInteractions)}
              />
            </div>
            <p className="mt-4 text-xs text-slate-600 dark:text-slate-500">
              口径说明：按学生完整学习链路统计，包含互动、仿真、评测与知识图谱行为。
            </p>
          </Panel>

          <Panel title="学习活跃与完课率" subtitle="活跃学生规模与课程完课率联动">
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={adminStatesMockData.monthlyTrend}>
                  <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                  <XAxis dataKey="month" stroke={axisColor} />
                  <YAxis yAxisId="left" stroke={axisColor} />
                  <YAxis yAxisId="right" orientation="right" stroke={axisColor} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    formatter={(value, name) =>
                      name === '完课率'
                        ? `${percentFormatter.format(Number(value) || 0)}%`
                        : formatNumber(Number(value) || 0)
                    }
                    contentStyle={chartTooltipStyle}
                    labelStyle={chartTooltipLabelStyle}
                    itemStyle={chartTooltipItemStyle}
                  />
                  <Legend wrapperStyle={chartLegendStyle} />
                  <Line yAxisId="left" type="monotone" dataKey="activeStudents" name="活跃学生" stroke="#22d3ee" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="completionRate" name="完课率" stroke="#f59e0b" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </Panel>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-900/50">
          <p className="text-xs uppercase tracking-[0.24em] text-cyan-700/80 dark:text-cyan-300/65">Semester Brief</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <BriefCard
              icon={<GraduationCap className="h-4 w-4 text-cyan-700 dark:text-cyan-300" />}
              title="教学规模"
              text={`18 名教师覆盖 ${formatNumber(adminStatesMockData.userScale.students)} 名学生，形成高并发教学组织。`}
            />
            <BriefCard
              icon={<BarChart3 className="h-4 w-4 text-cyan-700 dark:text-cyan-300" />}
              title="学习行为密度"
              text={`学期总访问量 ${formatNumber(totals.monthlyVisitTotal)}，互动总量 ${formatNumber(totals.interactionTotal)}。`}
            />
            <BriefCard
              icon={<Ship className="h-4 w-4 text-cyan-700 dark:text-cyan-300" />}
              title="仿真实训强度"
              text={`7类仿真累计访问 ${formatNumber(totals.simulationVisitTotal)}，Control Odyssey 达到 ${formatNumber(adminStatesMockData.controlOdysseyVisits)}。`}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white/90 p-5 dark:border-slate-800 dark:bg-slate-900/50">
      <h2 className="text-base font-semibold text-slate-900 dark:text-white">{title}</h2>
      <p className="mt-1 text-xs text-slate-600 dark:text-slate-400">{subtitle}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function MetricCard({
  icon,
  title,
  value,
  description,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  description: string;
}) {
  return (
    <div className="rounded-xl border border-cyan-200 bg-cyan-50/70 p-4 shadow-[0_0_20px_rgba(14,116,144,0.08)] dark:border-cyan-500/20 dark:bg-cyan-500/5 dark:shadow-[0_0_32px_rgba(34,211,238,0.08)]">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.22em] text-cyan-700/80 dark:text-cyan-200/70">{title}</p>
        <span className="rounded-full bg-cyan-100 p-2 dark:bg-cyan-500/10">{icon}</span>
      </div>
      <p className="mt-4 text-2xl font-semibold text-slate-900 dark:text-white">{value}</p>
      <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">{description}</p>
    </div>
  );
}

function StatLine({
  icon,
  label,
  value,
}: {
  icon: ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
        <span className="text-cyan-700 dark:text-cyan-300">{icon}</span>
        {label}
      </div>
      <span className="text-sm font-semibold text-slate-900 dark:text-white">{value}</span>
    </div>
  );
}

function BriefCard({
  icon,
  title,
  text,
}: {
  icon: ReactNode;
  title: string;
  text: string;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/60">
      <div className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
        {icon}
        {title}
      </div>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{text}</p>
    </div>
  );
}
