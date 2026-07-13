'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

type ApprovalState = 'idle' | 'submitting' | 'success' | 'error';

export function DocumentGradingApprovalButton({ gradingRunId }: { gradingRunId: string }) {
  const router = useRouter();
  const [state, setState] = useState<ApprovalState>('idle');
  const [message, setMessage] = useState<string | null>(null);

  async function approve() {
    if (state === 'submitting' || state === 'success') return;

    setState('submitting');
    setMessage(null);

    try {
      const response = await fetch('/api/teacher/document-grading/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gradingRunId, decision: 'approved' }),
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
    <span data-document-grading-approval="active">
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
    </span>
  );
}
