'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';

type PublicationState = {
  sourceRevisionId: string;
  receipts: { static: boolean; browser: boolean };
  pendingGaps: Array<{ scope: 'GOAL' | 'MODULE'; targetId: string; gapIdentity: string; sourceState: string; acknowledged: boolean }>;
  stalePlan: null | { baselineRevisionNumber: number; newestPlanRevisionId: string; newestRevisionNumber: number; acknowledged: boolean };
  publication: null | { id: string; revisionNumber: number; displayName: string; manifestHash: string; publishedAt: string };
};

export function SmartCoursewarePublicationPanel({ sourceRevisionId }: { sourceRevisionId: string }) {
  const [state, setState] = useState<PublicationState | null>(null);
  const [reasons, setReasons] = useState<Record<string, string>>({});
  const [busyAction, setBusyAction] = useState<string | null>('load');
  const [message, setMessage] = useState('');
  const endpoint = `/api/teacher/smart-courseware/revisions/${encodeURIComponent(sourceRevisionId)}/publication`;

  useEffect(() => {
    let active = true;
    void fetch(endpoint, { cache: 'no-store' }).then(async (response) => {
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.code ?? 'publication-state-unavailable');
      if (active) setState(payload.publication);
    }).catch((error) => active && setMessage(error instanceof Error ? error.message : 'publication-state-unavailable'))
      .finally(() => active && setBusyAction(null));
    return () => { active = false; };
  }, [endpoint]);

  const ready = useMemo(() => Boolean(state && state.receipts.static && state.receipts.browser
    && state.pendingGaps.every((gap) => gap.acknowledged)
    && (!state.stalePlan || state.stalePlan.acknowledged)), [state]);

  async function act(action: Record<string, unknown>, key: string) {
    setBusyAction(key);
    setMessage('');
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(action) });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload?.error?.code ?? 'publication-action-failed');
      setState(payload.publication);
      setMessage(action.action === 'publish' ? '互动课件已发布并进入课程目录。' : '发布证据已更新。');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'publication-action-failed');
    } finally {
      setBusyAction(null);
    }
  }

  return <section className="rounded-xl border border-border bg-background p-4 sm:p-5" data-courseware-publication data-publication-theme-surface="adaptive" aria-labelledby="courseware-publication-heading">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div><p className="text-xs font-medium text-primary">发布到课堂</p><h2 id="courseware-publication-heading" className="mt-1 text-lg font-semibold">确定性发布检查</h2><p className="mt-1 break-all text-sm text-subtle">批准版本 {sourceRevisionId}</p></div>
      {state?.publication
        ? <span className="max-w-full rounded-full bg-emerald-500/10 px-3 py-1 text-sm text-emerald-700 dark:text-emerald-300" data-publication-state="published">{state.publication.displayName}</span>
        : <span className="rounded-full bg-muted px-3 py-1 text-sm text-subtle" data-publication-state="draft">尚未发布</span>}
    </div>
    {message ? <p className="mt-3 break-words rounded-lg bg-muted px-3 py-2 text-sm" role="status">{message}</p> : null}
    {!state ? <p className="mt-4 text-sm text-subtle">{busyAction === 'load' ? '正在读取发布状态…' : '发布状态不可用。'}</p> : <div className="mt-4 space-y-4">
      <div className="grid gap-3 sm:grid-cols-2" data-publication-validation-state>
        <EvidenceCard title="静态校验" passed={state.receipts.static}><button type="button" disabled={Boolean(busyAction) || state.publication !== null} onClick={() => void act({ action: 'validate-static' }, 'static')} className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">{busyAction === 'static' ? '校验中…' : '运行静态校验'}</button></EvidenceCard>
        <EvidenceCard title="固定浏览器校验" passed={state.receipts.browser}><button type="button" disabled={Boolean(busyAction) || state.publication !== null} onClick={() => void act({ action: 'validate-browser' }, 'browser')} className="rounded bg-primary px-3 py-2 text-sm text-primary-foreground disabled:opacity-50">{busyAction === 'browser' ? '校验中…' : '运行浏览器校验'}</button></EvidenceCard>
      </div>
      {state.pendingGaps.length ? <div className="space-y-3" data-publication-gap-list><h3 className="font-medium">来源待补项逐项确认</h3>{state.pendingGaps.map((gap) => {
        const key = `${gap.scope}:${gap.gapIdentity}`;
        return <div key={key} className="min-w-0 rounded-lg border border-border p-3" data-publication-gap={gap.scope.toLowerCase()}><p className="break-all text-sm font-medium">{gap.scope === 'GOAL' ? '教学目标' : '课件模块'} · {gap.targetId}</p><p className="mt-1 text-xs text-subtle">{gap.sourceState}</p>{gap.acknowledged ? <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">已由当前教师确认</p> : <div className="mt-2 flex flex-col gap-2 sm:flex-row"><input aria-label={`${gap.targetId} 确认理由`} value={reasons[key] ?? ''} onChange={(event) => setReasons((current) => ({ ...current, [key]: event.target.value }))} className="min-w-0 flex-1 rounded border border-border bg-background px-3 py-2 text-sm" placeholder="填写该待补项仍可发布的理由" /><button type="button" disabled={Boolean(busyAction) || !(reasons[key] ?? '').trim()} onClick={() => void act({ action: 'acknowledge-gap', scope: gap.scope, targetId: gap.targetId, gapIdentity: gap.gapIdentity, reason: reasons[key] }, key)} className="shrink-0 rounded border border-border px-3 py-2 text-sm disabled:opacity-50">逐项确认</button></div>}</div>;
      })}</div> : <p className="text-sm text-emerald-700 dark:text-emerald-300" data-publication-gaps="resolved">没有未解决的来源待补项。</p>}
      {state.stalePlan ? <div className="rounded-lg border border-amber-500/40 p-3" data-publication-stale-plan><p className="text-sm">当前课件基于教案第 {state.stalePlan.baselineRevisionNumber} 版，最新为第 {state.stalePlan.newestRevisionNumber} 版。</p>{state.stalePlan.acknowledged ? <p className="mt-2 text-sm text-emerald-700 dark:text-emerald-300">版本差异已确认</p> : <div className="mt-2 flex flex-col gap-2 sm:flex-row"><input aria-label="旧教案基线确认理由" value={reasons.stale ?? ''} onChange={(event) => setReasons((current) => ({ ...current, stale: event.target.value }))} className="min-w-0 flex-1 rounded border border-border bg-background px-3 py-2 text-sm" placeholder="填写仍使用旧教案版本的理由" /><button type="button" disabled={Boolean(busyAction) || !(reasons.stale ?? '').trim()} onClick={() => void act({ action: 'acknowledge-stale-plan', newestPlanRevisionId: state.stalePlan!.newestPlanRevisionId, reason: reasons.stale }, 'stale')} className="shrink-0 rounded border border-border px-3 py-2 text-sm disabled:opacity-50">确认版本差异</button></div>}</div> : null}
      <button type="button" disabled={Boolean(busyAction) || !ready || state.publication !== null} onClick={() => void act({ action: 'publish', idempotencyKey: `courseware-publish:${sourceRevisionId}:${crypto.randomUUID()}` }, 'publish')} className="w-full rounded bg-primary px-4 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50 sm:w-auto" data-publication-submit>{state.publication ? '已发布' : busyAction === 'publish' ? '正在发布…' : '发布到课程目录'}</button>
    </div>}
  </section>;
}

function EvidenceCard({ title, passed, children }: { title: string; passed: boolean; children: ReactNode }) {
  return <div className="flex min-w-0 items-center justify-between gap-3 rounded-lg border border-border p-3"><div><p className="text-sm font-medium">{title}</p><p className={`text-xs ${passed ? 'text-emerald-700 dark:text-emerald-300' : 'text-subtle'}`}>{passed ? '已通过' : '待运行'}</p></div>{children}</div>;
}
