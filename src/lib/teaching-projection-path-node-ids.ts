import { getAllRegisteredResourceMetadata, getRegisteredResourceMetadata } from './resource-registry-metadata';
import { fromResourceIdToken } from './teaching-projection/textbook-locators/identity';

/**
 * 课堂仿真显式映射：仅收录 registry 中 lessonNN 精确身份。
 * 无行的 lessonNN 投影仿真跳过并计数，禁止前缀猜测。
 */
export const CLASSROOM_SIMULATION_PATH_NODE_IDS: Readonly<Record<string, string>> = Object.freeze(
  Object.fromEntries(
    getAllRegisteredResourceMetadata()
      .filter((resource) => /^lesson\d+/i.test(resource.id))
      .flatMap((resource) => [
        [`act:simulation:${resource.id}`, `registry:${resource.id}`] as const,
        [resource.id, `registry:${resource.id}`] as const,
      ]),
  ),
);

export type TeachingProjectionBindingSkipFamily =
  | 'classroom-simulation'
  | 'textbook-container'
  | 'unmapped';

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
  const video = /^act:video:([^:\s]+)$/u.exec(resourceId);
  if (video) {
    return { nodeId: `runtime-media:${video[1]}:${video[1]}-intro-video`, kind: 'video' };
  }
  const audio = /^act:audio:([^:\s]+)$/u.exec(resourceId);
  if (audio) {
    return { nodeId: `runtime-media:${audio[1]}:${audio[1]}-audio`, kind: 'audio' };
  }
  const textbookSection = /^act:textbook-section:([^:\s]+)$/u.exec(resourceId);
  if (textbookSection) {
    let decoded: string;
    try {
      decoded = fromResourceIdToken(textbookSection[1]);
    } catch {
      return { skip: 'unmapped' };
    }
    const parts = decoded.split(':').filter(Boolean);
    if (parts.length < 2) return { skip: 'unmapped' };
    return { nodeId: `textbook-section:${decoded}`, kind: 'textbook-section' };
  }
  const exercise = /^act:exercise:([^:\s]+)$/u.exec(resourceId);
  if (exercise) return { nodeId: `exercise:${exercise[1]}`, kind: 'exercise' };
  const arena = /^act:simulation:arena-task-(.+)$/u.exec(resourceId);
  if (arena) {
    const slug = arena[1].replace(/^task-/u, '');
    return { nodeId: `arena-task:task-${slug}`, kind: 'arena' };
  }
  const simulation = /^act:simulation:(.+)$/u.exec(resourceId);
  if (simulation) {
    const mapped = classroomSimulationNodeIds[resourceId] ?? classroomSimulationNodeIds[simulation[1]];
    if (mapped) return { nodeId: mapped, kind: 'simulation' };
    if (isClassroomLessonSimulationId(resourceId) || isClassroomLessonSimulationId(simulation[1])) {
      return { skip: 'classroom-simulation' };
    }
    if (getRegisteredResourceMetadata(simulation[1])) {
      return { nodeId: `registry:${simulation[1]}`, kind: 'simulation' };
    }
    return { skip: 'unmapped' };
  }
  return { skip: 'unmapped' };
}

export function resolveCanonicalGoalTargets(
  targets: readonly string[],
  options: {
    bridge?: ReadonlyMap<string, string> | null;
  } = {},
): string[] {
  const bridge = options.bridge;
  if (!bridge) return [];
  const resolved: string[] = [];
  for (const target of targets) {
    const bridged = bridge.get(target);
    if (bridged) resolved.push(bridged);
  }
  return [...new Set(resolved)];
}

function isClassroomLessonSimulationId(value: string): boolean {
  return /(?:^|:)lesson\d+/i.test(value);
}
