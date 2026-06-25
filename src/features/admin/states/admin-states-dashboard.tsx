'use client';

import type { ReactNode } from 'react';
import { useEffect, useState, useCallback } from 'react';
import {
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
  AlertCircle,
  Download,
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
import { ActionStatusPanel } from '@/components/platform/action-status';
import { createAuditedActionState } from '@/lib/action-status-contract';
import { AdminConsoleHeader } from '../admin-console-header';
import { adminStatesMockData } from './stats-data';
import type { SystemUsageData } from './system-usage-data';
import { DataCenterSourceMarker } from '@/features/data-center/shared/source-marker';
import { DataCenterDrilldownLink } from '@/features/data-center/shared/drilldown-link';
import type { DataCenterSourceQuality } from '@/features/data-center/shared/data-center-contracts';

type AdminStatesDashboardProps = {
  currentUser: {
    id: string;
    name?: string | null;
    email?: string | null;
    role: 'ADMIN';
  };
  initialExportQuery?: {
    action?: string | null;
    focus?: string | null;
    format?: string | null;
  } | null;
};

const numberFormatter = new Intl.NumberFormat('zh-CN');
const percentFormatter = new Intl.NumberFormat('zh-CN', { maximumFractionDigits: 1 });

const MODULE_COLORS = ['#22d3ee', '#38bdf8', '#34d399', '#f59e0b', '#a78bfa', '#f97316'];

function formatNumber(value: number) {
  return numberFormatter.format(value);
}

export function AdminStatesDashboard({ currentUser, initialExportQuery }: AdminStatesDashboardProps) {
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
      // 保持按钮状态和提示文案一致，失败时显式回退到演示模式
      setDemoMode(true);
      setData(adminStatesMockData);
      setLastUpdated(new Date());
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
  const routeExportRequested = initialExportQuery?.action === 'export'
    || initialExportQuery?.focus === 'usage-export';
  const exportFilename = `admin-system-usage-${new Date().toISOString().slice(0, 10)}.json`;
  const exportState = routeExportRequested
    ? createAuditedActionState({
        identity: {
          id: `admin-states-export-request:${demoMode ? 'demo' : 'real'}:${new Date().toISOString().slice(0, 10)}`,
          category: 'export',
          label: '系统使用量导出',
          sourceRoute: '/admin/states',
          requestedAction: initialExportQuery?.action ?? initialExportQuery?.focus ?? 'export',
        },
        status: error ? 'failed' : 'succeeded',
        message: error
          ? `系统使用量真实数据获取失败，导出已阻断：${error}`
          : demoMode
          ? '系统使用量演示导出请求已就绪，文件和操作账本 ID 将由服务端下载响应返回。'
          : '系统使用量真实数据导出请求已就绪，文件和操作账本 ID 将由服务端下载响应返回。',
        recoveryAction: error ? '恢复真实数据接口后重试导出' : undefined,
        nextAction: error ? undefined : '下载文件并使用响应中的审计 ID 留存记录',
        downloadFilename: error ? undefined : exportFilename,
      })
    : null;
  const exportHref = routeExportRequested && !error
    ? `/api/admin/states/export?source=${demoMode ? 'demo' : 'real'}&format=${encodeURIComponent(initialExportQuery?.format ?? 'json')}`
    : null;

  return (
    <div
      className="admin-console-shell"
      data-commercial-operations-workspace="admin-operations"
      data-commercial-workspace-zone="instrument-area"
      data-operations-status-semantics={loading ? 'loading' : error ? 'stale' : 'fresh'}
    >
      <AdminConsoleHeader
        currentUser={currentUser}
        currentHref="/admin/states"
        backHref="/admin"
        eyebrow="使用态势"
        title="系统使用量统计"
        description="查看真实访问量、互动分布、仿真活跃度与月度趋势，区分演示数据和实时接口返回。"
        chips={
          <>
            <span className="admin-console-chip">学期：{data.semester}</span>
            <span className="admin-console-chip">
              数据更新时间：{lastUpdated.toLocaleString('zh-CN')}
            </span>
            {demoMode ? <span className="admin-console-chip text-amber-300">演示数据</span> : null}
          </>
        }
        actions={
          <>
            <button type="button" onClick={toggleDemoMode} className="admin-console-button">
              {demoMode ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
              {demoMode ? '演示模式：开' : '演示模式：关'}
            </button>
            <button type="button" onClick={refreshData} disabled={loading} className="admin-console-button disabled:opacity-50">
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              刷新
            </button>
          </>
        }
      />

      <main className="admin-console-container grid gap-6 py-8">
        {/* 错误提示 */}
        {error && (
          <div className="admin-console-notice admin-console-notice-danger">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5" />
              <span>获取真实数据失败：{error}，已自动切换回演示数据</span>
            </div>
          </div>
        )}

        {exportState ? (
          <ActionStatusPanel
            state={exportState}
            className="mb-6"
            action={exportHref ? (
              <a href={exportHref} download={exportFilename} className="admin-console-button px-3 py-1.5">
                <Download className="h-4 w-4" />
                下载统计文件
              </a>
            ) : null}
          />
        ) : null}

        {/* 加载遮罩 */}
        {loading && (
          <div className={`fixed inset-0 z-50 flex items-center justify-center ${isDark ? 'bg-black/50' : 'bg-white/70'}`}>
            <div className="flex items-center gap-3 rounded-xl border border-cyan-500/30 bg-slate-900/90 px-6 py-4 text-cyan-100">
              <RefreshCw className="h-5 w-5 animate-spin" />
              正在加载真实数据...
            </div>
          </div>
        )}

        {/* 治理模式区域（演示模式下展示的 UI 合约） */}
        {demoMode ? (
        <section className="mb-6">
          <div className="rounded-2xl border border-platform-border bg-platform-surface p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-base font-semibold text-platform-fg-primary">数据治理概览</h2>
                <p className="mt-1 text-xs text-platform-fg-secondary">治理模式区域展示源覆盖、数据就绪、缺失上下文、过期数据、隐私范围与不支持状态</p>
              </div>
              <DataCenterSourceMarker quality="demo" />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              <GovernancePanelItem label="源覆盖率" value="完整覆盖" detail="示例：当前学期学生与教师数据源均已覆盖" tone="success" isDark={isDark} />
              <GovernancePanelItem label="数据就绪" value="就绪" detail="示例：最近一次全量快照在SLA范围内" tone="success" isDark={isDark} />
              <GovernancePanelItem label="缺失上下文" value="部分缺失" detail="示例：部分仿真模块缺少完整学习链路" tone="warning" isDark={isDark} />
              <GovernancePanelItem label="过期数据" value="无过期" detail="示例：当前学期活跃数据均在时效窗口内" tone="success" isDark={isDark} />
              <GovernancePanelItem label="隐私范围" value="受限" detail="示例：含受限学生数据，仅聚合视图可展示" tone="warning" isDark={isDark} />
              <GovernancePanelItem label="不支持状态" value="3项" detail="示例：实时轨迹、原始作答、私有记忆" tone="danger" isDark={isDark} />
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-platform-border pt-4">
              <span className="text-xs text-platform-fg-muted">治理钻取：</span>
              <DataCenterDrilldownLink
                label="数据治理面板"
                href="/admin/data-governance"
                target="admin-governance"
                currentRole="admin"
                allowedRoles={['admin', 'audit']}
              />
              <DataCenterDrilldownLink
                label="证据浏览器"
                href="/admin/states"
                target="evidence-browser"
                currentRole="admin"
                allowedRoles={['admin', 'teacher', 'audit']}
                restricted
                restrictedReason="完整证据浏览器功能尚未开放"
              />
            </div>
          </div>
        </section>
        ) : null}

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
          <Panel title="月度访问量变化" subtitle="平台总体访问、互动量、仿真访问趋势" isDark={isDark} sourceQuality={demoMode ? 'demo' : 'real'}>
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

          <Panel title="模块访问结构占比" subtitle="按平台核心模块拆分" isDark={isDark} sourceQuality={demoMode ? 'demo' : 'real'}>
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
          <Panel title="互动环节统计（按类型）" subtitle="课堂活动与学习行为拆分" isDark={isDark} sourceQuality={demoMode ? 'demo' : 'real'}>
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

          <Panel title="虚拟仿真访问量（7类分项）" subtitle="按具体仿真场景统计访问量" isDark={isDark} sourceQuality={demoMode ? 'demo' : 'real'}>
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
          <Panel title="完整学习周期负载" subtitle="按完整学习口径统计" isDark={isDark} sourceQuality={demoMode ? 'demo' : 'real'}>
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

          <Panel title="学习活跃与完课率" subtitle="活跃学生规模与课程完课率联动" isDark={isDark} sourceQuality={demoMode ? 'demo' : 'real'}>
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
          <p className={`text-xs uppercase tracking-[0.24em] ${isDark ? 'text-cyan-300/65' : 'text-cyan-700/80'}`}>学期摘要</p>
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

      </main>
    </div>
  );
}

function Panel({
  title,
  subtitle,
  children,
  isDark,
  sourceQuality,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
  isDark: boolean;
  sourceQuality?: DataCenterSourceQuality;
}) {
  return (
    <div className={`rounded-2xl border p-5 ${isDark ? 'border-slate-800 bg-slate-900/50' : 'border-slate-200 bg-white/90'}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h2 className={`text-base font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{title}</h2>
          <p className={`mt-1 text-xs ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{subtitle}</p>
        </div>
        {sourceQuality ? <DataCenterSourceMarker quality={sourceQuality} /> : null}
      </div>
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

function GovernancePanelItem({
  label,
  value,
  detail,
  tone,
  isDark,
}: {
  label: string;
  value: string;
  detail: string;
  tone: 'success' | 'info' | 'warning' | 'danger';
  isDark: boolean;
}) {
  const borders: Record<string, string> = {
    success: isDark ? 'border-emerald-500/30 bg-emerald-500/5' : 'border-emerald-200 bg-emerald-50/70',
    info: isDark ? 'border-cyan-500/20 bg-cyan-500/5' : 'border-cyan-200 bg-cyan-50/70',
    warning: isDark ? 'border-amber-500/30 bg-amber-500/5' : 'border-amber-200 bg-amber-50/70',
    danger: isDark ? 'border-red-500/30 bg-red-500/5' : 'border-red-200 bg-red-50/70',
  };
  return (
    <div className={`rounded-lg border p-3 ${borders[tone]}`}>
      <p className={`text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{label}</p>
      <p className={`mt-1 text-sm font-semibold ${isDark ? 'text-white' : 'text-slate-900'}`}>{value}</p>
      <p className={`mt-1 text-xs ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>{detail}</p>
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
