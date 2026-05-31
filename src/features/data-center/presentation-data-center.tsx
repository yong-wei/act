'use client';

import { useState } from 'react';
import {
  BarChart3,
  BookOpenCheck,
  Gamepad2,
  GraduationCap,
  MessagesSquare,
  Ship,
  Users,
  Download,
  ChevronRight,
  TrendingUp,
  Clock,
  Activity,
} from 'lucide-react';
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from 'recharts';
import { useTheme } from '@/components/providers/theme-provider';
import { useMemo } from 'react';
import { AppShell } from '@/components/platform/app-shell';
import type { PlatformRole } from '@/components/platform/platform-ui-contracts';
import { getPlatformRoleNavigation } from '@/lib/platform-role-navigation';
import { DataCenterChartPanel } from './shared/chart-panel';
import { DataCenterSourceMarker } from './shared/source-marker';
import type { DataCenterSourceQuality } from './shared/data-center-contracts';
import { presentationDataCenterMock } from './presentation-mock-data';

const numberFormatter = new Intl.NumberFormat('zh-CN');

const MODULE_COLORS = ['#22d3ee', '#38bdf8', '#34d399', '#f59e0b', '#a78bfa', '#f97316'];
const metricGridClass = 'grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))]';
const operationsPanelGridClass = 'mb-6 grid gap-6 grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))]';
const compactGridClass = 'grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]';

interface PresentationDataCenterProps {
  role: PlatformRole;
}

export function PresentationDataCenter({ role }: PresentationDataCenterProps) {
  const navigation = useMemo(() => {
    const base = getPlatformRoleNavigation(role);
    const hasEntry = base.some((item) => item.href === '/data-center');
    if (hasEntry) return base;
    return [
      ...base,
      {
        id: 'platform-data-center',
        label: '数据中心',
        href: '/data-center',
        role,
        order: 155,
        description: '平台教学运行全景视图。',
      },
    ];
  }, [role]);
  const { mounted, theme } = useTheme();
  const isDark = mounted ? theme === 'dark' : true;
  const axisColor = isDark ? '#94a3b8' : '#334155';
  const gridColor = isDark ? 'rgba(100,116,139,0.25)' : 'rgba(148,163,184,0.35)';
  const [data] = useState(presentationDataCenterMock);

  const chartTooltipStyle = {
    background: isDark ? '#0f172a' : '#ffffff',
    border: isDark ? '1px solid #334155' : '1px solid #cbd5e1',
    borderRadius: '8px',
    color: isDark ? '#e2e8f0' : '#0f172a',
  };
  const chartTooltipLabelStyle = { color: isDark ? '#e2e8f0' : '#0f172a', fontWeight: 600 };
  const chartTooltipItemStyle = { color: isDark ? '#cbd5e1' : '#334155' };
  const chartLegendStyle = { color: isDark ? '#cbd5e1' : '#334155', fontSize: '12px' };

  const totals = {
    interactionTotal: data.interactionByType.reduce((sum, item) => sum + item.count, 0),
    simulationVisitTotal: data.simulationVisits.reduce((sum, item) => sum + item.visits, 0),
    monthlyVisitTotal: data.monthlyTrend.reduce((sum, item) => sum + item.totalVisits, 0),
  };

  const sourceQuality = (): DataCenterSourceQuality =>
    (data._meta?.sourceQuality as DataCenterSourceQuality) ?? 'demo';

  return (
    <AppShell
      role={role}
      navigation={navigation}
      activeHref="/data-center"
      title="平台数据中心"
      subtitle="教学运行全景视图 · 聚合统计指标"
      breadcrumbs={[
        { label: '课程中心', href: '/' },
        { label: '数据中心' },
      ]}
    >
      <div className="w-full min-w-0" data-commercial-operations-workspace="data-center">
        {/* 数据来源提示 */}
        <div
          className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-platform-border bg-platform-surface p-4"
          data-commercial-workspace-zone="context-strip"
        >
          <div className="flex min-w-0 items-center gap-3">
            <Activity className="h-5 w-5 shrink-0 text-platform-action-primary" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-platform-fg-primary">数据来源说明</p>
              <p className="text-xs text-platform-fg-secondary">
                本页面展示平台教学运行聚合数据，每个指标均标注数据质量来源
              </p>
            </div>
          </div>
          <DataCenterSourceMarker quality={sourceQuality()} showSummary />
        </div>

        <div data-commercial-workspace-zone="instrument-area">
          {/* 1. 核心指标 (headline-metrics) */}
          <section className="mb-6">
            <DataCenterChartPanel
              title="核心平台指标"
              subtitle="用户规模、互动量、仿真访问与 Control Odyssey 访问"
              sourceQuality={sourceQuality()}
              mode="presentation"
            >
              <div className={metricGridClass}>
                <MetricCard
                  icon={<Users className="h-5 w-5" />}
                  title="用户规模"
                  value={`${numberFormatter.format(data.userScale.students)} 学生`}
                  description={`教师 ${data.userScale.teachers} · 管理员 ${data.userScale.admins}`}
                  isDark={isDark}
                />
                <MetricCard
                  icon={<MessagesSquare className="h-5 w-5" />}
                  title="互动总量"
                  value={numberFormatter.format(totals.interactionTotal)}
                  description={`人均 ${data.estimatedPerStudent.interactiveActions} 次`}
                  isDark={isDark}
                />
                <MetricCard
                  icon={<Ship className="h-5 w-5" />}
                  title="仿真访问总量"
                  value={numberFormatter.format(totals.simulationVisitTotal)}
                  description="7类仿真分项统计"
                  isDark={isDark}
                />
                <MetricCard
                  icon={<Gamepad2 className="h-5 w-5" />}
                  title="Control Odyssey"
                  value={numberFormatter.format(data.controlOdysseyVisits)}
                  description="高频训练访问模块"
                  isDark={isDark}
                />
              </div>
            </DataCenterChartPanel>
          </section>

      {/* 2. 模块活动 (module-activity) 和 学习轨迹 (learning-trajectory) */}
      <section className={operationsPanelGridClass}>
        <DataCenterChartPanel
          title="月度访问量变化"
          subtitle="学习轨迹：平台总体访问、互动量、仿真访问趋势"
          sourceQuality={sourceQuality()}
          mode="presentation"
        >
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={data.monthlyTrend}>
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
                  formatter={(value) => numberFormatter.format(Number(value) || 0)}
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
              </ComposedChart>
            </ResponsiveContainer>
          </div>
        </DataCenterChartPanel>

        <DataCenterChartPanel
          title="模块访问结构占比"
          subtitle="模块活动：按平台核心模块拆分"
          sourceQuality={sourceQuality()}
          mode="presentation"
        >
          <div className="h-[320px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data.moduleVisitShare as unknown as Record<string, unknown>[]}
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
                  formatter={(value) => numberFormatter.format(Number(value) || 0)}
                  contentStyle={chartTooltipStyle}
                  labelStyle={chartTooltipLabelStyle}
                  itemStyle={chartTooltipItemStyle}
                />
                <Legend wrapperStyle={chartLegendStyle} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </DataCenterChartPanel>
      </section>

      {/* 3. 仿真活动 (simulation-activity) 和 课堂活动 (classroom-activity) */}
      <section className={operationsPanelGridClass}>
        <DataCenterChartPanel
          title="互动环节统计"
          subtitle="课堂活动：按互动类型拆分"
          sourceQuality={sourceQuality()}
          mode="presentation"
        >
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.interactionByType} layout="vertical" margin={{ left: 42 }}>
                <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                <XAxis type="number" stroke={axisColor} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <YAxis type="category" dataKey="type" stroke={axisColor} width={112} />
                <Tooltip
                  formatter={(value) => numberFormatter.format(Number(value) || 0)}
                  contentStyle={chartTooltipStyle}
                  labelStyle={chartTooltipLabelStyle}
                  itemStyle={chartTooltipItemStyle}
                />
                <Bar dataKey="count" fill="#22d3ee" radius={[0, 8, 8, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DataCenterChartPanel>

        <DataCenterChartPanel
          title="仿真活动分布"
          subtitle="仿真活动：7类仿真分项访问统计"
          sourceQuality={sourceQuality()}
          mode="presentation"
        >
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.simulationVisits}>
                <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                <XAxis dataKey="simulation" stroke={axisColor} tick={{ fontSize: 11 }} interval={0} angle={-15} height={58} />
                <YAxis stroke={axisColor} tickFormatter={(v) => `${Math.round(v / 1000)}k`} />
                <Tooltip
                  formatter={(value) => numberFormatter.format(Number(value) || 0)}
                  contentStyle={chartTooltipStyle}
                  labelStyle={chartTooltipLabelStyle}
                  itemStyle={chartTooltipItemStyle}
                />
                <Bar dataKey="visits" fill="#38bdf8" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </DataCenterChartPanel>
      </section>

      {/* 4. 学习负载与完课率 */}
      <section className={operationsPanelGridClass}>
        <DataCenterChartPanel
          title="完整学习周期负载"
          subtitle="学习轨迹：按完整学习口径统计"
          sourceQuality={sourceQuality()}
          mode="presentation"
        >
          <div className={compactGridClass}>
            <StatLine icon={<BookOpenCheck className="h-4 w-4" />} label="习题尝试总量" value={numberFormatter.format(data.userScale.students * data.estimatedPerStudent.exerciseAttempts)} isDark={isDark} />
            <StatLine icon={<Ship className="h-4 w-4" />} label="仿真总时长（分钟）" value={numberFormatter.format(data.userScale.students * data.estimatedPerStudent.simulationMinutes)} isDark={isDark} />
            <StatLine icon={<Gamepad2 className="h-4 w-4" />} label="Control Odyssey 总访问" value={numberFormatter.format(data.controlOdysseyVisits)} isDark={isDark} />
            <StatLine icon={<TrendingUp className="h-4 w-4" />} label="知识图谱交互总量" value={numberFormatter.format(data.userScale.students * data.estimatedPerStudent.knowledgeGraphInteractions)} isDark={isDark} />
          </div>
          <p className={`mt-4 text-xs ${isDark ? 'text-slate-500' : 'text-slate-600'}`}>
            口径说明：按学生完整学习链路统计，包含互动、仿真、评测与知识图谱行为。
          </p>
        </DataCenterChartPanel>

        <DataCenterChartPanel
          title="学习活跃与完课率"
          subtitle="课堂活动：活跃学生规模与课程完课率联动"
          sourceQuality={sourceQuality()}
          mode="presentation"
        >
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
                      ? `${value}%`
                      : numberFormatter.format(Number(value) || 0)
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
        </DataCenterChartPanel>
      </section>

      {/* 5. Demo 快照 (demo-snapshots) */}
      <section className="mb-6">
        <DataCenterChartPanel
          title="学期简报 · 快照"
          subtitle="演示快照：教学规模、学习行为密度、仿真实训强度总览"
          sourceQuality={sourceQuality()}
          mode="presentation"
        >
          <div className={compactGridClass}>
            <BriefCard
              icon={<GraduationCap className="h-4 w-4" />}
              title="教学规模"
              text={`${data.userScale.teachers} 名教师覆盖 ${numberFormatter.format(data.userScale.students)} 名学生，形成高并发教学组织。`}
              isDark={isDark}
            />
            <BriefCard
              icon={<BarChart3 className="h-4 w-4" />}
              title="学习行为密度"
              text={`学期总访问量 ${numberFormatter.format(totals.monthlyVisitTotal)}，互动总量 ${numberFormatter.format(totals.interactionTotal)}。`}
              isDark={isDark}
            />
            <BriefCard
              icon={<Ship className="h-4 w-4" />}
              title="仿真实训强度"
              text={`7类仿真累计访问 ${numberFormatter.format(totals.simulationVisitTotal)}，Control Odyssey 达到 ${numberFormatter.format(data.controlOdysseyVisits)}。`}
              isDark={isDark}
            />
          </div>
        </DataCenterChartPanel>
      </section>

      {/* 导出区域 */}
        </div>

      <div className="flex flex-wrap items-center justify-end gap-3 border-t border-platform-border pt-4" data-commercial-workspace-zone="command-bar">
        <p className="text-xs text-platform-fg-muted">
          导出快照将自动移除原始学习证据、原始轨迹和私有数据，保留来源标记
        </p>
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-platform-border bg-platform-surface px-4 py-2 text-sm font-medium text-platform-fg-primary hover:bg-platform-action-subtle transition-colors"
          onClick={() => {
            window.alert('演示环境：导出快照功能将在后续版本中提供');
          }}
        >
          <Download className="h-4 w-4" />
          导出演示快照
        </button>
      </div>
      </div>
    </AppShell>
  );
}

function MetricCard({
  icon, title, value, description, isDark,
}: {
  icon: React.ReactNode; title: string; value: string; description: string; isDark: boolean;
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
  icon, label, value, isDark,
}: {
  icon: React.ReactNode; label: string; value: string; isDark: boolean;
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
  icon, title, text, isDark,
}: {
  icon: React.ReactNode; title: string; text: string; isDark: boolean;
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
