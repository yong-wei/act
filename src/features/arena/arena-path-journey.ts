import {
  resolveAdaptivePathLaunchReturnContext,
  type AdaptivePathLaunchContext,
} from '@/features/adaptive/adaptive-learning-center-contracts';

export const ARENA_PUBLICATION_CONTEXT_KEYS = ['publicationId', 'classId', 'seasonId'] as const;
type SearchParamReader = Pick<URLSearchParams, 'get'>;

export function buildArenaChallengeSearchParams(
  input: Record<string, string | string[] | undefined>,
): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    const firstValue = Array.isArray(value) ? value[0] : value;
    if (typeof firstValue === 'string') params.set(key, firstValue);
  }
  return params;
}

export function resolveArenaPathLaunchParams(
  searchParams: SearchParamReader,
  taskId: string,
): AdaptivePathLaunchContext | null {
  const context = resolveAdaptivePathLaunchReturnContext(searchParams);
  if (!context) return null;
  if (context.resourceType !== 'arena_task') return null;
  if (context.nodeId !== `arena-task:${taskId}`) return null;
  return context;
}

export function appendArenaPathLaunchParams(
  target: URLSearchParams,
  context: AdaptivePathLaunchContext,
): void {
  target.set('source', context.source);
  target.set('goal', context.goalId);
  target.set('goalId', context.goalId);
  target.set('pathId', context.pathId);
  target.set('nodeId', context.nodeId);
  target.set('intent', context.routeIntent);
  target.set('returnHref', context.returnHref);
  target.set('resourceType', context.resourceType);
}

export function buildArenaPathCompletionRequest(
  searchParams: SearchParamReader,
  taskId: string,
  submissionId: string,
): {
  href: string;
  body: {
    nodeId: string;
    resourceType: 'arena_task';
    status: 'completed';
    arenaRef: { id: string };
    idempotencyKey: string;
  };
} | null {
  const normalizedSubmissionId = submissionId.trim();
  const context = resolveArenaPathLaunchParams(searchParams, taskId);
  if (!context || !normalizedSubmissionId) return null;
  return {
    href: `/api/learning-paths/${encodeURIComponent(context.pathId)}/execute`,
    body: {
      nodeId: context.nodeId,
      resourceType: 'arena_task',
      status: 'completed',
      arenaRef: { id: normalizedSubmissionId },
      idempotencyKey: `path-arena-submission:${context.pathId}:${context.nodeId}:${normalizedSubmissionId}`,
    },
  };
}
