'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';

import {
  buildAdaptivePathCompletionRequest,
  resolveAdaptivePathLaunchReturnContext,
} from '@/features/personalization/experience/adaptive-learning-center-contracts';
import { publishAdaptivePathJourneyResponse } from '@/features/personalization/experience/adaptive-path-journey-control';

export function TextbookPathCompletionBar() {
  const search = useSearchParams();
  const context = resolveAdaptivePathLaunchReturnContext(search);
  const [pending, setPending] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!context) return null;

  async function completeReading() {
    if (!context || pending || completed) return;
    const request = buildAdaptivePathCompletionRequest({
      launchContext: context,
      completedAt: new Date().toISOString(),
    });
    if (!request) return;
    setPending(true);
    setError(null);
    try {
      const response = await fetch(request.href, {
        method: request.method,
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(request.body),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error('complete-failed');
      publishAdaptivePathJourneyResponse(result);
      setCompleted(true);
    } catch {
      setError('记录阅读完成失败，请重试。');
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="border-b border-border bg-card px-4 py-3 sm:px-6"
      data-textbook-path-completion="available"
    >
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-3">
        <p className="text-sm text-muted-foreground">
          读完本章节后，需要明确记录完成，学习路径才会进入下一步。
        </p>
        <button
          type="button"
          onClick={() => void completeReading()}
          disabled={pending || completed}
          className="inline-flex items-center gap-2 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
        >
          <CheckCircle2 className="h-4 w-4" />
          {completed ? '已记录阅读完成' : pending ? '正在记录…' : '我已完成阅读'}
        </button>
        <Link
          href={context.returnHref}
          className="text-sm text-primary hover:underline"
        >
          返回学习路径
        </Link>
        {error ? <p role="alert" className="w-full text-sm text-destructive">{error}</p> : null}
      </div>
    </div>
  );
}
