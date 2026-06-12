'use client';

/**
 * 我的成长中枢页面
 *
 * 学生成长数据可视化与个性化建议中心
 */

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
} from 'recharts';
import { AppShell } from '@/components/platform/app-shell';
import { UserMenu } from '@/components/shared/user-menu';
import { buildLearnerDataRouteShell } from '@/features/adaptive/adaptive-learning-center-contracts';
import { DiagnosisSurfacePanel } from '@/features/adaptive/diagnosis-surface-panel';
import { getCompetencyLabel, COMPETENCY_DIMENSIONS } from '@/lib/data-governance/competency-model';
import type { CompetencyVector, TrendVector } from '@/lib/data-governance/competency-model';
import type { RoleBasedLearningDiagnosis } from '@/lib/data-governance/role-based-learning-diagnosis';
import type { RiskFlag } from '@/lib/data-governance/risk-detector';

interface EvidenceSummaryItem {
  factType: string;
  outcome: string;
  score?: number;
  evidenceTitle?: string;
  stepId?: string;
  questionSummaries?: Array<{
    questionId?: string;
    prompt?: string;
    studentAnswerRedacted?: boolean;
    referenceAnswer?: string;
    isCorrect?: boolean;
  }>;
}

interface GrowthSnapshotData {
  currentSnapshot: {
    vector: CompetencyVector;
    snapshotAt: string;
    factCount: number;
  };
  previousSnapshot: {
    vector: CompetencyVector;
    snapshotAt: string;
  } | null;
  trendVector: TrendVector;
  evidenceSummary: Record<string, EvidenceSummaryItem[]>;
  riskFlags: RiskFlag[];
  recommendations: Array<{
    type: 'immediate' | 'weekly' | 'challenge';
    title: string;
    description: string;
    actionUrl?: string;
    priority: number;
  }>;
  diagnosis: RoleBasedLearningDiagnosis;
}

interface GrowthRecord {
  id: string;
  type: 'milestone' | 'simulation' | 'risk_resolved' | 'excellent_design' | 'achievement' | 'competency_evaluation';
  title: string;
  description: string;
  date: string;
  metadata: Record<string, unknown>;
  icon: string;
}

interface GroupedGrowthRecord extends GrowthRecord {
  groupedCount?: number;
  groupedRecordIds?: string[];
}

const learnerDataShell = buildLearnerDataRouteShell('/profile/growth');

export default function GrowthPage() {
  const router = useRouter();
  const sessionData = useSession();
  const session = sessionData?.data;
  const status = sessionData?.status ?? 'loading';

  const [snapshot, setSnapshot] = useState<GrowthSnapshotData | null>(null);
  const [growthRecords, setGrowthRecords] = useState<GrowthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<'7d' | '30d' | '90d'>('30d');

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [snapshotRes, recordsRes] = await Promise.all([
        fetch(`/api/student/competency-snapshot?timeRange=${timeRange}`),
        fetch('/api/student/growth-records?limit=10'),
      ]);

      if (!snapshotRes.ok || !recordsRes.ok) {
        throw new Error('获取成长数据失败');
      }

      const [snapshotData, recordsData] = await Promise.all([
        snapshotRes.json(),
        recordsRes.json(),
      ]);

      setSnapshot(snapshotData);
      setGrowthRecords(recordsData.records || []);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '未知错误');
    } finally {
      setLoading(false);
    }
  }, [timeRange]);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      if (session.user.role !== 'STUDENT') {
        router.replace('/dashboard');
        return;
      }
      void fetchData();
    }
  }, [status, session, router, fetchData]);

  if (status === 'loading' || loading) {
    return (
      <div
        className="surface-page flex items-center justify-center"
        data-route-family={learnerDataShell.routeFamily}
        data-route-identity={learnerDataShell.routeIdentity}
        data-learner-record-surface={learnerDataShell.archetype}
        data-learner-record-next-action="wait-for-growth"
      >
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          <p className="text-subtle">加载成长数据...</p>
        </div>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <div
        className="surface-page flex items-center justify-center"
        data-route-family={learnerDataShell.routeFamily}
        data-route-identity={learnerDataShell.routeIdentity}
        data-learner-record-surface={learnerDataShell.archetype}
        data-learner-record-next-action="login"
      >
        <div className="text-center">
          <p className="text-xl text-subtle">请先登录</p>
          <Link href="/login" className="cta-primary mt-4 inline-block rounded-lg px-6 py-2">
            前往登录
          </Link>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div
        className="surface-page flex items-center justify-center"
        data-route-family={learnerDataShell.routeFamily}
        data-route-identity={learnerDataShell.routeIdentity}
        data-learner-record-surface={learnerDataShell.archetype}
        data-learner-record-next-action="retry-growth"
      >
        <div className="text-center">
          <p className="text-xl text-red-500">{error}</p>
          <button onClick={fetchData} className="btn-ghost-themed mt-4 rounded-lg px-6 py-2">
            重试
          </button>
        </div>
      </div>
    );
  }

  const currentVector = snapshot?.currentSnapshot?.vector;
  const overallScore = currentVector
    ? Math.round(
        COMPETENCY_DIMENSIONS.reduce((sum, d) => sum + currentVector[d].score, 0) /
          COMPETENCY_DIMENSIONS.length
      )
    : 0;

  // Prepare radar chart data
  const radarData = currentVector
    ? COMPETENCY_DIMENSIONS.map((dim) => ({
        dimension: getCompetencyLabel(dim).slice(0, 4),
        fullDimension: getCompetencyLabel(dim),
        score: Math.round(currentVector[dim].score),
        trend: snapshot?.trendVector?.[dim] || 'stable',
      }))
    : [];

  // Prepare bar chart data
  const barData = currentVector
    ? COMPETENCY_DIMENSIONS.map((dim) => ({
        dimension: getCompetencyLabel(dim),
        score: Math.round(currentVector[dim].score),
        confidence: Math.round(currentVector[dim].confidence * 100),
        trend: snapshot?.trendVector?.[dim] || 'stable',
      }))
    : [];
  const hasCompetencyChartData = (snapshot?.currentSnapshot?.factCount ?? 0) > 0
    && barData.some((entry) => entry.score > 0 || entry.confidence > 0);
  const groupedGrowthRecords = groupGrowthTimelineRecords(growthRecords);

  return (
    <AppShell
      viewerRole="student"
      title="成长中枢"
      subtitle="能力趋势、证据覆盖与下一步路径"
      activeHref="/profile/growth"
      actions={(
        <div className="flex rounded-lg bg-platform-action-subtle p-1">
          {(['7d', '30d', '90d'] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`rounded-md px-3 py-1 text-sm transition ${
                timeRange === range
                  ? 'bg-platform-action-primary text-platform-canvas'
                  : 'text-platform-fg-secondary hover:text-platform-fg-primary'
              }`}
            >
              {range === '7d' ? '近7天' : range === '30d' ? '近30天' : '近90天'}
            </button>
          ))}
        </div>
      )}
      userMenu={<UserMenu user={{ name: session?.user?.name, email: session?.user?.email, role: session?.user?.role }} />}
      className="surface-page"
    >
      <section
      data-route-family={learnerDataShell.routeFamily}
      data-route-identity={learnerDataShell.routeIdentity}
      data-learner-record-surface={learnerDataShell.archetype}
    >
      <div
        data-learner-record-priority="evidence-timeline"
        data-learner-record-evidence-confidence={hasCompetencyChartData ? 'medium' : 'low'}
        data-learner-record-missing-source={hasCompetencyChartData ? 'complete' : 'missing-evidence'}
      >
        {/* Top Cards */}
        <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {/* Learning Stage Card */}
          <div className="surface-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-subtle">当前学习阶段</p>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {overallScore >= 75 ? '进阶期' : overallScore >= 55 ? '成长期' : '起步期'}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-500/20 text-blue-500">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
            </div>
            <p className="mt-2 text-xs text-subtle">
              综合得分 {overallScore} 分 · {snapshot?.currentSnapshot?.factCount || 0} 条学习记录
            </p>
          </div>

          {/* Weekly Activity Card */}
          <div className="surface-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-subtle">本周学习热度</p>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {growthRecords.filter((r) => new Date(r.date) > new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)).length}
                  <span className="text-base font-normal text-subtle"> 次活动</span>
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20 text-amber-500">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                </svg>
              </div>
            </div>
            <p className="mt-2 text-xs text-subtle">
              最近7天活跃记录
            </p>
          </div>

          {/* Progress Summary Card */}
          <div className="surface-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-subtle">本周进步</p>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {snapshot?.riskFlags?.length === 0 ? '稳步提升' : '需要关注'}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="mt-2 text-xs text-subtle">
              {snapshot?.riskFlags?.length
                ? `有 ${snapshot.riskFlags.length} 个待关注事项`
                : '各项能力均衡发展'}
            </p>
          </div>

          {/* AI Suggestion Card */}
          <div className="surface-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-subtle">控灵建议</p>
                <p className="mt-1 line-clamp-1 text-lg font-medium text-foreground">
                  {snapshot?.recommendations?.[0]?.title || '继续保持'}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/20 text-violet-500">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <p className="mt-2 text-xs text-subtle">
              {snapshot?.recommendations?.length
                ? `还有 ${snapshot.recommendations.length} 条建议`
                : '暂无新建议'}
            </p>
          </div>
        </div>

        <div className="mb-8">
          <DiagnosisSurfacePanel
            diagnosis={snapshot?.diagnosis}
            mode="student"
            title="控制校正个人诊断"
            description="把诊断快照转化为学生可理解的维度状态、证据引用和下一步行动。"
          />
        </div>

        {/* Middle Section - Competency Overview */}
        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          {/* Radar Chart */}
          <div className="surface-card min-w-0 p-6">
            <h3 className="mb-4 text-lg font-semibold text-foreground">能力雷达</h3>
            {hasCompetencyChartData ? (
              <div className="h-[320px] min-h-[320px] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="70%" data={radarData}>
                    <PolarGrid stroke="currentColor" strokeOpacity={0.2} />
                    <PolarAngleAxis
                      dataKey="dimension"
                      tick={{ fill: 'currentColor', fontSize: 12 }}
                      tickLine={{ stroke: 'currentColor', strokeOpacity: 0.3 }}
                    />
                    <PolarRadiusAxis
                      angle={90}
                      domain={[0, 100]}
                      tick={{ fill: 'currentColor', fontSize: 10, opacity: 0.7 }}
                      tickCount={5}
                      axisLine={{ stroke: 'currentColor', strokeOpacity: 0.3 }}
                    />
                    <Radar
                      name="能力评分"
                      dataKey="score"
                      stroke="#f59e0b"
                      fill="#f59e0b"
                      fillOpacity={0.3}
                      strokeWidth={2}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          return (
                            <div className="surface-card border p-3 shadow-lg">
                              <p className="font-medium text-amber-500">{item.fullDimension}</p>
                              <p className="text-2xl font-bold">{item.score}</p>
                              <p className="mt-1 text-xs text-subtle">
                                趋势: {item.trend === 'up' ? '上升' : item.trend === 'down' ? '下降' : '稳定'}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex min-h-[320px] min-w-0 flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/30 p-6 text-center">
                <p className="text-sm text-subtle">暂无足够证据生成能力雷达。</p>
                <Link
                  href="/assessment/adaptive-practice"
                  className="btn-ghost-themed mt-4 rounded-lg px-4 py-2 text-sm"
                  data-learner-record-next-action="adaptive-practice"
                >
                  开始练习
                </Link>
              </div>
            )}
          </div>

          {/* Bar Chart */}
          <div className="surface-card min-w-0 p-6">
            <h3 className="mb-4 text-lg font-semibold text-foreground">能力详情</h3>
            {hasCompetencyChartData ? (
              <div className="h-[320px] min-h-[320px] min-w-0">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={barData} layout="vertical" margin={{ left: 80 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="currentColor" strokeOpacity={0.1} />
                    <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 12 }} />
                    <YAxis
                      type="category"
                      dataKey="dimension"
                      tick={{ fontSize: 11 }}
                      width={75}
                    />
                    <Tooltip
                      content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const item = payload[0].payload;
                          return (
                            <div className="surface-card border p-3 shadow-lg">
                              <p className="font-medium">{item.dimension}</p>
                              <p className="text-lg font-bold text-amber-500">{item.score} 分</p>
                              <p className="text-xs text-subtle">置信度: {item.confidence}%</p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                      {barData.map((entry, index) => (
                        <Cell
                          key={`cell-${index}`}
                          fill={entry.score >= 75 ? '#22c55e' : entry.score >= 55 ? '#f59e0b' : '#ef4444'}
                        />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex min-h-[320px] min-w-0 flex-col items-center justify-center rounded-xl border border-dashed border-border/70 bg-muted/30 p-6 text-center">
                <p className="text-sm text-subtle">暂无足够证据生成能力详情。</p>
                <Link href="/profile/evidence" className="btn-ghost-themed mt-4 rounded-lg px-4 py-2 text-sm">
                  查看证据
                </Link>
              </div>
            )}
          </div>
        </div>

        {/* Risk Flags Section */}
        {snapshot?.riskFlags && snapshot.riskFlags.length > 0 && (
          <div className="mb-8">
            <h3 className="mb-4 text-lg font-semibold text-foreground">关注事项</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {snapshot.riskFlags.map((risk, index) => (
                <div
                  key={index}
                  className={`surface-card-soft p-4 ${
                    risk.severity === 'high'
                      ? 'border-red-500/30 bg-red-500/5'
                      : risk.severity === 'medium'
                      ? 'border-amber-500/30 bg-amber-500/5'
                      : 'border-blue-500/30 bg-blue-500/5'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`rounded-full p-2 ${
                        risk.severity === 'high'
                          ? 'bg-red-500/20 text-red-500'
                          : risk.severity === 'medium'
                          ? 'bg-amber-500/20 text-amber-500'
                          : 'bg-blue-500/20 text-blue-500'
                      }`}
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                        />
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">
                        {risk.type === 'ai_misuse'
                          ? 'AI使用方式'
                          : risk.type === 'participation'
                          ? '学习活跃度'
                          : risk.type === 'constraint'
                          ? '工程约束'
                          : risk.type === 'cross_domain'
                          ? '跨域迁移'
                          : risk.type === 'stagnation'
                          ? '学习停滞'
                          : '其他'}
                      </p>
                      <p className="mt-1 text-sm text-subtle">{risk.description}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recommendations Section */}
        {snapshot?.recommendations && snapshot.recommendations.length > 0 && (
          <div className="mb-8">
            <h3 className="mb-4 text-lg font-semibold text-foreground">下一步建议</h3>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {snapshot.recommendations.slice(0, 6).map((rec, index) => (
                <Link
                  key={index}
                  href={rec.actionUrl || '#'}
                  className="surface-card-soft group flex flex-col gap-3 p-4 transition-all hover:border-amber-500/30 hover:bg-accent/70"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded px-2 py-0.5 text-xs ${
                          rec.type === 'immediate'
                            ? 'bg-red-500/20 text-red-500'
                            : rec.type === 'weekly'
                            ? 'bg-blue-500/20 text-blue-500'
                            : 'bg-purple-500/20 text-purple-500'
                        }`}
                      >
                        {rec.type === 'immediate' ? '立即' : rec.type === 'weekly' ? '本周' : '挑战'}
                      </span>
                      <span className="text-xs text-subtle">优先级 {rec.priority}</span>
                    </div>
                    <svg
                      className="h-5 w-5 text-subtle transition-transform group-hover:translate-x-1"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                  <div>
                    <p className="font-medium text-foreground">{rec.title}</p>
                    <p className="mt-1 line-clamp-2 text-sm text-subtle">{rec.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Growth Timeline */}
        <div className="mb-8">
          <h3 className="mb-4 text-lg font-semibold text-foreground">成长档案时间线</h3>
          {groupedGrowthRecords.length === 0 ? (
            <div className="surface-card-soft p-8 text-center">
              <p className="text-subtle">暂无成长记录，开始学习之旅吧！</p>
              <Link href="/missions" className="cta-primary mt-4 inline-block rounded-lg px-6 py-2">
                开始任务
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {groupedGrowthRecords.slice(0, 10).map((record, index) => (
                <div key={record.id} className="flex gap-4">
                  {/* Timeline Line */}
                  <div className="flex flex-col items-center">
                    <div
                      className={`flex h-10 w-10 items-center justify-center rounded-full ${
                        record.type === 'milestone'
                          ? 'bg-blue-500/20 text-blue-500'
                          : record.type === 'simulation'
                          ? 'bg-emerald-500/20 text-emerald-500'
                          : record.type === 'risk_resolved'
                          ? 'bg-green-500/20 text-green-500'
                          : record.type === 'achievement'
                          ? 'bg-amber-500/20 text-amber-500'
                          : 'bg-violet-500/20 text-violet-500'
                      }`}
                    >
                      {record.type === 'milestone' && (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 21v-8a2 2 0 012-2h14a2 2 0 012 2v8M3 21h18M5 21v-8a2 2 0 012-2h14a2 2 0 012 2v8" />
                        </svg>
                      )}
                      {record.type === 'simulation' && (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                      )}
                      {record.type === 'risk_resolved' && (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                      {record.type === 'achievement' && (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
                        </svg>
                      )}
                      {record.type === 'excellent_design' && (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                        </svg>
                      )}
                      {record.type === 'competency_evaluation' && (
                        <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 4.5l1.5 3.5 3.5 1.5-3.5 1.5L11 14.5 9.5 11 6 9.5 9.5 8 11 4.5zM17.5 13l.9 2.1 2.1.9-2.1.9-.9 2.1-.9-2.1-2.1-.9 2.1-.9.9-2.1zM5.5 15l.7 1.6 1.6.7-1.6.7-.7 1.6-.7-1.6-1.6-.7 1.6-.7.7-1.6z" />
                        </svg>
                      )}
                    </div>
                    {index < groupedGrowthRecords.length - 1 && (
                      <div className="mt-2 h-full w-px bg-accent" />
                    )}
                  </div>

                  {/* Record Content */}
                  <div className="surface-card-soft flex-1 p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium text-foreground">{record.title}</p>
                        <p className="mt-1 text-sm text-subtle">{record.description}</p>
                        {record.groupedCount && record.groupedCount > 1 ? (
                          <p className="mt-2 text-xs text-subtle">重复记录 {record.groupedCount} 条已合并显示</p>
                        ) : null}
                      </div>
                      <span className="text-xs text-subtle">
                        {formatRelativeDate(record.date)}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Evidence Summary */}
        {snapshot?.evidenceSummary && Object.keys(snapshot.evidenceSummary).length > 0 && (
          <div>
            <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-lg font-semibold text-foreground">能力证据链</h3>
              <Link href="/profile/evidence" className="btn-ghost-themed inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm">
                查看全部证据
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {Object.entries(snapshot.evidenceSummary).slice(0, 4).map(([dimension, evidence]) => (
                <div key={dimension} className="surface-card-soft p-4">
                  <p className="font-medium text-foreground">{getCompetencyLabel(dimension as never)}</p>
                  <div className="mt-2 space-y-2">
                    {evidence.slice(0, 3).map((item, idx) => (
                      <div key={idx} className="rounded-lg border border-border/60 bg-card/70 p-3 text-sm">
                        <div className="flex items-start justify-between gap-3">
                          <span className="font-medium text-foreground">{formatEvidenceTitle(item)}</span>
                          <span className={getOutcomeBadgeClass(item.outcome)}>{formatOutcome(item.outcome)}</span>
                        </div>
                        {typeof item.score === 'number' && (
                          <p className="mt-1 text-xs text-subtle">评分 {item.score}</p>
                        )}
                        {item.questionSummaries?.slice(0, 2).map((question, questionIndex) => (
                          <p key={`${question.questionId ?? questionIndex}`} className="mt-2 text-xs text-subtle">
                            {question.prompt ?? question.questionId ?? '题目'}：{question.studentAnswerRedacted ? '作答已脱敏' : '未记录作答'}
                            {question.referenceAnswer ? `，参考 ${question.referenceAnswer}` : ''}
                            {typeof question.isCorrect === 'boolean' ? `，${question.isCorrect ? '正确' : '需修正'}` : ''}
                          </p>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      </section>
    </AppShell>
  );
}

function groupGrowthTimelineRecords(records: GrowthRecord[]): GroupedGrowthRecord[] {
  const groupedRecords: GroupedGrowthRecord[] = [];
  let index = 0;

  while (index < records.length) {
    const record = records[index];
    const key = lowSignalGrowthRecordKey(record);
    if (!key) {
      groupedRecords.push(record);
      index += 1;
      continue;
    }

    const group = [record];
    let nextIndex = index + 1;
    while (nextIndex < records.length && lowSignalGrowthRecordKey(records[nextIndex]) === key) {
      group.push(records[nextIndex]);
      nextIndex += 1;
    }

    if (group.length <= 1) {
      groupedRecords.push(record);
      index = nextIndex;
      continue;
    }

    groupedRecords.push({
      ...record,
      title: record.title,
      description: `${record.description}（同类低信号记录已折叠）`,
      groupedCount: group.length,
      groupedRecordIds: group.map((entry) => entry.id),
    });
    index = nextIndex;
  }

  return groupedRecords;
}

function lowSignalGrowthRecordKey(record: GrowthRecord): string | null {
  if (record.type !== 'risk_resolved' && record.type !== 'competency_evaluation') return null;
  return [record.type, record.title, record.description].join('|');
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return '今天';
  if (diffDays === 1) return '昨天';
  if (diffDays < 7) return `${diffDays}天前`;
  if (diffDays < 30) return `${Math.floor(diffDays / 7)}周前`;
  return `${Math.floor(diffDays / 30)}月前`;
}

function formatEvidenceTitle(item: EvidenceSummaryItem): string {
  if (item.evidenceTitle) {
    return item.evidenceTitle;
  }
  if (item.factType === 'simulation') return '仿真操作证据';
  if (item.factType === 'question') return item.stepId ? `课堂作答 ${item.stepId}` : '课堂作答证据';
  if (item.factType === 'ai_intervention') return 'AI 交互证据';
  if (item.factType === 'ethical') return '工程伦理证据';
  return item.factType;
}

function formatOutcome(outcome: string): string {
  if (outcome === 'success') return '成功';
  if (outcome === 'failure') return '失败';
  if (outcome === 'partial') return '部分';
  return '进行中';
}

function getOutcomeBadgeClass(outcome: string): string {
  const base = 'shrink-0 rounded px-2 py-0.5 text-xs';
  if (outcome === 'success') return `${base} bg-emerald-500/20 text-emerald-500`;
  if (outcome === 'failure') return `${base} bg-red-500/20 text-red-500`;
  return `${base} bg-amber-500/20 text-amber-500`;
}
