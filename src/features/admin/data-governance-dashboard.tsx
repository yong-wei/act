'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Database,
  Download,
  FileText,
  RefreshCw,
  ShieldAlert,
  Workflow,
} from 'lucide-react';

import { ActionStatusPanel } from '@/components/platform/action-status';
import { createAuditedActionState, type AuditedActionState } from '@/lib/action-status-contract';
import {
  buildAdminOperationId,
  buildAdminOperationIdempotencyKey,
  type AdminOperationLedgerEntry,
} from '@/lib/admin-operation-ledger';
import {
  buildGovernanceOverview,
  type GovernanceStatusPayload,
} from '@/features/admin/data-governance-overview';
import {
  buildGovernanceActionContract,
  type GovernanceActionQuery,
  type GovernanceActionAuditRecord,
  type GovernanceRiskAction,
} from '@/features/admin/admin-governance-action-contract';
import { AdminConsoleHeader } from './admin-console-header';
import type { AdminConsoleUser } from './admin-console-config';

type DataGovernanceDashboardProps = {
  currentUser: AdminConsoleUser;
  initialActionQuery?: GovernanceActionQuery | null;
};

type SarDiagnosticsReport = NonNullable<GovernanceStatusPayload['sarDiagnostics']>;
type SarRefreshHealth = NonNullable<GovernanceStatusPayload['sarRefreshHealth']>;
type GovernanceDashboardTab = 'overview' | 'risks' | 'sessions' | 'sources' | 'cache';
type GraphCenterAuditContext = 'resource-binding' | 'citation-readiness' | 'overlay-limitations' | 'custom';

function formatDiagnosticRate(value: number) {
  return `${(value * 100).toFixed(1)}%`;
}

function diagnosticRecordEntries(record: Record<string, number>, limit = 4) {
  return Object.entries(record)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
}

function sanitizeVisibleDiagnosticText(value: string) {
  const forbiddenVisibleText = [
    /\braw[_ -]?(answer|answers|evidence|submission|submissions|trace|traces|payload)\b/i,
    /\braw\b.*\b(answer|answers|evidence|submission|submissions|trace|traces|payload)\b/i,
    /\bhidden(?:Arena|ArenaEvaluation|Evaluation)?Internals?\w*\b/i,
    /\bhidden\b.*\b(arena|evaluation|internals)\b/i,
    /\bprivate[_ -]?konling[_ -]?memory\b/i,
    /\baudit[_ -]?only[_ -]?trace\b/i,
  ];
  return forbiddenVisibleText.some((pattern) => pattern.test(value)) ? '[redacted]' : value;
}

export function SarDiagnosticsPanel({
  report,
  refreshHealth,
}: {
  report?: SarDiagnosticsReport | null;
  refreshHealth?: SarRefreshHealth | null;
}) {
  if (!report) {
    return (
      <section
        className="admin-console-surface space-y-4"
        data-admin-sar-diagnostics="unavailable"
      >
        <div className="flex items-center gap-3">
          <span className="admin-console-icon-badge">
            <Database className="h-5 w-5" />
          </span>
          <div>
            <h2 className="admin-console-title text-xl font-semibold">SAR 诊断</h2>
            <p className="admin-console-muted text-sm">当前状态 payload 未返回 SAR 诊断报告。</p>
          </div>
        </div>
        <div className="admin-console-notice" data-admin-sar-diagnostics-state="degraded">
          SAR 诊断不可用；关联检索健康不能按完整状态展示。
        </div>
        {refreshHealth ? (
          <div
            className="admin-console-surface-soft text-sm"
            data-admin-sar-refresh-health={refreshHealth.status}
          >
            <span className="admin-console-kicker">SAR 投影刷新</span>
            <div className="mt-2 admin-console-title font-semibold">
              {refreshHealth.status} · {refreshHealth.totals.sourceFamilyCount} 个源族
            </div>
            <div className="admin-console-muted mt-2">
              最近尝试 {new Date(refreshHealth.lastAttemptedAt).toLocaleString('zh-CN')} · 过期 {refreshHealth.totals.staleSourceCount} · 失败 {refreshHealth.totals.failureCount}
            </div>
          </div>
        ) : null}
      </section>
    );
  }

  const traceRows = report.queryTraceSummaries.slice(0, 4);
  const countCards = [
    ['事件', report.totals.eventCount],
    ['实体', report.totals.entityCount],
    ['关系', report.totals.relationCount],
    ['查询', report.totals.queryCount],
  ];
  const downstreamCards = [
    ['Source Pack 交接', report.totals.sourcePackHandoffCount.toLocaleString()],
    ['Verified citation rate', formatDiagnosticRate(report.totals.verifiedCitationRate)],
    ['SAR candidate adopted', report.totals.sarCandidateAdoptionCount.toLocaleString()],
    ['SAR candidate rejected', report.totals.sarCandidateRejectionCount.toLocaleString()],
    ['隐私拒绝', report.totals.privacyRejectionCount.toLocaleString()],
    ['限制项', report.totals.limitationCount.toLocaleString()],
  ];
  const comparisonCards = [
    ['Ordinary Source Pack refs', report.comparison.ordinarySourcePackRefCount.toLocaleString()],
    ['SAR-assisted refs', report.comparison.sarAssistedRefCount.toLocaleString()],
    ['Adopted refs', report.comparison.adoptedRefCount.toLocaleString()],
    ['Rejected refs', report.comparison.rejectedRefCount.toLocaleString()],
  ];

  return (
    <section
      className="admin-console-surface space-y-5"
      data-admin-sar-diagnostics="available"
      data-admin-sar-demo-fixture={report.demoFixtureStatus?.id ?? 'missing'}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <span className="admin-console-icon-badge">
            <Database className="h-5 w-5" />
          </span>
          <div>
            <h2 className="admin-console-title text-xl font-semibold">SAR 诊断</h2>
            <p className="admin-console-muted text-sm">
              {new Date(report.generatedAt).toLocaleString('zh-CN')} 生成 · 平均 {report.totals.averageHopCount.toFixed(1)} 跳
            </p>
          </div>
        </div>
        <span className="admin-console-chip">
          {report.demoFixtureStatus?.deterministic ? 'demo fixture stable' : 'demo fixture degraded'}
        </span>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        {countCards.map(([label, value]) => (
          <div key={label} className="admin-console-surface-soft">
            <div className="admin-console-muted text-sm">{label}</div>
            <div className="admin-console-title mt-2 text-2xl font-semibold">{Number(value).toLocaleString()}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
        {downstreamCards.map(([label, value]) => (
          <div key={label} className="admin-console-surface-soft">
            <div className="admin-console-muted text-sm">{label}</div>
            <div className="admin-console-title mt-2 text-lg font-semibold">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-4" aria-label="SAR candidates and verified citation comparison">
        {comparisonCards.map(([label, value]) => (
          <div key={label} className="admin-console-surface-soft">
            <div className="admin-console-muted text-sm">{label}</div>
            <div className="admin-console-title mt-2 text-lg font-semibold">{value}</div>
          </div>
        ))}
      </div>

      {refreshHealth ? (
        <div
          className="admin-console-surface-soft space-y-4"
          data-admin-sar-refresh-health={refreshHealth.status}
        >
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <span className="admin-console-kicker">SAR 投影刷新</span>
              <h3 className="admin-console-title mt-2 text-base font-semibold">
                {refreshHealth.status} · {refreshHealth.totals.sourceFamilyCount} 个源族
              </h3>
            </div>
            <span className="admin-console-chip">
              {refreshHealth.totals.staleSourceCount.toLocaleString()} 过期 · {refreshHealth.totals.failureCount.toLocaleString()} 失败
            </span>
          </div>
          <div className="grid gap-3 text-sm md:grid-cols-3">
            <div>
              <div className="admin-console-muted">最近尝试</div>
              <div className="admin-console-title mt-1">{new Date(refreshHealth.lastAttemptedAt).toLocaleString('zh-CN')}</div>
            </div>
            <div>
              <div className="admin-console-muted">最近成功</div>
              <div className="admin-console-title mt-1">
                {refreshHealth.lastSuccessfulAt ? new Date(refreshHealth.lastSuccessfulAt).toLocaleString('zh-CN') : '暂无成功记录'}
              </div>
            </div>
            <div>
              <div className="admin-console-muted">投影记录</div>
              <div className="admin-console-title mt-1">
                {refreshHealth.totals.projectedEventCount.toLocaleString()} / {refreshHealth.totals.projectedEntityCount.toLocaleString()} / {refreshHealth.totals.projectedRelationCount.toLocaleString()}
              </div>
            </div>
          </div>
          <div className="admin-console-table-shell p-0">
            <table className="admin-console-table" data-admin-mobile-cards="true" aria-label="SAR refresh health">
              <thead>
                <tr>
                  <th className="px-4 py-3">源族</th>
                  <th className="px-4 py-3">状态</th>
                  <th className="px-4 py-3">刷新时间</th>
                  <th className="px-4 py-3">过期 / 失败</th>
                  <th className="px-4 py-3">retry</th>
                </tr>
              </thead>
              <tbody>
                {refreshHealth.sources.slice(0, 8).map((source) => (
                  <tr key={source.family}>
                    <td className="px-4 py-3 admin-console-title font-medium" data-label="源族">{source.family}</td>
                    <td className="px-4 py-3" data-label="状态">{source.status}</td>
                    <td className="px-4 py-3" data-label="刷新时间">
                      {source.highWaterMark ? new Date(source.highWaterMark).toLocaleString('zh-CN') : source.sourceVersion ?? '-'}
                    </td>
                    <td className="px-4 py-3" data-label="过期 / 失败">
                      {source.staleCount.toLocaleString()} / {source.failureCount.toLocaleString()}
                    </td>
                    <td className="px-4 py-3" data-label="retry">{source.retryState}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {refreshHealth.limitations.length > 0 ? (
            <div className="text-sm">
              <span className="admin-console-muted">限制：</span>
              {refreshHealth.limitations.slice(0, 4).map((limitation) => sanitizeVisibleDiagnosticText(limitation)).join(' · ')}
            </div>
          ) : null}
        </div>
      ) : (
        <div
          className="admin-console-notice"
          data-admin-sar-refresh-health="unavailable"
        >
          SAR 投影刷新健康尚未写入状态 payload。
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        {[
          ['Source owner', report.sourceOwnerCounts],
          ['Privacy scope', report.privacyScopeCounts],
          ['Authority level', report.authorityLevelCounts],
        ].map(([label, record]) => (
          <div key={label as string} className="admin-console-surface-soft">
            <h3 className="admin-console-title text-sm font-semibold">{label as string}</h3>
            <div className="mt-3 space-y-2 text-sm">
              {diagnosticRecordEntries(record as Record<string, number>).map(([name, count]) => (
                <div key={name} className="flex items-center justify-between gap-3">
                  <span className="admin-console-muted">{name}</span>
                  <span className="admin-console-title font-medium">{count.toLocaleString()}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="admin-console-table-shell p-0">
        <table className="admin-console-table" data-admin-mobile-cards="true" aria-label="SAR 诊断 trace summaries">
          <thead>
            <tr>
              <th className="px-4 py-3">查询</th>
              <th className="px-4 py-3">跳数</th>
              <th className="px-4 py-3">事件/实体</th>
              <th className="px-4 py-3">拒绝/限制</th>
              <th className="px-4 py-3">引用</th>
            </tr>
          </thead>
          <tbody>
            {traceRows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center admin-console-table-subtle">
                  暂无 SAR trace summary。
                </td>
              </tr>
            ) : traceRows.map((trace) => (
              <tr key={trace.id}>
                <td className="px-4 py-3 admin-console-title font-medium" data-label="查询">{trace.query}</td>
                <td className="px-4 py-3" data-label="跳数">{trace.hopCount}</td>
                <td className="px-4 py-3" data-label="事件/实体">
                  {trace.selectedEventCount.toLocaleString()} / {trace.selectedEntityCount.toLocaleString()}
                </td>
                <td className="px-4 py-3" data-label="拒绝/限制">
                  {trace.rejectedRefCount.toLocaleString()}（隐私 {trace.privacyRejectionCount.toLocaleString()}） / {trace.limitationCount.toLocaleString()}
                </td>
                <td className="px-4 py-3" data-label="引用">
                  {trace.sourcePackHandoffCount.toLocaleString()} · {formatDiagnosticRate(trace.verifiedCitationRate)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {report.demoFixtureStatus ? (
        <div className="admin-console-surface-soft text-sm">
          <span className="admin-console-kicker">Control-correction demo fixture</span>
          <div className="mt-2 grid gap-2 md:grid-cols-3">
            <div>Query：{sanitizeVisibleDiagnosticText(report.demoFixtureStatus.query)}</div>
            <div>Source Pack：{report.demoFixtureStatus.sourcePackHandoff ? 'available' : 'missing'}</div>
            <div>Verified citation：{report.demoFixtureStatus.verifiedCitationOutcome}</div>
          </div>
        </div>
      ) : null}
    </section>
  );
}

export function normalizeGraphCenterAuditContext(audit: string | null | undefined): GraphCenterAuditContext | null {
  const trimmed = audit?.trim();
  if (!trimmed) return null;
  if (
    trimmed === 'resource-binding' ||
    trimmed === 'citation-readiness' ||
    trimmed === 'overlay-limitations'
  ) {
    return trimmed;
  }
  return 'custom';
}

export function graphCenterAuditInitialTab(audit: GraphCenterAuditContext | null): GovernanceDashboardTab {
  if (audit === 'resource-binding' || audit === 'citation-readiness') return 'sources';
  if (audit === 'overlay-limitations') return 'cache';
  return 'overview';
}

function governanceActionLabel(action: GovernanceRiskAction) {
  if (action === 'assign') return '治理分派';
  if (action === 'ignore') return '治理忽略';
  if (action === 'reopen') return '治理重开';
  if (action === 'undo') return '治理撤销';
  return '治理处置';
}

function governanceActionCategory(action: GovernanceRiskAction) {
  if (action === 'assign') return 'governance-assign';
  if (action === 'ignore') return 'governance-ignore';
  if (action === 'reopen') return 'governance-reopen';
  if (action === 'undo') return 'governance-undo';
  return 'governance-resolve';
}

function compactAdminIdentifier(value: string | null | undefined) {
  return value ? `${value.slice(0, 8)}...` : '-';
}

function isAssigneeFailure(message: string) {
  return message.includes('负责人不存在') || message.includes('缺少负责人');
}

function governanceFailureOutcome(responseStatus: number, message: string): GovernanceActionAuditRecord['outcome'] {
  if (isAssigneeFailure(message)) return 'missing-assignee';
  if (responseStatus === 404) return 'missing-risk';
  if (message.includes('仍处于待处理')) return 'already-open';
  if (message.includes('没有可撤销')) return 'undo-unavailable';
  if (message.includes('已解决') || message.includes('已处理')) return 'already-handled';
  return 'unsupported';
}

function governanceFailureRecovery(responseStatus: number, message: string) {
  if (isAssigneeFailure(message)) return '重新选择负责人后提交分派';
  if (responseStatus === 404) return '返回风险列表并刷新数据';
  if (message.includes('仍处于待处理')) return '继续分派、处置或忽略该风险';
  if (message.includes('没有可撤销')) return '查看审计记录，或使用重开恢复为待处理';
  if (responseStatus === 409) return '查看审计记录，或使用重开/撤销恢复为待处理';
  return '刷新治理列表后重试';
}

function governanceRefreshStateFromLedger(ledger: AdminOperationLedgerEntry) {
  return createAuditedActionState({
    identity: {
      id: ledger.operationId,
      category: 'refresh',
      label: '数据治理刷新',
      sourceRoute: '/admin/data-governance',
      requestedAction: 'refresh',
    },
    status: governanceRefreshStatusFromLedgerOutcome(ledger.outcome),
    message: ledger.auditSummary,
    nextAction: '复核治理风险或导出风险文件',
    recoveryAction: ledger.recoveryState.action,
    recoveryKind: ledger.recoveryState.status,
    displayReference: ledger.idempotencyKey,
  });
}

function governanceRefreshStatusFromLedgerOutcome(outcome: AdminOperationLedgerEntry['outcome']) {
  if (outcome === 'pending') return 'pending';
  if (outcome === 'failed') return 'failed';
  if (outcome === 'blocked') return 'blocked';
  return 'succeeded';
}

function governanceActionStateFromLedger(
  ledger: AdminOperationLedgerEntry,
  input: { action: GovernanceRiskAction; riskId: string },
) {
  const label = governanceActionLabel(input.action);
  return createAuditedActionState({
    identity: {
      id: ledger.operationId,
      category: governanceActionCategory(input.action),
      label,
      sourceRoute: '/admin/data-governance',
      targetId: input.riskId,
      requestedAction: input.action,
    },
    status: ledger.outcome === 'failed' ? 'failed' : 'succeeded',
    message: ledger.auditSummary,
    nextAction: '刷新治理列表并复核风险状态',
    recoveryAction: ledger.recoveryState.action,
    recoveryKind: ledger.recoveryState.status,
    displayReference: ledger.idempotencyKey,
  });
}

export function DataGovernanceDashboard({ currentUser, initialActionQuery }: DataGovernanceDashboardProps) {
  const [status, setStatus] = useState<GovernanceStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const initialGraphCenterAuditContext = normalizeGraphCenterAuditContext(initialActionQuery?.audit);
  const initialTab: GovernanceDashboardTab = initialActionQuery?.tab === 'risks' || initialActionQuery?.riskId || initialActionQuery?.action
    ? 'risks'
    : initialActionQuery?.surface === 'authoring' && initialActionQuery?.tab === 'reports'
      ? 'sessions'
      : graphCenterAuditInitialTab(initialGraphCenterAuditContext);
  const [activeTab, setActiveTab] = useState<GovernanceDashboardTab>(initialTab);
  const [executedActionState, setExecutedActionState] = useState<AuditedActionState | null>(null);
  const [executedAuditRecord, setExecutedAuditRecord] = useState<GovernanceActionAuditRecord | null>(null);
  const [refreshActionState, setRefreshActionState] = useState<AuditedActionState | null>(null);
  const [retainedRiskQuery, setRetainedRiskQuery] = useState<{ riskId: string; tab: GovernanceDashboardTab } | null>(
    initialActionQuery?.riskId
      ? { riskId: initialActionQuery.riskId, tab: 'risks' }
      : null,
  );

  const fetchStatus = useCallback(async (
    manual = false,
    overrideQuery?: { riskId?: string | null; tab?: GovernanceDashboardTab | null },
  ) => {
    const requestedRiskId = overrideQuery?.riskId ?? retainedRiskQuery?.riskId ?? initialActionQuery?.riskId ?? '';
    const requestedTab = overrideQuery?.tab ?? retainedRiskQuery?.tab ?? initialActionQuery?.tab ?? '';
    const idempotencyKey = buildAdminOperationIdempotencyKey([
      'admin-governance-refresh',
      currentUser.id,
      requestedRiskId,
      initialActionQuery?.surface ?? '',
      initialActionQuery?.audit ?? '',
    ]);
    const operationId = buildAdminOperationId({
      kind: 'admin-governance-refresh',
      scope: 'admin-data-governance-status',
      seed: idempotencyKey,
    });
    try {
      setLoading(true);
      if (manual) {
        setRefreshActionState(createAuditedActionState({
          identity: {
            id: operationId,
            category: 'refresh',
            label: '数据治理刷新',
            sourceRoute: '/admin/data-governance',
            requestedAction: 'refresh',
          },
          status: 'pending',
          message: '正在刷新数据治理状态，操作账本已记录刷新范围。',
          nextAction: '等待状态接口返回',
          displayReference: idempotencyKey,
        }));
      }
      const params = new URLSearchParams();
      if (requestedRiskId.trim()) {
        params.set('riskId', requestedRiskId.trim());
      }
      if (initialActionQuery?.surface === 'authoring') {
        params.set('surface', 'authoring');
      }
      if (requestedTab.trim()) {
        params.set('tab', requestedTab.trim());
      }
      if (initialActionQuery?.lessonPlanId?.trim()) {
        params.set('lessonPlanId', initialActionQuery.lessonPlanId.trim());
      }
      if (initialActionQuery?.graphNodeId?.trim()) {
        params.set('graphNodeId', initialActionQuery.graphNodeId.trim());
      }
      if (initialActionQuery?.audit?.trim()) {
        params.set('audit', initialActionQuery.audit.trim());
      }
      if (manual) {
        params.set('recordOperation', 'refresh');
      }
      const response = await fetch(`/api/admin/data-governance/status${params.size ? `?${params}` : ''}`, {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error('获取数据治理状态失败');
      }
      const data = (await response.json()) as GovernanceStatusPayload;
      setStatus(data);
      setError(null);
      if (manual) {
        setRefreshActionState(data.operationLedger
          ? governanceRefreshStateFromLedger(data.operationLedger)
          : createAuditedActionState({
              identity: {
                id: operationId,
                category: 'refresh',
                label: '数据治理刷新',
                sourceRoute: '/admin/data-governance',
                requestedAction: 'refresh',
              },
              status: 'succeeded',
              message: `数据治理状态已刷新，当前状态 ${data.status}，最近风险 ${data.recentRiskFlags.length} 条。`,
              nextAction: '复核治理风险或导出风险文件',
              displayReference: idempotencyKey,
            }));
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : '获取数据治理状态失败';
      setError(message);
      if (manual) {
        setRefreshActionState(createAuditedActionState({
          identity: {
            id: operationId,
            category: 'refresh',
            label: '数据治理刷新',
            sourceRoute: '/admin/data-governance',
            requestedAction: 'refresh',
          },
          status: 'failed',
          message,
          recoveryAction: '检查数据治理状态接口后重试刷新',
          displayReference: idempotencyKey,
          httpStatus: 500,
        }));
      }
    } finally {
      setLoading(false);
    }
  }, [
    currentUser.id,
    initialActionQuery?.audit,
    initialActionQuery?.graphNodeId,
    initialActionQuery?.lessonPlanId,
    initialActionQuery?.riskId,
    initialActionQuery?.surface,
    initialActionQuery?.tab,
    retainedRiskQuery?.riskId,
    retainedRiskQuery?.tab,
  ]);

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, [fetchStatus]);

  const overview = useMemo(() => {
    if (!status) {
      return null;
    }
    return buildGovernanceOverview(status);
  }, [status]);

  const actionContract = useMemo(() => {
    if (!status) return { state: null, auditRecord: null };
    const actionRisks = status.targetRiskFlag
      ? [status.targetRiskFlag, ...status.recentRiskFlags.filter((risk) => risk.id !== status.targetRiskFlag?.id)]
      : status.recentRiskFlags;
    return buildGovernanceActionContract({
      query: initialActionQuery,
      risks: actionRisks,
      actorId: currentUser.id,
      now: new Date(status.timestamp),
    });
  }, [currentUser.id, initialActionQuery, status]);

  const visibleActionState = executedActionState ?? actionContract.state;
  const visibleAuditRecord = executedAuditRecord ?? actionContract.auditRecord;
  const routeRiskAction = isDashboardRiskAction(initialActionQuery?.action)
    ? initialActionQuery.action
    : null;
  const routeRiskActionTarget = routeRiskAction
    && visibleActionState?.status === 'pending'
    && status
    ? resolveGovernanceRouteRiskActionTarget(status, initialActionQuery?.riskId)
    : null;
  const exportFormat = initialActionQuery?.format === 'csv' || initialActionQuery?.format === 'xlsx'
    ? initialActionQuery.format
    : 'json';
  const riskExportHref = visibleActionState?.downloadFilename
    ? `/api/admin/data-governance/export?format=${encodeURIComponent(exportFormat)}`
    : null;
  const governanceStatusAnnouncement = useMemo(() => {
    if (loading) return '正在刷新数据治理看板。';
    if (error) return `数据治理看板出现错误：${error}`;
    if (!status || !overview) return '数据治理看板暂无可展示数据。';
    return `数据治理看板已更新，当前状态为 ${status.status}，当前标签为 ${overview.tabs.find((tab) => tab.id === activeTab)?.label ?? '概览'}。`;
  }, [activeTab, error, loading, overview, status]);
  const authoringSurfaceActive = initialActionQuery?.surface === 'authoring';
  const authoringLessonPlanId = initialActionQuery?.lessonPlanId?.trim() || null;
  const authoringLessonPlanMissing = Boolean(status?.authoringContext?.lessonPlanMissing);
  const graphCenterNodeId = status?.graphCenterAudit?.graphNodeId ?? initialActionQuery?.graphNodeId?.trim() ?? null;
  const graphCenterAuditContext = normalizeGraphCenterAuditContext(status?.graphCenterAudit?.audit ?? initialActionQuery?.audit);

  const executeGovernanceAction = async (input: {
    action: GovernanceRiskAction;
    riskId: string;
    assignee?: string | null;
  }) => {
    const label = governanceActionLabel(input.action);
    setExecutedAuditRecord(null);
    setExecutedActionState(createAuditedActionState({
      identity: {
        id: `admin-governance-${input.action}:${input.riskId}`,
        category: governanceActionCategory(input.action),
        label,
        sourceRoute: '/admin/data-governance',
        targetId: input.riskId,
        requestedAction: input.action,
      },
      status: 'pending',
      message: '治理动作正在提交。',
    }));
    let responseStatus = 500;
    try {
      const response = await fetch(`/api/admin/data-governance/risks/${encodeURIComponent(input.riskId)}/actions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: input.action,
          assignee: input.assignee ?? null,
        }),
      });
      responseStatus = response.status;
      const payload = await response.json().catch(() => null) as {
        auditRecord?: GovernanceActionAuditRecord;
        operationLedger?: AdminOperationLedgerEntry;
        error?: string;
      } | null;
      if (!response.ok) {
        throw new Error(payload?.error || '治理动作失败');
      }
      setExecutedAuditRecord(payload?.auditRecord ?? null);
      setExecutedActionState(payload?.operationLedger
        ? governanceActionStateFromLedger(payload.operationLedger, input)
        : createAuditedActionState({
            identity: {
              id: `admin-governance-${input.action}:${input.riskId}`,
              category: governanceActionCategory(input.action),
              label,
              sourceRoute: '/admin/data-governance',
              targetId: input.riskId,
              requestedAction: input.action,
            },
            status: 'succeeded',
            message: `${label}已保存审计记录。`,
            nextAction: '刷新治理列表并复核风险状态',
          }));
      setRetainedRiskQuery({ riskId: input.riskId, tab: 'risks' });
      setActiveTab('risks');
      fetchStatus(false, { riskId: input.riskId, tab: 'risks' });
    } catch (err) {
      const message = err instanceof Error ? err.message : '治理动作失败';
      const outcome = governanceFailureOutcome(responseStatus, message);
      setExecutedActionState(createAuditedActionState({
        identity: {
          id: `admin-governance-${input.action}:${input.riskId}`,
          category: governanceActionCategory(input.action),
          label,
          sourceRoute: '/admin/data-governance',
          targetId: input.riskId,
          requestedAction: input.action,
        },
        status: responseStatus === 409 ? 'blocked' : 'failed',
        message,
        recoveryAction: governanceFailureRecovery(responseStatus, message),
        httpStatus: responseStatus,
      }));
      setExecutedAuditRecord({
        actorId: currentUser.id,
        action: input.action,
        riskId: input.riskId,
        assignee: input.assignee ?? null,
        outcome,
        undoAvailable: false,
        recordedAt: new Date().toISOString(),
      });
    }
  };

  if (loading && !status) {
    return (
      <div
        className="admin-console-shell"
        data-commercial-operations-workspace="admin-operations"
        data-commercial-workspace-zone="instrument-area"
        data-operations-status-semantics="loading"
        data-report-ledger-surface="governance-data-quality-snapshot"
        data-report-ledger-watermark="low-contrast-brand"
        data-report-ledger-privacy-scope="admin-governance"
        data-report-ledger-export="deferred"
      >
        <AdminConsoleHeader
          currentUser={currentUser}
          currentHref="/admin/data-governance"
          backHref="/admin"
          eyebrow="治理看板"
          title="数据治理"
          description="这里不只展示总量，而是直接展开风险、事实与快照的下层内容，帮助管理员判断治理链路到底卡在队列、快照还是风险处置。"
        />
        <main className="admin-console-container flex min-h-[360px] items-center justify-center py-8">
          <div className="admin-console-surface flex items-center gap-3">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span className="admin-console-title text-sm font-medium">正在加载数据治理看板…</span>
          </div>
        </main>
      </div>
    );
  }

  if (error && !status) {
    return (
      <div
        className="admin-console-shell"
        data-commercial-operations-workspace="admin-operations"
        data-commercial-workspace-zone="instrument-area"
        data-operations-status-semantics="blocked"
        data-report-ledger-surface="governance-data-quality-snapshot"
        data-report-ledger-watermark="low-contrast-brand"
        data-report-ledger-privacy-scope="admin-governance"
        data-report-ledger-export="deferred"
      >
        <AdminConsoleHeader
          currentUser={currentUser}
          currentHref="/admin/data-governance"
          backHref="/admin"
          eyebrow="治理看板"
          title="数据治理"
          description="这里不只展示总量，而是直接展开风险、事实与快照的下层内容，帮助管理员判断治理链路到底卡在队列、快照还是风险处置。"
        />
        <main className="admin-console-container py-8">
          <div className="admin-console-notice admin-console-notice-danger flex items-start gap-3" role="alert">
            <AlertTriangle className="mt-0.5 h-5 w-5" />
            <div>
              <p className="font-medium">数据治理看板加载失败</p>
              <p className="mt-1 text-sm">{error}</p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!status || !overview) {
    return null;
  }

  return (
    <div
      className="admin-console-shell"
      data-commercial-operations-workspace="admin-operations"
      data-commercial-workspace-zone="instrument-area"
      data-operations-status-semantics={status.status === 'healthy' ? 'ready' : status.status === 'error' ? 'blocked' : 'partial'}
      data-report-ledger-surface="governance-data-quality-snapshot"
      data-report-ledger-watermark="low-contrast-brand"
      data-report-ledger-privacy-scope="admin-governance"
      data-report-ledger-export="deferred"
      data-graph-center-governance-context={graphCenterNodeId ? 'true' : undefined}
      data-graph-center-node-id={graphCenterNodeId ?? undefined}
      data-graph-center-audit={graphCenterNodeId && graphCenterAuditContext ? graphCenterAuditContext : undefined}
      data-graph-center-preferred-tab={status.graphCenterAudit?.preferredTab}
    >
      <AdminConsoleHeader
        currentUser={currentUser}
        currentHref="/admin/data-governance"
        backHref="/admin"
        eyebrow="治理看板"
        title="数据治理"
        description="这里不只展示总量，而是直接展开风险、事实与快照的下层内容，帮助管理员判断治理链路到底卡在队列、快照还是风险处置。"
        chips={
          <span className="admin-console-chip">
            最近更新：{new Date(status.timestamp).toLocaleString('zh-CN')}
          </span>
        }
        actions={
          <button type="button"
            onClick={() => fetchStatus(true)}
            className="admin-console-button-primary"
            disabled={loading}
            aria-label="刷新数据治理状态"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            刷新状态
          </button>
        }
      />

      <main className="admin-console-container space-y-6 py-8">
        {error && (
          <div className="admin-console-notice admin-console-notice-danger" role="alert">
            {error}
          </div>
        )}
        {graphCenterNodeId ? (
          <section
            className="admin-console-notice"
            data-graph-center-governance-audit-context="true"
            data-graph-center-node-id={graphCenterNodeId}
            data-graph-center-audit={graphCenterAuditContext ?? 'unspecified'}
            data-graph-center-preferred-tab={status.graphCenterAudit?.preferredTab ?? graphCenterAuditInitialTab(graphCenterAuditContext)}
          >
            <div className="font-semibold text-foreground">图谱治理上下文</div>
            <div className="mt-1 text-sm">
              当前审计已定位到图谱节点 <span className="font-mono text-xs">{graphCenterNodeId}</span>
              {graphCenterAuditContext ? `，审计类型：${graphCenterAuditContext}` : '。'}
            </div>
          </section>
        ) : null}
        <div
          className="sr-only"
          role="status"
          aria-live="polite"
          data-admin-governance-status
        >
          {governanceStatusAnnouncement}
        </div>

        {visibleActionState ? (
          <ActionStatusPanel
            state={visibleActionState}
            action={riskExportHref ? (
              <a
                href={riskExportHref}
                download={visibleActionState.downloadFilename}
                className="admin-console-button px-3 py-1.5"
                aria-label="下载数据治理风险文件"
              >
                <Download className="h-4 w-4" />
                下载风险文件
              </a>
            ) : routeRiskAction && routeRiskActionTarget ? (
              <button
                type="button"
                onClick={() => executeGovernanceAction({
                  action: routeRiskAction,
                  riskId: routeRiskActionTarget.id,
                  assignee: routeRiskAction === 'assign' ? initialActionQuery?.assignee?.trim() || currentUser.id : null,
                })}
                className="admin-console-button px-3 py-1.5"
                aria-label={`提交${governanceActionLabel(routeRiskAction)}`}
              >
                提交{governanceActionLabel(routeRiskAction).replace('治理', '')}
              </button>
            ) : null}
          />
        ) : null}
        {refreshActionState ? (
          <ActionStatusPanel state={refreshActionState} />
        ) : null}

        {visibleAuditRecord ? (
          <section className="admin-console-surface-soft text-sm">
            <span className="admin-console-kicker">动作审计</span>
            <div className="mt-3 grid gap-2 md:grid-cols-3">
              <div>操作者：{compactAdminIdentifier(visibleAuditRecord.actorId)}</div>
              <div>动作：{visibleAuditRecord.action}</div>
              <div>结果：{visibleAuditRecord.outcome}</div>
              <div>风险：{visibleAuditRecord.riskId ?? '-'}</div>
              <div>负责人：{compactAdminIdentifier(visibleAuditRecord.assignee)}</div>
              <div>回滚可用：{visibleAuditRecord.undoAvailable ? '是' : '否'}</div>
              <div className="break-all">操作：{visibleAuditRecord.operationId ?? '-'}</div>
              <div className="break-all">去重键：{visibleAuditRecord.idempotencyKey ?? '-'}</div>
              <div>保留策略：{visibleAuditRecord.retentionPolicy ?? 'admin-operation-ledger-30d'}</div>
            </div>
          </section>
        ) : null}

        {authoringSurfaceActive ? (
          <section
            className="admin-console-surface-soft flex flex-wrap items-start justify-between gap-4 text-sm"
            data-admin-governance-authoring-surface="quality-reports"
          >
            <div className="flex items-start gap-3">
              <FileText className="mt-0.5 h-5 w-5 text-cyan-300" />
              <div>
                <h2 className="admin-console-title font-semibold">作者态质量报告</h2>
                <p className="admin-console-muted mt-1">
                  当前入口来自作者态治理链接，已切换到课堂质量报告视图。
                  {authoringLessonPlanMissing
                    ? `目标教案 ${authoringLessonPlanId} 当前不存在，请返回教案管理重新选择。`
                    : authoringLessonPlanId
                    ? `目标教案：${authoringLessonPlanId}`
                    : '当前链接缺少 lessonPlanId，请从具体教案或资源治理项重新进入。'}
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setActiveTab('sessions')}
                className="admin-console-button px-3 py-1.5"
              >
                查看质量报告
              </button>
              <a href="/admin/lesson-plans" className="admin-console-button px-3 py-1.5">
                返回教案管理
              </a>
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {overview.summaryCards.map((card) => (
            <div key={card.title} className="admin-console-metric-card">
              <div className="flex items-center justify-between">
                <span className="admin-console-kicker">{card.title}</span>
                <span
                  className={`admin-console-chip ${
                    card.tone === 'danger'
                      ? 'admin-console-tone-danger'
                      : card.tone === 'success'
                        ? 'admin-console-tone-success'
                        : ''
                  }`}
                >
                  {card.tone === 'danger' ? '告警' : card.tone === 'success' ? '正常' : '概览'}
                </span>
              </div>
              <div className="mt-6">
                <p className="admin-console-title text-3xl font-semibold">{card.value}</p>
                <p className="admin-console-muted mt-3 text-sm leading-6">{card.detail}</p>
              </div>
            </div>
          ))}
        </section>

        <nav className="admin-console-surface flex flex-wrap gap-2 p-2" aria-label="数据治理视图">
          {overview.tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              aria-pressed={activeTab === tab.id}
              aria-current={activeTab === tab.id ? 'page' : undefined}
              className={`rounded-md px-4 py-2 text-sm font-medium transition ${
                activeTab === tab.id
                  ? 'bg-cyan-500 text-slate-950'
                  : 'admin-console-muted hover:bg-slate-500/10'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>

        {activeTab === 'overview' && (
        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="admin-console-surface space-y-4">
            <div className="flex items-center gap-3">
              <span className="admin-console-icon-badge">
                <Workflow className="h-5 w-5" />
              </span>
              <div>
                <h2 className="admin-console-title text-xl font-semibold">队列健康度</h2>
                <p className="admin-console-muted text-sm">
                  直接查看三个核心队列的等待、执行、完成与失败情况。
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              {overview.queueCards.map((card) => (
                <div key={card.title} className="admin-console-surface-soft space-y-3">
                  <h3 className="admin-console-title text-base font-semibold">{card.title}</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="admin-console-muted">等待</div>
                      <div className="admin-console-title mt-1 text-lg font-semibold">{card.waiting}</div>
                    </div>
                    <div>
                      <div className="admin-console-muted">执行中</div>
                      <div className="admin-console-title mt-1 text-lg font-semibold">{card.active}</div>
                    </div>
                    <div>
                      <div className="admin-console-muted">已完成</div>
                      <div className="admin-console-title mt-1 text-lg font-semibold">{card.completed}</div>
                    </div>
                    <div>
                      <div className="admin-console-muted">失败</div>
                      <div className="mt-1 text-lg font-semibold text-rose-400">{card.failed}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="admin-console-surface space-y-4">
            <div className="flex items-center gap-3">
              <span className="admin-console-icon-badge">
                <Database className="h-5 w-5" />
              </span>
              <div>
                <h2 className="admin-console-title text-xl font-semibold">{overview.factPanel.title}</h2>
                <p className="admin-console-muted text-sm">
                  事实分布能反向验证当前数据治理是否真的覆盖学习过程，而不是只累计了少量快照。
                </p>
              </div>
            </div>
            <div className="space-y-3">
              {overview.factPanel.items.length === 0 ? (
                <div className="admin-console-surface-soft admin-console-muted text-sm">
                  暂无可展示的事实分布。
                </div>
              ) : (
                overview.factPanel.items.map((item) => {
                  const ratio = status.data.learningFacts > 0 ? (item.count / status.data.learningFacts) * 100 : 0;
                  return (
                    <div key={item.label} className="admin-console-surface-soft">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="admin-console-title text-sm font-semibold">{item.label}</p>
                          <p className="admin-console-muted mt-1 text-xs">
                            占学习事实总量 {ratio.toFixed(1)}%
                          </p>
                        </div>
                        <div className="admin-console-title text-xl font-semibold">
                          {item.count.toLocaleString()}
                        </div>
                      </div>
                      <div className="mt-3 h-2 rounded-full bg-slate-300/15">
                        <div
                          className="h-full rounded-full bg-cyan-400/80"
                          style={{ width: `${Math.max(ratio, 6)}%` }}
                        />
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </section>
        )}

        {activeTab === 'overview' && (
          <SarDiagnosticsPanel
            report={status.sarDiagnostics ?? null}
            refreshHealth={status.sarRefreshHealth ?? null}
          />
        )}

        {activeTab === 'sources' && overview.sourceCatalogPanel && (
          <section className="admin-console-surface space-y-4">
            <div className="flex items-center gap-3">
              <span className="admin-console-icon-badge">
                <Database className="h-5 w-5" />
              </span>
              <div>
                <h2 className="admin-console-title text-xl font-semibold">{overview.sourceCatalogPanel.title}</h2>
                <p className="admin-console-muted text-sm">
                  dry-run 命令：<code>{overview.sourceCatalogPanel.coverageCommand}</code>
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="admin-console-surface-soft">
                <div className="admin-console-muted text-sm">目录源</div>
                <div className="admin-console-title mt-2 text-2xl font-semibold">{overview.sourceCatalogPanel.totalSources}</div>
              </div>
              <div className="admin-console-surface-soft">
                <div className="admin-console-muted text-sm">可贡献源</div>
                <div className="admin-console-title mt-2 text-2xl font-semibold">{overview.sourceCatalogPanel.eligibleSources}</div>
              </div>
              <div className="admin-console-surface-soft">
                <div className="admin-console-muted text-sm">已就绪源</div>
                <div className="admin-console-title mt-2 text-2xl font-semibold">{overview.sourceCatalogPanel.readySources}</div>
              </div>
              <div className="admin-console-surface-soft">
                <div className="admin-console-muted text-sm">暂不支持源</div>
                <div className="admin-console-title mt-2 text-2xl font-semibold">{overview.sourceCatalogPanel.unsupportedSources}</div>
              </div>
            </div>
            {overview.sourceCoveragePanel && (
              <div className="grid gap-4 md:grid-cols-4">
                <div className="admin-console-surface-soft">
                  <div className="admin-console-muted text-sm">样本行数</div>
                  <div className="admin-console-title mt-2 text-2xl font-semibold">
                    {overview.sourceCoveragePanel.totals.totalRows.toLocaleString()}
                  </div>
                </div>
                <div className="admin-console-surface-soft">
                  <div className="admin-console-muted text-sm">可纳入</div>
                  <div className="admin-console-title mt-2 text-2xl font-semibold">
                    {overview.sourceCoveragePanel.totals.eligibleRows.toLocaleString()}
                  </div>
                </div>
                <div className="admin-console-surface-soft">
                  <div className="admin-console-muted text-sm">已排除</div>
                  <div className="admin-console-title mt-2 text-2xl font-semibold">
                    {overview.sourceCoveragePanel.totals.excludedRows.toLocaleString()}
                  </div>
                </div>
                <div className="admin-console-surface-soft">
                  <div className="admin-console-muted text-sm">不支持</div>
                  <div className="admin-console-title mt-2 text-2xl font-semibold">
                    {overview.sourceCoveragePanel.totals.unsupportedRows.toLocaleString()}
                  </div>
                </div>
              </div>
            )}
            <div className="admin-console-table-shell p-0">
              <table className="admin-console-table" data-admin-mobile-cards="true" aria-label="数据源治理目录">
                <thead>
                  <tr>
                    <th className="px-4 py-3">来源</th>
                    <th className="px-4 py-3">范围</th>
                    <th className="px-4 py-3">价值</th>
                    <th className="px-4 py-3">资格</th>
                    <th className="px-4 py-3">物化</th>
                    <th className="px-4 py-3">行数</th>
                    <th className="px-4 py-3">排除原因</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.sourceCatalogPanel.sources.map((source) => (
                    <tr key={source.id}>
                      <td className="px-4 py-3 admin-console-title font-medium" data-label="来源">{source.id}</td>
                      <td className="px-4 py-3" data-label="范围">{source.learningScope}</td>
                      <td className="px-4 py-3" data-label="价值">{source.valueLevel}</td>
                      <td className="px-4 py-3" data-label="资格">{source.eligibility}</td>
                      <td className="px-4 py-3" data-label="物化">{source.materializationReadiness}</td>
                      <td className="px-4 py-3" data-label="行数">
                        {(source.totalRows ?? 0).toLocaleString()}
                      </td>
                      <td className="px-4 py-3 admin-console-table-subtle" data-label="排除原因">
                        {source.exclusionReasons && source.exclusionReasons.length > 0
                          ? source.exclusionReasons.join(' / ')
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {overview.sourceCoveragePanel && overview.sourceCoveragePanel.exclusions.length > 0 && (
              <div className="admin-console-surface-soft">
                <h3 className="admin-console-title text-base font-semibold">排除明细</h3>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  {overview.sourceCoveragePanel.exclusions.map((exclusion) => (
                    <div
                      key={`${exclusion.sourceId}-${exclusion.reason}`}
                      className="rounded-md border border-slate-400/10 p-3"
                    >
                      <div className="admin-console-title text-sm font-semibold">
                        {exclusion.sourceId} · {exclusion.reason}
                      </div>
                      <div className="admin-console-muted mt-2 text-xs">
                        {exclusion.rowCount.toLocaleString()} 行 · {exclusion.affectedUsers.toLocaleString()} 名用户 · 样本 {exclusion.sampleSourceReference ?? '-'}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {activeTab === 'sessions' && overview.sessionQualityPanel && (
          <section className="admin-console-surface space-y-4">
            <div className="flex items-center gap-3">
              <span className="admin-console-icon-badge">
                <Workflow className="h-5 w-5" />
              </span>
              <div>
                <h2 className="admin-console-title text-xl font-semibold">{overview.sessionQualityPanel.title}</h2>
                <p className="admin-console-muted text-sm">
                  使用课堂报告中的集中质量状态，不从零散日志临时推断。
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              {[
                ['绿色', overview.sessionQualityPanel.summary.green],
                ['黄色', overview.sessionQualityPanel.summary.yellow],
                ['红色', overview.sessionQualityPanel.summary.red],
                ['未识别', overview.sessionQualityPanel.summary.unknown],
              ].map(([label, value]) => (
                <div key={label} className="admin-console-surface-soft">
                  <div className="admin-console-muted text-sm">{label}</div>
                  <div className="admin-console-title mt-2 text-2xl font-semibold">{value}</div>
                </div>
              ))}
            </div>
            <div className="admin-console-table-shell p-0">
              <table className="admin-console-table" data-admin-mobile-cards="true" aria-label="课堂质量报告">
                <thead>
                  <tr>
                    <th className="px-4 py-3">课堂</th>
                    <th className="px-4 py-3">质量</th>
                    <th className="px-4 py-3">原因</th>
                    <th className="px-4 py-3">更新时间</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.sessionQualityPanel.rows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center admin-console-table-subtle">
                        暂无课堂质量报告。
                      </td>
                    </tr>
                  ) : (
                    overview.sessionQualityPanel.rows.map((report) => (
                      <tr key={report.sessionId}>
                        <td className="px-4 py-3" data-label="课堂">
                          <div className="admin-console-title font-medium">{report.lessonKey ?? report.sessionId}</div>
                          <div className="admin-console-table-subtle text-xs">{report.summary ?? report.sessionId}</div>
                        </td>
                        <td className="px-4 py-3" data-label="质量">
                          <span className="admin-console-chip">{report.qualityStatus}</span>
                        </td>
                        <td className="px-4 py-3 admin-console-table-subtle" data-label="原因">
                          {report.qualityReasons.length > 0 ? report.qualityReasons.join(' / ') : '-'}
                        </td>
                        <td className="px-4 py-3 admin-console-table-subtle" data-label="更新时间">
                          {new Date(report.updatedAt).toLocaleString('zh-CN')}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {activeTab === 'cache' && overview.cachePanel && (
          <section className="admin-console-surface space-y-4">
            <div className="flex items-center gap-3">
              <span className="admin-console-icon-badge">
                <Database className="h-5 w-5" />
              </span>
              <div>
                <h2 className="admin-console-title text-xl font-semibold">{overview.cachePanel.title}</h2>
                <p className="admin-console-muted text-sm">
                  查看学生证据特征缓存是否 stale、是否持续重建，以及各来源覆盖状态。
                </p>
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <div className="admin-console-surface-soft">
                <div className="admin-console-muted text-sm">缓存条目</div>
                <div className="admin-console-title mt-2 text-2xl font-semibold">{overview.cachePanel.totalEntries.toLocaleString()}</div>
              </div>
              <div className="admin-console-surface-soft">
                <div className="admin-console-muted text-sm">待刷新</div>
                <div className="admin-console-title mt-2 text-2xl font-semibold">{overview.cachePanel.staleEntries.toLocaleString()}</div>
              </div>
              <div className="admin-console-surface-soft">
                <div className="admin-console-muted text-sm">源事实</div>
                <div className="admin-console-title mt-2 text-2xl font-semibold">{overview.cachePanel.totalSourceFacts.toLocaleString()}</div>
              </div>
              <div className="admin-console-surface-soft">
                <div className="admin-console-muted text-sm">重建次数</div>
                <div className="admin-console-title mt-2 text-2xl font-semibold">{overview.cachePanel.totalRebuilds.toLocaleString()}</div>
              </div>
            </div>
            <div className="admin-console-surface-soft">
              <div className="admin-console-muted text-sm">最近刷新</div>
              <div className="admin-console-title mt-2 text-base font-semibold">
                {overview.cachePanel.latestRefreshAt
                  ? new Date(overview.cachePanel.latestRefreshAt).toLocaleString('zh-CN')
                  : '暂无刷新记录'}
              </div>
              <div className="admin-console-muted mt-2 text-xs">版本 {overview.cachePanel.payloadVersion}</div>
            </div>
            <div className="grid gap-3 md:grid-cols-3">
              {Object.entries(overview.cachePanel.coverage).map(([source, counts]) => (
                <div key={source} className="admin-console-surface-soft">
                  <div className="admin-console-title text-sm font-semibold">{source}</div>
                  <div className="admin-console-muted mt-2 text-xs">
                    {Object.entries(counts).map(([state, count]) => `${state}: ${count}`).join(' / ') || '暂无覆盖数据'}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {(activeTab === 'overview' || activeTab === 'risks') && (
          <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="admin-console-surface space-y-4">
            <div className="flex items-center gap-3">
              <span className="admin-console-icon-badge">
                <ShieldAlert className="h-5 w-5" />
              </span>
              <div>
                <h2 className="admin-console-title text-xl font-semibold">{overview.riskPanel.title}</h2>
                <p className="admin-console-muted text-sm">
                  风险行现在包含证据入口、负责人、处置状态和审计记录，避免停留在只读列表。
                </p>
              </div>
            </div>
            <div className="admin-console-table-shell p-0">
              <table
                className="admin-console-table"
                data-admin-mobile-cards="true"
                data-admin-risk-governance-table
                aria-label="治理风险对象化工作流"
              >
                <thead>
                  <tr>
                    <th className="px-4 py-3">风险对象</th>
                    <th className="px-4 py-3">证据</th>
                    <th className="px-4 py-3">负责人</th>
                    <th className="px-4 py-3">级别</th>
                    <th className="px-4 py-3">审计</th>
                    <th className="px-4 py-3 text-right">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.riskPanel.rows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center admin-console-table-subtle">
                        当前没有未解决风险。
                      </td>
                    </tr>
                  ) : (
                    overview.riskPanel.rows.map((risk) => (
                      <tr
                        key={risk.id}
                        data-admin-risk-governance-row={risk.id}
                        data-admin-risk-governance-disposition={risk.dispositionStatus ?? (risk.isResolved ? 'resolved' : 'open')}
                      >
                        <td className="px-4 py-3" data-label="风险对象">
                          <div className="admin-console-title font-medium">{risk.safeLabel ?? `${risk.userName} · ${risk.flagLabel}`}</div>
                          <div className="admin-console-table-subtle text-xs">{risk.affectedObjectLabel ?? `student:${risk.userId}`}</div>
                          <div className="admin-console-table-subtle mt-1 text-xs">{risk.description}</div>
                          <div className="admin-console-table-subtle mt-1 text-xs">
                            触发：{new Date(risk.triggeredAt).toLocaleString('zh-CN')}
                          </div>
                        </td>
                        <td className="px-4 py-3" data-label="证据">
                          <a
                            href={risk.evidenceHref ?? `/admin/data-governance?tab=risks&riskId=${encodeURIComponent(risk.id)}&action=evidence`}
                            className="admin-console-button px-3 py-1.5 text-xs"
                            data-admin-risk-governance-evidence={risk.id}
                            data-admin-risk-governance-evidence-state={risk.auditTrail && risk.auditTrail.length > 0 ? 'available' : 'unavailable'}
                            aria-label={`查看治理风险证据 ${risk.flagLabel} ${risk.userName}`}
                          >
                            查看证据
                          </a>
                          <div className="admin-console-table-subtle mt-2 text-xs">
                            {risk.auditTrail && risk.auditTrail.length > 0
                              ? '治理动作可通过审计链回溯。'
                              : '暂无附加证据记录，请按风险来源复核。'}
                          </div>
                          <div className="admin-console-table-subtle mt-2 text-xs break-all">{risk.id}</div>
                        </td>
                        <td className="px-4 py-3" data-label="负责人">
                          <span
                            className="admin-console-chip"
                            data-admin-risk-governance-assignment={risk.currentAssignee ?? 'unassigned'}
                          >
                            {risk.currentAssignee ?? '未分派'}
                          </span>
                        </td>
                        <td className="px-4 py-3" data-label="级别">
                          <span className="admin-console-chip">{risk.severityLabel}</span>
                        </td>
                        <td className="px-4 py-3" data-label="审计">
                          <details data-admin-risk-governance-audit={risk.id}>
                            <summary className="cursor-pointer admin-console-title text-sm">
                              {risk.auditTrail?.length ?? 0} 条记录
                            </summary>
                            <div className="mt-2 space-y-1 admin-console-table-subtle text-xs">
                              {risk.auditTrail && risk.auditTrail.length > 0 ? (
                                risk.auditTrail.slice(-3).map((record) => (
                                  <div key={`${record.action}-${record.recordedAt}`}>
                                    {record.action} · {record.previousState ?? '-'} → {record.newState ?? record.outcome} · {compactAdminIdentifier(record.actorId)}
                                  </div>
                                ))
                              ) : (
                                <div>暂无审计记录。</div>
                              )}
                            </div>
                          </details>
                        </td>
                        <td className="px-4 py-3" data-label="操作">
                          <div className="flex flex-wrap justify-end gap-2">
                            {risk.isResolved ? (
                              <>
                                <button
                                  type="button"
                                  onClick={() => executeGovernanceAction({ action: 'reopen', riskId: risk.id })}
                                  className="admin-console-button px-3 py-1.5 text-xs"
                                  data-admin-risk-governance-disposition-action="reopen"
                                  aria-label={`重开治理风险 ${risk.flagLabel} ${risk.userName}`}
                                >
                                  重开
                                </button>
                                {risk.undoAvailable ? (
                                  <button
                                    type="button"
                                    onClick={() => executeGovernanceAction({ action: 'undo', riskId: risk.id })}
                                    className="admin-console-button px-3 py-1.5 text-xs"
                                    data-admin-risk-governance-disposition-action="undo"
                                    aria-label={`撤销治理风险处置 ${risk.flagLabel} ${risk.userName}`}
                                  >
                                    撤销
                                  </button>
                                ) : null}
                              </>
                            ) : (
                              <>
                                <button
                                  type="button"
                                  onClick={() => executeGovernanceAction({ action: 'resolve', riskId: risk.id })}
                                  className="admin-console-button px-3 py-1.5 text-xs"
                                  data-admin-risk-governance-disposition-action="resolve"
                                  aria-label={`处置治理风险 ${risk.flagLabel} ${risk.userName}`}
                                >
                                  处置
                                </button>
                                <button
                                  type="button"
                                  onClick={() => executeGovernanceAction({ action: 'ignore', riskId: risk.id })}
                                  className="admin-console-button px-3 py-1.5 text-xs"
                                  data-admin-risk-governance-disposition-action="ignore"
                                  aria-label={`忽略治理风险 ${risk.flagLabel} ${risk.userName}`}
                                >
                                  忽略
                                </button>
                                <button
                                  type="button"
                                  onClick={() => executeGovernanceAction({ action: 'assign', riskId: risk.id, assignee: currentUser.id })}
                                  className="admin-console-button px-3 py-1.5 text-xs"
                                  data-admin-risk-governance-disposition-action="assign"
                                  aria-label={`分派治理风险 ${risk.flagLabel} ${risk.userName}`}
                                >
                                  分派
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="space-y-6">
            <div className="admin-console-surface">
              <div className="flex items-center gap-3">
                <span className="admin-console-icon-badge">
                  <Database className="h-5 w-5" />
                </span>
                <div>
                  <h2 className="admin-console-title text-xl font-semibold">{overview.snapshotPanel.title}</h2>
                  <p className="admin-console-muted text-sm">
                    按最近生成时间查看快照，并识别当前事实量最高的学生。
                  </p>
                </div>
              </div>
              <div className="mt-5 space-y-3">
                {overview.snapshotPanel.rows.map((snapshot) => (
                  <div key={`${snapshot.userId}-${snapshot.snapshotAt}`} className="admin-console-surface-soft">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="admin-console-title text-sm font-semibold">{snapshot.userName}</p>
                        <p className="admin-console-muted mt-1 text-xs">{snapshot.userId}</p>
                      </div>
                      <div className="text-right">
                        <p className="admin-console-title text-lg font-semibold">{snapshot.factCount}</p>
                        <p className="admin-console-muted mt-1 text-xs">事实数</p>
                      </div>
                    </div>
                    <p className="admin-console-muted mt-3 text-xs">
                      快照时间：{new Date(snapshot.snapshotAt).toLocaleString('zh-CN')}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="admin-console-surface">
              <h2 className="admin-console-title text-xl font-semibold">快照高值关注</h2>
              <p className="admin-console-muted mt-2 text-sm">
                这些学生当前快照内的事实覆盖较多，适合进一步核对是否存在风险和成长信号。
              </p>
              <div className="mt-5 space-y-3">
                {overview.snapshotPanel.highlights.length === 0 ? (
                  <div className="admin-console-surface-soft admin-console-muted text-sm">
                    暂无高值快照样本。
                  </div>
                ) : (
                  overview.snapshotPanel.highlights.map((item) => (
                    <div
                      key={`${item.userId}-${item.snapshotAt}`}
                      className="admin-console-surface-soft flex items-center justify-between gap-4"
                    >
                      <div>
                        <p className="admin-console-title text-sm font-semibold">{item.userName}</p>
                        <p className="admin-console-muted mt-1 text-xs">
                          {new Date(item.snapshotAt).toLocaleString('zh-CN')}
                        </p>
                      </div>
                      <div className="admin-console-title text-2xl font-semibold">{item.factCount}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </section>
        )}
      </main>
    </div>
  );
}

export function resolveGovernanceRouteRiskActionTarget(
  status: Pick<GovernanceStatusPayload, 'recentRiskFlags' | 'targetRiskFlag'>,
  riskId: string | null | undefined,
) {
  const targetId = riskId?.trim();
  if (!targetId) return null;
  if (status.targetRiskFlag?.id === targetId) {
    return status.targetRiskFlag;
  }
  return status.recentRiskFlags.find((risk) => risk.id === targetId) ?? null;
}

function isDashboardRiskAction(value: string | null | undefined): value is GovernanceRiskAction {
  return value === 'resolve'
    || value === 'assign'
    || value === 'ignore'
    || value === 'reopen'
    || value === 'undo';
}
