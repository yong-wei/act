'use client';

import Link from 'next/link';
import { ExternalLink, FileCheck2, Printer, ShieldCheck } from 'lucide-react';
import { useMemo, useState } from 'react';

import type { DiagnosisDeliveryAction } from '@/lib/diagnosis-report-delivery';
import type { DiagnosisDeliveryProjection } from '@/lib/diagnosis-report-delivery-projection';

type DeliveryEvent = {
  id: string;
  targetKind: string;
  targetKey: string;
  action: string;
  actionRef: string | null;
  result: string;
  createdAt: string;
};

export function DiagnosisReportDeliveryView({
  projection,
  actions,
  dispositionEvents: initialEvents,
  dispositionHref,
  returnHref,
  teacherMode,
}: {
  projection: DiagnosisDeliveryProjection;
  actions: DiagnosisDeliveryAction[];
  dispositionEvents: DeliveryEvent[];
  dispositionHref?: string;
  returnHref: string;
  teacherMode: boolean;
}) {
  const [events, setEvents] = useState(initialEvents);
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const latestByTarget = useMemo(
    () => new Map([...events].reverse().map((event) => [event.targetKey, event])),
    [events],
  );

  const record = async (targetKind: 'report' | 'finding', targetKey: string, action: string, actionRef?: string) => {
    if (!dispositionHref) return;
    setSubmitting(`${targetKey}:${action}`);
    setMessage(null);
    try {
      const response = await fetch(dispositionHref, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetKind,
          targetKey,
          action,
          actionRef: actionRef ?? null,
          idempotencyKey: crypto.randomUUID(),
        }),
      });
      const payload = await response.json() as { event?: DeliveryEvent; error?: string };
      if (!response.ok || !payload.event) throw new Error(payload.error || '处置记录失败');
      setEvents((current) => [payload.event!, ...current]);
      setMessage('处置状态已记录；诊断风险判断保持不变。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '处置记录失败，请重试。');
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div
      className="min-h-screen bg-background text-foreground"
      data-diagnosis-delivery-role={projection.role}
      data-diagnosis-delivery-report={projection.reportId}
    >
      <header className="border-b border-border bg-card/90 px-4 py-4 print:hidden sm:px-8">
        <div className="mx-auto flex max-w-5xl flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Link href={returnHref} className="text-sm text-subtle hover:text-foreground">返回报告历史</Link>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => window.print()} className="btn-ghost-themed inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm">
              <Printer className="h-4 w-4" />打印
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-8 print:max-w-none print:px-0 print:py-0">
        <article className="overflow-hidden rounded-2xl border border-border bg-card print:rounded-none print:border-0">
          <div className="border-b border-border bg-sky-500/5 p-6 sm:p-8">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-600">固定治理报告</p>
                <h1 className="mt-2 text-2xl font-bold sm:text-3xl">{projection.title}</h1>
                <p className="mt-3 max-w-3xl text-sm leading-6 text-subtle">{projection.privacyNotice}</p>
              </div>
              <ShieldCheck className="h-9 w-9 flex-none text-sky-600" />
            </div>
            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-3">
              <Meta label="证据截止" value={formatDate(projection.evidenceCutoff)} />
              <Meta label="报告生成" value={formatDate(projection.generatedAt)} />
              <Meta label="版本" value={`${projection.generatorVersion} / ${projection.roleVersion}`} />
            </dl>
          </div>

          <div className="space-y-8 p-6 sm:p-8">
            <section>
              <h2 className="text-lg font-semibold">诊断摘要</h2>
              <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-subtle">{projection.summary}</p>
            </section>

            <section>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-lg font-semibold">主要结论</h2>
                <span className="rounded-full border border-border px-3 py-1 text-xs text-subtle">{confidenceLabel(projection.confidence)}</span>
              </div>
              <div className="mt-4 space-y-4">
                {projection.findings.length === 0 ? (
                  <p className="rounded-xl border border-dashed border-border p-4 text-sm text-subtle">当前固定报告没有结构化主要结论。</p>
                ) : projection.findings.map((finding, index) => {
                  const findingActions = actions.filter((action) => action.targetKey === finding.targetKey);
                  const latest = latestByTarget.get(finding.targetKey);
                  return (
                    <section key={finding.targetKey} className="rounded-xl border border-border p-4 sm:p-5" data-diagnosis-finding={finding.targetKey}>
                      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-xs font-medium text-subtle">结论 {index + 1}</p>
                          <h3 className="mt-1 font-semibold">{finding.title}</h3>
                        </div>
                        {finding.severity ? <span className="text-xs text-amber-700">风险等级：{severityLabel(finding.severity)}</span> : null}
                      </div>
                      {finding.summary ? <p className="mt-3 text-sm leading-6 text-subtle">{finding.summary}</p> : null}
                      <details className="mt-4 rounded-lg bg-muted/20 p-3">
                        <summary className="cursor-pointer text-sm font-medium">查看允许的证据摘要</summary>
                        {finding.evidence.state === 'available' ? (
                          <ul className="mt-3 space-y-1 text-sm text-subtle">
                            {finding.evidence.sources.map((source) => <li key={source.kind}>{source.label}：{source.count} 项</li>)}
                          </ul>
                        ) : <p className="mt-3 text-sm text-subtle">{finding.evidence.limitation}</p>}
                      </details>
                      {teacherMode ? (
                        <div className="mt-4 border-t border-border pt-4 print:hidden">
                          <p className="text-xs text-subtle">当前处置：{latest ? dispositionLabel(latest.action) : '尚未记录'}。处置不会清除风险。</p>
                          <div className="mt-3 flex flex-wrap gap-2">
                            <DispositionButton label="待处理" busy={submitting === `${finding.targetKey}:pending`} onClick={() => record('finding', finding.targetKey, 'pending')} />
                            <DispositionButton label="已完成处置" busy={submitting === `${finding.targetKey}:completed`} onClick={() => record('finding', finding.targetKey, 'completed')} />
                            {findingActions.map((action) => (
                              <span key={`${action.kind}:${action.href}`} className="inline-flex flex-wrap gap-1">
                                <Link href={action.href} className="btn-ghost-themed inline-flex items-center gap-1 rounded-lg px-3 py-2 text-xs">
                                  {action.label}<ExternalLink className="h-3 w-3" />
                                </Link>
                                {action.kind === 'remediation' ? (
                                  <DispositionButton
                                    label="标记已安排干预"
                                    busy={submitting === `${finding.targetKey}:intervention-arranged`}
                                    onClick={() => record('finding', finding.targetKey, 'intervention-arranged', action.href)}
                                  />
                                ) : null}
                              </span>
                            ))}
                            {!findingActions.some((action) => action.kind === 'remediation') ? (
                              <span className="px-1 py-2 text-xs text-subtle">暂无已注册补练资源</span>
                            ) : null}
                          </div>
                        </div>
                      ) : null}
                    </section>
                  );
                })}
              </div>
            </section>

            <section>
              <h2 className="text-lg font-semibold">学习建议</h2>
              <ul className="mt-3 space-y-2 text-sm leading-6 text-subtle">
                {projection.suggestions.map((suggestion) => <li key={`${suggestion.targetKey}:${suggestion.text}`}>• {suggestion.text}</li>)}
              </ul>
            </section>

            <section>
              <h2 className="text-lg font-semibold">报告限制</h2>
              {projection.limitations.length > 0 ? (
                <ul className="mt-3 space-y-2 text-sm leading-6 text-subtle">
                  {projection.limitations.map((limitation) => <li key={limitation}>• {limitation}</li>)}
                </ul>
              ) : <p className="mt-3 text-sm text-subtle">当前报告未声明额外限制。</p>}
            </section>

            {teacherMode ? (
              <section className="rounded-xl border border-border bg-muted/10 p-4 print:hidden">
                <div className="flex items-center gap-2"><FileCheck2 className="h-5 w-5 text-sky-600" /><h2 className="font-semibold">报告处置</h2></div>
                <p className="mt-2 text-sm text-subtle">记录教师处理进度，不修改报告、成绩、画像、趋势或风险。</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <DispositionButton label="已查看" busy={submitting === 'report:viewed'} onClick={() => record('report', 'report', 'viewed')} />
                  <DispositionButton label="待处理" busy={submitting === 'report:pending'} onClick={() => record('report', 'report', 'pending')} />
                  <DispositionButton label="已完成处置" busy={submitting === 'report:completed'} onClick={() => record('report', 'report', 'completed')} />
                  {actions.filter((action) => action.targetKey === 'report').map((action) => (
                    <Link key={action.href} href={action.href} className="btn-ghost-themed rounded-lg px-3 py-2 text-xs">{action.label}</Link>
                  ))}
                </div>
                {message ? <p className="mt-3 text-sm" role="status">{message}</p> : null}
              </section>
            ) : null}
          </div>

          <footer className="border-t border-border px-6 py-4 text-xs text-subtle sm:px-8">
            报告版本：{projection.reportId} · {projection.projectionVersion} · {projection.roleVersion}
          </footer>
        </article>
      </main>
    </div>
  );
}

function Meta({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-subtle">{label}</dt><dd className="mt-1 font-medium">{value}</dd></div>;
}

function DispositionButton({ label, busy, onClick }: { label: string; busy: boolean; onClick: () => void }) {
  return <button type="button" disabled={busy} onClick={onClick} className="btn-ghost-themed rounded-lg px-3 py-2 text-xs disabled:opacity-50">{busy ? '记录中…' : label}</button>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat('zh-CN', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Asia/Shanghai' }).format(new Date(value));
}

function severityLabel(value: string) {
  return ({ low: '低', medium: '中', high: '高' } as Record<string, string>)[value] ?? '未提供';
}

function confidenceLabel(value: string) {
  return ({ high: '高置信度', medium: '中置信度', low: '低置信度', unavailable: '置信度不可用' } as Record<string, string>)[value] ?? '置信度不可用';
}

function dispositionLabel(value: string) {
  return ({ viewed: '已查看', pending: '待处理', 'intervention-arranged': '已安排干预', completed: '已完成处置' } as Record<string, string>)[value] ?? value;
}
