'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useEffect, useState, useCallback } from 'react';
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
  ToggleLeft,
  ToggleRight,
  RefreshCw,
  Database,
  AlertCircle,
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

type InteractionStat = {
  type: string;
  count: number;
  avgPerStudent: number;
};

type SimulationVisitStat = {
  simulation: string;
  visits: number;
  avgDurationMinutes: number;
  completionRate: number;
};

type MonthlyTrendStat = {
  month: string;
  activeStudents: number;
  totalVisits: number;
  interactions: number;
  simulationVisits: number;
  completionRate: number;
};

type SystemUsageData = {
  generatedAt: string;
  semester: string;
  userScale: {
    teachers: number;
    students: number;
    admins: number;
  };
  estimatedPerStudent: Record<string, number>;
  interactionByType: InteractionStat[];
  simulationVisits: SimulationVisitStat[];
  controlOdysseyVisits: number;
  moduleVisitShare: Array<{ module: string; visits: number }>;
  monthlyTrend: MonthlyTrendStat[];
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

  // 演示模式状态
  const [demoMode, setDemoMode] = useState(true);
  const [data, setData] = useState<SystemUsageData>(adminStatesMockData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

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

  // 获取真实数据
  const fetchRealData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/system-usage', {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error('获取系统使用量数据失败');
      }
      const realData = await response.json();
      setData(realData);
      setLastUpdated(new Date());
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
      // 出错时回退到演示数据
      setData(adminStatesMockData);
    } finally {
      setLoading(false);
    }
  }, []);

  // 切换演示模式
  const toggleDemoMode = useCallback(() => {
    const newDemoMode = !demoMode;
    setDemoMode(newDemoMode);
    if (newDemoMode) {
      setData(adminStatesMockData);
      setLastUpdated(new Date());
      setError(null);
    } else {
      fetchRealData();
    }
  }, [demoMode, fetchRealData]);

  // 刷新数据
  const refreshData = useCallback(() => {
    if (demoMode) {
      setLastUpdated(new Date());
    } else {
      fetchRealData();
    }
  }, [demoMode, fetchRealData]);

  // 初始加载
  useEffect(() => {
    if (!demoMode) {
      fetchRealData();
    }
  }, [demoMode, fetchRealData]);

  const totals = {
    interactionTotal: data.interactionByType.reduce((sum, item) => sum + item.count, 0),
    simulationVisitTotal: data.simulationVisits.reduce((sum, item) => sum + item.visits, 0),
    monthlyVisitTotal: data.monthlyTrend.reduce((sum, item) => sum + item.totalVisits, 0),
  };

  const estimates = {
    exerciseAttemptsTotal:
      data.userScale.students * data.estimatedPerStudent.exerciseAttempts,
    simulationMinutesTotal:
      data.userScale.students * data.estimatedPerStudent.simulationMinutes,
    odysseyTotal:
      data.userScale.students * data.estimatedPerStudent.controlOdysseyVisits,
  };

  return (
    <div className={`min-h-screen ${isDark ? 'bg-slate-950 text-slate-100' : 'bg-slate-50 text-slate-900'}`}>
      {/* Header */}
      <header className={`border-b ${isDark ? 'border-cyan-500/30 bg-gradient-to-b from-slate-950 via-slate-900 to-slate-950' : 'border-cyan-200 bg-gradient-to-b from-white via-slate-50 to-white'}`}>
        <div className="mx-auto max-w-[1600px] px-6 py-6">
          <Link
            href="/admin"
            className={`mb-4 inline-flex items-center gap-2 text-sm transition ${isDark ? 'text-slate-400 hover:text-white' : 'text-slate-600 hover:text-slate-900'}`}
          >
            <ArrowLeft className="h-4 w-4" />
            返回管理后台
          </Link>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div>
              <p className={`text-xs uppercase tracking-[0.28em] ${isDark ? 'text-cyan-300/65' : 'text-cyan-700/80'}`}>Platform States</p>
              <h1 className={`mt-1 text-2xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>系统使用量统计</h1>
              <p className={`mt-2 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                学期：{data.semester} · 数据更新时间：{lastUpdated.toLocaleString('zh-CN')}
                {demoMode && <span className="ml-2 rounded-full bg-amber-500/20 px-2 py-0.5 text-xs text-amber-400">演示数据</span>}
              </p>
            </div>
            <div className="flex items-center gap-3">
              {/* 演示模式切换 */}
              <button
                onClick={toggleDemoMode}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                  demoMode
                    ? 'border-amber-500/40 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20'
                    : isDark
                    ? 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400'
                }`}
              >
                {demoMode ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                {demoMode ? '演示模式：开' : '演示模式：关'}
              </button>
              {/* 刷新按钮 */}
              <button
                onClick={refreshData}
                disabled={loading}
                className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm transition ${
                  isDark
                    ? 'border-slate-700 bg-slate-800/60 text-slate-300 hover:border-slate-500 disabled:opacity-50'
                    : 'border-slate-300 bg-white text-slate-700 hover:border-slate-400 disabled:opacity-50'
                }`}
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                刷新
              </button>
              <UserMenu user={currentUser} />
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-[1600px] gap-6 px-6 py-6">
        {/* 错误提示 */}
        {error && !demoMode && (
          <div className={`rounded-xl border p-4 ${isDark ? 'border-red-500/40 bg-red-500/10 text-red-200' : 'border-red-400 bg-red-50 text-red-800'}`}>
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              <span>获取真实数据失败：{error}，已自动切换回演示数据</span>
            </div>
          </div>
        )}

        {/* 加载遮罩 */}
        {loading && (
          <div className={`fixed inset-0 z-50 flex items-center justify-center ${isDark ? 'bg-black/50' : 'bg-white/70'}`}>
            <div className="flex items-center gap-3 rounded-xl border border-cyan-500/30 bg-slate-900/90 px-6 py-4 text-cyan-100">
              <RefreshCw className="h-5 w-5 animate-spin" />
              正在加载真实数据...
            </div>
          </div>
        )}

        {/* 顶部统计卡片 */}
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <MetricCard
            icon={<Users className="h-5 w-5" />}
            title="用户规模"
            value={`${formatNumber(data.userScale.students)} 学生`}
            description={`教师 ${data.userScale.teachers} · 管理员 ${data.userScale.admins}`}
            isDark={isDark}
          />
          <MetricCard
            icon={<MessagesSquare className="h-5 w-5" />}
            title="互动总量"
            value={formatNumber(totals.interactionTotal)}
            description={`人均 ${data.estimatedPerStudent.interactiveActions} 次`}
            isDark={isDark}
          />
          <MetricCard
            icon={<Ship className="h-5 w-5" />}
            title="仿真访问总量"
            value={formatNumber(totals.simulationVisitTotal)}
            description="7类仿真分项统计"
            isDark={isDark}
          />
          <MetricCard
            icon={<Gamepad2 className="h-5 w-5" />}
            title="Control Odyssey"
            value={formatNumber(data.controlOdysseyVisits)}
            description="高频训练访问模块"
            isDark={isDark}
          />
        </section>

        {/* 图表区域 */}
        <section className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">
          <Panel title="月度访问量变化" subtitle="平台总体访问、互动量、仿真访问趋势" isDark={isDark}>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={data.monthlyTrend}>
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

          <Panel title="模块访问结构占比" subtitle="按平台核心模块拆分" isDark={isDark}>
            <div className="h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.moduleVisitShare}
                    dataKey="visits"
                    nameKey="module"
                    outerRadius={110}
                    innerRadius={52}
                    paddingAngle={2}
                  >
                    {data.moduleVisitShare.map((entry, index) => (
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

        {/* 互动与仿真统计 */}
        <section className="grid gap-6 xl:grid-cols-2">
          <Panel title="互动环节统计（按类型）" subtitle="课堂活动与学习行为拆分" isDark={isDark}>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.interactionByType} layout="vertical" margin={{ left: 42 }}>
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

          <Panel title="虚拟仿真访问量（7类分项）" subtitle="按具体仿真场景统计访问量" isDark={isDark}>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={data.simulationVisits}>
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

        {/* 学习负载与活跃度 */}
        <section className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
          <Panel title="完整学习周期负载" subtitle="按完整学习口径统计" isDark={isDark}>
            <div className="grid gap-3 md:grid-cols-2">
              <StatLine icon={<BookOpenCheck className="h-4 w-4" />} label="习题尝试总量" value={formatNumber(estimates.exerciseAttemptsTotal)} isDark={isDark} />
              <StatLine icon={<Ship className="h-4 w-4" />} label="仿真总时长（分钟）" value={formatNumber(estimates.simulationMinutesTotal)} isDark={isDark} />
              <StatLine icon={<Gamepad2 className="h-4 w-4" />} label="Control Odyssey 总访问" value={formatNumber(estimates.odysseyTotal)} isDark={isDark} />
              <StatLine
                icon={<Radar className="h-4 w-4" />}
                label="知识图谱交互总量"
                value={formatNumber(data.userScale.students * data.estimatedPerStudent.knowledgeGraphInteractions)}
                isDark={isDark}
              />
            </div>
            <p className={`mt-4 text-xs ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
              口径说明：按学生完整学习链路统计，包含互动、仿真、评测与知识图谱行为。
            </p>
          </Panel>

          <Panel title="学习活跃与完课率" subtitle="活跃学生规模与课程完课率联动" isDark={isDark}>
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data.monthlyTrend}>
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

        {/* 学期简报 */}
        <section className={`rounded-2xl border p-5 ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white/90'}`}>
          <p className={`text-xs uppercase tracking-[0.24em] ${isDark ? 'text-cyan-300/65' : 'text-cyan-700/80'}`}>Semester Brief</p>
          <div className="mt-3 grid gap-3 md:grid-cols-3">
            <BriefCard
              icon={<GraduationCap className="h-4 w-4" />}
              title="教学规模"
              text={`${data.userScale.teachers} 名教师覆盖 ${formatNumber(data.userScale.students)} 名学生，形成高并发教学组织。`}
              isDark={isDark}
            />
            <BriefCard
              icon={<BarChart3 className="h-4 w-4" />}
              title="学习行为密度"
              text={`学期总访问量 ${formatNumber(totals.monthlyVisitTotal)}，互动总量 ${formatNumber(totals.interactionTotal)}。`}
              isDark={isDark}
            />
            <BriefCard
              icon={<Ship className="h-4 w-4" />}
              title="仿真实训强度"
              text={`7类仿真累计访问 ${formatNumber(totals.simulationVisitTotal)}，Control Odyssey 达到 ${formatNumber(data.controlOdysseyVisits)}。`}
              isDark={isDark}
            />
          </div>
        </section>

        {/* 数据治理监控入口 */}
        <section className={`rounded-2xl border p-5 ${isDark ? 'border-cyan-500/20 bg-cyan-500/5' : 'border-cyan-200 bg-cyan-50/50'}`}>
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <p className={`text-xs uppercase tracking-[0.24em] ${isDark ? 'text-cyan-300/65' : 'text-cyan-700/80'}`}>Data Governance</p>
              <h3 className={`mt-1 text-lg font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>数据治理监控</h3>
              <p className={`mt-1 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>
                查看事件队列、能力快照、风险标记等实时数据
              </p>
            </div>
            <Link
              href="/admin/data-governance"
              className="inline-flex items-center gap-2 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-400 transition hover:bg-cyan-500/20"
            >
              <Database className="h-4 w-4" />
              打开监控面板
            </Link>
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
  isDark,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  isDark: boolean;
}) {
  return (
    <div className={`rounded-2xl border p-5 ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white/90'}`}>
      <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{title}</h2>
      <p className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{subtitle}</p>
      <div className="mt-4">{children}</div>
    </div>
  );
}

function MetricCard({
  icon,
  title,
  value,
  description,
  isDark,
}: {
  icon: ReactNode;
  title: string;
  value: string;
  description: string;
  isDark: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 shadow-[0_0_20px_rgba(14,116,144,0.08)] transition hover:shadow-[0_0_32px_rgba(34,211,238,0.12)] ${
      isDark
        ? 'border-cyan-500/20 bg-cyan-500/5 shadow-[0_0_32px_rgba(34,211,238,0.08)]'
        : 'border-cyan-200 bg-cyan-50/70'
    }`}>
      <div className="flex items-center justify-between">
        <p className={`text-xs uppercase tracking-[0.22em] ${isDark ? 'text-cyan-200/70' : 'text-cyan-700/80'}`}>{title}</p>
        <span className={`rounded-full p-2 ${isDark ? 'bg-cyan-500/10' : 'bg-cyan-100'}`}>
          <span className={isDark ? 'text-cyan-200' : 'text-cyan-700'}>{icon}</span>
        </span>
      </div>
      <p className={`mt-4 text-2xl font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{value}</p>
      <p className={`mt-2 text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{description}</p>
    </div>
  );
}

function StatLine({
  icon,
  label,
  value,
  isDark,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  isDark: boolean;
}) {
  return (
    <div className={`flex items-center justify-between rounded-lg border px-3 py-2 ${
      isDark ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-50'
    }`}>
      <div className={`flex items-center gap-2 text-sm ${isDark ? 'text-slate-300' : 'text-slate-700'}`}>
        <span className={isDark ? 'text-cyan-300' : 'text-cyan-700'}>{icon}</span>
        {label}
      </div>
      <span className={`text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{value}</span>
    </div>
  );
}

function BriefCard({
  icon,
  title,
  text,
  isDark,
}: {
  icon: ReactNode;
  title: string;
  text: string;
  isDark: boolean;
}) {
  return (
    <div className={`rounded-xl border p-4 ${isDark ? 'border-slate-800 bg-slate-950/60' : 'border-slate-200 bg-slate-50'}`}>
      <div className={`flex items-center gap-2 text-sm font-medium ${isDark ? 'text-white' : 'text-slate-900'}`}>
        <span className={isDark ? 'text-cyan-300' : 'text-cyan-700'}>{icon}</span>
        {title}
      </div>
      <p className={`mt-2 text-sm ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{text}</p>
    </div>
  );
}
