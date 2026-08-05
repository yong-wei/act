export type AdaptivePathCorrectionOutcomeState =
  | 'improved'
  | 'needs-review'
  | 'pending-verification'
  | 'indeterminate';

export type AdaptivePathCorrectionOutcomeLimitation =
  | 'no-follow-up-evidence'
  | 'conflicting-follow-up-evidence'
  | 'invalid-decision-timestamp'
  | 'insufficient-confidence';

export interface AdaptivePathCorrectionOutcome {
  state: AdaptivePathCorrectionOutcomeState;
  limitation: AdaptivePathCorrectionOutcomeLimitation | null;
  decisionCreatedAt: string | null;
  associatedNodeCount: number;
  evidenceCount: number;
}

export interface AdaptivePathCorrectionOutcomeDecision {
  decision?: unknown;
  createdAt?: unknown;
  applicationResult?: unknown;
}

export interface AdaptivePathCorrectionOutcomeExecution {
  nodeId?: unknown;
  resourceType?: unknown;
  status?: unknown;
  createdAt?: unknown;
  completedAt?: unknown;
  failedAt?: unknown;
}

export function projectAdaptivePathCorrectionOutcome(input: {
  decision: AdaptivePathCorrectionOutcomeDecision;
  executions: AdaptivePathCorrectionOutcomeExecution[];
  terminalNodeId?: string | null;
  terminalState?: string | null;
}): AdaptivePathCorrectionOutcome | null {
  if (input.decision.decision !== 'confirmed') return null;
  const application = readRecord(input.decision.applicationResult);
  if (application.applied !== true) return null;
  const decisionCreatedAt = toDate(input.decision.createdAt);
  const nodeIds = readStringArray(application.nodeIds);
  if (!decisionCreatedAt) {
    return {
      state: 'indeterminate',
      limitation: 'invalid-decision-timestamp',
      decisionCreatedAt: null,
      associatedNodeCount: nodeIds.length,
      evidenceCount: 0,
    };
  }
  if (nodeIds.length === 0) {
    return {
      state: 'indeterminate',
      limitation: 'insufficient-confidence',
      decisionCreatedAt: decisionCreatedAt.toISOString(),
      associatedNodeCount: 0,
      evidenceCount: 0,
    };
  }

  const nodeIdSet = new Set(nodeIds);
  const eligible = input.executions.filter((execution) => {
    const nodeId = readString(execution.nodeId);
    const resourceType = readString(execution.resourceType);
    const status = execution.status;
    const eventAt = toDate(execution.completedAt) ?? toDate(execution.failedAt) ?? toDate(execution.createdAt);
    const supportsOutcome = resourceType === 'checkpoint' ||
      resourceType === 'adaptive_quiz' ||
      nodeId === input.terminalNodeId;
    return Boolean(nodeId && nodeIdSet.has(nodeId) && supportsOutcome && eventAt && eventAt > decisionCreatedAt && (status === 'completed' || status === 'failed'));
  });
  const completed = eligible.filter((execution) => execution.status === 'completed');
  const failed = eligible.filter((execution) => execution.status === 'failed');
  const base = {
    decisionCreatedAt: decisionCreatedAt.toISOString(),
    associatedNodeCount: nodeIds.length,
    evidenceCount: eligible.length,
  };
  if (completed.length > 0 && failed.length > 0) {
    return { ...base, state: 'indeterminate', limitation: 'conflicting-follow-up-evidence' };
  }
  if (input.terminalState === 'low-confidence' && eligible.some((execution) => execution.nodeId === input.terminalNodeId)) {
    return { ...base, state: 'indeterminate', limitation: 'insufficient-confidence' };
  }
  if (completed.length > 0) {
    return { ...base, state: 'improved', limitation: null };
  }
  if (failed.length > 0) {
    return { ...base, state: 'needs-review', limitation: null };
  }
  return { ...base, state: 'pending-verification', limitation: 'no-follow-up-evidence' };
}

function readRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

function readStringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === 'string' && item.length > 0)
    : [];
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function toDate(value: unknown): Date | null {
  if (value instanceof Date && Number.isFinite(value.getTime())) return value;
  if (typeof value !== 'string') return null;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date : null;
}
