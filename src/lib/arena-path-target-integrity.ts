import { ARENA_CHALLENGE_TASKS } from '@/features/arena/data/seed-challenges';

export type ArenaPathTargetAcceptedReason =
  | 'canonical-arena-task-target'
  | 'verified-yangfan-legacy-arena-mapping'
  | 'verified-legacy-arena-registry-mapping';

export type ArenaPathTargetBlockedReason =
  | 'generic-arena-target'
  | 'knowledge-placeholder-identity'
  | 'arena-node-id-mismatch'
  | 'arena-source-kind-mismatch'
  | 'arena-source-ref-mismatch'
  | 'arena-route-mismatch'
  | 'unknown-arena-task';

export interface ArenaPathTargetInput {
  nodeId?: unknown;
  type?: unknown;
  sourceKind?: unknown;
  sourceRef?: unknown;
  target?: unknown;
  fixtureScope?: unknown;
}

export interface CanonicalArenaPathTarget {
  nodeId: string;
  type: 'arena_task';
  sourceKind: 'arena_task';
  sourceRef: string;
  target: string;
}

export type ArenaPathTargetIntegrityResult =
  | {
      status: 'valid' | 'repaired';
      reason: ArenaPathTargetAcceptedReason;
      taskId: string;
      target: CanonicalArenaPathTarget;
    }
  | {
      status: 'blocked';
      reason: ArenaPathTargetBlockedReason;
      taskId: null;
      target: null;
    };

const KNOWN_ARENA_TASK_IDS = new Set(ARENA_CHALLENGE_TASKS.map((task) => task.id));
const YANGFAN_FIXTURE_SCOPE = 'yangfan-diagnostic-fixture.v1';
const YANGFAN_LEGACY_NODE_ID = '根轨迹_1_1';
const YANGFAN_ARENA_TASK_ID = 'task-second-order-lead-pid';
const VERIFIED_LEGACY_ARENA_REGISTRY_MAPPINGS = [
  {
    nodeId: 'registry:arena-challenge-workbench',
    type: 'arena_task',
    sourceKind: 'resource_registry',
    sourceRef: 'arena-challenge-workbench',
    target: '/arena/challenges/task-second-order-lead-pid',
    taskId: 'task-second-order-lead-pid',
  },
  {
    nodeId: 'registry:arena-cruise-blackbox-workbench',
    type: 'arena_task',
    sourceKind: 'resource_registry',
    sourceRef: 'arena-cruise-blackbox-workbench',
    target: '/arena/challenges/task-cruise-roll-blackbox-identification',
    taskId: 'task-cruise-roll-blackbox-identification',
  },
] as const;

export function resolveArenaPathTargetIntegrity(
  input: ArenaPathTargetInput,
): ArenaPathTargetIntegrityResult {
  if (matchesVerifiedYangFanLegacyMapping(input)) {
    return acceptedResult('repaired', 'verified-yangfan-legacy-arena-mapping', YANGFAN_ARENA_TASK_ID);
  }
  const legacyRegistryTaskId = resolveVerifiedLegacyArenaRegistryTaskId(input);
  if (legacyRegistryTaskId) {
    return acceptedResult('repaired', 'verified-legacy-arena-registry-mapping', legacyRegistryTaskId);
  }

  const nodeId = readString(input.nodeId);
  const sourceKind = readString(input.sourceKind);
  const sourceRef = readString(input.sourceRef);
  const target = readString(input.target);
  if (target === '/arena' || target?.startsWith('/arena?')) {
    return blockedResult(target === '/arena' ? 'generic-arena-target' : 'knowledge-placeholder-identity');
  }
  if (sourceKind === 'knowledge_graph' && nodeId && !nodeId.startsWith('arena-task:')) {
    return blockedResult('knowledge-placeholder-identity');
  }

  const taskIdFromNode = nodeId?.startsWith('arena-task:') ? nodeId.slice('arena-task:'.length) : null;
  if (!taskIdFromNode) {
    return blockedResult('arena-node-id-mismatch');
  }
  if (sourceKind !== 'arena_task') {
    return blockedResult('arena-source-kind-mismatch');
  }
  const taskIdFromRoute = parseArenaChallengeTaskId(target);
  if (sourceRef && taskIdFromRoute === sourceRef && taskIdFromNode !== sourceRef) {
    return blockedResult('arena-node-id-mismatch');
  }
  if (sourceRef !== taskIdFromNode) {
    return blockedResult('arena-source-ref-mismatch');
  }
  if (target !== `/arena/challenges/${taskIdFromNode}`) {
    return blockedResult('arena-route-mismatch');
  }
  if (!KNOWN_ARENA_TASK_IDS.has(taskIdFromNode)) {
    return blockedResult('unknown-arena-task');
  }
  return acceptedResult('valid', 'canonical-arena-task-target', taskIdFromNode);
}

function parseArenaChallengeTaskId(target: string | null): string | null {
  if (!target) return null;
  const match = /^\/arena\/challenges\/([^/?#]+)$/.exec(target);
  return match?.[1] ?? null;
}

function matchesVerifiedYangFanLegacyMapping(input: ArenaPathTargetInput): boolean {
  if (
    input.fixtureScope !== YANGFAN_FIXTURE_SCOPE ||
    input.nodeId !== YANGFAN_LEGACY_NODE_ID ||
    input.type !== 'arena_task' ||
    input.sourceKind !== 'knowledge_graph' ||
    input.sourceRef !== YANGFAN_LEGACY_NODE_ID
  ) {
    return false;
  }
  return input.target === `/arena?nodeId=${encodeURIComponent(YANGFAN_LEGACY_NODE_ID)}`;
}

function resolveVerifiedLegacyArenaRegistryTaskId(input: ArenaPathTargetInput): string | null {
  const mapping = VERIFIED_LEGACY_ARENA_REGISTRY_MAPPINGS.find((candidate) => (
    input.nodeId === candidate.nodeId &&
    input.type === candidate.type &&
    input.sourceKind === candidate.sourceKind &&
    input.sourceRef === candidate.sourceRef &&
    input.target === candidate.target
  ));
  return mapping && KNOWN_ARENA_TASK_IDS.has(mapping.taskId) ? mapping.taskId : null;
}

function acceptedResult(
  status: 'valid' | 'repaired',
  reason: ArenaPathTargetAcceptedReason,
  taskId: string,
): ArenaPathTargetIntegrityResult {
  return {
    status,
    reason,
    taskId,
    target: {
      nodeId: `arena-task:${taskId}`,
      type: 'arena_task',
      sourceKind: 'arena_task',
      sourceRef: taskId,
      target: `/arena/challenges/${taskId}`,
    },
  };
}

function blockedResult(reason: ArenaPathTargetBlockedReason): ArenaPathTargetIntegrityResult {
  return { status: 'blocked', reason, taskId: null, target: null };
}

function readString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
}
