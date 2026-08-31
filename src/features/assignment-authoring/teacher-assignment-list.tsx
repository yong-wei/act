'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertCircle, ArrowLeft, ClipboardCheck, Eye, Plus, RefreshCw, Search } from 'lucide-react';

import { assignmentNextAction, type TeacherAssignmentListItem } from './assignment-ui-contracts';

type LoadState = 'loading' | 'ready' | 'error';
type ReviewAwareAssignment = TeacherAssignmentListItem & {
  submissionCount: number;
  pendingReviewCount: number;
  reviewedCount: number;
  nextReview: { submissionId: string; questionId: string; reviewId: string | null; gradingRunId: string | null } | null;
  submissionCountsAvailable: boolean;
};

export function TeacherAssignmentList() {
  const [items, setItems] = useState<ReviewAwareAssignment[]>([]);
  const [loadState, setLoadState] = useState<LoadState>('loading');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('ALL');
  const [audience, setAudience] = useState('ALL');
  const [highlightId, setHighlightId] = useState('');

  const load = useCallback(async () => {
    setLoadState('loading');
    try {
      const response = await fetch('/api/teacher/assignments', { cache: 'no-store' });
      if (!response.ok) throw new Error(`assignment-list:${response.status}`);
      const payload = await response.json() as { assignments?: unknown[] };
      setItems((payload.assignments ?? []).map(normalizeTeacherAssignmentListItem));
      setLoadState('ready');
    } catch {
      setLoadState('error');
    }
  }, []);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => {
    setHighlightId(new URLSearchParams(window.location.search).get('highlight') ?? '');
  }, []);
  useEffect(() => {
    if (loadState !== 'ready' || !highlightId) return;
    document.getElementById(`assignment-${highlightId}`)?.scrollIntoView({ block: 'center' });
  }, [highlightId, loadState]);

  const audienceOptions = useMemo(() => Array.from(new Map(items.flatMap((item) => item.latestRevision?.audiences.map((entry) => [entry.classId, entry.className] as const) ?? [])).entries()), [items]);
  const filtered = useMemo(() => items.filter((item) => {
    const title = item.latestRevision?.title ?? '';
    const matchesQuery = title.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase());
    const matchesStatus = status === 'ALL' || item.state === status;
    const matchesAudience = audience === 'ALL' || item.latestRevision?.audiences.some((entry) => entry.classId === audience);
    return matchesQuery && matchesStatus && matchesAudience;
  }), [audience, items, query, status]);

  const semantics = loadState === 'loading' ? 'loading' : loadState === 'error' ? 'error' : items.length === 0 ? 'empty' : filtered.length === 0 ? 'filtered-empty' : 'ready';

  return (
    <main className="surface-page min-h-screen px-4 py-8 md:px-8" data-commercial-operations-workspace="teacher-operations" data-commercial-workspace-zone="instrument-area" data-operations-status-semantics={semantics}>
      <div className="mx-auto max-w-6xl space-y-6">
        <header className="flex flex-col gap-4 border-b border-slate-800 pb-6 md:flex-row md:items-end md:justify-between">
          <div>
            <Link href="/teacher" className="mb-3 inline-flex items-center gap-1 text-sm text-slate-400 hover:text-cyan-300"><ArrowLeft className="h-4 w-4" />返回教师工作台</Link>
            <h1 className="text-3xl font-semibold text-white">作业</h1>
            <p className="mt-2 text-sm text-slate-400">管理草稿、发布计划与已冻结版本。</p>
          </div>
          <Link href="/teacher/assignments/new?returnTo=%2Fteacher%2Fassignments" className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-cyan-600 px-4 py-2 font-medium text-white hover:bg-cyan-500"><Plus className="h-4 w-4" />新建作业</Link>
        </header>

        {loadState === 'loading' && <div role="status" aria-live="polite" className="grid gap-4 md:grid-cols-2"><span className="sr-only">正在加载作业</span>{[1, 2, 3, 4].map((id) => <div key={id} className="h-36 animate-pulse rounded-xl bg-slate-800" />)}</div>}
        {loadState === 'error' && <section role="alert" className="rounded-xl border border-rose-500/40 bg-rose-950/30 p-6 text-rose-100"><AlertCircle className="mb-3 h-6 w-6" /><h2 className="font-semibold">作业列表暂时无法加载</h2><p className="mt-1 text-sm text-rose-200">已保留当前筛选条件，可重试。</p><button type="button" onClick={() => void load()} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-lg border border-rose-400 px-4"><RefreshCw className="h-4 w-4" />重试</button></section>}
        {loadState === 'ready' && items.length === 0 && <section className="rounded-xl border border-dashed border-slate-700 p-12 text-center"><h2 className="text-lg font-medium text-white">暂无作业</h2><p className="mt-2 text-slate-400">创建第一份主观题作业。</p></section>}
        {loadState === 'ready' && items.length > 0 && <>
          <section aria-label="作业筛选" className="grid gap-3 rounded-xl border border-slate-800 bg-slate-900/60 p-4 md:grid-cols-3">
            <label className="relative"><span className="sr-only">搜索作业</span><Search className="absolute left-3 top-3 h-4 w-4 text-slate-500" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索作业" className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 pl-9 pr-3 text-white" /></label>
            <label><span className="sr-only">按状态筛选</span><select value={status} onChange={(event) => setStatus(event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white"><option value="ALL">全部状态</option>{['DRAFT', 'SCHEDULED', 'PUBLISHED', 'CLOSED', 'ARCHIVED'].map((value) => <option key={value} value={value}>{stateLabel(value)}</option>)}</select></label>
            <label><span className="sr-only">按班级筛选</span><select value={audience} onChange={(event) => setAudience(event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-700 bg-slate-950 px-3 text-white"><option value="ALL">全部班级</option>{audienceOptions.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></label>
          </section>
          <p role="status" aria-live="polite" className="text-sm text-slate-400">显示 {filtered.length} 项结果</p>
          {filtered.length === 0 ? <section className="rounded-xl border border-dashed border-slate-700 p-10 text-center"><h2 className="font-medium text-white">没有匹配的作业</h2><button type="button" className="mt-4 min-h-11 rounded-lg border border-slate-600 px-4 text-slate-100" onClick={() => { setQuery(''); setStatus('ALL'); setAudience('ALL'); }}>清除筛选</button></section> : <div className="grid gap-4 md:grid-cols-2">{filtered.map((item) => <AssignmentCard key={item.id} item={item} highlighted={item.id === highlightId} />)}</div>}
        </>}
      </div>
    </main>
  );
}

function AssignmentCard({ item, highlighted = false }: { item: ReviewAwareAssignment; highlighted?: boolean }) {
  const revision = item.latestRevision;
  const submissionsHref = `/teacher/assignments/${encodeURIComponent(item.id)}/submissions`;
  const gradingHref = `/teacher/assignments/${encodeURIComponent(item.id)}/grading`;
  const reviewHref = buildTeacherAssignmentReviewHref(item);
  const hasSubmissionEntry = item.state === 'PUBLISHED' || item.state === 'CLOSED' || item.submissionCount > 0;
  return <article id={`assignment-${item.id}`} aria-current={highlighted ? 'true' : undefined} className={`rounded-xl border bg-slate-900/70 p-5 ${highlighted ? 'border-cyan-400 ring-2 ring-cyan-400/30' : 'border-slate-800'}`}><div className="flex items-start justify-between gap-4"><div><p className="text-xs uppercase tracking-wide text-cyan-300">{stateLabel(item.state)}</p><h2 className="mt-2 text-lg font-semibold text-white">{revision?.title ?? '未命名作业'}</h2></div><span className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300">v{revision?.revisionNumber ?? 0}.{revision?.version ?? 0}</span></div><dl className="mt-4 grid grid-cols-2 gap-3 text-sm"><div><dt className="text-slate-500">受众</dt><dd className="text-slate-200">{revision?.audiences.length ? revision.audiences.map((entry) => entry.className).join('、') : '未设置'}</dd></div><div><dt className="text-slate-500">截止时间</dt><dd className="text-slate-200">{revision?.audiences[0]?.dueAt ? new Date(revision.audiences[0].dueAt).toLocaleString('zh-CN') : '未设置'}</dd></div><div><dt className="text-slate-500">已提交</dt><dd className="text-slate-200">{item.submissionCountsAvailable ? item.submissionCount : '暂不可用'}</dd></div><div><dt className="text-slate-500">待批阅</dt><dd className="text-slate-200">{item.submissionCountsAvailable ? item.pendingReviewCount : '暂不可用'}</dd></div></dl><div className="mt-5 flex flex-wrap gap-3">{hasSubmissionEntry ? <><Link href={submissionsHref} className="inline-flex min-h-11 items-center gap-2 text-sm font-medium text-cyan-300 hover:text-cyan-200"><Eye className="h-4 w-4" />查看提交</Link><Link href={gradingHref} className="inline-flex min-h-11 items-center text-sm font-medium text-cyan-300 hover:text-cyan-200">截止后批改</Link></> : <Link href={`/teacher/assignments/${item.id}/edit?returnTo=%2Fteacher%2Fassignments`} className="inline-flex min-h-11 items-center text-sm font-medium text-cyan-300 hover:text-cyan-200">{assignmentNextAction(item)} →</Link>}{item.pendingReviewCount > 0 ? <Link href={reviewHref} className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-cyan-600 px-3 text-sm font-medium text-white hover:bg-cyan-500"><ClipboardCheck className="h-4 w-4" />进入批阅</Link> : null}</div></article>;
}

export function normalizeTeacherAssignmentListItem(value: unknown): ReviewAwareAssignment {
  const row = value as Record<string, unknown>;
  const revisions = Array.isArray(row.revisions) ? row.revisions as Array<Record<string, unknown>> : [];
  const revision = revisions[0];
  const audiences = Array.isArray(revision?.audiences) ? revision.audiences as Array<Record<string, unknown>> : [];
  const reviewSummary = row.reviewSummary && typeof row.reviewSummary === 'object' ? row.reviewSummary as Record<string, unknown> : {};
  const nextReviewValue = reviewSummary.nextReview ?? row.nextReview;
  const nextReview = nextReviewValue && typeof nextReviewValue === 'object' ? nextReviewValue as Record<string, unknown> : null;
  return { id: String(row.id), state: String(row.state) as TeacherAssignmentListItem['state'], updatedAt: String(row.updatedAt), latestRevision: revision ? { id: String(revision.id), revisionNumber: Number(revision.revisionNumber), version: Number(revision.version), title: String(revision.title), state: String(revision.state) as 'DRAFT' | 'PUBLISHED', audiences: audiences.map((entry) => ({ classId: String(entry.classId), className: String((entry.class as Record<string, unknown> | undefined)?.name ?? entry.classId), availableAt: String(entry.availableAt), dueAt: String(entry.dueAt) })) } : null, submissionCount: safeCount(reviewSummary.submissionCount ?? row.submissionCount), pendingReviewCount: safeCount(reviewSummary.pendingReviewCount ?? row.pendingReviewCount), reviewedCount: safeCount(reviewSummary.reviewedCount ?? row.reviewedCount), nextReview: nextReview && nextReview.submissionId && nextReview.questionId ? { submissionId: String(nextReview.submissionId), questionId: String(nextReview.questionId), reviewId: nullableId(nextReview.reviewId), gradingRunId: nullableId(nextReview.gradingRunId) } : null, submissionCountsAvailable: reviewSummary.submissionCount !== undefined || row.submissionCount !== undefined };
}

export function buildTeacherAssignmentReviewHref(item: Pick<ReviewAwareAssignment, 'id' | 'nextReview'>) {
  if (!item.nextReview) return `/teacher/assignments/${encodeURIComponent(item.id)}/submissions`;
  const query = new URLSearchParams({ questionId: item.nextReview.questionId, mode: 'student' });
  if (item.nextReview.reviewId) query.set('reviewId', item.nextReview.reviewId);
  else if (item.nextReview.gradingRunId) query.set('gradingRunId', item.nextReview.gradingRunId);
  return `/teacher/assignments/${encodeURIComponent(item.id)}/submissions/${encodeURIComponent(item.nextReview.submissionId)}/review?${query.toString()}`;
}

function safeCount(value: unknown) { const count = Number(value); return Number.isFinite(count) && count > 0 ? Math.trunc(count) : 0; }

function nullableId(value: unknown) { return typeof value === 'string' && value.length > 0 ? value : null; }

function stateLabel(value: string) { return ({ DRAFT: '草稿', SCHEDULED: '已排期', PUBLISHED: '已发布', CLOSED: '已截止', ARCHIVED: '已归档' } as Record<string, string>)[value] ?? value; }
