'use client';

import { useState } from 'react';

export function DocumentGradingApprovalButton({ gradingRunId }: { gradingRunId: string }) {
  const [status, setStatus] = useState<'idle' | 'submitting' | 'approved' | 'failed'>('idle');

  async function approve() {
    setStatus('submitting');
    const response = await fetch('/api/teacher/document-grading/approve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ gradingRunId, decision: 'approved' }),
    });
    setStatus(response.ok ? 'approved' : 'failed');
  }

  return (
    <button
      type="button"
      onClick={approve}
      disabled={status === 'submitting' || status === 'approved'}
      className="rounded border border-border px-3 py-2 text-sm text-foreground transition hover:border-primary hover:text-primary disabled:cursor-not-allowed disabled:opacity-60"
    >
      {status === 'submitting' ? 'approving' : status === 'approved' ? 'approved' : 'approve'}
    </button>
  );
}
