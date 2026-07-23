'use client';

/**
 * 我的成长中枢页面
 *
 * 学生成长数据可视化与个性化建议中心
 */

import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { StudentFeedbackTaskPanel } from '@/features/assessment/student-feedback-task-panel';
import { useVerifiedFeedbackTaskContext } from '@/features/assessment/use-verified-feedback-task-context';
import { buildLearnerDataRouteShell } from '@/features/adaptive/adaptive-learning-center-contracts';
import { getPlatformCockpitHref } from '@/lib/platform-role-navigation';
import { DiagnosisSurfacePanel } from '@/features/adaptive/diagnosis-surface-panel';
import { buildFeedbackTaskContext } from '@/lib/student-feedback-task-contract';
import type { PortraitV2ConsumerSummary } from '@/lib/data-governance/portrait-v2-consumer';
import type { RoleBasedLearningDiagnosis } from '@/lib/data-governance/role-based-learning-diagnosis';

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
  evidenceState: 'current' | 'empty' | 'unavailable';
  availabilityReason:
    | 'available'
    | 'no-eligible-evidence'
    | 'no-evidence-after-revocation'
    | 'migration-in-progress'
    | 'current-state-unavailable'
    | 'current-state-version-mismatch'
    | 'invalid-current-snapshot';
  currentSnapshot: {
    portrait: PortraitV2ConsumerSummary;
    snapshotAt: string | null;
    overallScore: number | null;
    dimensionCoverage: {
      evidencedDimensionIds: string[];
      missingDimensionIds: string[];
    };
    evidenceAsOf: string | null;
    confidence: number | null;
    factCount: number;
  } | null;
  previousSnapshot: null;
  trendVector: null;
  lastTrend: 'up' | 'stable' | 'down' | 'not-comparable' | null;
  evidenceSummary: Record<string, EvidenceSummaryItem[]>;
  riskFlags: Array<{
    type: 'constraint' | 'stagnation' | 'cross_domain';
    severity: 'low' | 'medium' | 'high';
    occurredAt: string | null;
    description: string;
  }>;
  recommendations: Array<{
    type: 'immediate' | 'weekly';
    title: string;
    description: string;
    actionUrl?: string;
    priority: number;
  }>;
  diagnosis: RoleBasedLearningDiagnosis | null;
}

interface GrowthRecord {
  id: string;
  type: string;
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

function GrowthFallback({
  nextAction,
  children,
}: {
  nextAction: string;
  children: ReactNode;
}) {
  return (
    <AppShell
      viewerRole="student"
      title="成长中枢"
      subtitle="累计能力达成、证据覆盖与成长记录"
      activeHref="/profile/growth"
      breadcrumbs={[
        { label: '首页', href: '/' },
        { label: '个人中心', href: '/profile' },
        { label: '成长中枢' },
      ]}
      className="surface-page"
    >
      <div
        className="flex min-h-[60vh] items-center justify-center"
        data-route-family={learnerDataShell.routeFamily}
        data-route-identity={learnerDataShell.routeIdentity}
        data-learner-record-surface={learnerDataShell.archetype}
        data-learner-record-next-action={nextAction}
      >
        {children}
      </div>
    </AppShell>
  );
}

export default function GrowthPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sessionData = useSession();
  const session = sessionData?.data;
  const status = sessionData?.status ?? 'loading';

  const [snapshot, setSnapshot] = useState<GrowthSnapshotData | null>(null);
  const [growthRecords, setGrowthRecords] = useState<GrowthRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const localFeedbackContext = buildFeedbackTaskContext({
    assignment: searchParams.get('assignment'),
    criterion: searchParams.get('criterion'),
    source: searchParams.get('source'),
    feedbackSource: searchParams.get('feedbackSource'),
    status: searchParams.get('status'),
    action: searchParams.get('action'),
    returnTo: searchParams.get('returnTo'),
    intent: searchParams.get('intent'),
    teacherInterventionId: searchParams.get('teacherInterventionId'),
  });
  const feedbackContext = useVerifiedFeedbackTaskContext(localFeedbackContext, searchParams);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [snapshotRes, recordsRes] = await Promise.all([
        fetch('/api/student/competency-snapshot'),
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
  }, []);

  useEffect(() => {
    if (status === 'authenticated' && session?.user?.id) {
      if (session.user.role !== 'STUDENT') {
        router.replace(getPlatformCockpitHref(session.user.role));
        return;
      }
      void fetchData();
    }
  }, [status, session, router, fetchData]);

  if (status === 'unauthenticated') {
    return (
      <GrowthFallback nextAction="login">
        <div className="text-center">
          <p className="text-xl text-subtle">请先登录</p>
          <Link href="/login" className="cta-primary mt-4 inline-block rounded-lg px-6 py-2">
            前往登录
          </Link>
        </div>
      </GrowthFallback>
    );
  }

  if (status === 'loading' || loading) {
    return (
      <GrowthFallback nextAction="wait-for-growth">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 animate-spin rounded-full border-4 border-amber-500 border-t-transparent" />
          <p className="text-subtle">加载成长数据...</p>
        </div>
      </GrowthFallback>
    );
  }

  if (error) {
    return (
      <GrowthFallback nextAction="retry-growth">
        <div className="text-center">
          <p className="text-xl text-red-500">{error}</p>
          <button type="button" onClick={fetchData} className="btn-ghost-themed mt-4 rounded-lg px-6 py-2">
            重试
          </button>
        </div>
      </GrowthFallback>
    );
  }

  const currentSnapshot = snapshot?.currentSnapshot;
  const portrait = currentSnapshot?.portrait;
  const portraitDimensions = portrait?.dimensions ?? [];
  const evidencedDimensions = portraitDimensions.filter((dimension) => dimension.evidenceCount > 0);
  const missingDimensions = portraitDimensions.filter((dimension) => dimension.evidenceCount === 0);
  const overallScore = currentSnapshot?.overallScore ?? portrait?.overallScore ?? null;

  // Prepare radar chart data
  const radarData = evidencedDimensions.map((dimension) => ({
    dimension: dimension.label.slice(0, 4),
    fullDimension: dimension.label,
    score: Math.round(dimension.score),
    trend: dimension.trend,
  }));

  // Prepare bar chart data
  const barData = evidencedDimensions.map((dimension) => ({
    dimension: dimension.label,
    score: Math.round(dimension.score),
    confidence: Math.round(dimension.confidence * 100),
    trend: dimension.trend,
  }));
  const hasPortrait = snapshot?.evidenceState === 'current' && evidencedDimensions.length > 0;
  const portraitEvidenceCount = portraitDimensions.reduce((sum, dimension) => sum + dimension.evidenceCount, 0);
  const hasCompetencyChartData = hasPortrait
    && barData.length > 0;
  const hasCompleteRadarData = hasPortrait && evidencedDimensions.length === 7;
  const groupedGrowthRecords = groupGrowthTimelineRecords(growthRecords);
  const strengthLabels = portrait?.strengths
    .map((id) => portraitDimensions.find((dimension) => dimension.id === id)?.label)
    .filter((label): label is string => Boolean(label)) ?? [];
  const improvementLabels = portrait?.weaknesses
    .map((id) => portraitDimensions.find((dimension) => dimension.id === id)?.label)
    .filter((label): label is string => Boolean(label)) ?? [];

  return (
    <AppShell
      viewerRole="student"
      title="成长中枢"
      subtitle="累计能力达成、证据覆盖与成长记录"
      activeHref="/profile/growth"
      breadcrumbs={[{ label: '首页', href: '/' }, { label: '个人中心', href: '/profile' }, { label: '成长中枢' }]}
      userMenu={session?.user ? <UserMenu user={{ name: session.user.name, email: session.user.email, role: session.user.role }} /> : undefined}
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
        <StudentFeedbackTaskPanel context={feedbackContext} surface="growth" className="mb-6" />
        {!hasPortrait ? (
          <div
            className="mb-8 rounded-xl border border-border bg-muted/40 p-5 text-sm text-subtle"
            data-portrait-availability={snapshot?.availabilityReason ?? 'current-state-unavailable'}
          >
            <p className="font-medium text-foreground">
              {formatPortraitAvailabilityTitle(snapshot?.availabilityReason)}
            </p>
            <p className="mt-2">
              {formatPortraitAvailabilityDescription(snapshot?.availabilityReason)}
            </p>
            <Link href="/profile/evidence" className="mt-3 inline-flex font-medium text-primary hover:underline">
              查看累计学习证据
            </Link>
          </div>
        ) : null}
        {/* Top Cards */}
        <div className="mb-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {hasPortrait && overallScore !== null ? <div className="surface-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-subtle">累计达成等级</p>
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
              综合得分 {overallScore} 分 · 累计 {portraitEvidenceCount} 条学习证据
            </p>
          </div> : null}

          {hasPortrait ? <div className="surface-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-subtle">七维证据覆盖</p>
                <p className="mt-1 text-2xl font-bold text-foreground">{evidencedDimensions.length} / 7</p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-500/20 text-amber-500">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 18.657A8 8 0 016.343 7.343S7 9 9 10c0-2 .5-5 2.986-7C14 5 16.09 5.777 17.656 7.343A7.975 7.975 0 0120 13a7.975 7.975 0 01-2.343 5.657z" />
                </svg>
              </div>
            </div>
            <p className="mt-2 text-xs text-subtle">
              {missingDimensions.length > 0
                ? `${missingDimensions.length} 个维度缺少合格证据，不计为零分`
                : '七个维度均有合格证据'}
            </p>
          </div> : null}

          {hasPortrait ? <div className="surface-card p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-subtle">最后能力趋势</p>
                <p className="mt-1 text-2xl font-bold text-foreground">
                  {formatTrend(snapshot?.lastTrend)}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-500">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
            </div>
            <p className="mt-2 text-xs text-subtle">
              仅在新增合格证据改变累计状态时更新
            </p>
          </div> : null}

          {hasPortrait ? <div className="surface-card p-5" data-portrait-last-risk>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-subtle">最后证据风险</p>
                <p className="mt-1 line-clamp-1 text-lg font-medium text-foreground">
                  {snapshot?.riskFlags?.length
                    ? formatRiskType(snapshot.riskFlags[0].type)
                    : '未触发风险'}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-violet-500/20 text-violet-500">
                <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
            </div>
            <p className="mt-2 text-xs text-subtle">
              {snapshot?.riskFlags?.length
                ? `共 ${snapshot.riskFlags.length} 个由累计证据触发的关注项`
                : '未从累计证据推断额外风险'}
            </p>
          </div> : null}
        </div>

        {hasPortrait && (strengthLabels.length > 0 || improvementLabels.length > 0) ? (
          <div className="mb-8 grid gap-4 md:grid-cols-2" data-portrait-strengths-improvements>
            <div className="surface-card-soft p-5">
              <p className="text-sm font-medium text-foreground">累计优势</p>
              <p className="mt-2 text-sm text-subtle">
                {strengthLabels.length > 0 ? strengthLabels.join('、') : '尚无足够证据形成优势判断'}
              </p>
            </div>
            <div className="surface-card-soft p-5">
              <p className="text-sm font-medium text-foreground">待提升维度</p>
              <p className="mt-2 text-sm text-subtle">
                {improvementLabels.length > 0 ? improvementLabels.join('、') : '尚无证据支持明确的待提升判断'}
              </p>
            </div>
          </div>
        ) : null}

        {hasPortrait && snapshot?.diagnosis ? <div className="mb-8" data-portrait-diagnosis>
          <DiagnosisSurfacePanel
            diagnosis={snapshot.diagnosis}
            mode="student"
            title="累计能力整体诊断"
            description="依据七维累计画像呈现当前能力判断、证据覆盖与下一步行动。"
          />
        </div> : null}

        {hasPortrait && currentSnapshot ? (
          <div className="mb-8 rounded-xl border border-border bg-muted/40 p-4 text-sm text-subtle" data-portrait-generated-at={currentSnapshot.snapshotAt ?? undefined}>
            <p>
              <span className="font-medium text-foreground">累计画像生成时间：</span>
              {formatTimestamp(currentSnapshot.snapshotAt)}
            </p>
            <p className="mt-1" data-portrait-evidence-as-of={currentSnapshot.evidenceAsOf ?? undefined}>
              <span className="font-medium text-foreground">累计证据截止：</span>
              {formatTimestamp(currentSnapshot.evidenceAsOf)}
            </p>
          </div>
        ) : null}

        {hasPortrait && portrait && portrait.limitations.length > 0 ? (
          <div className="mb-8 rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 text-sm text-subtle" data-portrait-v2-limitation>
            <p className="font-medium text-foreground">画像来源说明</p>
            <p className="mt-1">
              当前为规范累计 portrait v2；置信度、证据截止时间和限制信息已保留。
            </p>
            {portrait.limitations.length > 0 ? (
              <p className="mt-1">限制：{portrait.limitations.join('；')}</p>
            ) : null}
          </div>
        ) : null}

        {/* Middle Section - Competency Overview */}
        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          {/* Radar Chart */}
          <div className="surface-card min-w-0 p-6">
            <h3 className="mb-4 text-lg font-semibold text-foreground">七维累计达成雷达</h3>
            {hasCompleteRadarData ? (
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
                <p className="text-sm text-subtle">
                  {hasCompetencyChartData
                    ? '部分维度缺少合格证据，暂不绘制完整七维雷达。'
                    : '尚无合格证据生成七维累计达成雷达。'}
                </p>
                <Link
                  href="/assessment/adaptive-practice?intent=practice"
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
            <h3 className="mb-4 text-lg font-semibold text-foreground">累计达成维度详情</h3>
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
                <p className="text-sm text-subtle">没有合格累计证据可用于展示维度详情。</p>
                <Link href="/profile/evidence" className="btn-ghost-themed mt-4 rounded-lg px-4 py-2 text-sm">
                  查看证据
                </Link>
              </div>
            )}
          </div>
        </div>

        {hasPortrait && missingDimensions.length > 0 ? (
          <div className="mb-8 rounded-xl border border-border bg-muted/40 p-5" data-portrait-missing-dimensions>
            <p className="font-medium text-foreground">缺少合格证据的维度</p>
            <p className="mt-2 text-sm text-subtle">
              {missingDimensions.map((dimension) => dimension.label).join('、')}。这些维度不参与累计总分，也不会显示为零分。
            </p>
          </div>
        ) : null}

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
                      <p className="font-medium text-foreground">{formatRiskType(risk.type)}</p>
                      <p className="mt-1 text-sm text-subtle">{risk.description}</p>
                      {risk.occurredAt ? (
                        <p className="mt-2 text-xs text-subtle">证据发生于 {formatTimestamp(risk.occurredAt)}</p>
                      ) : null}
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
                            : 'bg-blue-500/20 text-blue-500'
                        }`}
                      >
                        {rec.type === 'immediate' ? '优先关注' : '持续建议'}
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
              <p className="text-subtle">尚无持久、有效的累计成长事件。</p>
              <Link href="/profile/evidence" className="cta-primary mt-4 inline-block rounded-lg px-6 py-2">
                查看累计学习证据
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
                        {formatTimestamp(record.date)}
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
              <h3 className="text-lg font-semibold text-foreground">累计能力证据摘要</h3>
              <Link href="/profile/evidence" className="btn-ghost-themed inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm">
                查看全部证据
              </Link>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              {Object.entries(snapshot.evidenceSummary).slice(0, 4).map(([dimension, evidence]) => (
                <div key={dimension} className="surface-card-soft p-4">
                  <p className="font-medium text-foreground">
                    {portrait?.dimensions.find((item) => item.id === dimension)?.label ?? dimension}
                  </p>
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

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return '未提供';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '时间格式不可用' : parsed.toLocaleString('zh-CN');
}

function formatTrend(
  trend: GrowthSnapshotData['lastTrend'] | undefined,
): string {
  if (trend === 'up') return '上升';
  if (trend === 'down') return '下降';
  if (trend === 'stable') return '稳定';
  return '尚无可比状态';
}

function formatRiskType(type: GrowthSnapshotData['riskFlags'][number]['type']): string {
  if (type === 'constraint') return '工程约束';
  if (type === 'cross_domain') return '跨域迁移';
  return '能力停滞';
}

function formatPortraitAvailabilityTitle(
  reason: GrowthSnapshotData['availabilityReason'] | undefined,
): string {
  if (reason === 'no-eligible-evidence') return '没有合格的累计学习证据';
  if (reason === 'no-evidence-after-revocation') return '原有证据已撤销，当前没有合格累计证据';
  if (reason === 'migration-in-progress') return '累计画像迁移尚未完成';
  if (reason === 'current-state-version-mismatch') return '累计画像版本尚未完成切换';
  if (reason === 'invalid-current-snapshot') return '累计画像校验未通过';
  return '累计画像当前不可用';
}

function formatPortraitAvailabilityDescription(
  reason: GrowthSnapshotData['availabilityReason'] | undefined,
): string {
  if (reason === 'no-eligible-evidence' || reason === 'no-evidence-after-revocation') {
    return '页面不会把缺失证据显示为零分、能力阶段或趋势。可前往证据页核对已记录的学习事实。';
  }
  if (reason === 'migration-in-progress' || reason === 'current-state-version-mismatch') {
    return '系统正在切换到规范累计画像。在迁移闭合前，不会展示旧画像或推断结果。';
  }
  if (reason === 'invalid-current-snapshot') {
    return '当前画像未通过版本与内容校验，因此不会显示可能失真的分数、趋势或风险。';
  }
  return '当前状态指针尚未提供可验证的累计画像，请稍后重试或联系教师核对。';
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
  if (outcome === 'cumulative') return '累计';
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
