'use client';

import { useCallback, useRef, useState } from 'react';
import { ChevronRight, Loader2 } from 'lucide-react';
import { useOptionalInteractiveContext } from '@/features/interactive';
import type { WidgetResult } from '@/resources/widgets/widget-props';

interface PathResourceContinueActionProps {
  enabled: boolean;
  result: WidgetResult;
  onBeforeComplete?: () => void | Promise<void>;
  onComplete?: (result?: WidgetResult) => void | Promise<void>;
}

export function PathResourceContinueAction({
  enabled,
  result,
  onBeforeComplete,
  onComplete,
}: PathResourceContinueActionProps) {
  const interactive = useOptionalInteractiveContext();
  const [completionStatus, setCompletionStatus] = useState<'idle' | 'pending' | 'error' | 'success'>('idle');
  const [completionError, setCompletionError] = useState<string | null>(null);
  const completionInFlightRef = useRef(false);

  const handleContinue = useCallback(async () => {
    if (!enabled || completionInFlightRef.current) return;
    completionInFlightRef.current = true;
    setCompletionStatus('pending');
    setCompletionError(null);
    try {
      await onBeforeComplete?.();
      if (onComplete) {
        await onComplete(result);
      } else {
        await interactive?.progress.markComplete(result);
      }
      setCompletionStatus('success');
    } catch {
      completionInFlightRef.current = false;
      setCompletionStatus('error');
      setCompletionError('路径进度未能确认，请重试。');
    }
  }, [enabled, interactive, onBeforeComplete, onComplete, result]);

  if (!enabled) return null;

  return (
    <div className="mt-4 flex flex-col gap-2" data-path-resource-continue={completionStatus}>
      {completionError ? (
        <p role="alert" className="text-xs text-rose-600 dark:text-rose-300">
          {completionError}
        </p>
      ) : null}
      <button
        type="button"
        onClick={() => {
          void handleContinue();
        }}
        disabled={completionStatus === 'pending' || completionStatus === 'success'}
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-70"
      >
        {completionStatus === 'pending' ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            正在提交
          </>
        ) : completionStatus === 'error' ? (
          '重试'
        ) : (
          <>
            继续下一步
            <ChevronRight className="h-4 w-4" />
          </>
        )}
      </button>
    </div>
  );
}
