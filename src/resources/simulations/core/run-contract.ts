import { createHash } from 'node:crypto';

export type SimulationTaskSpecSchemaVersion = 'simulation-task-spec-v1';
export type SimulationRunKind = 'scene_simulation' | 'arena_preview' | 'teacher_batch' | 'agent_experiment';
export type SimulationSourceDomain =
  | 'simulation_scene'
  | 'arena_virtual_preview'
  | 'arena_official_evaluation'
  | 'konling_agent'
  | 'teacher_batch';
export type SimulationRunStatus = 'queued' | 'running' | 'completed' | 'failed' | 'abandoned';
export type SimulationAccessRole = 'STUDENT' | 'TEACHER' | 'ADMIN';
export type SimulationAccessScope = 'owner' | 'class-summary' | 'audit-summary' | 'none';

export interface SimulationTaskLaunchContextV1 {
  courseId?: string;
  classId?: string;
  sessionId?: string;
  lessonId?: string;
  resourceId?: string;
  publicationId?: string;
  assignmentId?: string;
  agentSessionId?: string;
  pageId?: string;
}

export interface SimulationEvaluationSpecRefV1 {
  id: string;
  visibility?: 'preview' | 'official' | 'both';
}

export interface SimulationTaskSpecInputV1 {
  sceneId: string;
  scenarioId: string;
  objectives: string[];
  constraints: string[];
  disturbancePolicy: Record<string, unknown>;
  evaluationSpecRef: SimulationEvaluationSpecRefV1;
  allowedControllers: string[];
  launchContext?: SimulationTaskLaunchContextV1;
}

export interface SimulationTaskSpecV1 extends SimulationTaskSpecInputV1 {
  schemaVersion: SimulationTaskSpecSchemaVersion;
  launchContext: SimulationTaskLaunchContextV1;
  specHash: string;
}

export interface SimulationRunEnvelopeV1 {
  id: string;
  ownerUserId?: string | null;
  classId?: string | null;
  courseId?: string | null;
  sessionId?: string | null;
  resourceId?: string | null;
  publicationId?: string | null;
  runKind: SimulationRunKind;
  sourceDomain: SimulationSourceDomain;
  sourceRefId: string;
  taskSpec: SimulationTaskSpecV1;
  controllerSnapshotRef?: string | null;
  status: SimulationRunStatus;
  summary: Record<string, unknown>;
  replayToken?: string | null;
  seed?: number | null;
  protocolVersion: string;
  runtimeVersion: string;
  modelVersion: string;
  sceneSpecVersion?: string | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface SimulationTraceRecordV1 {
  id: string;
  runId: string;
  protocolVersion: string;
  runtimeVersion: string;
  modelVersion: string;
  seed?: number | null;
  checksum: string;
  summaryMetrics: Record<string, unknown>;
  sampleCount: number;
  sampleCadence: number;
  sampleStorageUri?: string | null;
  createdAt: string;
}

export interface SimulationRunValidationResult {
  ok: boolean;
  issues: string[];
}

export interface SimulationAccessRequester {
  userId: string;
  role: SimulationAccessRole;
  classIds?: string[];
  allowRawTraceAudit?: boolean;
}

export interface SimulationAccessDecision {
  allowed: boolean;
  scope: SimulationAccessScope;
  rawTraceAllowed: boolean;
}

const USER_OWNED_RUN_KINDS = new Set<SimulationRunKind>([
  'scene_simulation',
  'arena_preview',
  'agent_experiment',
]);

function stableJson(value: unknown): string {
  return JSON.stringify(sortValue(value));
}

function sortValue(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortValue);
  }
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, nested]) => [key, sortValue(nested)]),
    );
  }
  return value;
}

function sha256(value: unknown): string {
  return `sha256:${createHash('sha256').update(stableJson(value)).digest('hex')}`;
}

export function buildSimulationTaskSpec(input: SimulationTaskSpecInputV1): SimulationTaskSpecV1 {
  const withoutHash = {
    schemaVersion: 'simulation-task-spec-v1' as const,
    sceneId: input.sceneId,
    scenarioId: input.scenarioId,
    objectives: input.objectives,
    constraints: input.constraints,
    disturbancePolicy: input.disturbancePolicy,
    evaluationSpecRef: input.evaluationSpecRef,
    allowedControllers: input.allowedControllers,
    launchContext: input.launchContext ?? {},
  };

  return {
    ...withoutHash,
    specHash: sha256(withoutHash),
  };
}

export function validateSimulationRunEnvelope(run: SimulationRunEnvelopeV1): SimulationRunValidationResult {
  const issues: string[] = [];

  if (!run.id.trim()) issues.push('id is required');
  if (!run.sourceRefId.trim()) issues.push('sourceRefId is required');
  if (USER_OWNED_RUN_KINDS.has(run.runKind) && !run.ownerUserId) {
    issues.push('ownerUserId is required for user-owned run kinds');
  }
  if (run.runKind === 'teacher_batch' && !run.classId && !run.courseId) {
    issues.push('teacher_batch requires classId or courseId scope');
  }
  if (!run.taskSpec.specHash.startsWith('sha256:')) {
    issues.push('taskSpec.specHash must use sha256');
  }

  return {
    ok: issues.length === 0,
    issues,
  };
}

export function authorizeSimulationRunAccess(input: {
  requester: SimulationAccessRequester;
  run: SimulationRunEnvelopeV1;
}): SimulationAccessDecision {
  const { requester, run } = input;

  if (requester.role === 'STUDENT') {
    const allowed = Boolean(run.ownerUserId && run.ownerUserId === requester.userId);
    return {
      allowed,
      scope: allowed ? 'owner' : 'none',
      rawTraceAllowed: allowed,
    };
  }

  if (requester.role === 'TEACHER') {
    const allowed = Boolean(run.classId && requester.classIds?.includes(run.classId));
    return {
      allowed,
      scope: allowed ? 'class-summary' : 'none',
      rawTraceAllowed: false,
    };
  }

  if (requester.role === 'ADMIN') {
    return {
      allowed: true,
      scope: 'audit-summary',
      rawTraceAllowed: requester.allowRawTraceAudit === true,
    };
  }

  return {
    allowed: false,
    scope: 'none',
    rawTraceAllowed: false,
  };
}

export function buildSimulationTraceRecord(input: SimulationTraceRecordV1): SimulationTraceRecordV1 {
  return {
    ...input,
    sampleStorageUri: input.sampleStorageUri ?? null,
    seed: input.seed ?? null,
  };
}
