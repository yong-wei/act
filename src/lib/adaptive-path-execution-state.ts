export type AdaptivePathExecutionNodeStatus =
  | 'current'
  | 'completed'
  | 'skipped'
  | 'blocked'
  | 'locked'
  | 'next'
  | 'optional';

export function resolveAdaptivePathExecutionNodeStatus(input: {
  completed: boolean;
  failed: boolean;
  skipped: boolean;
  current: boolean;
  rawStatus: string;
  readinessState: string;
  pendingResult: boolean;
}): AdaptivePathExecutionNodeStatus {
  if (input.current && input.completed && input.pendingResult) return 'current';
  if (input.completed) return 'completed';
  if (input.failed || input.rawStatus === 'blocked') return 'blocked';
  if (
    input.rawStatus === 'locked' ||
    input.readinessState === 'locked' ||
    input.readinessState === 'evidence-needed' ||
    input.readinessState === 'needs-preparation'
  ) return 'locked';
  if (input.current || input.rawStatus === 'current') return 'current';
  if (input.skipped) return 'skipped';
  if (input.rawStatus === 'next') return 'next';
  return 'optional';
}
