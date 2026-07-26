'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { AlertCircle, ArrowLeft, CheckCircle2, Clock3, FileUp, History, Loader2, Paperclip, Save } from 'lucide-react';
import { AppShell } from '@/components/platform/app-shell';
import {
  assignmentStateLabels,
  formatAssignmentDeadline,
  questionStateLabels,
  type StudentAnswerAttempt,
  type StudentAssignmentDetail,
  type StudentAssignmentQuestion,
} from './student-assignment-types';

type Notice = { kind: 'success' | 'error'; message: string; controlId?: string } | null;
type PendingUpload = {
  intentId: string;
  fileName: string;
  idempotencyKey: string;
  status: 'SCANNING' | 'TIMEOUT' | 'UNSAFE' | 'EXPIRED' | 'ERROR';
  message: string;
};

export function StudentAssignmentWorkspace({ assignmentId, revisionId }: { assignmentId: string; revisionId?: string }) {
  const session = useSession();
  const [assignment, setAssignment] = useState<StudentAssignmentDetail | null>(null);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<Notice>(null);
  const [historyQuestionId, setHistoryQuestionId] = useState<string | null>(null);
  const [history, setHistory] = useState<StudentAnswerAttempt[]>([]);
  const [pendingUploads, setPendingUploads] = useState<Record<string, PendingUpload>>({});
  const [nextQuestionId, setNextQuestionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const editorHeadingRef = useRef<HTMLHeadingElement>(null);
  const noticeRef = useRef<HTMLDivElement>(null);
  const historyHeadingRef = useRef<HTMLHeadingElement>(null);
  const historyTriggerRef = useRef<HTMLButtonElement>(null);
  const uploadStatusRef = useRef<HTMLDivElement>(null);

  const loadAssignment = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const revisionQuery = revisionId ? `?revisionId=${encodeURIComponent(revisionId)}` : '';
      const response = await fetch(`/api/student/assignments/${encodeURIComponent(assignmentId)}${revisionQuery}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({})) as { assignment?: StudentAssignmentDetail; error?: string };
      if (!response.ok || !payload.assignment) throw new Error(payload.error || '作业暂时无法加载');
      setAssignment(payload.assignment);
      setSelectedQuestionId((current) => current ?? payload.assignment?.questions[0]?.id ?? null);
      setDrafts(Object.fromEntries(payload.assignment.questions.map((question) => [question.id, question.textDraft ?? ''])));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : '作业暂时无法加载');
    } finally {
      setLoading(false);
    }
  }, [assignmentId, revisionId]);

  useEffect(() => {
    if (session.status === 'authenticated') void loadAssignment();
    if (session.status === 'unauthenticated') setLoading(false);
  }, [loadAssignment, session.status]);

  const selectedQuestion = useMemo(
    () => assignment?.questions.find((question) => question.id === selectedQuestionId) ?? null,
    [assignment, selectedQuestionId],
  );

  function selectQuestion(questionId: string) {
    setSelectedQuestionId(questionId);
    setHistoryQuestionId(null);
    setNotice(null);
    setNextQuestionId(null);
    requestAnimationFrame(() => editorHeadingRef.current?.focus());
  }

  function updateQuestion(questionId: string, patch: Partial<StudentAssignmentQuestion>) {
    setAssignment((current) => current ? {
      ...current,
      questions: current.questions.map((question) => question.id === questionId ? { ...question, ...patch } : question),
    } : current);
  }

  async function saveDraft(question: StudentAssignmentQuestion) {
    setBusyAction(`save:${question.id}`);
    setNotice(null);
    try {
      const response = await fetch(answerPath(question.id), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ version: question.version, text: drafts[question.id] ?? '' }),
      });
      const payload = await response.json().catch(() => ({})) as { answer?: { version: number; state: StudentAssignmentQuestion['state']; textDraft?: string }; error?: string };
      if (!response.ok || !payload.answer) throw new Error(payload.error || '草稿保存失败');
      updateQuestion(question.id, { version: payload.answer.version, state: payload.answer.state, textDraft: payload.answer.textDraft });
      setNotice({ kind: 'success', message: '本题草稿已保存。' });
    } catch (cause) {
      setNotice({ kind: 'error', message: cause instanceof Error ? cause.message : '草稿保存失败', controlId: `answer-${question.id}` });
    } finally {
      setBusyAction(null);
      requestAnimationFrame(() => noticeRef.current?.focus());
    }
  }

  async function uploadAttachment(question: StudentAssignmentQuestion, file: File) {
    if ((question.assets?.length ?? 0) >= 10) {
      setNotice({ kind: 'error', message: '每题最多可包含 10 个图片或附件。', controlId: `file-${question.id}` });
      return;
    }
    setBusyAction(`upload:${question.id}`);
    setNotice(null);
    updateQuestion(question.id, { state: 'UPLOADING' });
    try {
      const checksum = await checksumFile(file);
      const signResponse = await fetch(`${answerPath(question.id)}/upload-sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fileName: file.name, mimeType: assignmentMimeType(file), sizeBytes: file.size, checksum }),
      });
      const signPayload = await signResponse.json().catch(() => ({})) as { upload?: { intentId: string; url: string; requiredHeaders?: Record<string, string> }; error?: string };
      if (!signResponse.ok || !signPayload.upload) throw new Error(signPayload.error || '无法准备附件上传');
      const uploadResponse = await fetch(signPayload.upload.url, { method: 'PUT', headers: signPayload.upload.requiredHeaders, body: file });
      if (!uploadResponse.ok) throw new Error('附件上传失败');
      const pending: PendingUpload = { intentId: signPayload.upload.intentId, fileName: file.name, idempotencyKey: crypto.randomUUID(), status: 'SCANNING', message: '附件已上传，正在进行安全扫描。' };
      setPendingUploads((current) => ({ ...current, [question.id]: pending }));
      setBusyAction(null);
      requestAnimationFrame(() => uploadStatusRef.current?.focus());
      await confirmUploadedAttachment(question, pending, true);
    } catch (cause) {
      updateQuestion(question.id, { state: question.textDraft ? 'DRAFT' : 'NOT_STARTED' });
      setNotice({ kind: 'error', message: cause instanceof Error ? cause.message : '附件上传失败', controlId: `file-${question.id}` });
    } finally {
      setBusyAction(null);
      requestAnimationFrame(() => noticeRef.current?.focus());
    }
  }

  async function confirmUploadedAttachment(question: StudentAssignmentQuestion, pending: PendingUpload, initial: boolean) {
    setBusyAction(`confirm:${question.id}`);
    setNotice(null);
    setPendingUploads((current) => ({ ...current, [question.id]: { ...pending, status: 'SCANNING', message: '附件已上传，正在进行安全扫描。' } }));
    updateQuestion(question.id, { state: 'UPLOADING' });
    try {
      let result: { status?: 'SCANNING' | 'CLEAN' | 'READY' | 'UNSAFE' | 'EXPIRED'; answerVersion?: number; asset?: { id: string; displayName: string; mimeType?: string; sizeBytes?: number }; error?: string } = {};
      if (initial) {
        const response = await fetch(`${answerPath(question.id)}/finalize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intentId: pending.intentId, idempotencyKey: pending.idempotencyKey }) });
        result = await response.json().catch(() => ({}));
        if (![200, 202, 410, 422].includes(response.status)) throw new Error(result.error || '附件确认失败');
      }
      for (let attempt = 0; result.status === 'SCANNING' || (!initial && attempt === 0); attempt += 1) {
        if (attempt >= 6) {
          setPendingUploads((current) => ({ ...current, [question.id]: { ...pending, status: 'TIMEOUT', message: '安全扫描仍在进行，可稍后重新检查。' } }));
          requestAnimationFrame(() => uploadStatusRef.current?.focus());
          return;
        }
        await wait(500);
        const statusResponse = await fetch(`${answerPath(question.id)}/finalize?intentId=${encodeURIComponent(pending.intentId)}`, { cache: 'no-store' });
        result = await statusResponse.json().catch(() => ({}));
        if (!statusResponse.ok && ![410, 422].includes(statusResponse.status)) throw new Error(result.error || '扫描状态查询失败');
      }
      if (result.status === 'CLEAN') {
        const finalizeResponse = await fetch(`${answerPath(question.id)}/finalize`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ intentId: pending.intentId, idempotencyKey: pending.idempotencyKey }) });
        result = await finalizeResponse.json().catch(() => ({}));
        if (!finalizeResponse.ok || result.status !== 'READY') throw new Error(result.error || '附件最终确认失败');
      }
      if (result.status === 'READY' && result.asset) {
        updateQuestion(question.id, {
          state: 'READY',
          version: result.answerVersion ?? question.version,
          assets: [...(question.assets ?? []), { ...result.asset, displayName: result.asset.displayName || pending.fileName }],
        });
        setPendingUploads((current) => { const next = { ...current }; delete next[question.id]; return next; });
        setNotice({ kind: 'success', message: `附件“${pending.fileName}”已通过安全扫描并就绪。` });
        requestAnimationFrame(() => noticeRef.current?.focus());
        return;
      }
      const terminalStatus = result.status === 'UNSAFE' ? 'UNSAFE' : 'EXPIRED';
      setPendingUploads((current) => ({ ...current, [question.id]: { ...pending, status: terminalStatus, message: terminalStatus === 'UNSAFE' ? '附件未通过安全扫描，请更换文件。' : '上传确认已过期，请重新选择文件。' } }));
      requestAnimationFrame(() => uploadStatusRef.current?.focus());
    } catch (cause) {
      setPendingUploads((current) => ({ ...current, [question.id]: { ...pending, status: 'ERROR', message: cause instanceof Error ? cause.message : '扫描状态查询失败' } }));
      requestAnimationFrame(() => uploadStatusRef.current?.focus());
    } finally {
      setBusyAction(null);
    }
  }

  async function submitQuestion(question: StudentAssignmentQuestion) {
    setBusyAction(`submit:${question.id}`);
    setNotice(null);
    try {
      const response = await fetch(`${answerPath(question.id)}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ answerVersion: question.version, idempotencyKey: crypto.randomUUID() }),
      });
      const payload = await response.json().catch(() => ({})) as {
        attempt?: { attemptNumber?: number };
        assignmentState?: StudentAssignmentDetail['state'];
        submittedRequiredCount?: number;
        error?: string;
      };
      if (!response.ok || !payload.attempt) throw new Error(payload.error || '本题提交失败');
      updateQuestion(question.id, { state: 'SUBMITTED', currentAttemptNumber: payload.attempt.attemptNumber ?? 1 });
      const nextQuestion = assignment?.questions.find((candidate) => candidate.id !== question.id && candidate.state !== 'SUBMITTED');
      setNextQuestionId(nextQuestion?.id ?? null);
      setAssignment((current) => current ? {
        ...current,
        state: payload.assignmentState ?? current.state,
        submittedRequiredCount: payload.submittedRequiredCount ?? current.submittedRequiredCount,
      } : current);
      setNotice({ kind: 'success', message: '本题已正式提交，其他题目的草稿未受影响。' });
    } catch (cause) {
      setNotice({ kind: 'error', message: cause instanceof Error ? cause.message : '本题提交失败', controlId: `submit-${question.id}` });
    } finally {
      setBusyAction(null);
      requestAnimationFrame(() => noticeRef.current?.focus());
    }
  }

  async function openHistory(question: StudentAssignmentQuestion) {
    historyTriggerRef.current = document.activeElement instanceof HTMLButtonElement ? document.activeElement : null;
    setBusyAction(`history:${question.id}`);
    setNotice(null);
    try {
      const revisionQuery = revisionId ? `?revisionId=${encodeURIComponent(revisionId)}` : '';
      const response = await fetch(`${answerPath(question.id)}/history${revisionQuery}`, { cache: 'no-store' });
      const payload = await response.json().catch(() => ({})) as { attempts?: StudentAnswerAttempt[]; error?: string };
      if (!response.ok) throw new Error(payload.error || '提交历史加载失败');
      setHistory(payload.attempts ?? []);
      setHistoryQuestionId(question.id);
      requestAnimationFrame(() => historyHeadingRef.current?.focus());
    } catch (cause) {
      setNotice({ kind: 'error', message: cause instanceof Error ? cause.message : '提交历史加载失败', controlId: `history-${question.id}` });
      requestAnimationFrame(() => noticeRef.current?.focus());
    } finally {
      setBusyAction(null);
    }
  }

  function closeHistory() {
    setHistoryQuestionId(null);
    requestAnimationFrame(() => historyTriggerRef.current?.focus());
  }

  async function downloadHistoryAsset(questionId: string, asset: NonNullable<StudentAnswerAttempt['assets']>[number]) {
    setBusyAction(`download:${asset.id}`);
    setNotice(null);
    try {
      const response = await fetch(`${answerPath(questionId)}/assets/${encodeURIComponent(asset.id)}/read`, { method: 'POST' });
      const payload = await response.json().catch(() => ({})) as { access?: { url: string; expiresAt: string }; error?: string };
      if (!response.ok || !payload.access) throw new Error(payload.error || '附件下载授权失败');
      const accessUrl = new URL(payload.access.url, window.location.origin);
      if (accessUrl.origin !== window.location.origin) throw new Error('附件下载地址无效');
      const fileResponse = await fetch(accessUrl, { cache: 'no-store' });
      if (!fileResponse.ok) throw new Error('附件下载失败，请重试');
      const objectUrl = URL.createObjectURL(await fileResponse.blob());
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = asset.displayName;
      anchor.click();
      URL.revokeObjectURL(objectUrl);
      setNotice({ kind: 'success', message: `附件“${asset.displayName}”已开始下载。` });
    } catch (cause) {
      setNotice({ kind: 'error', message: cause instanceof Error ? cause.message : '附件下载失败', controlId: `download-${asset.id}` });
    } finally {
      setBusyAction(null);
      requestAnimationFrame(() => noticeRef.current?.focus());
    }
  }

  const answerPath = (questionId: string) => `/api/student/assignments/${encodeURIComponent(assignmentId)}/answers/${encodeURIComponent(questionId)}`;

  return (
    <AppShell viewerRole="student" activeHref="/missions" title={assignment?.title || '主线作业'} subtitle="逐题保存与提交，已提交的题目保留独立历史。" breadcrumbs={[{ label: '首页', href: '/' }, { label: '任务中心', href: '/missions' }, { label: assignment?.title || '作业详情' }]}>
      {loading || session.status === 'loading' ? <WorkspaceLoading /> : session.status === 'unauthenticated' ? (
        <WorkspaceMessage title="请先登录" description="登录后可继续这份作业。" action={<Link href="/login" className="cta-primary rounded-lg px-5 py-2.5 text-sm">前往登录</Link>} />
      ) : error || !assignment ? (
        <WorkspaceMessage title="作业无法打开" description={error || '缺少作业上下文'} alert action={<button type="button" onClick={() => void loadAssignment()} className="btn-ghost-themed rounded-lg px-5 py-2.5 text-sm">重试</button>} />
      ) : assignment.contextStatus === 'STALE' ? (
        <WorkspaceMessage title="作业上下文已失效" description={assignment.policyReason || '当前班级或发布上下文已变化，请返回任务中心刷新。'} alert action={<Link href="/missions" className="btn-ghost-themed rounded-lg px-5 py-2.5 text-sm">返回任务中心</Link>} />
      ) : (
        <div data-assignment-workspace={assignment.id}>
          <Link href="/missions" className="mb-5 inline-flex items-center gap-2 text-sm text-subtle hover:text-foreground"><ArrowLeft className="h-4 w-4" />返回任务中心</Link>
          {assignment.contextStatus === 'HISTORICAL' && (
            <div className="mb-5 rounded-xl border border-slate-500/25 bg-slate-500/5 p-4 text-sm text-subtle" role="status">
              这是你的历史提交记录。当前发布已结束，仅可查看已提交内容与历史，不会显示参考答案或未发布批阅信息。
            </div>
          )}
          <header className="surface-card mb-5 p-5 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div><span className="text-xs font-medium text-primary">{assignmentStateLabels[assignment.state]}</span><h1 className="mt-2 text-2xl font-bold text-foreground">{assignment.title}</h1><p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-subtle">{assignment.instructions}</p></div>
              <div className="shrink-0 rounded-xl bg-accent/60 px-4 py-3 text-sm text-subtle"><Clock3 className="mr-2 inline h-4 w-4" />截止 {formatAssignmentDeadline(assignment.dueAt)}</div>
            </div>
          </header>

          {(assignment.feedbackStatus === 'PUBLISHING' || assignment.feedbackStatus === 'BLOCKED') && <div role="status" className={assignment.feedbackStatus === 'BLOCKED' ? 'mb-5 rounded-xl border border-amber-500/30 bg-amber-500/8 p-4 text-sm text-amber-800 dark:text-amber-200' : 'mb-5 rounded-xl border border-blue-500/25 bg-blue-500/8 p-4 text-sm text-blue-800 dark:text-blue-200'}>{assignment.policyReason}</div>}

          {assignment.feedback && assignment.feedback.length > 0 && <StudentApprovedFeedback assignment={assignment} onSelectQuestion={selectQuestion} />}

          <div className="grid gap-5 lg:grid-cols-[14rem_minmax(0,1fr)_16rem]">
            <nav className="surface-card h-fit p-3" aria-label="作业题目">
              <p className="px-2 pb-2 text-xs font-medium text-subtle">题目导航</p>
              {assignment.questions.map((question, index) => (
                <button key={question.id} type="button" onClick={() => selectQuestion(question.id)} aria-current={selectedQuestionId === question.id ? 'step' : undefined} className={selectedQuestionId === question.id ? 'mb-1 flex w-full items-center justify-between rounded-lg bg-primary/12 px-3 py-3 text-left text-sm font-medium text-foreground' : 'mb-1 flex w-full items-center justify-between rounded-lg px-3 py-3 text-left text-sm text-subtle hover:bg-accent hover:text-foreground'}>
                  <span>第 {index + 1} 题</span><span className="text-xs">{questionStateLabels[question.state]}</span>
                </button>
              ))}
            </nav>

            <main className="min-w-0">
              {selectedQuestion?.resubmission && <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/8 p-4 text-sm text-amber-800 dark:text-amber-200" role="status"><p className="font-medium">本题已由教师退回，请修改后重新提交</p><p className="mt-1">{selectedQuestion.resubmission.reason}</p><p className="mt-1 text-xs">重交截止 {new Date(selectedQuestion.resubmission.deadlineAt).toLocaleString('zh-CN')}</p></div>}
              {selectedQuestion && <QuestionEditor question={selectedQuestion} index={assignment.questions.indexOf(selectedQuestion)} draft={drafts[selectedQuestion.id] ?? ''} onDraftChange={(value) => setDrafts((current) => ({ ...current, [selectedQuestion.id]: value }))} onSave={() => void saveDraft(selectedQuestion)} onUpload={(file) => void uploadAttachment(selectedQuestion, file)} onSubmit={() => void submitQuestion(selectedQuestion)} onHistory={() => void openHistory(selectedQuestion)} busyAction={busyAction} readOnly={assignment.canMutate === false || assignment.historicalOnly || assignment.contextStatus === 'HISTORICAL'} headingRef={editorHeadingRef} pendingUpload={pendingUploads[selectedQuestion.id]} uploadStatusRef={uploadStatusRef} onRetryConfirm={(pending) => void confirmUploadedAttachment(selectedQuestion, pending, false)} />}
              {notice && <div ref={noticeRef} tabIndex={-1} role={notice.kind === 'error' ? 'alert' : 'status'} className={notice.kind === 'success' ? 'mt-4 rounded-xl border border-emerald-500/25 bg-emerald-500/8 p-4 text-sm text-emerald-700 outline-none dark:text-emerald-300' : 'mt-4 rounded-xl border border-red-500/25 bg-red-500/8 p-4 text-sm text-red-700 outline-none dark:text-red-300'}>
                <p>{notice.message}</p>
                {notice.kind === 'error' && notice.controlId && (
                  <a href={`#${notice.controlId}`} onClick={(event) => { event.preventDefault(); document.getElementById(notice.controlId!)?.focus(); }} className="mt-2 inline-block font-medium underline underline-offset-2">
                    前往受影响的控件
                  </a>
                )}
                {notice.kind === 'success' && nextQuestionId && (
                  <button type="button" onClick={() => selectQuestion(nextQuestionId)} className="btn-ghost-themed mt-3 rounded-lg px-4 py-2 text-sm">
                    前往下一未提交题
                  </button>
                )}
              </div>}
              {historyQuestionId && <HistoryPanel attempts={history} headingRef={historyHeadingRef} onClose={closeHistory} onDownload={(asset) => void downloadHistoryAsset(historyQuestionId, asset)} busyAction={busyAction} />}
            </main>

            <aside className="surface-card h-fit p-4 lg:sticky lg:top-20" aria-label="作业提交概览">
              <p className="text-sm font-semibold text-foreground">必答进度</p><p className="mt-3 text-3xl font-bold text-foreground">{assignment.submittedRequiredCount}<span className="text-base font-normal text-subtle"> / {assignment.requiredQuestionCount}</span></p>
              <div className="mt-3 h-2 overflow-hidden rounded-full bg-accent" role="progressbar" aria-valuenow={assignment.submittedRequiredCount} aria-valuemin={0} aria-valuemax={assignment.requiredQuestionCount}><div className="h-full rounded-full bg-primary" style={{ width: `${assignment.requiredQuestionCount ? assignment.submittedRequiredCount / assignment.requiredQuestionCount * 100 : 0}%` }} /></div>
              <p className="mt-4 text-sm text-subtle">每题独立正式提交。所有必答题提交后，系统自动更新整份作业状态，无需再次封卷。</p>
              {assignment.policyReason && <p className="mt-3 rounded-lg bg-accent/60 p-3 text-xs text-subtle">{assignment.policyReason}</p>}
            </aside>
          </div>
        </div>
      )}
    </AppShell>
  );
}

function StudentApprovedFeedback({ assignment, onSelectQuestion }: { assignment: StudentAssignmentDetail; onSelectQuestion: (questionId: string) => void }) {
  const feedback = assignment.feedback ?? [];
  return <section className="surface-card mb-5 p-5 sm:p-6" aria-labelledby="approved-feedback-heading" data-student-assignment-feedback="approved">
    <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium text-emerald-600 dark:text-emerald-300">教师已批准反馈</p><h2 id="approved-feedback-heading" className="mt-1 text-xl font-semibold text-foreground">批阅结果</h2></div>{assignment.approvedTotal != null && <p className="rounded-xl bg-emerald-500/10 px-4 py-2 text-lg font-semibold text-emerald-700 dark:text-emerald-300">总分 {assignment.approvedTotal}</p>}</div>
    <div className="mt-5 space-y-4">{feedback.map((item) => <article key={item.snapshotId} id={`feedback-question-${item.questionId}`} className="rounded-xl border border-border/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3"><button type="button" onClick={() => onSelectQuestion(item.questionId)} className="text-left font-semibold text-foreground underline-offset-4 hover:underline">{item.questionTitle}</button><span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-medium text-primary">{item.questionTotal} 分</span></div>
      {item.criteria.length > 0 && <dl className="mt-4 grid gap-3 sm:grid-cols-2">{item.criteria.map((criterion, index) => <div key={`${criterion.criterionId ?? 'criterion'}-${index}`} className="rounded-lg bg-accent/50 p-3"><dt className="text-xs font-medium text-subtle">{criterion.criterionId ?? `评分项 ${index + 1}`}</dt><dd className="mt-1 text-sm text-foreground">{criterion.score ?? 0} 分{criterion.comment ? ` · ${criterion.comment}` : ''}</dd></div>)}</dl>}
      {item.overallComment && <p className="mt-4 whitespace-pre-wrap text-sm leading-6 text-subtle">{item.overallComment}</p>}
      {item.annotations.filter((annotation) => annotation.status !== 'SUPPRESSED').length > 0 && <ul className="mt-4 space-y-2" aria-label="教师批注">{item.annotations.filter((annotation) => annotation.status !== 'SUPPRESSED').map((annotation, index) => <li key={annotation.id ?? index} className="rounded-lg border-l-2 border-primary bg-accent/40 px-3 py-2 text-sm text-subtle"><span className="font-medium text-foreground">{String(annotation.anchor?.precision ?? 'BLOCK')} 定位：</span>{annotation.comment || '教师批注'}</li>)}</ul>}
      {item.reviewedAssets.length > 0 && <div className="mt-4 flex flex-wrap gap-2">{item.reviewedAssets.map((asset, index) => asset.href ? <a key={asset.id ?? index} href={asset.href} className="btn-ghost-themed rounded-lg px-3 py-2 text-xs">{asset.label ?? '查看批阅文档'}{asset.precision ? ` · ${asset.precision}` : ''}</a> : null)}</div>}
      {item.limitations.length > 0 && <div className="mt-4 rounded-lg bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">{item.limitations.join('；')}</div>}
      {item.resubmission && <div className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/8 p-3 text-sm text-amber-800 dark:text-amber-200"><p className="font-medium">本题需要重新提交</p><p className="mt-1">{item.resubmission.reason}</p><p className="mt-1 text-xs">截止 {new Date(item.resubmission.deadlineAt).toLocaleString('zh-CN')}</p><button type="button" onClick={() => onSelectQuestion(item.questionId)} className="btn-ghost-themed mt-3 rounded-lg px-3 py-2 text-xs">前往修改本题</button></div>}
    </article>)}</div>
  </section>;
}

function QuestionEditor({ question, index, draft, onDraftChange, onSave, onUpload, onSubmit, onHistory, busyAction, readOnly, headingRef, pendingUpload, uploadStatusRef, onRetryConfirm }: { question: StudentAssignmentQuestion; index: number; draft: string; onDraftChange: (value: string) => void; onSave: () => void; onUpload: (file: File) => void; onSubmit: () => void; onHistory: () => void; busyAction: string | null; readOnly: boolean; headingRef: React.RefObject<HTMLHeadingElement | null>; pendingUpload?: PendingUpload; uploadStatusRef: React.RefObject<HTMLDivElement | null>; onRetryConfirm: (pending: PendingUpload) => void }) {
  const submitted = question.state === 'SUBMITTED';
  const busy = busyAction?.endsWith(`:${question.id}`) ?? false;
  return (
    <article className="surface-card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs font-medium text-primary">第 {index + 1} 题 · {question.points} 分</p><h2 ref={headingRef} tabIndex={-1} className="mt-2 text-lg font-semibold text-foreground outline-none">{question.promptText}</h2></div><span className="rounded-full bg-accent px-3 py-1 text-xs text-subtle">{questionStateLabels[question.state]}</span></div>
      <div className="mt-6"><label htmlFor={`answer-${question.id}`} className="text-sm font-medium text-foreground">Markdown 正文</label><textarea id={`answer-${question.id}`} value={draft} disabled={submitted || readOnly} onChange={(event) => onDraftChange(event.target.value)} rows={9} maxLength={20000} className="mt-2 w-full resize-y rounded-xl border border-border bg-background px-4 py-3 text-sm leading-6 text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-70" placeholder="可填写正文，也可仅提交附件。" /><p className="mt-1 text-right text-xs text-subtle">{draft.length} / 20000</p></div>
      <div className="mt-5 rounded-xl border border-dashed border-border p-4"><p className="text-sm font-medium text-foreground">本题图片与附件</p><p className="mt-1 text-xs text-subtle">正文内图片与独立附件合计最多 10 个；支持 PDF、DOC、DOCX、PPTX、PNG、JPEG、Markdown 和纯文本。</p>{question.assets?.map((asset) => <div key={asset.id} className="mt-3 flex items-center gap-2 text-sm text-foreground"><Paperclip className="h-4 w-4" />{asset.displayName}</div>)}{pendingUpload && <div ref={uploadStatusRef} tabIndex={-1} role="status" className={pendingUpload.status === 'SCANNING' ? 'mt-3 rounded-lg border border-blue-500/25 bg-blue-500/8 p-3 text-sm text-blue-700 outline-none dark:text-blue-300' : 'mt-3 rounded-lg border border-amber-500/25 bg-amber-500/8 p-3 text-sm text-amber-700 outline-none dark:text-amber-300'}><p>{pendingUpload.message}</p><p className="mt-1 text-xs opacity-80">上传意图 {pendingUpload.intentId.slice(0, 8)}… 已保留。</p>{pendingUpload.status !== 'UNSAFE' && pendingUpload.status !== 'EXPIRED' && <button type="button" disabled={busy} onClick={() => onRetryConfirm(pendingUpload)} className="btn-ghost-themed mt-2 rounded-lg px-3 py-2 text-xs">重新检查扫描状态</button>}</div>}{!submitted && !readOnly && <label className="btn-ghost-themed mt-3 inline-flex cursor-pointer items-center gap-2 rounded-lg px-4 py-2 text-sm"><FileUp className="h-4 w-4" />选择附件<input id={`file-${question.id}`} type="file" accept=".pdf,.doc,.docx,.pptx,.png,.jpg,.jpeg,.md,.markdown,.txt" className="sr-only" onChange={(event) => { const file = event.target.files?.[0]; if (file) onUpload(file); event.currentTarget.value = ''; }} /></label>}</div>
      <div className="mt-6 flex flex-wrap gap-3 border-t border-border/70 pt-5">
        {!submitted && !readOnly && <button type="button" disabled={busy} onClick={onSave} className="btn-ghost-themed inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm"><Save className="h-4 w-4" />保存本题草稿</button>}
        {!submitted && !readOnly && <button id={`submit-${question.id}`} type="button" disabled={busy || question.state === 'UPLOADING'} onClick={onSubmit} className="cta-primary inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}提交本题</button>}
        <button id={`history-${question.id}`} type="button" disabled={busy} onClick={onHistory} className="btn-ghost-themed inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm"><History className="h-4 w-4" />提交历史</button>
      </div>
    </article>
  );
}

function HistoryPanel({ attempts, headingRef, onClose, onDownload, busyAction }: { attempts: StudentAnswerAttempt[]; headingRef: React.RefObject<HTMLHeadingElement | null>; onClose: () => void; onDownload: (asset: NonNullable<StudentAnswerAttempt['assets']>[number]) => void; busyAction: string | null }) {
  return <section className="surface-card mt-4 p-5" aria-labelledby="answer-history-heading"><div className="flex items-start justify-between gap-4"><div><h2 id="answer-history-heading" ref={headingRef} tabIndex={-1} className="font-semibold text-foreground outline-none">本题提交历史</h2><p className="mt-1 text-xs text-subtle">历史尝试只读，不会覆盖当前草稿。</p></div><button type="button" onClick={onClose} className="btn-ghost-themed rounded-lg px-3 py-2 text-sm">返回本题</button></div>{attempts.length === 0 ? <p className="mt-5 text-sm text-subtle">尚无正式提交记录。</p> : <ol className="mt-5 space-y-3">{attempts.map((attempt) => <li key={attempt.id} className="rounded-xl border border-border/70 p-4"><p className="text-sm font-medium text-foreground">第 {attempt.attemptNumber} 次提交</p><p className="mt-1 text-xs text-subtle">{new Date(attempt.submittedAt).toLocaleString('zh-CN')}</p>{attempt.textSnapshot && <p className="mt-3 whitespace-pre-wrap text-sm text-subtle">{attempt.textSnapshot}</p>}{attempt.assets?.map((asset) => <button id={`download-${asset.id}`} key={asset.id} type="button" disabled={busyAction === `download:${asset.id}` || !asset.canDownload} onClick={() => onDownload(asset)} className="btn-ghost-themed mt-3 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-xs"><Paperclip className="h-3.5 w-3.5" />下载附件：{asset.displayName}</button>)}</li>)}</ol>}</section>;
}

function WorkspaceLoading() { return <div className="space-y-4" aria-busy="true" aria-label="正在加载作业"><div className="surface-card h-40 animate-pulse" /><div className="grid gap-4 lg:grid-cols-[14rem_1fr_16rem]"><div className="surface-card h-72 animate-pulse" /><div className="surface-card h-[32rem] animate-pulse" /><div className="surface-card h-52 animate-pulse" /></div></div>; }
function WorkspaceMessage({ title, description, action, alert = false }: { title: string; description: string; action: React.ReactNode; alert?: boolean }) { return <div className="surface-card px-6 py-16 text-center" role={alert ? 'alert' : undefined}><AlertCircle className="mx-auto h-9 w-9 text-subtle" /><h1 className="mt-4 text-xl font-semibold text-foreground">{title}</h1><p className="mx-auto mt-2 max-w-xl text-sm text-subtle">{description}</p><div className="mt-6">{action}</div></div>; }

async function checksumFile(file: File): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', await file.arrayBuffer());
  return `sha256:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('')}`;
}

function assignmentMimeType(file: File): string {
  if (file.type) return file.type;
  const extension = file.name.toLowerCase().split('.').pop();
  const fallback: Record<string, string> = {
    pdf: 'application/pdf',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    md: 'text/markdown',
    markdown: 'text/markdown',
    txt: 'text/plain',
  };
  return fallback[extension ?? ''] ?? 'application/octet-stream';
}

function wait(milliseconds: number) {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
