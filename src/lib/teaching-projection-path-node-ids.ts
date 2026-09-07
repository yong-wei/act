export const CLASSROOM_SIMULATION_PATH_NODE_IDS: Readonly<Record<string, string>> = {};

export type TeachingProjectionBindingSkipFamily =
  | 'classroom-simulation'
  | 'textbook-container'
  | 'unmapped';

let liveCanonicalTargetBridge: ReadonlyMap<string, string> | null = null;

export function setCanonicalTargetBridge(bridge: ReadonlyMap<string, string> | null): void {
  liveCanonicalTargetBridge = bridge;
}

export function getCanonicalTargetBridge(): ReadonlyMap<string, string> | null {
  return liveCanonicalTargetBridge;
}

export function mapActResourceIdToNodeId(
  resourceId: string,
  classroomSimulationNodeIds: Readonly<Record<string, string>> = CLASSROOM_SIMULATION_PATH_NODE_IDS,
): { nodeId: string; kind: string } | { skip: TeachingProjectionBindingSkipFamily } {
  if (resourceId.startsWith('act:textbook:') || resourceId.startsWith('act:textbook-chapter:')) {
    return { skip: 'textbook-container' };
  }
  const handout = /^act:handout:([^:\s]+)$/u.exec(resourceId);
  if (handout) return { nodeId: `runtime-handout:${handout[1]}`, kind: 'handout' };
  const card = /^act:card:([^:\s]+)$/u.exec(resourceId);
  if (card) return { nodeId: `knowledge-card:${card[1]}`, kind: 'card' };
  const media = /^act:(video|audio):([^:\s]+):([^:\s]+)$/u.exec(resourceId);
  if (media) return { nodeId: `runtime-media:${media[2]}:${media[3]}`, kind: media[1] };
  const arena = /^act:simulation:arena-task-(.+)$/u.exec(resourceId);
  if (arena) return { nodeId: `arena-task:${arena[1]}`, kind: 'arena' };
  const simulation = /^act:simulation:(.+)$/u.exec(resourceId);
  if (simulation) {
    const mapped = classroomSimulationNodeIds[resourceId] ?? classroomSimulationNodeIds[simulation[1]];
    if (!mapped) return { skip: 'classroom-simulation' };
    return { nodeId: mapped, kind: 'simulation' };
  }
  if (/^act:textbook-section:[^:\s]+$/u.test(resourceId)) {
    return { skip: 'unmapped' };
  }
  const exercise = /^act:exercise:([^:\s]+)$/u.exec(resourceId);
  if (exercise) return { nodeId: `exercise:${exercise[1]}`, kind: 'exercise' };
  return { skip: 'unmapped' };
}

export function resolveCanonicalGoalTargets(
  targets: readonly string[],
  options: {
    bridge?: ReadonlyMap<string, string> | null;
  } = {},
): string[] {
  const bridge = options.bridge !== undefined ? options.bridge : liveCanonicalTargetBridge;
  if (!bridge) return [];
  const resolved: string[] = [];
  for (const target of targets) {
    const bridged = bridge.get(target);
    if (bridged) resolved.push(bridged);
  }
  return [...new Set(resolved)];
}
