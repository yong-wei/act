'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { AlertCircle, ArrowLeft, CheckCircle2, RefreshCw, Send } from 'lucide-react';

type LoadState = 'loading' | 'ready' | 'error';
type ReviewCriterion = { criterionId?: string; score?: number | null; comment?: string | null };
type ReviewAnnotation = { id?: string; comment?: string | null; status?: string | null; anchor?: { precision?: string | null } | null };
type QuestionProjection = { questionId?: string; snapshotItemId?: string; approvalSnapshotId?: string | null; status?: string; score?: number | null; comment?: string | null; criteria?: ReviewCriterion[]; annotations?: ReviewAnnotation[]; failureReason?: string | null };
type ConclusionDraft = { kind: 'UNANSWERED' | 'EXEMPT'; scoreEffect: string; reason: string };
type ReturnDraft = { reason: string; deadlineAt: string };
type GradePayload = {
  grade?: { version?: number; state?: string; totalScore?: number | null; overallComment?: string | null; questionProjection?: unknown[] };
  questions?: Array<{ snapshotItemId?: string; questionId?: string; promptSnapshot?: unknown; approvalHistory?: Array<{ id?: string; source?: string; questionTotal?: number; overallComment?: string; reviewedPdfId?: string | null }> }>;
};

export function TeacherAssignmentGradeWorkspace({ assignmentId, submissionId, snapshotId, initialConfirmationId }: { assignmentId: string; submissionId: string; snapshotId: string; initialConfirmationId: string | null }) {
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [payload, setPayload] = useState<GradePayload | null>(null);
  const [confirmationId, setConfirmationId] = useState(initialConfirmationId);
  const [busy, setBusy] = useState<string | null>(null);
  const [conclusions, setConclusions] = useState<Record<string, ConclusionDraft>>({});
  const [returns, setReturns] = useState<Record<string, ReturnDraft>>({});
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; message: string } | null>(null);
  const endpoint = `/api/teacher/assignments/${encodeURIComponent(assignmentId)}/submissions/${encodeURIComponent(submissionId)}/grade`;
  const load = useCallback(async () => {
    if (!snapshotId) { setLoadState('error'); setNotice({ kind: 'error', message: '缺少作业批改快照。' }); return; }
    setLoadState('loading');
    try {
      const response = await fetch(`${endpoint}?snapshotId=${encodeURIComponent(snapshotId)}`, { cache: 'no-store' });
      const next = await response.json().catch(() => ({})) as GradePayload & { error?: string };
      if (!response.ok) throw new Error(next.error ?? '无法加载作业成绩');
      setPayload(next); setLoadState('ready');
    } catch (error) { setLoadState('error'); setNotice({ kind: 'error', message: error instanceof Error ? error.message : '无法加载作业成绩' }); }
  }, [endpoint, snapshotId]);
  useEffect(() => { void load(); }, [load]);
  async function mutate(action: 'REFRESH' | 'CONFIRM' | 'RELEASE') {
    if (!payload?.grade || !snapshotId) return;
    setBusy(action.toLowerCase()); setNotice(null);
    try {
      const body = action === 'REFRESH' ? { action, snapshotId } : action === 'CONFIRM' ? { action, snapshotId, expectedVersion: payload.grade.version, idempotencyKey: crypto.randomUUID() } : { action, snapshotId, confirmationId, idempotencyKey: crypto.randomUUID() };
      const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
      const result = await response.json().catch(() => ({})) as { confirmation?: { id?: string }; error?: string; details?: { blockers?: Array<{ questionId?: string; reason?: string }> } };
      if (!response.ok) { const blockers = result.details?.blockers?.map((item) => `${item.questionId ?? '题目'}：${item.reason ?? '未完成'}`).join('；'); throw new Error(blockers ? `${result.error ?? '无法完成操作'}：${blockers}` : result.error ?? '无法完成操作'); }
      if (result.confirmation?.id) setConfirmationId(result.confirmation.id);
      setNotice({ kind: 'success', message: action === 'REFRESH' ? '已刷新整份作业的批改聚合。' : action === 'CONFIRM' ? '教师确认已记录，可逐份发布。' : '已向该学生发布结果包。' });
      await load();
    } catch (error) { setNotice({ kind: 'error', message: error instanceof Error ? error.message : '无法完成操作' }); } finally { setBusy(null); }
  }
  async function conclude(snapshotItemId: string) {
    const conclusion = conclusions[snapshotItemId] ?? { kind: 'UNANSWERED' as const, scoreEffect: '0', reason: '' };
    const scoreEffect = Number(conclusion.scoreEffect);
    if (!conclusion.reason.trim() || !Number.isFinite(scoreEffect) || scoreEffect < 0) { setNotice({ kind: 'error', message: '请填写明确结论、分值和原因。' }); return; }
    setBusy(`conclude:${snapshotItemId}`); setNotice(null);
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'CONCLUDE', snapshotId, snapshotItemId, kind: conclusion.kind, scoreEffect, reason: conclusion.reason.trim() }) });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? '无法记录题目结论');
      setNotice({ kind: 'success', message: '已记录题目结论，并刷新整份作业聚合。' }); await load();
    } catch (error) { setNotice({ kind: 'error', message: error instanceof Error ? error.message : '无法记录题目结论' }); } finally { setBusy(null); }
  }
  async function returnQuestion(snapshotItemId: string) {
    const draft = returns[snapshotItemId] ?? { reason: '', deadlineAt: defaultReturnDeadline() };
    const deadline = new Date(draft.deadlineAt);
    if (draft.reason.trim().length < 8 || Number.isNaN(deadline.getTime())) { setNotice({ kind: 'error', message: '请填写不少于 8 个字符的退回原因和新的补交截止时间。' }); return; }
    setBusy(`return:${snapshotItemId}`); setNotice(null);
    try {
      const response = await fetch(endpoint, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ action: 'RETURN', snapshotId, snapshotItemId, reason: draft.reason.trim(), newDeadlineAt: deadline.toISOString(), idempotencyKey: crypto.randomUUID() }) });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? '无法退回该题补交');
      setNotice({ kind: 'success', message: '已退回该题并开放补交；新提交需要重新批改、确认和发布。' }); await load();
    } catch (error) { setNotice({ kind: 'error', message: error instanceof Error ? error.message : '无法退回该题补交' }); } finally { setBusy(null); }
  }
  const grade = payload?.grade;
  const projections = Array.isArray(grade?.questionProjection) ? grade.questionProjection as QuestionProjection[] : [];
  return <main className="surface-page min-h-screen px-4 py-6 md:px-8" data-assignment-submission-grade-workspace="true"><div className="mx-auto max-w-5xl space-y-6">
    <header className="flex flex-col gap-4 border-b border-slate-800 pb-5 md:flex-row md:items-end md:justify-between"><div><Link href={`/teacher/assignments/${encodeURIComponent(assignmentId)}/grading`} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-cyan-300"><ArrowLeft className="h-4 w-4" />返回批改控制台</Link><h1 className="text-2xl font-semibold text-white">整份作业审阅</h1><p className="mt-1 text-sm text-slate-400">先核对逐题结果，再确认并逐份发布给学生。</p></div><div className="flex flex-wrap gap-2"><button type="button" onClick={() => void mutate('REFRESH')} disabled={busy !== null || loadState !== 'ready'} className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-slate-600 px-3 text-sm text-slate-100 disabled:opacity-50"><RefreshCw className="h-4 w-4" />刷新聚合</button>{grade?.state === 'AWAITING_CONFIRMATION' ? <button type="button" onClick={() => void mutate('CONFIRM')} disabled={busy !== null} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-cyan-600 px-3 text-sm font-medium text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />确认结果</button> : null}{grade?.state === 'CONFIRMED' && confirmationId ? <button type="button" onClick={() => void mutate('RELEASE')} disabled={busy !== null} className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white disabled:opacity-50"><Send className="h-4 w-4" />发布给学生</button> : null}</div></header>
    {notice ? <div role={notice.kind === 'error' ? 'alert' : 'status'} className={notice.kind === 'error' ? 'rounded-xl border border-rose-500/40 bg-rose-950/30 p-4 text-sm text-rose-100' : 'rounded-xl border border-emerald-500/35 bg-emerald-950/25 p-4 text-sm text-emerald-100'}>{notice.message}</div> : null}
    {loadState === 'loading' ? <div className="h-48 animate-pulse rounded-xl bg-slate-800" /> : null}
    {loadState === 'error' ? <section role="alert" className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-6 text-rose-100"><AlertCircle className="mb-3 h-6 w-6" /><h2 className="font-semibold">无法加载审阅记录</h2><button type="button" onClick={() => void load()} className="mt-4 inline-flex min-h-10 items-center rounded-lg border border-rose-400 px-3">重试</button></section> : null}
    {loadState === 'ready' && grade ? <><section className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-sm text-slate-400">当前状态</p><p className="mt-1 text-lg font-semibold text-white">{gradeStateLabel(grade.state)}</p></div><p className="rounded-xl bg-cyan-500/10 px-4 py-2 text-lg font-semibold text-cyan-200">{grade.totalScore == null ? '总分待定' : `总分 ${grade.totalScore}`}</p></div>{grade.overallComment ? <div className="mt-4 border-t border-slate-800 pt-4"><p className="text-xs text-slate-500">整份作业总体评价</p><p className="mt-1 whitespace-pre-wrap text-sm leading-6 text-slate-200">{grade.overallComment}</p></div> : null}</section><section className="space-y-4">{payload.questions?.map((question, index) => { const projection = projections.find((item) => item.questionId === question.questionId); const itemId = question.snapshotItemId ?? ''; const conclusion = conclusions[itemId] ?? { kind: 'UNANSWERED' as const, scoreEffect: '0', reason: '' }; const returnDraft = returns[itemId] ?? { reason: '', deadlineAt: defaultReturnDeadline() }; const unresolved = projection?.status !== 'COMPLETE'; const canReturn = itemId && projection?.status === 'COMPLETE' && ['CONFIRMED', 'RELEASED'].includes(grade.state ?? ''); const readyPdf = question.approvalHistory?.find((item) => item.id === projection?.approvalSnapshotId && item.reviewedPdfId); return <article key={itemId || index} className="rounded-xl border border-slate-800 bg-slate-900/60 p-5"><div className="flex flex-wrap items-start justify-between gap-3"><div><h2 className="font-semibold text-white">第 {index + 1} 题</h2><p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-slate-300">{promptText(question.promptSnapshot)}</p></div><span className="rounded-full bg-slate-800 px-3 py-1 text-sm text-slate-200">{projection?.score == null ? projection?.failureReason ? gradeFailureLabel(projection.failureReason) : '待处理' : `${projection.score} 分`}</span></div>{projection?.comment ? <div className="mt-4"><p className="text-xs text-slate-500">本题评价</p><p className="mt-1 whitespace-pre-wrap text-sm text-slate-300">{String(projection.comment)}</p></div> : null}<ReviewDetails criteria={projection?.criteria} annotations={projection?.annotations} />{readyPdf?.id && readyPdf.reviewedPdfId ? <a href={reviewedPdfHref(assignmentId, submissionId, snapshotId, readyPdf.id)} target="_blank" rel="noreferrer" className="mt-4 inline-flex min-h-10 items-center rounded-lg border border-cyan-500/60 px-3 text-sm text-cyan-100 hover:bg-cyan-500/10">查看本题批注 PDF</a> : <p className="mt-4 text-xs text-slate-500">本题批注 PDF 尚未就绪。</p>}{canReturn ? <div className="mt-4 rounded-lg border border-cyan-500/30 bg-cyan-950/20 p-4"><p className="text-sm font-medium text-cyan-100">退回该题补交后，学生的新版本将重新进入批改、确认和发布流程。</p><div className="mt-3 grid gap-3 md:grid-cols-[1fr_13rem_auto]"><input aria-label={`第 ${index + 1} 题补交原因`} value={returnDraft.reason} onChange={(event) => setReturns((current) => ({ ...current, [itemId]: { ...returnDraft, reason: event.target.value } }))} placeholder="请填写退回补交原因" className="min-h-10 rounded-lg border border-slate-600 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-500" /><input aria-label={`第 ${index + 1} 题补交截止时间`} type="datetime-local" value={returnDraft.deadlineAt} onChange={(event) => setReturns((current) => ({ ...current, [itemId]: { ...returnDraft, deadlineAt: event.target.value } }))} className="min-h-10 rounded-lg border border-slate-600 bg-slate-950 px-3 text-sm text-slate-100" /><button type="button" onClick={() => void returnQuestion(itemId)} disabled={busy !== null} className="min-h-10 rounded-lg border border-cyan-400/70 px-3 text-sm text-cyan-100 disabled:opacity-50">退回补交</button></div></div> : null}{unresolved && itemId ? <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-950/20 p-4"><p className="text-sm font-medium text-cyan-100">该题尚未形成可确认评分。可转人工批改，或记录明确结论。</p><div className="mt-3 grid gap-3 md:grid-cols-[auto_9rem_1fr_auto]"><select aria-label={`第 ${index + 1} 题结论类型`} value={conclusion.kind} onChange={(event) => setConclusions((current) => ({ ...current, [itemId]: { ...conclusion, kind: event.target.value as ConclusionDraft['kind'] } }))} className="min-h-10 rounded-lg border border-slate-600 bg-slate-950 px-3 text-sm text-slate-100"><option value="UNANSWERED">未作答</option><option value="EXEMPT">不计分</option></select><input aria-label={`第 ${index + 1} 题结论分值`} type="number" min="0" step="0.1" value={conclusion.scoreEffect} onChange={(event) => setConclusions((current) => ({ ...current, [itemId]: { ...conclusion, scoreEffect: event.target.value } }))} className="min-h-10 rounded-lg border border-slate-600 bg-slate-950 px-3 text-sm text-slate-100" /><input aria-label={`第 ${index + 1} 题结论原因`} value={conclusion.reason} onChange={(event) => setConclusions((current) => ({ ...current, [itemId]: { ...conclusion, reason: event.target.value } }))} placeholder="请填写教师结论依据" className="min-h-10 rounded-lg border border-slate-600 bg-slate-950 px-3 text-sm text-slate-100 placeholder:text-slate-500" /><button type="button" onClick={() => void conclude(itemId)} disabled={busy !== null} className="min-h-10 rounded-lg border border-amber-400/70 px-3 text-sm text-amber-100 disabled:opacity-50">记录结论</button></div></div> : null}</article>; })}</section></> : null}
  </div></main>;
}

function promptText(value: unknown) { if (typeof value === 'string') return value; if (value && typeof value === 'object') { const row = value as Record<string, unknown>; return typeof row.prompt === 'string' ? row.prompt : typeof row.text === 'string' ? row.text : ''; } return ''; }
function ReviewDetails({ criteria, annotations }: { criteria?: ReviewCriterion[]; annotations?: ReviewAnnotation[] }) { const visibleAnnotations = (annotations ?? []).filter((annotation) => annotation.status !== 'SUPPRESSED'); if ((criteria?.length ?? 0) === 0 && visibleAnnotations.length === 0) return null; return <div className="mt-4 space-y-3"><div><p className="text-xs text-slate-500">小题扣分</p>{(criteria?.length ?? 0) > 0 ? <ul className="mt-2 grid gap-2 md:grid-cols-2">{criteria!.map((criterion, index) => <li key={`${criterion.criterionId ?? 'criterion'}-${index}`} className="rounded-lg bg-slate-950/60 p-3 text-sm text-slate-200">评分项 {index + 1}：{criterion.score ?? 0} 分{criterion.comment ? ` · ${criterion.comment}` : ''}</li>)}</ul> : <p className="mt-1 text-sm text-slate-400">无独立评分项。</p>}</div>{visibleAnnotations.length > 0 ? <div><p className="text-xs text-slate-500">结构化批注</p><ul className="mt-2 space-y-2">{visibleAnnotations.map((annotation, index) => <li key={annotation.id ?? index} className="rounded-lg border-l-2 border-cyan-500 bg-slate-950/60 px-3 py-2 text-sm text-slate-200">{annotationPrecisionLabel(annotation.anchor?.precision)}：{annotation.comment || '教师批注'}</li>)}</ul></div> : null}</div>; }
function defaultReturnDeadline() { return new Date(Date.now() + 24 * 60 * 60 * 1_000).toISOString().slice(0, 16); }
function gradeStateLabel(state: string | undefined) { return ({ PENDING_GRADING: '待批改', PARTIAL_FAILURE: '部分失败', AWAITING_CONFIRMATION: '待教师确认', CONFIRMED: '已确认，待发布', RELEASED: '已发布' } as Record<string, string>)[state ?? ''] ?? '待处理'; }
function gradingSourceLabel(source: string | undefined) { return ({ AI: '自动预评分', TEACHER: '教师确认', MANUAL: '人工批改' } as Record<string, string>)[source ?? ''] ?? '已确认结果'; }
function gradingRunStateLabel(state: string | undefined) { return ({ QUEUED: '等待处理', RUNNING: '处理中', AWAITING_REVIEW: '待教师审核', APPROVED: '已审核', BLOCKED: '需人工处理', FAILED: '处理失败', RETRYABLE: '可重试' } as Record<string, string>)[state ?? ''] ?? '状态不可用'; }
function gradeFailureLabel(reason: string | null | undefined) { return ({ 'missing-attempt': '未提交', 'question-failed': '需人工处理', 'question-processing': '处理中', 'question-ungraded': '待批改' } as Record<string, string>)[reason ?? ''] ?? '待处理'; }
function annotationPrecisionLabel(value: string | null | undefined) { return ({ BLOCK: '作答片段', SPAN: '作答片段', PAGE: '页面', DOCUMENT: '作答文档' } as Record<string, string>)[value ?? ''] ?? '相关位置'; }
function reviewedPdfHref(assignmentId: string, submissionId: string, gradeSnapshotId: string, approvalId: string) { return `/api/teacher/assignments/${encodeURIComponent(assignmentId)}/submissions/${encodeURIComponent(submissionId)}/reviews/${encodeURIComponent(approvalId)}/asset?snapshotId=${encodeURIComponent(gradeSnapshotId)}`; }
