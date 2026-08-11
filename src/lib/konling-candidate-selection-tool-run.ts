interface CandidateSelectionToolRunDb {
  agentToolRun: {
    findFirst(args: any): Promise<any | null>;
    updateMany(args: any): Promise<{ count: number }>;
  };
}

export interface KonlingCandidateSelectionToolRunIdentity {
  toolRunId: string;
  actorUserId: string;
  targetUserId: string;
  batchId: string;
  candidateId: string;
  pathId: string;
  goalId: string;
  idempotencyKey: string;
}

export interface KonlingCandidateSelectionToolRunCompletion extends KonlingCandidateSelectionToolRunIdentity {
  selectedOptionId: string;
  selectedStyleId: string;
  studentSafeRationale: string;
}

export class KonlingCandidateSelectionToolRunError extends Error {
  constructor(readonly status: number, message: string) {
    super(message);
  }
}

export async function bindKonlingCandidateSelectionToolRun(
  db: CandidateSelectionToolRunDb,
  input: KonlingCandidateSelectionToolRunIdentity,
): Promise<void> {
  const toolRun = await db.agentToolRun.findFirst({
    where: selectionToolRunWhere(input, { in: ['running', 'succeeded'] }),
  });
  if (!toolRun) throw new KonlingCandidateSelectionToolRunError(404, 'Candidate selection tool run was not found in the current scope');

  const summary = recordValue(toolRun.inputSummary);
  assertSelectionInputMatches(summary, input, false);

  if (stringValue(summary.candidateId) === input.candidateId) return;

  const updated = await db.agentToolRun.updateMany({
    where: { id: toolRun.id, status: 'running', inputSummary: { equals: summary } },
    data: {
      inputSummary: {
        ...summary,
        batchId: input.batchId,
        candidateId: input.candidateId,
        pathId: input.pathId,
        goalId: input.goalId,
      },
    },
  });
  if (updated.count === 1) return;

  const converged = await db.agentToolRun.findFirst({
    where: selectionToolRunWhere(input, { in: ['running', 'succeeded'] }),
  });
  if (!converged) throw new KonlingCandidateSelectionToolRunError(409, 'Candidate selection tool run status changed');
  assertSelectionInputMatches(recordValue(converged.inputSummary), input, true);
}

export async function completeKonlingCandidateSelectionToolRun(
  db: CandidateSelectionToolRunDb,
  input: KonlingCandidateSelectionToolRunCompletion & {
    complete?: boolean;
  },
): Promise<void> {
  const toolRun = await db.agentToolRun.findFirst({
    where: selectionToolRunWhere(input, { in: ['running', 'succeeded'] }),
  });
  if (!toolRun) throw new KonlingCandidateSelectionToolRunError(404, 'Candidate selection tool run was not found in the current scope');
  assertSelectionInputMatches(recordValue(toolRun.inputSummary), input, true);

  const output = buildKonlingCandidateSelectionToolResult(input);
  if (toolRun.status === 'succeeded') {
    assertSelectionOutputMatches(recordValue(toolRun.outputSummary), output);
    return;
  }
  if (input.complete === false) return;
  const completedAt = new Date();
  const startedAt = toolRun.startedAt instanceof Date ? toolRun.startedAt : new Date(toolRun.startedAt);
  const updated = await db.agentToolRun.updateMany({
    where: { id: toolRun.id, status: 'running' },
    data: {
      status: 'succeeded', outputSummary: output, completedAt,
      latencyMs: Number.isFinite(startedAt.getTime()) ? Math.max(0, completedAt.getTime() - startedAt.getTime()) : null,
    },
  });
  if (updated.count === 1) return;

  const converged = await db.agentToolRun.findFirst({
    where: selectionToolRunWhere(input, 'succeeded'),
  });
  if (!converged) throw new KonlingCandidateSelectionToolRunError(409, 'Candidate selection tool run status changed');
  assertSelectionInputMatches(recordValue(converged.inputSummary), input, true);
  assertSelectionOutputMatches(recordValue(converged.outputSummary), output);
}

export function buildKonlingCandidateSelectionToolResult(input: KonlingCandidateSelectionToolRunCompletion) {
  return {
    status: 'selected', toolRunId: input.toolRunId, batchId: input.batchId,
    candidateId: input.candidateId, pathId: input.pathId, goalId: input.goalId,
    selectedOptionId: input.selectedOptionId, selectedStyleId: input.selectedStyleId,
    idempotencyKey: input.idempotencyKey, autoStart: false,
    studentSafeRationale: input.studentSafeRationale,
  };
}

function selectionToolRunWhere(input: KonlingCandidateSelectionToolRunIdentity, status: unknown) {
  return {
    id: input.toolRunId,
    actorUserId: input.actorUserId,
    targetUserId: input.targetUserId,
    ownerUserId: input.targetUserId,
    toolName: 'select_learning_path',
    idempotencyKey: input.idempotencyKey,
    status,
  };
}

function assertSelectionInputMatches(
  summary: Record<string, unknown>,
  input: KonlingCandidateSelectionToolRunIdentity,
  requireCandidate: boolean,
): void {
  if (
    stringValue(summary.batchId) !== input.batchId
    || (requireCandidate
      ? stringValue(summary.candidateId) !== input.candidateId
      : stringValue(summary.candidateId) && stringValue(summary.candidateId) !== input.candidateId)
    || (stringValue(summary.pathId) && stringValue(summary.pathId) !== input.pathId)
    || (stringValue(summary.goalId) && stringValue(summary.goalId) !== input.goalId)
  ) throw new KonlingCandidateSelectionToolRunError(409, 'Candidate selection does not match the tool run identity');
}

function assertSelectionOutputMatches(
  prior: Record<string, unknown>,
  expected: ReturnType<typeof buildKonlingCandidateSelectionToolResult>,
): void {
  for (const [key, value] of Object.entries(expected)) {
    if (prior[key] !== value) {
      throw new KonlingCandidateSelectionToolRunError(409, 'Completed candidate selection tool run has a different result');
    }
  }
}

function recordValue(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}
