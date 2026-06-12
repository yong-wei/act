import { NextResponse } from 'next/server';

import { prisma } from '@/lib/prisma';
import { rethrowIfNextDynamicError } from '@/lib/nextjs-dynamic-error';
import {
  recordPathNodeExecution,
  updateControlCorrectionPathRoundAfterExecution,
} from '@/lib/control-correction-path-rounds';
import {
  assertCanWriteStudentPath,
  getLearningPathRequester,
  readPathForAccess,
  readPathNodeIds,
  refreshPathEvidenceFeatureCache,
  requireIdempotencyKey,
} from '../../route-helpers';

export const dynamic = 'force-dynamic';

const EXECUTION_STATUSES = new Set(['started', 'completed', 'failed', 'abandoned']);
const RESOURCE_TYPES = new Set(['knowledge_card', 'simulation', 'arena_task', 'intervention', 'ai_intervention', 'reflection']);

export async function POST(request: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const requester = await getLearningPathRequester();
    if (requester instanceof NextResponse) return requester;
    const params = await props.params;
    const path = await readPathForAccess(params.id);
    if (path instanceof NextResponse) return path;
    const denied = assertCanWriteStudentPath(requester, path);
    if (denied) return denied;

    const body = await request.json();
    const missingIdempotencyKey = requireIdempotencyKey(body.idempotencyKey);
    if (missingIdempotencyKey) return missingIdempotencyKey;
    const nodeIds = new Set(readPathNodeIds(path));
    if (
      typeof body.nodeId !== 'string' ||
      !nodeIds.has(body.nodeId) ||
      typeof body.resourceType !== 'string' ||
      !RESOURCE_TYPES.has(body.resourceType) ||
      typeof body.status !== 'string' ||
      !EXECUTION_STATUSES.has(body.status)
    ) {
      return NextResponse.json({ error: '执行事件不符合路径节点或状态契约' }, { status: 400 });
    }
    if (typeof body.idempotencyKey === 'string' && body.idempotencyKey.length > 0) {
      const existingExecution = await prisma.learningPathExecution.findFirst({
        where: {
          pathId: params.id,
          idempotencyKey: body.idempotencyKey,
        },
      });
      if (existingExecution) {
        const existingStatus = readExecutionStatus(existingExecution.status);
        let execution = existingExecution;
        if (
          typeof existingExecution.resourceType === 'string' &&
          existingStatus
        ) {
          const executionInput = {
            pathId: params.id,
            userId: path.userId,
            nodeId: existingExecution.nodeId,
            resourceType: existingExecution.resourceType,
            status: existingStatus,
            startedAt: existingExecution.startedAt ?? null,
            completedAt: existingExecution.completedAt ?? null,
            failedAt: existingExecution.failedAt ?? null,
            evidenceRefs: Array.isArray(existingExecution.evidenceRefs) ? existingExecution.evidenceRefs : [],
            liftMetadata: toRecord(existingExecution.liftMetadata),
            simulationRef: toNullableRecord(existingExecution.simulationRef),
            arenaRef: toNullableRecord(existingExecution.arenaRef),
            idempotencyKey: body.idempotencyKey ?? null,
            actorUserId: requester.userId,
            actorRole: requester.role,
          };
          const governedExecutionInput = await resolveGovernedTerminalEvidence(prisma as any, path, executionInput);
          execution = await recordPathNodeExecution(prisma as any, governedExecutionInput);
          if (path.currentNodeId === existingExecution.nodeId) {
            await updateControlCorrectionPathRoundAfterExecution(prisma as any, path, governedExecutionInput);
          }
        }
        const cacheRefresh = await refreshPathEvidenceFeatureCache(path.userId);
        return NextResponse.json({ execution: toExecutionWriteView(execution), cacheRefresh });
      }
    }
    if (path.currentNodeId !== body.nodeId) {
      return NextResponse.json({ error: '执行事件只能写入当前路径节点' }, { status: 409 });
    }
    const executionInput = await resolveGovernedTerminalEvidence(prisma as any, path, {
      pathId: params.id,
      userId: path.userId,
      nodeId: body.nodeId,
      resourceType: body.resourceType,
      status: body.status,
      startedAt: body.startedAt ?? null,
      completedAt: body.completedAt ?? null,
      failedAt: body.failedAt ?? null,
      evidenceRefs: body.evidenceRefs ?? [],
      liftMetadata: body.liftMetadata ?? {},
      simulationRef: body.simulationRef ?? null,
      arenaRef: body.arenaRef ?? null,
      idempotencyKey: body.idempotencyKey ?? null,
      actorUserId: requester.userId,
      actorRole: requester.role,
    });
    const execution = await recordPathNodeExecution(prisma as any, executionInput);
    await updateControlCorrectionPathRoundAfterExecution(prisma as any, path, executionInput);
    const cacheRefresh = await refreshPathEvidenceFeatureCache(path.userId);

    return NextResponse.json({ execution: toExecutionWriteView(execution), cacheRefresh });
  } catch (error) {
    rethrowIfNextDynamicError(error);
    console.error('[LearningPathExecute] Error:', error);
    return NextResponse.json({ error: '记录路径执行失败' }, { status: 500 });
  }
}

function readExecutionStatus(value: unknown): 'started' | 'completed' | 'failed' | 'abandoned' | null {
  return typeof value === 'string' && EXECUTION_STATUSES.has(value)
    ? value as 'started' | 'completed' | 'failed' | 'abandoned'
    : null;
}

function toRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function toNullableRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
}

function toExecutionWriteView(execution: any) {
  return {
    id: execution.id,
    nodeId: execution.nodeId,
    resourceType: execution.resourceType,
    status: execution.status,
    startedAt: execution.startedAt ?? null,
    completedAt: execution.completedAt ?? null,
    failedAt: execution.failedAt ?? null,
    createdAt: execution.createdAt ?? null,
  };
}

async function resolveGovernedTerminalEvidence<T extends {
  userId: string;
  nodeId: string;
  resourceType: string;
  simulationRef?: Record<string, unknown> | null;
  arenaRef?: Record<string, unknown> | null;
  evidenceRefs?: unknown[];
}>(
  db: any,
  path: any,
  input: T,
): Promise<T> {
  const terminalValidation = toRecord(path.terminalValidation);
  if (terminalValidation.nodeId !== input.nodeId) return input;

  const scope = readTerminalEvidenceScope(path, input.nodeId);
  const simulationRef = await resolveServerSimulationRef(db, input.userId, input.simulationRef, scope);
  const arenaRef = await resolveServerArenaRef(db, input.userId, input.arenaRef, scope);
  return {
    ...input,
    simulationRef,
    arenaRef,
    evidenceRefs: sanitizeTerminalEvidenceRefs(input.evidenceRefs, simulationRef, arenaRef),
  };
}

async function resolveServerSimulationRef(
  db: any,
  userId: string,
  clientRef: Record<string, unknown> | null | undefined,
  scope: TerminalEvidenceScope,
): Promise<Record<string, unknown> | null> {
  const id = readRefId(clientRef, ['id', 'runId', 'simulationRunId', 'ref']);
  if (!id) return null;
  const run = await db.simulationRun?.findFirst?.({
    where: {
      id,
      ownerUserId: userId,
    },
    select: {
      id: true,
      runKind: true,
      sourceDomain: true,
      status: true,
      sourceRefId: true,
      taskSpecId: true,
      resourceId: true,
      summary: true,
      replayToken: true,
      protocolVersion: true,
      completedAt: true,
    },
  });
  if (!run) {
    return unknownEvidenceRef('SimulationRun', id);
  }
  if (!matchesExpectedSimulationEvidence(run, scope)) {
    return unknownEvidenceRef('SimulationRun', id, 'simulation-scope-mismatch');
  }
  const summary = toRecord(run.summary);
  return compactObject({
    kind: 'SimulationRun',
    id: run.id,
    provenance: run.sourceDomain === 'arena_virtual_preview' || run.runKind === 'arena_preview' ? 'preview' : 'official',
    status: typeof run.status === 'string' ? run.status : undefined,
    replayConfidence: readFinite(summary.replayConfidence ?? summary.confidence),
    protocolVersion: typeof run.protocolVersion === 'string' ? run.protocolVersion : undefined,
    completedAt: run.completedAt instanceof Date ? run.completedAt.toISOString() : undefined,
    summaryMetrics: sanitizeMetricRecord(summary.metrics ?? summary),
  });
}

async function resolveServerArenaRef(
  db: any,
  userId: string,
  clientRef: Record<string, unknown> | null | undefined,
  scope: TerminalEvidenceScope,
): Promise<Record<string, unknown> | null> {
  const id = readRefId(clientRef, ['id', 'submissionId', 'runId', 'ref']);
  if (!id) return null;
  const submission = await db.arenaSubmission?.findFirst?.({
    where: {
      id,
      userId,
    },
    select: {
      id: true,
      taskId: true,
      userId: true,
      score: true,
      valid: true,
      submittedAt: true,
      evaluationRun: {
        select: {
          protocolVersion: true,
          metrics: true,
          metadata: true,
          completedAt: true,
        },
      },
    },
  });
  if (submission) {
    if (!matchesExpectedArenaEvidence(submission, scope)) {
      return unknownEvidenceRef('ArenaSubmission', id, 'arena-task-mismatch');
    }
    const evaluationRun = toRecord(submission.evaluationRun);
    const metadata = toRecord(evaluationRun.metadata);
    return compactObject({
      kind: 'ArenaSubmission',
      id: submission.id,
      taskId: submission.taskId,
      provenance: 'official',
      official: true,
      valid: typeof submission.valid === 'boolean' ? submission.valid : undefined,
      score: readFinite(submission.score),
      replayConfidence: readFinite(metadata.replayConfidence ?? metadata.confidence),
      protocolVersion: typeof evaluationRun.protocolVersion === 'string' ? evaluationRun.protocolVersion : undefined,
      submittedAt: submission.submittedAt instanceof Date ? submission.submittedAt.toISOString() : undefined,
      summaryMetrics: sanitizeMetricRecord(evaluationRun.metrics),
    });
  }

  const preview = await db.arenaVirtualSimulationRun?.findFirst?.({
    where: {
      id,
      userId,
    },
    select: {
      id: true,
      taskId: true,
      simulationRunId: true,
      payload: true,
      createdAt: true,
    },
  });
  if (preview) {
    if (!matchesExpectedArenaEvidence(preview, scope)) {
      return unknownEvidenceRef('ArenaVirtualSimulationRun', id, 'arena-task-mismatch');
    }
    const payload = toRecord(preview.payload);
    const replay = toRecord(payload.replay);
    return compactObject({
      kind: 'ArenaVirtualSimulationRun',
      id: preview.id,
      taskId: preview.taskId,
      provenance: 'preview',
      official: false,
      replayConfidence: readFinite(replay.confidence ?? payload.replayConfidence),
      simulationRunId: typeof preview.simulationRunId === 'string' ? preview.simulationRunId : undefined,
      createdAt: preview.createdAt instanceof Date ? preview.createdAt.toISOString() : undefined,
      summaryMetrics: sanitizeMetricRecord(payload.summary),
    });
  }

  return unknownEvidenceRef('ArenaSubmission', id);
}

interface TerminalEvidenceScope {
  arenaTaskId: string | null;
  simulationRefs: Set<string>;
}

function readTerminalEvidenceScope(path: any, nodeId: string): TerminalEvidenceScope {
  const terminalValidation = toRecord(path.terminalValidation);
  const pathPayload = toRecord(path.pathPayload);
  const planNodes = Array.isArray(pathPayload.planNodes) ? pathPayload.planNodes.map(toRecord) : [];
  const mainPathNodeIds = Array.isArray(pathPayload.mainPathNodeIds)
    ? pathPayload.mainPathNodeIds.filter((value): value is string => typeof value === 'string')
    : [];
  const terminalNode = planNodes.find((node) => node.nodeId === nodeId) ?? {};
  const arenaTaskId = firstString(
    terminalValidation.sourceRef,
    terminalValidation.taskId,
    terminalValidation.target,
    terminalNode.sourceRef,
    terminalNode.taskId,
    terminalNode.target,
    stripNodePrefix(nodeId, 'arena-task:'),
  );
  const simulationRefs = new Set<string>();
  for (const node of planNodes) {
    if (node.type !== 'simulation' && typeof node.nodeId === 'string' && !node.nodeId.startsWith('simulation:')) continue;
    addScopeRef(simulationRefs, node.nodeId);
    addScopeRef(simulationRefs, node.target);
    addScopeRef(simulationRefs, node.resourceId);
    addScopeRef(simulationRefs, node.taskSpecId);
  }
  for (const id of mainPathNodeIds) {
    if (id.startsWith('simulation:')) addScopeRef(simulationRefs, id);
  }
  return { arenaTaskId, simulationRefs };
}

function matchesExpectedArenaEvidence(record: Record<string, unknown>, scope: TerminalEvidenceScope): boolean {
  if (!scope.arenaTaskId) return true;
  return record.taskId === scope.arenaTaskId;
}

function matchesExpectedSimulationEvidence(record: Record<string, unknown>, scope: TerminalEvidenceScope): boolean {
  if (scope.simulationRefs.size === 0) return true;
  return [
    record.sourceRefId,
    record.resourceId,
    record.taskSpecId,
  ].some((value) => typeof value === 'string' && scope.simulationRefs.has(stripKnownNodePrefix(value)));
}

function addScopeRef(target: Set<string>, value: unknown): void {
  if (typeof value !== 'string' || !value.trim()) return;
  target.add(value);
  target.add(stripKnownNodePrefix(value));
}

function stripKnownNodePrefix(value: string): string {
  return stripNodePrefix(value, 'simulation:') ??
    stripNodePrefix(value, 'arena-task:') ??
    lastPathSegment(value);
}

function lastPathSegment(value: string): string {
  const normalized = value.trim().replace(/\/+$/, '');
  const index = normalized.lastIndexOf('/');
  return index >= 0 ? normalized.slice(index + 1) : normalized;
}

function stripNodePrefix(value: unknown, prefix: string): string | null {
  return typeof value === 'string' && value.startsWith(prefix) ? value.slice(prefix.length) : null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    if (typeof value === 'string' && value.trim()) return stripKnownNodePrefix(value);
  }
  return null;
}

function unknownEvidenceRef(kind: string, id: string, reason?: string): Record<string, unknown> {
  return compactObject({
    kind,
    id,
    provenance: 'unknown',
    official: false,
    status: kind === 'SimulationRun' ? 'unverified' : undefined,
    mismatchReason: reason,
  });
}

function sanitizeTerminalEvidenceRefs(
  refs: unknown[] | undefined,
  simulationRef: Record<string, unknown> | null,
  arenaRef: Record<string, unknown> | null,
): Array<{ kind: string; id: string }> {
  const safeRefs = Array.isArray(refs)
    ? refs
        .map((item) => {
          const ref = toRecord(item);
          const kind = typeof ref.kind === 'string' ? ref.kind : typeof ref.sourceType === 'string' ? ref.sourceType : null;
          const id = readRefId(ref, ['id', 'ref', 'sourceId']);
          if (!kind || !id || !['LearningFact', 'SimulationRun', 'ArenaSubmission', 'ArenaVirtualSimulationRun'].includes(kind)) {
            return null;
          }
          return { kind, id };
        })
        .filter((item): item is { kind: string; id: string } => Boolean(item))
    : [];
  if (typeof simulationRef?.id === 'string') safeRefs.push({ kind: 'SimulationRun', id: simulationRef.id });
  if (typeof arenaRef?.id === 'string') {
    safeRefs.push({ kind: typeof arenaRef.kind === 'string' ? arenaRef.kind : 'ArenaSubmission', id: arenaRef.id });
  }
  return safeRefs;
}

function readRefId(ref: Record<string, unknown> | null | undefined, keys: string[]): string | null {
  const record = toRecord(ref);
  for (const key of keys) {
    const value = record[key];
    if (typeof value === 'string' && value.trim()) return value;
  }
  return null;
}

function sanitizeMetricRecord(value: unknown): Record<string, number> | undefined {
  const record = toRecord(value);
  const entries = Object.entries(record).filter(([key, entry]) => {
    const lower = key.toLowerCase();
    return typeof entry === 'number' &&
      Number.isFinite(entry) &&
      !lower.includes('trace') &&
      !lower.includes('hidden') &&
      !lower.includes('raw');
  });
  return entries.length ? Object.fromEntries(entries) as Record<string, number> : undefined;
}

function readFinite(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function compactObject(value: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(value).filter(([, entry]) => entry !== undefined));
}
