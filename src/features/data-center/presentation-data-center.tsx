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
import {
  SOURCE_QUALITY_MARKERS,
  type DataCenterSourceQuality,
} from './shared/data-center-contracts';
import { buildExportSafeSnapshot, type SafeSnapshot, type SnapshotMetric } from './shared/export-safe-snapshot';
import { presentationDataCenterMock, type PresentationDataCenterData } from './presentation-mock-data';

const numberFormatter = new Intl.NumberFormat('zh-CN');

const MODULE_COLORS = [
  'hsl(var(--platform-chart-1))',
  'hsl(var(--platform-chart-2))',
  'hsl(var(--platform-chart-3))',
  'hsl(var(--platform-chart-4))',
  'hsl(var(--platform-chart-5))',
  'hsl(var(--platform-chart-6))',
];
const metricGridClass = 'grid gap-4 grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))]';
const operationsPanelGridClass = 'mb-6 grid gap-6 grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))]';
const compactGridClass = 'grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))]';
const chartInitialDimension = { width: 1, height: 1 };

type DataMapContextMarker = 'source-quality' | 'freshness' | 'privacy-scope' | 'status-legend';

export interface DataMapContextCardModel {
  marker: DataMapContextMarker;
  label: string;
  value: string;
  summary: string;
  actionLabel: string;
  actionHref: string;
  exportAvailability: '可导出' | '受限导出' | '暂缓导出';
}

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
  const axisColor = isDark ? 'hsl(var(--platform-fg-muted))' : 'hsl(var(--platform-fg-secondary))';
  const gridColor = 'hsl(var(--platform-border))';
  const [data] = useState(presentationDataCenterMock);

  const chartTooltipStyle = {
    background: 'hsl(var(--platform-surface))',
    border: isDark ? '1px solid hsl(var(--platform-fg-secondary))' : '1px solid hsl(var(--platform-border-strong))',
    borderRadius: '8px',
    color: 'hsl(var(--platform-fg-primary))',
  };
  const chartTooltipLabelStyle = { color: 'hsl(var(--platform-fg-primary))', fontWeight: 600 };
  const chartTooltipItemStyle = { color: 'hsl(var(--platform-fg-secondary))' };
  const chartLegendStyle = { color: 'hsl(var(--platform-fg-secondary))', fontSize: '12px' };

  const totals = {
    interactionTotal: data.interactionByType.reduce((sum, item) => sum + item.count, 0),
    simulationVisitTotal: data.simulationVisits.reduce((sum, item) => sum + item.visits, 0),
    monthlyVisitTotal: data.monthlyTrend.reduce((sum, item) => sum + item.totalVisits, 0),
  };

  const sourceQuality = (): DataCenterSourceQuality =>
    (data._meta?.sourceQuality as DataCenterSourceQuality) ?? 'demo';
  const dataMapContextCards = buildDataMapContextCards({
    sourceQuality: sourceQuality(),
    generatedAt: data._meta.generatedAt,
    role,
  });
  const exportSnapshot = () => buildPresentationExportSnapshot(data, totals);

  return (
    <AppShell
      role={role}
      navigation={navigation}
      activeHref="/data-center"
      title="平台数据中心"
      subtitle="教学运行全景视图 · 聚合统计指标"
      sidebarMode="collapsible"
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
          data-data-map-semantics="source-quality-freshness-privacy-status"
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

        <section
          className="mb-6 grid gap-3 grid-cols-[repeat(auto-fit,minmax(min(100%,220px),1fr))]"
          data-governance-action-context="repair-review-export"
        >
          {dataMapContextCards.map((card) => (
            <DataMapContextCard key={card.marker} card={card} />
          ))}
        </section>

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
          <div className="h-[320px] min-w-0 w-full">
            <ResponsiveContainer width="100%" height="100%" initialDimension={chartInitialDimension}>
              <ComposedChart data={data.monthlyTrend}>
                <defs>
                  <linearGradient id="visitGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--platform-chart-1))" stopOpacity={0.45} />
                    <stop offset="95%" stopColor="hsl(var(--platform-chart-1))" stopOpacity={0.03} />
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
                  stroke="hsl(var(--platform-chart-1))"
                  fill="url(#visitGradient)"
                  strokeWidth={2}
                />
                <Line type="monotone" dataKey="interactions" name="互动量" stroke="hsl(var(--platform-chart-3))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="simulationVisits" name="仿真访问量" stroke="hsl(var(--platform-chart-4))" strokeWidth={2} dot={false} />
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
          <div className="h-[320px] min-w-0 w-full">
            <ResponsiveContainer width="100%" height="100%" initialDimension={chartInitialDimension}>
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
          <div className="h-[300px] min-w-0 w-full">
            <ResponsiveContainer width="100%" height="100%" initialDimension={chartInitialDimension}>
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
                <Bar dataKey="count" fill="hsl(var(--platform-chart-1))" radius={[0, 8, 8, 0]} />
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
          <div className="h-[300px] min-w-0 w-full">
            <ResponsiveContainer width="100%" height="100%" initialDimension={chartInitialDimension}>
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
                <Bar dataKey="visits" fill="hsl(var(--platform-chart-2))" radius={[8, 8, 0, 0]} />
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
          <p className="mt-4 text-xs text-platform-fg-muted">
            口径说明：按学生完整学习链路统计，包含互动、仿真、评测与知识图谱行为。
          </p>
        </DataCenterChartPanel>

        <DataCenterChartPanel
          title="学习活跃与完课率"
          subtitle="课堂活动：活跃学生规模与课程完课率联动"
          sourceQuality={sourceQuality()}
          mode="presentation"
        >
          <div className="h-[260px] min-w-0 w-full">
            <ResponsiveContainer width="100%" height="100%" initialDimension={chartInitialDimension}>
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
                <Line yAxisId="left" type="monotone" dataKey="activeStudents" name="活跃学生" stroke="hsl(var(--platform-chart-1))" strokeWidth={2} />
                <Line yAxisId="right" type="monotone" dataKey="completionRate" name="完课率" stroke="hsl(var(--platform-chart-4))" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </DataCenterChartPanel>
      </section>

          {/* 5. Demo 快照 (demo-snapshots) */}
          <section
            className="relative mb-6 overflow-hidden rounded-2xl border border-platform-border bg-platform-surface p-4"
            data-report-ledger-surface="data-center-platform-snapshot"
            data-report-ledger-watermark="low-contrast-brand"
            data-report-ledger-privacy-scope="aggregate-only"
            data-report-ledger-export="available"
          >
            <span
              className="pointer-events-none absolute right-6 top-5 select-none text-5xl font-semibold uppercase tracking-[0.32em] text-platform-fg-muted/10"
              aria-hidden="true"
            >
              ACT
            </span>
            <div className="relative">
              <div className="mb-4 grid gap-2 text-xs text-platform-fg-secondary md:grid-cols-4">
                <span>来源质量：{SOURCE_QUALITY_MARKERS[sourceQuality()].label}</span>
                <span>新鲜度：{data._meta.generatedAt}</span>
                <span>隐私范围：聚合视图</span>
                <span>状态图例：可导出</span>
              </div>
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
            </div>
          </section>

          {/* 导出区域 */}
        </div>

        <div
          id="data-center-export"
          className="flex flex-wrap items-center justify-end gap-3 border-t border-platform-border pt-4"
          data-commercial-workspace-zone="command-bar"
        >
          <p className="text-xs text-platform-fg-muted">
            导出快照将自动移除原始学习证据、原始轨迹和私有数据，保留来源标记
          </p>
          <button
            className="inline-flex items-center gap-2 rounded-lg border border-platform-border bg-platform-surface px-4 py-2 text-sm font-medium text-platform-fg-primary transition-colors hover:bg-platform-action-subtle"
            onClick={() => {
              downloadExportSafeSnapshot(exportSnapshot(), `data-center-snapshot-${data._meta.semester}.json`);
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

function DataMapContextCard({
  card,
}: {
  card: DataMapContextCardModel;
}) {
  return (
    <article
      className="rounded-lg border border-platform-border bg-platform-surface p-4"
      data-data-map-context={card.marker}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-platform-fg-muted">{card.label}</p>
          <p className="mt-2 text-sm font-semibold text-platform-fg-primary">{card.value}</p>
        </div>
        <span className="rounded-full border border-platform-border bg-platform-action-subtle p-2 text-platform-action-primary">
          <Clock className="h-4 w-4" />
        </span>
      </div>
      <p className="mt-3 text-xs leading-relaxed text-platform-fg-secondary">{card.summary}</p>
      <a href={card.actionHref} className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-platform-action-primary">
        {card.actionLabel}
        <ChevronRight className="h-3.5 w-3.5" />
      </a>
    </article>
  );
}

export function buildDataMapContextCards({
  sourceQuality,
  generatedAt,
  role,
}: {
  sourceQuality: DataCenterSourceQuality;
  generatedAt: string;
  role: PlatformRole;
}): DataMapContextCardModel[] {
  const marker = SOURCE_QUALITY_MARKERS[sourceQuality];
  const isRestricted = sourceQuality === 'restricted';
  const isStale = sourceQuality === 'stale';
  const isPartial = sourceQuality === 'partial';
  const exportAvailability: DataMapContextCardModel['exportAvailability'] = isRestricted
    ? '受限导出'
    : isStale
      ? '暂缓导出'
      : '可导出';
  const privacyValue = isRestricted
    ? '受限聚合视图'
    : role === 'student'
      ? '学生聚合可见'
      : '治理明细可见';
  const statusValue = isStale
    ? '待复核 · 暂缓导出'
    : isPartial
      ? '部分覆盖 · 需要补齐'
      : isRestricted
        ? '受限 · 聚合可见'
        : '可用 · 可导出';
  const actionHref = role === 'admin'
    ? '/admin/data-governance'
    : role === 'teacher'
      ? '/teacher'
      : exportAvailability === '可导出'
        ? '/data-center#data-center-export'
        : '/admin/data-governance';

  return [
    {
      marker: 'source-quality',
      label: '来源质量',
      value: marker.label,
      summary: `${marker.summary}；所有图表继续保留来源质量标记。`,
      actionLabel: sourceQuality === 'real' ? '查看来源口径' : '查看复核口径',
      actionHref,
      exportAvailability,
    },
    {
      marker: 'freshness',
      label: '新鲜度',
      value: isStale ? '需要复核' : `最近同步：${generatedAt}`,
      summary: isStale
        ? `最近同步：${generatedAt}，下一次复核需要确认过期数据是否仍可用于报告。`
        : `最近同步：${generatedAt}，下一次复核会检查过期、部分覆盖和缺失上下文。`,
      actionLabel: '下一次复核',
      actionHref,
      exportAvailability,
    },
    {
      marker: 'privacy-scope',
      label: '隐私范围',
      value: privacyValue,
      summary: isRestricted
        ? '当前来源受隐私策略限制，仅展示聚合视图；导出前需要教师或审核角色确认范围。'
        : '学生侧只展示聚合视图，教师和审核角色可进入治理明细。',
      actionLabel: role === 'student' ? '查看聚合口径' : '进入治理复核',
      actionHref,
      exportAvailability,
    },
    {
      marker: 'status-legend',
      label: '状态图例',
      value: statusValue,
      summary: `导出可用性：${exportAvailability}；修复动作随来源质量、新鲜度和隐私范围变化。`,
      actionLabel: exportAvailability === '可导出' ? '导出可用性' : '查看修复动作',
      actionHref,
      exportAvailability,
    },
  ];
}

export function buildPresentationExportSnapshot(
  data: PresentationDataCenterData,
  totals: { interactionTotal: number; simulationVisitTotal: number; monthlyVisitTotal: number },
) {
  const sourceQuality = data._meta.sourceQuality;
  const metrics: SnapshotMetric[] = [
    { label: '学期', value: data._meta.semester, sourceQuality },
    { label: '最近同步', value: data._meta.generatedAt, sourceQuality },
    { label: '隐私范围', value: '聚合视图', sourceQuality },
    { label: '状态图例', value: '可导出', sourceQuality },
    { label: '导出安全策略', value: '移除原始证据、原始轨迹、隐藏评价、原始答案和私有记忆', sourceQuality },
    { label: '学生规模', value: data.userScale.students, sourceQuality },
    { label: '教师规模', value: data.userScale.teachers, sourceQuality },
    { label: '学期总访问量', value: totals.monthlyVisitTotal, sourceQuality },
    { label: '互动总量', value: totals.interactionTotal, sourceQuality },
    { label: '仿真访问总量', value: totals.simulationVisitTotal, sourceQuality },
    { label: 'Control Odyssey 访问', value: data.controlOdysseyVisits, sourceQuality },
  ];

  return buildExportSafeSnapshot(metrics);
}

export function downloadExportSafeSnapshot(snapshot: SafeSnapshot, filename: string) {
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function MetricCard({
  icon, title, value, description,
}: {
  icon: React.ReactNode; title: string; value: string; description: string; isDark: boolean;
}) {
  return (
    <div className="rounded-xl border border-platform-border bg-platform-action-subtle p-4 transition">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.22em] text-platform-action-primary">{title}</p>
        <span className="rounded-full bg-platform-surface p-2">
          <span className="text-platform-action-primary">{icon}</span>
        </span>
      </div>
      <p className="mt-4 text-2xl font-semibold text-platform-fg-primary">{value}</p>
      <p className="mt-2 text-xs text-platform-fg-secondary">{description}</p>
    </div>
  );
}

function StatLine({
  icon, label, value,
}: {
  icon: React.ReactNode; label: string; value: string; isDark: boolean;
}) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-platform-border bg-platform-surface px-3 py-2">
      <div className="flex items-center gap-2 text-sm text-platform-fg-secondary">
        <span className="text-platform-action-primary">{icon}</span>
        {label}
      </div>
      <span className="text-sm font-semibold text-platform-fg-primary">{value}</span>
    </div>
  );
}

function BriefCard({
  icon, title, text,
}: {
  icon: React.ReactNode; title: string; text: string; isDark: boolean;
}) {
  return (
    <div className="rounded-xl border border-platform-border bg-platform-surface p-4">
      <div className="flex items-center gap-2 text-sm font-medium text-platform-fg-primary">
        <span className="text-platform-action-primary">{icon}</span>
        {title}
      </div>
      <p className="mt-2 text-sm text-platform-fg-secondary">{text}</p>
    </div>
  );
}
