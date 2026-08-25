'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, Bot, LoaderCircle, RefreshCw, UserRoundCheck } from 'lucide-react';

type LoadState = 'loading' | 'ready' | 'error';
type SubmissionQuestion = { id: string; title: string; status: string; diagnosticCode?: string; diagnosticMessage?: string; reviewId: string | null; gradingRunId: string | null; batchId: string | null; batchItemId: string | null };
type Submission = { id: string; studentId: string; studentName: string; studentNumber: string | null; state: string; submittedRequiredCount: number; gradingDiagnostic?: { code: string; message: string; canStartAi: boolean }; questions: SubmissionQuestion[]; grading: { snapshotId: string; source: string; state: string; operationState: string | null; confirmationId: string | null; releaseId: string | null } | null };

export function TeacherAssignmentGradingConsole({ assignmentId }: { assignmentId: string }) {
  const router = useRouter();
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ kind: 'error' | 'success'; message: string } | null>(null);
  const load = useCallback(async () => {
    setLoadState('loading');
    try {
      const response = await fetch(`/api/teacher/assignments/${encodeURIComponent(assignmentId)}/submissions`, { cache: 'no-store' });
      if (!response.ok) throw new Error(`assignment-grading-console:${response.status}`);
      const payload = await response.json() as { items?: unknown[] };
      const next = (payload.items ?? []).flatMap(normalizeSubmission);
      setSubmissions(next);
      setSelectedStudentIds((current) => current.length ? current.filter((id) => next.some((item) => item.studentId === id && isAiGradingCandidate(item))) : next.filter(isAiGradingCandidate).map((item) => item.studentId));
      setLoadState('ready');
    } catch { setLoadState('error'); }
  }, [assignmentId]);
  useEffect(() => { void load(); }, [load]);
  const selected = useMemo(() => new Set(selectedStudentIds), [selectedStudentIds]);
  const submitted = useMemo(() => submissions.filter((item) => item.submittedRequiredCount > 0), [submissions]);
  const eligible = useMemo(() => submitted.filter(isAiGradingCandidate), [submitted]);
  const allEligibleSelected = eligible.length > 0 && eligible.every((item) => selected.has(item.studentId));
  const toggleStudent = (studentId: string) => setSelectedStudentIds((current) => current.includes(studentId) ? current.filter((id) => id !== studentId) : [...current, studentId]);
  const toggleAllEligible = () => setSelectedStudentIds((current) => toggleAllAiGradingCandidates(current, eligible.map((item) => item.studentId)));
  async function startAiGrading() {
    if (!selectedStudentIds.length) return;
    setBusy('ai'); setNotice(null);
    try {
      const response = await fetch(`/api/teacher/assignments/${encodeURIComponent(assignmentId)}/grading`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), studentIds: selectedStudentIds }) });
      const payload = await response.json().catch(() => ({})) as { submittedStudentIds?: string[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? '无法启动自动批改');
      setNotice({ kind: 'success', message: `已为 ${payload.submittedStudentIds?.length ?? selectedStudentIds.length} 名学生建立批改批次。` }); await load();
    } catch (error) { setNotice({ kind: 'error', message: gradingErrorMessage(error, '无法启动自动批改') }); } finally { setBusy(null); }
  }
  async function beginManualGrading(submission: Submission, question: SubmissionQuestion) {
    setBusy(`manual:${submission.id}:${question.id}`); setNotice(null);
    try {
      const response = await fetch(`/api/teacher/assignments/${encodeURIComponent(assignmentId)}/grading/manual`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ submissionId: submission.id, questionId: question.id, idempotencyKey: crypto.randomUUID() }) });
      const payload = await response.json().catch(() => ({})) as { review?: { id?: string }; run?: { id?: string }; error?: string };
      if (!response.ok || !payload.review?.id) throw new Error(payload.error ?? '无法创建人工批改');
      const query = new URLSearchParams({ questionId: question.id, mode: 'student', reviewId: payload.review.id }); if (payload.run?.id) query.set('gradingRunId', payload.run.id);
      router.push(`/teacher/assignments/${encodeURIComponent(assignmentId)}/submissions/${encodeURIComponent(submission.id)}/review?${query.toString()}`);
    } catch (error) { setNotice({ kind: 'error', message: gradingErrorMessage(error, '无法创建人工批改') }); setBusy(null); }
  }
  async function beginAiReview(submission: Submission, question: SubmissionQuestion) {
    if (question.reviewId) {
      const query = new URLSearchParams({ questionId: question.id, mode: 'student', reviewId: question.reviewId });
      if (question.gradingRunId) query.set('gradingRunId', question.gradingRunId);
      router.push(`/teacher/assignments/${encodeURIComponent(assignmentId)}/submissions/${encodeURIComponent(submission.id)}/review?${query.toString()}`);
      return;
    }
    if (!question.gradingRunId) return;
    setBusy(`ai-review:${submission.id}:${question.id}`); setNotice(null);
    try {
      const response = await fetch(`/api/teacher/assignments/${encodeURIComponent(assignmentId)}/submissions/${encodeURIComponent(submission.id)}/review`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ gradingRunId: question.gradingRunId }) });
      const payload = await response.json().catch(() => ({})) as { review?: { id?: string }; error?: string };
      if (!response.ok || !payload.review?.id) throw new Error(payload.error ?? '无法打开预评分草稿审核');
      const query = new URLSearchParams({ questionId: question.id, mode: 'student', reviewId: payload.review.id, gradingRunId: question.gradingRunId });
      router.push(`/teacher/assignments/${encodeURIComponent(assignmentId)}/submissions/${encodeURIComponent(submission.id)}/review?${query.toString()}`);
    } catch (error) { setNotice({ kind: 'error', message: gradingErrorMessage(error, '无法打开预评分草稿审核') }); setBusy(null); }
  }
  async function retryQuestion(submission: Submission, question: SubmissionQuestion) {
    if (!question.batchId || !question.batchItemId) return;
    setBusy(`retry:${submission.id}:${question.id}`); setNotice(null);
    try {
      const response = await fetch(`/api/teacher/assignments/${encodeURIComponent(assignmentId)}/grading/batches/${encodeURIComponent(question.batchId)}/items/${encodeURIComponent(question.batchItemId)}/retry`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), reason: '教师在批改控制台重试失败题目' }) });
      const payload = await response.json().catch(() => ({})) as { error?: string; stage?: string };
      if (!response.ok) throw new Error(payload.error ?? '无法重试该题');
      setNotice({ kind: 'success', message: payload.stage === 'conversion' ? '已创建文档重新解析任务；完成后请再次点击“重试”继续评分。' : '已创建该题的重试任务。' }); await load();
    } catch (error) { setNotice({ kind: 'error', message: gradingErrorMessage(error, '无法重试该题') }); } finally { setBusy(null); }
  }
  return <main className="surface-page min-h-screen px-4 py-6 md:px-8" data-assignment-grading-console="true"><div className="mx-auto max-w-7xl space-y-6">
    <header className="flex flex-col gap-4 border-b border-slate-800 pb-5 md:flex-row md:items-end md:justify-between"><div><Link href={`/teacher/assignments/${encodeURIComponent(assignmentId)}/submissions`} className="mb-3 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-cyan-300"><ArrowLeft className="h-4 w-4" />返回提交队列</Link><h1 className="text-2xl font-semibold text-white">截止后批改控制台</h1><p className="mt-1 text-sm text-slate-400">选择学生后启动自动批改；人工批改按题进入现有审阅工作区。</p></div><div className="flex flex-wrap items-center gap-2"><button type="button" onClick={toggleAllEligible} disabled={busy !== null || !eligible.length} className="inline-flex min-h-11 items-center justify-center rounded-lg border border-slate-600 px-4 text-sm font-medium text-slate-100 hover:border-cyan-400 hover:text-cyan-100 disabled:cursor-not-allowed disabled:opacity-50">{allEligibleSelected ? '取消全选' : '全选待批改学生'}</button><button type="button" onClick={() => void startAiGrading()} disabled={busy !== null || !selectedStudentIds.length} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 font-medium text-white hover:bg-cyan-500 disabled:cursor-not-allowed disabled:opacity-50"><Bot className="h-4 w-4" />{busy === 'ai' ? '正在启动…' : `一键自动批改（${selectedStudentIds.length}）`}</button></div></header>
    {notice ? <div role={notice.kind === 'error' ? 'alert' : 'status'} className={notice.kind === 'error' ? 'rounded-xl border border-rose-500/40 bg-rose-950/30 p-4 text-sm text-rose-100' : 'rounded-xl border border-emerald-500/35 bg-emerald-950/25 p-4 text-sm text-emerald-100'}>{notice.message}</div> : null}
    {loadState === 'loading' ? <div className="grid gap-4 md:grid-cols-2">{[1, 2].map((item) => <div key={item} className="h-40 animate-pulse rounded-xl bg-slate-800" />)}</div> : null}
    {loadState === 'error' ? <section role="alert" className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-6 text-rose-100"><AlertCircle className="mb-3 h-6 w-6" /><h2 className="font-semibold">批改队列暂时无法加载</h2><button type="button" onClick={() => void load()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-rose-400 px-4"><RefreshCw className="h-4 w-4" />重试</button></section> : null}
    {loadState === 'ready' && !submitted.length ? <section className="rounded-xl border border-dashed border-slate-700 p-12 text-center text-slate-300">当前没有已提交且可进入批改的作业。</section> : null}
    {loadState === 'ready' && submitted.length ? <section className="overflow-hidden rounded-xl border border-slate-800 bg-slate-900/60"><div className="border-b border-slate-800 px-4 py-3 text-sm text-slate-400">已选择 {selectedStudentIds.length} / {eligible.length} 名待批改学生；取消勾选即排除本次自动批改。</div><ul className="divide-y divide-slate-800">{submitted.map((submission) => <li key={submission.id} className="p-4"><div className="flex flex-wrap items-start justify-between gap-3"><label className="flex items-center gap-3 text-white"><input type="checkbox" checked={selected.has(submission.studentId)} disabled={!isAiGradingCandidate(submission)} onChange={() => toggleStudent(submission.studentId)} className="h-4 w-4 accent-cyan-500 disabled:opacity-50" /><span><span className="font-medium">{submission.studentName}</span>{submission.studentNumber ? <span className="ml-2 text-xs text-slate-500">{submission.studentNumber}</span> : null}</span></label><div className="flex items-center gap-3"><span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">{gradingStateLabel(submission.grading?.state)}</span>{submission.grading ? <Link href={`/teacher/assignments/${encodeURIComponent(assignmentId)}/submissions/${encodeURIComponent(submission.id)}/grade?snapshotId=${encodeURIComponent(submission.grading.snapshotId)}${submission.grading.confirmationId ? `&confirmationId=${encodeURIComponent(submission.grading.confirmationId)}` : ''}`} className="text-xs font-medium text-cyan-300 hover:text-cyan-200">审核整份作业</Link> : null}</div></div><p className="mt-2 text-xs text-slate-400" data-grading-diagnostic={submission.gradingDiagnostic?.code}>{submission.gradingDiagnostic?.message ?? '批改状态待确认。'}</p><div className="mt-4 grid gap-2 lg:grid-cols-2">{submission.questions.map((question) => <div key={question.id} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/60 px-3 py-3"><div><p className="text-sm text-slate-100">{question.title}</p><p className="mt-1 text-xs text-slate-500">{questionStatusLabel(question.status)}{question.diagnosticMessage ? ` · ${question.diagnosticMessage}` : ''}</p></div><div className="flex gap-2">{question.status === 'BLOCKED' && question.batchId && question.batchItemId ? <button type="button" onClick={() => void retryQuestion(submission, question)} disabled={busy !== null} className="inline-flex min-h-9 items-center rounded-lg border border-amber-500/70 px-3 text-xs text-amber-100 disabled:opacity-50">重试</button> : null}{isAiReviewCandidate(question) ? <button type="button" onClick={() => void beginAiReview(submission, question)} disabled={busy !== null} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-cyan-500/60 px-3 text-xs text-cyan-100 hover:border-cyan-300 disabled:opacity-50">{busy === `ai-review:${submission.id}:${question.id}` ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <Bot className="h-3.5 w-3.5" />}{question.reviewId ? '继续审核' : '审核预评分草稿'}</button> : null}{question.status !== 'NOT_SUBMITTED' ? <button type="button" onClick={() => void beginManualGrading(submission, question)} disabled={busy !== null} className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-slate-600 px-3 text-xs text-slate-100 hover:border-cyan-400 disabled:opacity-50">{busy === `manual:${submission.id}:${question.id}` ? <LoaderCircle className="h-3.5 w-3.5 animate-spin" /> : <UserRoundCheck className="h-3.5 w-3.5" />}人工批改</button> : null}</div></div>)}</div></li>)}</ul></section> : null}
  </div></main>;
}
export function normalizeSubmission(value: unknown): Submission[] {
  if (!value || typeof value !== 'object') return [];
  const row = value as Record<string, unknown>;
  const id = stringValue(row.submissionId ?? row.id);
  const studentId = stringValue(row.studentId);
  if (!id || !studentId) return [];
  return [{
    id,
    studentId,
    studentName: stringValue(row.studentName) || '未知学生',
    studentNumber: stringValue(row.studentNumber) || null,
    state: stringValue(row.state),
    submittedRequiredCount: numberValue(row.submittedRequiredCount),
    gradingDiagnostic: normalizeDiagnostic(row.gradingDiagnostic),
    grading: normalizeGrading(row.grading),
    questions: Array.isArray(row.questions) ? row.questions.flatMap(normalizeQuestion) : [],
  }];
}
function normalizeQuestion(value: unknown): SubmissionQuestion[] {
  if (!value || typeof value !== 'object') return [];
  const row = value as Record<string, unknown>;
  const id = stringValue(row.questionId ?? row.id);
  return id ? [{
    id,
    title: stringValue(row.title) || '未命名题目',
    status: stringValue(row.status),
    diagnosticCode: stringValue(row.diagnosticCode) || undefined,
    diagnosticMessage: stringValue(row.diagnosticMessage) || undefined,
    reviewId: stringValue(row.reviewId) || null,
    gradingRunId: stringValue(row.gradingRunId) || null,
    batchId: stringValue(row.batchId) || null,
    batchItemId: stringValue(row.batchItemId) || null,
  }] : [];
}
function normalizeDiagnostic(value: unknown): Submission['gradingDiagnostic'] | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const row = value as Record<string, unknown>;
  const code = stringValue(row.code);
  const message = stringValue(row.message);
  return code && message ? { code, message, canStartAi: row.canStartAi === true } : undefined;
}
function normalizeGrading(value: unknown): Submission['grading'] { if (!value || typeof value !== 'object') return null; const row = value as Record<string, unknown>; const snapshotId = stringValue(row.snapshotId); return snapshotId ? { snapshotId, source: stringValue(row.source) || 'AI', state: stringValue(row.state), operationState: stringValue(row.operationState) || null, confirmationId: stringValue(row.confirmationId) || null, releaseId: stringValue(row.releaseId) || null } : null; }
function stringValue(value: unknown) { return typeof value === 'string' ? value : ''; }
function numberValue(value: unknown) { return typeof value === 'number' && Number.isFinite(value) ? value : 0; }
export function isAiGradingCandidate(submission: Pick<Submission, 'state' | 'submittedRequiredCount' | 'grading' | 'gradingDiagnostic'>) {
  const manualSnapshotIsFinal = submission.grading?.source === 'MANUAL'
    && ['CONFIRMED', 'RELEASED'].includes(submission.grading.state);
  return ['SUBMITTED', 'IN_PROGRESS'].includes(submission.state)
    && submission.submittedRequiredCount > 0
    && (!submission.grading || (submission.grading.source === 'MANUAL' && !manualSnapshotIsFinal))
    && (submission.gradingDiagnostic?.canStartAi ?? true);
}
export function toggleAllAiGradingCandidates(currentStudentIds: readonly string[], eligibleStudentIds: readonly string[]) {
  const eligibleIds = [...new Set(eligibleStudentIds)];
  const eligibleIdSet = new Set(eligibleIds);
  return eligibleIds.every((studentId) => currentStudentIds.includes(studentId))
    ? currentStudentIds.filter((studentId) => !eligibleIdSet.has(studentId))
    : [...new Set([...currentStudentIds, ...eligibleIds])];
}
export function isAiReviewCandidate(question: Pick<SubmissionQuestion, 'status' | 'gradingRunId' | 'reviewId'>) {
  return Boolean(question.reviewId) || (question.status === 'READY' && Boolean(question.gradingRunId));
}
function questionStatusLabel(status: string) { return ({ NOT_SUBMITTED: '未提交', PROCESSING: '批改中', READY: '待审阅', IN_REVIEW: '人工批改中', RETURNED: '等待补交', APPROVED: '已完成', BLOCKED: '批改失败，可重试或人工处理' } as Record<string, string>)[status] ?? '待处理'; }
function gradingStateLabel(state: string | undefined) { return ({ PENDING_GRADING: '待批改', PARTIAL_FAILURE: '部分失败', AWAITING_CONFIRMATION: '待教师确认', CONFIRMED: '已确认，待发布', RELEASED: '已发布' } as Record<string, string>)[state ?? ''] ?? '待批改'; }
export function gradingErrorMessage(error: unknown, fallback: string) {
  const code = error instanceof Error ? error.message : '';
  return ({
    'assignment-grading-before-deadline': '尚未到批改时间，截止后才可开始批改。',
    'assignment-grading-no-submitted-work': '尚无已提交的作答，暂时不能开始批改。',
    'grading-provider-policy-not-found': '批改策略暂时不可用，请稍后重试或转人工批改。',
    'grading-provider-policy-unavailable': '批改策略暂时不可用，请稍后重试或转人工批改。',
    'teacher-review-forbidden': '当前账号没有这份作业的批改权限。',
  } as Record<string, string>)[code] ?? fallback;
}
