'use client';

import { useState } from 'react';

import {
  buildTeacherKaqSarReviewRequest,
  type TeacherKaqEvidenceTracePayload,
  type TeacherKaqSarReviewDecision,
} from '@/lib/data-governance/teacher-kaq-evidence-trace';

export function KaqSarCandidateReview({
  payload,
  candidate,
}: {
  payload: TeacherKaqEvidenceTracePayload;
  candidate: TeacherKaqEvidenceTracePayload['candidateResources'][number];
}) {
  const [state, setState] = useState<'idle' | 'submitting' | 'reviewed' | 'failed'>('idle');
  const [rationale, setRationale] = useState('');
  const actions = candidate.review?.availableActions ?? [];
  if (actions.length === 0) return null;

  async function submitReview(decision: TeacherKaqSarReviewDecision) {
    const requestBody = buildTeacherKaqSarReviewRequest({ payload, candidate, decision, rationale });
    if (!requestBody) return;
    setState('submitting');
    const response = await fetch('/api/teacher/sar-suggested-bindings/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody),
    });
    setState(response.ok ? 'reviewed' : 'failed');
  }

  return (
    <span className="mt-2 flex flex-wrap items-center gap-1" data-teacher-kaq-sar-review="true">
      <label className="min-w-[12rem] flex-1 text-xs text-muted-foreground">
        <span className="sr-only">审查理由</span>
        <input
          type="text"
          value={rationale}
          onChange={(event) => setRationale(event.target.value)}
          placeholder="审查理由（留空使用默认审计摘要）"
          className="w-full rounded border border-border bg-card px-1.5 py-0.5 text-xs text-foreground"
          data-teacher-kaq-sar-review-rationale={candidate.id}
        />
      </label>
      {actions.map((action) => (
        <button
          key={action}
          type="button"
          className="rounded border border-border px-1.5 py-0.5 text-xs text-muted-foreground hover:border-primary hover:text-primary"
          onClick={() => void submitReview(action)}
          disabled={state === 'submitting'}
          data-teacher-kaq-sar-review-action={action}
        >
          {action}
        </button>
      ))}
      {state !== 'idle' && (
        <span data-teacher-kaq-sar-review-state={state}>
          {state === 'submitting' ? '提交中…' : state === 'reviewed' ? '已记录' : '提交失败，可重试'}
        </span>
      )}
    </span>
  );
}
