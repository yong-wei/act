'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';

import { ArenaBlackBoxSubmissionPanel } from '../submissions/arena-blackbox-submission-panel';
import {
  ArenaSubmissionPanel,
  type CompositeSubmissionDraft,
} from '../submissions/arena-submission-panel';
import type { ArenaSubmissionRecord } from '../submissions/submission-service';
import type { WorkspaceMode } from '../types';
import {
  getEvaluableControllerMethods,
  type EvaluableControllerMethod,
} from '../submissions/controller-artifact-builder';
import { resolveArenaWorkbenchContext } from './context';

export function ArenaWorkbenchSubmissionMount({
  workspaceMode,
  className = 'mx-auto max-w-6xl px-4 pb-12 sm:px-6 lg:px-8',
  compositeDraft,
  onCompositeDraftChange,
  evaluationModeLabel,
  preferredControllerMethod,
}: {
  workspaceMode: WorkspaceMode;
  className?: string;
  compositeDraft?: CompositeSubmissionDraft;
  onCompositeDraftChange?: (draft: CompositeSubmissionDraft) => void;
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
  const [submissions, setSubmissions] = useState<ArenaSubmissionRecord[] | null>(null);
  const [viewerUserId, setViewerUserId] = useState<string | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;
    setSubmissions(null);
    setViewerUserId(undefined);

    if (!arenaContext || arenaContext.recommendedWorkspaceMode !== workspaceMode) {
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
          setSubmissions(response.ok ? payload.submissions ?? [] : []);
          setViewerUserId(response.ok ? payload.viewerUserId : undefined);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setSubmissions([]);
          setViewerUserId(undefined);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [arenaContext, publicationId, workspaceMode]);

  if (!arenaContext || arenaContext.recommendedWorkspaceMode !== workspaceMode) {
    return null;
  }

  if (workspaceMode !== 'black-box-identification' && getEvaluableControllerMethods(arenaContext.task).length === 0) {
    return null;
  }

  if (submissions === null) {
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
          initialSubmissions={submissions}
          publicationId={publicationId}
          viewerUserId={viewerUserId}
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <ArenaSubmissionPanel
        key={`${arenaContext.task.id}:${publicationId ?? 'open'}`}
        task={arenaContext.task}
        initialSubmissions={submissions}
        publicationId={publicationId}
        viewerUserId={viewerUserId}
        compositeDraft={compositeDraft}
        onCompositeDraftChange={onCompositeDraftChange}
        evaluationModeLabel={evaluationModeLabel}
        preferredControllerMethod={preferredControllerMethod}
      />
    </div>
  );
}
