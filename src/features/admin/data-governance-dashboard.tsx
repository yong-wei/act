'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  Database,
  RefreshCw,
  ShieldAlert,
  Workflow,
} from 'lucide-react';

import {
  buildGovernanceOverview,
  type GovernanceStatusPayload,
} from '@/features/admin/data-governance-overview';
import { AdminConsoleHeader } from './admin-console-header';
import type { AdminConsoleUser } from './admin-console-config';

type DataGovernanceDashboardProps = {
  currentUser: AdminConsoleUser;
};

export function DataGovernanceDashboard({ currentUser }: DataGovernanceDashboardProps) {
  const [status, setStatus] = useState<GovernanceStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/admin/data-governance/status', {
        cache: 'no-store',
      });
      if (!response.ok) {
        throw new Error('获取数据治理状态失败');
      }
      const data = (await response.json()) as GovernanceStatusPayload;
      setStatus(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '获取数据治理状态失败');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatus();
    const interval = setInterval(fetchStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const overview = useMemo(() => {
    if (!status) {
      return null;
    }
    return buildGovernanceOverview(status);
  }, [status]);

  if (loading && !status) {
    return (
      <div className="admin-console-shell">
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
      <div className="admin-console-shell">
        <AdminConsoleHeader
          currentUser={currentUser}
          currentHref="/admin/data-governance"
          backHref="/admin"
          eyebrow="治理看板"
          title="数据治理"
          description="这里不只展示总量，而是直接展开风险、事实与快照的下层内容，帮助管理员判断治理链路到底卡在队列、快照还是风险处置。"
        />
        <main className="admin-console-container py-8">
          <div className="admin-console-notice admin-console-notice-danger flex items-start gap-3">
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
    <div className="admin-console-shell">
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
          <button
            onClick={fetchStatus}
            className="admin-console-button-primary"
            disabled={loading}
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            刷新状态
          </button>
        }
      />

      <main className="admin-console-container space-y-6 py-8">
        {error && (
          <div className="admin-console-notice admin-console-notice-danger">
            {error}
          </div>
        )}

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

        <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div className="admin-console-surface space-y-4">
            <div className="flex items-center gap-3">
              <span className="admin-console-icon-badge">
                <ShieldAlert className="h-5 w-5" />
              </span>
              <div>
                <h2 className="admin-console-title text-xl font-semibold">{overview.riskPanel.title}</h2>
                <p className="admin-console-muted text-sm">
                  最近触发的未解决风险按严重级别展开，方便直接查看“谁、何时、为什么被标记”。
                </p>
              </div>
            </div>
            <div className="admin-console-table-shell p-0">
              <table className="admin-console-table">
                <thead>
                  <tr>
                    <th className="px-4 py-3">学生</th>
                    <th className="px-4 py-3">风险类型</th>
                    <th className="px-4 py-3">级别</th>
                    <th className="px-4 py-3">触发时间</th>
                    <th className="px-4 py-3">说明</th>
                  </tr>
                </thead>
                <tbody>
                  {overview.riskPanel.rows.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center admin-console-table-subtle">
                        当前没有未解决风险。
                      </td>
                    </tr>
                  ) : (
                    overview.riskPanel.rows.map((risk) => (
                      <tr key={risk.id}>
                        <td className="px-4 py-3">
                          <div className="admin-console-title font-medium">{risk.userName}</div>
                          <div className="admin-console-table-subtle text-xs">{risk.userId}</div>
                        </td>
                        <td className="px-4 py-3">{risk.flagLabel}</td>
                        <td className="px-4 py-3">
                          <span className="admin-console-chip">{risk.severityLabel}</span>
                        </td>
                        <td className="px-4 py-3 admin-console-table-subtle">
                          {new Date(risk.triggeredAt).toLocaleString('zh-CN')}
                        </td>
                        <td className="px-4 py-3 admin-console-table-subtle">{risk.description}</td>
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
      </main>
    </div>
  );
}
