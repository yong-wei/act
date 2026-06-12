'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { ArenaBlackBoxSubmissionPanel } from '../submissions/arena-blackbox-submission-panel';
import {
  ArenaSubmissionPanel,
  type CompositeSubmissionDraft,
  type PredictiveSubmissionDraft,
} from '../submissions/arena-submission-panel';
import type { ArenaSubmissionRecord } from '../submissions/submission-service';
import type { WorkspaceMode } from '../types';
import {
  getEvaluableControllerMethods,
  type EvaluableControllerMethod,
} from '../submissions/controller-artifact-builder';
import { resolveArenaWorkbenchContext } from './context';
import { resolveWorkbenchOfficialOnlyMetricIds } from './official-only-metrics';

interface SubmissionLoadState {
  key: string;
  submissions: ArenaSubmissionRecord[];
  viewerUserId?: string;
}

export function ArenaWorkbenchSubmissionMount({
  workspaceMode,
  className = 'mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8',
  compositeDraft,
  onCompositeDraftChange,
  predictiveDraft,
  onPredictiveDraftChange,
  officialOnlyMetricIds,
  evaluationModeLabel,
  preferredControllerMethod,
}: {
  workspaceMode: WorkspaceMode;
  className?: string;
  compositeDraft?: CompositeSubmissionDraft;
  onCompositeDraftChange?: (draft: CompositeSubmissionDraft) => void;
  predictiveDraft?: PredictiveSubmissionDraft;
  onPredictiveDraftChange?: (draft: PredictiveSubmissionDraft) => void;
  officialOnlyMetricIds?: string[];
  evaluationModeLabel?: string;
  preferredControllerMethod?: EvaluableControllerMethod;
}) {
  const searchParams = useSearchParams();
  const arenaTaskId = searchParams.get('arenaTask');
  const publicationId = searchParams.get('publicationId')?.trim() || undefined;
  const arenaContext = useMemo(
    () => (arenaTaskId ? resolveArenaWorkbenchContext(arenaTaskId) : null),
    [arenaTaskId],
  );
  const requestKey = arenaContext && arenaContext.recommendedWorkspaceMode === workspaceMode
    ? `${arenaContext.task.id}:${publicationId ?? 'open'}`
    : null;
  const [submissionState, setSubmissionState] = useState<SubmissionLoadState | null>(null);

  useEffect(() => {
    let cancelled = false;

    if (!arenaContext || !requestKey) {
      return () => {
        cancelled = true;
      };
    }

    const submissionParams = new URLSearchParams({ taskId: arenaContext.task.id });
    if (publicationId) {
      submissionParams.set('publicationId', publicationId);
    }

    fetch(`/api/arena/submissions?${submissionParams.toString()}`, {
      cache: 'no-store',
    })
      .then(async (response) => {
        const payload = await response.json() as {
          submissions?: ArenaSubmissionRecord[];
          viewerUserId?: string;
        };
        if (!cancelled) {
          setSubmissionState({
            key: requestKey,
            submissions: response.ok ? payload.submissions ?? [] : [],
            viewerUserId: response.ok ? payload.viewerUserId : undefined,
          });
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSubmissionState({ key: requestKey, submissions: [] });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [arenaContext, publicationId, requestKey]);

  if (!arenaContext || arenaContext.recommendedWorkspaceMode !== workspaceMode) {
    return null;
  }

  if (workspaceMode !== 'black-box-identification' && getEvaluableControllerMethods(arenaContext.task).length === 0) {
    return null;
  }

  const resolvedOfficialOnlyMetricIds = resolveWorkbenchOfficialOnlyMetricIds({
    workspaceMode,
    task: arenaContext.task,
    explicitMetricIds: officialOnlyMetricIds,
  });

  const loadedSubmissionState = submissionState?.key === requestKey ? submissionState : null;

  if (loadedSubmissionState === null) {
    return (
      <div className={className}>
        <section className="surface-card p-6 text-sm text-subtle">正在加载竞技场提交记录...</section>
      </div>
    );
  }

  if (workspaceMode === 'black-box-identification') {
    return (
      <div className={className}>
        <ArenaBlackBoxSubmissionPanel
          key={`${arenaContext.task.id}:${publicationId ?? 'open'}`}
          task={arenaContext.task}
          initialSubmissions={loadedSubmissionState.submissions}
          publicationId={publicationId}
          viewerUserId={loadedSubmissionState.viewerUserId}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <ArenaSubmissionPanel
        key={`${arenaContext.task.id}:${publicationId ?? 'open'}`}
        task={arenaContext.task}
        initialSubmissions={loadedSubmissionState.submissions}
        publicationId={publicationId}
        viewerUserId={loadedSubmissionState.viewerUserId}
        compositeDraft={compositeDraft}
        onCompositeDraftChange={onCompositeDraftChange}
        predictiveDraft={predictiveDraft}
        onPredictiveDraftChange={onPredictiveDraftChange}
        officialOnlyMetricIds={resolvedOfficialOnlyMetricIds}
        evaluationModeLabel={evaluationModeLabel}
        preferredControllerMethod={preferredControllerMethod}
      />
    </div>
  );
}
