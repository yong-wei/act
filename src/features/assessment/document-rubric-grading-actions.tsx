'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type ApprovalState = 'idle' | 'submitting' | 'success' | 'error';

type DocumentGradingCriterion = { criterionId: string; label: string; selectedLevelId: string | null; editableScore: number | null; aiLevelId?: string | null; aiScore?: number | null; teacherComment?: string | null; levels?: Array<{ id: string; label: string; minPoints: number; maxPoints: number }> };
type DocumentGradingEdit = { criterionId: string; levelId: string; score: number; comment: string };

export function selectModifiedDocumentGradingEdits(
  criteria: DocumentGradingCriterion[],
  edits: DocumentGradingEdit[],
): DocumentGradingEdit[] {
  const originalByCriterionId = new Map(criteria.map((criterion) => [criterion.criterionId, criterion]));
  return edits.filter((edit) => {
    const original = originalByCriterionId.get(edit.criterionId);
    return !original
      || edit.levelId !== (original.selectedLevelId ?? '')
      || edit.score !== (original.editableScore ?? 0)
      || edit.comment !== (original.teacherComment ?? '');
  });
}

export function DocumentGradingApprovalButton({ gradingRunId, criteria = [] }: { gradingRunId: string; criteria?: DocumentGradingCriterion[] }) {
  const router = useRouter();
  const [state, setState] = useState<ApprovalState>('idle');
  const [message, setMessage] = useState<string | null>(null);
  const [edits, setEdits] = useState(() => criteria.map((criterion) => ({ criterionId: criterion.criterionId, levelId: criterion.selectedLevelId ?? '', score: criterion.editableScore ?? 0, comment: criterion.teacherComment ?? '' })));

  async function approve() {
    if (state === 'submitting' || state === 'success') return;

    setState('submitting');
    setMessage(null);

    try {
      const response = await fetch('/api/teacher/document-grading/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gradingRunId,
          decision: 'approved',
          edits: selectModifiedDocumentGradingEdits(criteria, edits),
        }),
      });
      const payload = await response.json().catch(() => null) as {
        error?: unknown;
        status?: unknown;
        gradingRunId?: unknown;
      } | null;

      if (!response.ok) {
        throw new Error(typeof payload?.error === 'string' ? payload.error : '审批文档评分失败');
      }
      if (payload?.status !== 'approved' || payload?.gradingRunId !== gradingRunId) {
        throw new Error('审批响应无效，请重试。');
      }

      setState('success');
      setMessage('审批成功，正在刷新工作台。');
      router.refresh();
    } catch (error) {
      setState('error');
      setMessage(error instanceof Error ? error.message : '审批文档评分失败，请重试。');
    }
  }

  return (
    <div data-document-grading-approval="active" className="space-y-4">
      {criteria.map((criterion, index) => <fieldset key={criterion.criterionId} className="rounded border border-border p-3"><legend className="px-1 text-sm font-medium">{criterion.label}</legend><p className="text-xs text-muted-foreground">AI 原值：{criterion.aiLevelId ?? '未选择'} · {criterion.aiScore ?? '-'}；教师最终值如下。证据锚点为只读。</p><div className="mt-2 grid gap-2 sm:grid-cols-3"><select aria-label={`${criterion.label}等级`} value={edits[index]?.levelId} onChange={(event) => setEdits((current) => current.map((edit, itemIndex) => itemIndex === index ? { ...edit, levelId: event.target.value } : edit))} className="rounded border border-border bg-background px-2 py-2 text-sm">{criterion.levels?.map((level) => <option key={level.id} value={level.id}>{level.label}（{level.minPoints}–{level.maxPoints}）</option>)}</select><input aria-label={`${criterion.label}分数`} type="number" min={criterion.levels?.find((level) => level.id === edits[index]?.levelId)?.minPoints ?? 0} max={criterion.levels?.find((level) => level.id === edits[index]?.levelId)?.maxPoints} value={edits[index]?.score} onChange={(event) => setEdits((current) => current.map((edit, itemIndex) => itemIndex === index ? { ...edit, score: Number(event.target.value) } : edit))} className="rounded border border-border bg-background px-2 py-2 text-sm"/><input aria-label={`${criterion.label}教师评语`} value={edits[index]?.comment} onChange={(event) => setEdits((current) => current.map((edit, itemIndex) => itemIndex === index ? { ...edit, comment: event.target.value } : edit))} className="rounded border border-border bg-background px-2 py-2 text-sm"/></div></fieldset>)}
      <button
        type="button"
        onClick={() => void approve()}
        disabled={state === 'submitting' || state === 'success'}
        aria-busy={state === 'submitting'}
        className="rounded border border-border px-3 py-2 text-sm text-foreground transition hover:border-primary hover:text-primary"
      >
        {state === 'submitting' ? '提交中…' : state === 'success' ? '已批准' : '批准返回'}
      </button>
      {state !== 'idle' && message ? (
        <span
          className="ml-2 text-xs text-muted-foreground"
          role={state === 'error' ? 'alert' : 'status'}
          aria-live={state === 'error' ? 'assertive' : 'polite'}
        >
          {message}
        </span>
      ) : null}
    </div>
  );
}
