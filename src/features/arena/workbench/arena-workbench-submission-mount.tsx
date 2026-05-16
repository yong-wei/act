'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { ArenaSubmissionPanel } from '../submissions/arena-submission-panel';
import type { ArenaSubmissionRecord } from '../submissions/submission-service';
import type { WorkspaceMode } from '../types';
import { getEvaluableControllerMethods } from '../submissions/controller-artifact-builder';
import { resolveArenaWorkbenchContext } from './context';

export function ArenaWorkbenchSubmissionMount({
  workspaceMode,
  className = 'mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8',
}: {
  workspaceMode: WorkspaceMode;
  className?: string;
}) {
  const searchParams = useSearchParams();
  const arenaTaskId = searchParams.get('arenaTask');
  const arenaContext = useMemo(
    () => (arenaTaskId ? resolveArenaWorkbenchContext(arenaTaskId) : null),
    [arenaTaskId],
  );
  const [submissions, setSubmissions] = useState<ArenaSubmissionRecord[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setSubmissions(null);

    if (!arenaContext || arenaContext.recommendedWorkspaceMode !== workspaceMode) {
      return () => {
        cancelled = true;
      };
    }

    fetch(`/api/arena/submissions?taskId=${encodeURIComponent(arenaContext.task.id)}`, {
      cache: 'no-store',
    })
      .then(async (response) => {
        const payload = await response.json() as {
          submissions?: ArenaSubmissionRecord[];
        };
        if (!cancelled) {
          setSubmissions(response.ok ? payload.submissions ?? [] : []);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSubmissions([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [arenaContext, workspaceMode]);

  if (!arenaContext || arenaContext.recommendedWorkspaceMode !== workspaceMode) {
    return null;
  }

  if (getEvaluableControllerMethods(arenaContext.task).length === 0) {
    return null;
  }

  if (submissions === null) {
    return (
      <div className={className}>
        <section className="surface-card p-6 text-sm text-subtle">正在加载竞技场提交记录...</section>
      </div>
    );
  }

  return (
    <div className={className}>
      <ArenaSubmissionPanel key={arenaContext.task.id} task={arenaContext.task} initialSubmissions={submissions} />
    </div>
  );
}
