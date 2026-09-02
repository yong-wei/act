import type { WorkbenchSessionContext } from './types';

export function getControlWorkbenchReturnHref(session: WorkbenchSessionContext) {
  if (!('taskId' in session)) return '/interactive-learning/cross-domain-exploration';
  if (!('publicationId' in session)) return `/arena/challenges/${session.taskId}`;

  const params = new URLSearchParams({ publicationId: session.publicationId });
  return `/arena/challenges/${session.taskId}?${params.toString()}`;
}

export function getControlWorkbenchLaunchKind(session: WorkbenchSessionContext) {
  if (!('taskId' in session)) return 'standalone';
  return session.submissionPolicy.officialEvaluationEnabled
    ? 'official-evaluation'
    : 'arena-preview';
}
