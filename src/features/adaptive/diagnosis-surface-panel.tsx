'use client';

import Link from 'next/link';
import {
  AlertTriangle,
  ArrowRight,
  BadgeCheck,
  Database,
  FileText,
  LineChart,
  Lock,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import type {
  RoleBasedLearningDiagnosis,
  RoleBasedLearningDiagnosisClaim,
  RoleBasedLearningDiagnosisLimitation,
  RoleBasedLearningDiagnosisRootCauseCluster,
} from '@/lib/data-governance/role-based-learning-diagnosis';

type DiagnosisSurfaceMode = 'student' | 'teacher-class' | 'teacher-student';

interface DiagnosisSurfacePanelProps {
  diagnosis: RoleBasedLearningDiagnosis | null | undefined;
  mode: DiagnosisSurfaceMode;
  scoreScale?: 'proportion' | 'points';
  title?: string;
  description?: string;
}

const JUDGMENT_LABELS: Record<RoleBasedLearningDiagnosisClaim['judgment'], string> = {
  'needs-attention': '需要关注',
  developing: '发展中',
  stable: '稳定',
  'insufficient-evidence': '证据不足',
};

const CONFIDENCE_LABELS = {
  none: '无置信度',
  low: '低置信度',
  medium: '中置信度',
  high: '高置信度',
} as const;

const LIMITATION_LABELS: Record<RoleBasedLearningDiagnosisLimitation['reason'], string> = {
  'missing-goal-slice': '目标切片缺失',
  'missing-target-student': '目标学生缺失',
  'missing-dimension-evidence': '维度证据缺失',
  'missing-citation': '引用缺失',
  'stale-evidence': '证据过期',
  'low-confidence': '低置信度',
  'no-active-path': '无活动路径',
  'path-outcome-unavailable': '路径结果不可用',
  'teacher-report-unavailable': '教师报告不可用',
  'missing-snapshot': '诊断快照缺失',
  'document-grading-workbench-not-present': '文档评分未接入',
};

export function DiagnosisSurfacePanel({
  diagnosis,
  mode,
  scoreScale = 'proportion',
  title = '控制校正诊断',
  description = '基于治理证据、诊断快照与角色权限生成的可行动视图。',
}: DiagnosisSurfacePanelProps) {
  const claims = diagnosis?.claims ?? [];
  const limitations = diagnosis?.limitations ?? [];
  const clusters = diagnosis?.rootCauseClusters ?? [];
  const evidenceCount = claims.reduce((sum, claim) => sum + claim.evidenceRefs.length, 0);
  const hasSnapshot = diagnosis?.materialization.inputs.includes('control-correction-diagnosis-report-snapshot') ?? false;
  const degraded = !diagnosis || limitations.length > 0 || !hasSnapshot;

  return (
    <section
      className="surface-card p-6"
      data-diagnosis-surface={mode}
      data-diagnosis-state={degraded ? 'degraded' : 'ready'}
      data-diagnosis-evidence-count={evidenceCount}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <LineChart className="h-4 w-4" />
            </span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">
                {mode === 'student' ? '个人诊断' : mode === 'teacher-class' ? '班级诊断' : '学生钻取诊断'}
              </p>
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
            </div>
          </div>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-subtle">{description}</p>
        </div>
        <div className="grid min-w-[260px] grid-cols-3 gap-2 text-center">
          <MetricPill label="维度" value={claims.length} />
          <MetricPill label="证据" value={evidenceCount} />
          <MetricPill label="限制" value={limitations.length} />
        </div>
      </div>

      {degraded ? (
        <div className="mt-5 rounded-lg border border-border bg-accent/60 p-4 text-sm text-foreground">
          <div className="flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 flex-none" />
            <div>
              <p className="font-medium">当前诊断处于降级状态</p>
              <p className="mt-1 text-xs leading-5">
                页面不会把缺失或低置信度内容伪装成真实分数；请结合证据覆盖、路径状态和后续采集结果判断。
              </p>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 lg:grid-cols-2">
        {claims.map((claim) => (
          <DiagnosisClaimCard key={claim.id} claim={claim} mode={mode} scoreScale={scoreScale} />
        ))}
      </div>

      {clusters.length > 0 ? (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">弱点聚类与备课入口</h3>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            {clusters.slice(0, 4).map((cluster) => (
              <ClusterCard key={cluster.id} cluster={cluster} mode={mode} />
            ))}
          </div>
        </div>
      ) : null}

      {limitations.length > 0 ? (
        <div className="mt-6">
          <div className="mb-3 flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">限制说明</h3>
          </div>
          <div className="flex flex-wrap gap-2">
            {limitations.map((item) => (
              <span
                key={`${item.reason}:${item.detail}`}
                className="inline-flex items-center gap-1 rounded-full border border-border bg-accent/60 px-3 py-1 text-xs text-foreground"
                title={item.detail}
              >
                <Lock className="h-3 w-3" />
                {LIMITATION_LABELS[item.reason] ?? item.reason}
              </span>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function DiagnosisClaimCard({
  claim,
  mode,
  scoreScale,
}: {
  claim: RoleBasedLearningDiagnosisClaim;
  mode: DiagnosisSurfaceMode;
  scoreScale: 'proportion' | 'points';
}) {
  const explanation = mode === 'student'
    ? claim.studentExplanation ?? claim.explanation
    : claim.teacherExplanation ?? claim.explanation;
  const primaryAction = claim.nextActions.find((action) => action.href) ?? claim.nextActions[0];

  return (
    <article className="rounded-lg border border-border/70 bg-card/75 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{formatDimensionId(claim.dimensionId)}</p>
          <p className="mt-1 text-xs text-subtle">{explanation ?? claim.rootCause}</p>
        </div>
        <span className={judgmentClassName(claim.judgment)}>
          {JUDGMENT_LABELS[claim.judgment]}
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <MetricPill label="得分" value={formatScore(claim.metrics.score, scoreScale)} />
        <MetricPill label="百分位" value={formatPercentile(claim.metrics.percentile)} />
        <MetricPill label="成长" value={formatGrowthPercentile(claim.metrics.growthPercentile)} />
        <MetricPill label="置信度" value={CONFIDENCE_LABELS[claim.confidence.state]} />
      </div>

      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        <MetricPill label="证据数" value={claim.confidence.evidenceCount} />
        <MetricPill label="覆盖率" value={`${Math.round(claim.confidence.sourceCompleteness * 100)}%`} />
      </div>

      <div className="mt-4 rounded-lg border border-border/60 bg-background/40 p-3">
        <div className="mb-2 flex items-center gap-2 text-xs font-medium text-foreground">
          <Database className="h-3.5 w-3.5 text-primary" />
          证据抽屉
        </div>
        {claim.evidenceRefs.length > 0 ? (
          <div className="space-y-2">
            {claim.evidenceRefs.slice(0, 3).map((ref) => (
              <div key={ref.chunkId} className="rounded-md border border-border/60 bg-card/70 p-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs font-medium text-foreground">{ref.displayTitle}</p>
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] text-primary">
                    {CONFIDENCE_LABELS[ref.confidence]}
                  </span>
                </div>
                <p className="mt-1 text-xs leading-5 text-subtle">{ref.capsule}</p>
                {ref.displayHref ? (
                  <Link href={ref.displayHref} className="mt-2 inline-flex items-center gap-1 text-xs text-primary">
                    打开证据
                    <ArrowRight className="h-3 w-3" />
                  </Link>
                ) : null}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-subtle">当前角色没有可展示的证据引用，或快照尚未生成。</p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        {primaryAction?.href ? (
          <Link href={primaryAction.href} className="btn-ghost-themed inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs">
            {primaryAction.label}
            <ArrowRight className="h-3 w-3" />
          </Link>
        ) : (
          <span className="inline-flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-xs text-subtle">
            <FileText className="h-3 w-3" />
            {primaryAction?.unavailableReason ?? '暂无可执行入口'}
          </span>
        )}
      </div>
    </article>
  );
}

function ClusterCard({ cluster, mode }: {
  cluster: RoleBasedLearningDiagnosisRootCauseCluster;
  mode: DiagnosisSurfaceMode;
}) {
  const prepReady = cluster.confidence !== 'none' && cluster.denominator > 0 && cluster.affectedPopulation > 0;
  const canReviewPrepPack = mode === 'teacher-class' && prepReady;

  return (
    <article className="rounded-lg border border-border/70 bg-card/75 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-foreground">{formatDimensionId(cluster.dimensionId)}</p>
          <p className="mt-1 text-xs leading-5 text-subtle">{cluster.label}</p>
        </div>
        <span className={prepReady ? 'diagnosis-chip-ready' : 'diagnosis-chip-muted'}>
          {prepReady ? '备课可准备' : '等待证据'}
        </span>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-4">
        <MetricPill label="影响人数" value={cluster.affectedPopulation} />
        <MetricPill label="班级基数" value={cluster.denominator} />
        <MetricPill label="置信度" value={CONFIDENCE_LABELS[cluster.confidence]} />
        <MetricPill label="优先级" value={formatPriority(cluster.interventionPriority)} />
      </div>
      <div className="mt-3 text-xs text-subtle">
        证据覆盖：ready {cluster.evidenceCoverage.ready}，stale {cluster.evidenceCoverage.stale}，missing {cluster.evidenceCoverage.missing}，low {cluster.evidenceCoverage.lowConfidence}
      </div>
      {canReviewPrepPack ? (
        <Link
          href={`/teacher/prep-packs?cluster=${encodeURIComponent(cluster.id)}`}
          className="mt-4 inline-flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-xs text-foreground hover:border-primary"
          data-teacher-prep-pack-review-entry="diagnosis-cluster"
        >
          打开课前包复核
          <ArrowRight className="h-3 w-3" />
        </Link>
      ) : null}
    </article>
  );
}

function MetricPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 px-3 py-2">
      <p className="text-[11px] text-subtle">{label}</p>
      <p className="mt-1 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function formatDimensionId(value: string) {
  return value
    .replace(/-/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function formatPriority(priority: RoleBasedLearningDiagnosisRootCauseCluster['interventionPriority']) {
  if (priority === 'high') return '高';
  if (priority === 'medium') return '中';
  return '低';
}

function formatScore(value: number | null, scoreScale: 'proportion' | 'points') {
  if (value === null) return '暂无';
  if (scoreScale === 'proportion') return `${Math.round(value * 100)}%`;
  return `${Number(value.toFixed(2))} 分`;
}

function formatPercentile(value: RoleBasedLearningDiagnosisClaim['metrics']['percentile']) {
  if (value.state !== 'available' || value.percentile === null) return percentileFallbackLabel(value.fallback);
  return `P${Math.round(value.percentile)}`;
}

function formatGrowthPercentile(value: RoleBasedLearningDiagnosisClaim['metrics']['growthPercentile']) {
  if (value.state !== 'available' || value.percentile === null) return percentileFallbackLabel(value.fallback);
  return `成长 P${Math.round(value.percentile)}`;
}

function percentileFallbackLabel(fallback: RoleBasedLearningDiagnosisClaim['metrics']['percentile']['fallback']) {
  if (fallback === 'insufficient-cohort') return '样本不足';
  if (fallback === 'cold-start') return '冷启动';
  return '暂无';
}

function judgmentClassName(judgment: RoleBasedLearningDiagnosisClaim['judgment']) {
  if (judgment === 'stable') return 'diagnosis-chip-ready';
  if (judgment === 'developing') return 'diagnosis-chip-progress';
  if (judgment === 'needs-attention') return 'diagnosis-chip-warning';
  return 'diagnosis-chip-muted';
}
