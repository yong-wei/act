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

const GOVERNED_OUTCOME_RESOURCE_TYPES = new Set([
  'lesson_step',
  'knowledge_node',
  'knowledge_card',
  'textbook_section',
  'video',
  'audio',
  'slides',
  'handout',
  'quiz',
  'adaptive_quiz',
  'control_workbench',
  'simulation',
  'arena_task',
  'external_resource',
  'checkpoint',
  'intervention',
  'ai_intervention',
  'konling',
  'reflection',
  'project',
]);

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
    return Boolean(
      nodeId &&
      nodeIdSet.has(nodeId) &&
      resourceType &&
      GOVERNED_OUTCOME_RESOURCE_TYPES.has(resourceType) &&
      eventAt &&
      eventAt > decisionCreatedAt &&
      (status === 'completed' || status === 'failed' || status === 'abandoned'),
    );
  });
  const base = {
    decisionCreatedAt: decisionCreatedAt.toISOString(),
    associatedNodeCount: nodeIds.length,
    evidenceCount: eligible.length,
  };

  // Ordinary node activity is evidence that the learner reached the node, not a
  // capability check. Only governed checkpoints and terminal validation can
  // produce an improved or needs-review result.
  const verificationResults = eligible
    .map((execution) => classifyVerificationEvidence(execution, input.terminalNodeId, input.terminalState))
    .filter((result): result is Exclude<ReturnType<typeof classifyVerificationEvidence>, null> => result !== null);
  const hasVerificationPass = verificationResults.includes('passed');
  const hasVerificationFailure = verificationResults.includes('failed');
  if (verificationResults.includes('low-confidence')) {
    return { ...base, state: 'indeterminate', limitation: 'insufficient-confidence' };
  }
  if (verificationResults.includes('indeterminate') || (hasVerificationPass && hasVerificationFailure)) {
    return { ...base, state: 'indeterminate', limitation: 'conflicting-follow-up-evidence' };
  }
  if (hasVerificationPass) {
    return { ...base, state: 'improved', limitation: null };
  }
  if (hasVerificationFailure) {
    return { ...base, state: 'needs-review', limitation: null };
  }
  if (eligible.length > 0) {
    return { ...base, state: 'pending-verification', limitation: 'insufficient-confidence' };
  }
  return { ...base, state: 'pending-verification', limitation: 'no-follow-up-evidence' };
}

function classifyVerificationEvidence(
  execution: AdaptivePathCorrectionOutcomeExecution,
  terminalNodeId: string | null | undefined,
  terminalState: string | null | undefined,
): 'passed' | 'failed' | 'indeterminate' | 'low-confidence' | null {
  const nodeId = readString(execution.nodeId);
  const resourceType = readString(execution.resourceType);
  const isTerminal = Boolean(nodeId && nodeId === terminalNodeId);
  if (!isTerminal && resourceType !== 'checkpoint' && resourceType !== 'adaptive_quiz') return null;

  if (isTerminal) {
    if (terminalState === 'low-confidence') return 'low-confidence';
    if (terminalState === 'failed' || execution.status === 'failed') return 'failed';
    if ((terminalState === 'completed' || terminalState === 'passed') && execution.status === 'completed') return 'passed';
    return null;
  }

  if (execution.status === 'completed') return 'passed';
  if (execution.status === 'failed') return 'failed';
  return null;
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
