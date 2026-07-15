import {
  getKnowledgeGraphPathPoint,
  getKnowledgeGraphPathTangent,
  type KnowledgeGraphEdgePath,
} from './edge-geometry';

export const KNOWLEDGE_GRAPH_MOTION = {
  focusDurationMs: 160,
  relationDurationMs: 220,
  cameraDurationMs: 240,
  collapseDurationMs: 160,
  totalRevealDurationMs: 360,
  individualStaggerLimit: 24,
} as const;

export function getKnowledgeGraphMotionMarkerPose(
  path: KnowledgeGraphEdgePath,
  progress: number,
) {
  return {
    point: getKnowledgeGraphPathPoint(path, progress),
    tangent: getKnowledgeGraphPathTangent(path, progress),
  };
}

interface RevealPlanInput {
  graphVersion: string;
  targetNodeId: string;
  generation: number;
  nodeIds: readonly string[];
  reducedMotion: boolean;
}

export interface KnowledgeGraphRevealPlan {
  key: string;
  focusDurationMs: number;
  relationDurationMs: number;
  cameraDurationMs: number;
  collapseDurationMs: number;
  animateParticles: boolean;
  nodes: Array<{
    nodeId: string;
    delayMs: number;
    durationMs: number;
    batch: 'individual' | 'remainder';
  }>;
}

export type KnowledgeGraphPresentationPhase = 'idle' | 'revealing' | 'collapsing';

export interface KnowledgeGraphPresentationState {
  key: string;
  phase: KnowledgeGraphPresentationPhase;
  targetNodeId: string | null;
  directNodeIds: readonly string[];
  revealedNodeIds: readonly string[];
  revealedRelationIds: readonly string[];
  elapsedMs?: number;
  durationMs?: number;
  relationDurationMs?: number;
  collapseDurationMs?: number;
  animateParticles?: boolean;
  nodeTimings?: Readonly<Record<string, { delayMs: number; durationMs: number }>>;
  animatedNodeIds?: readonly string[];
  animatedRelationIds?: readonly string[];
}

export const IDLE_KNOWLEDGE_GRAPH_PRESENTATION: KnowledgeGraphPresentationState = {
  key: '',
  phase: 'idle',
  targetNodeId: null,
  directNodeIds: [],
  revealedNodeIds: [],
  revealedRelationIds: [],
  elapsedMs: 0,
  durationMs: 0,
  relationDurationMs: 0,
  collapseDurationMs: 0,
  animateParticles: false,
  nodeTimings: {},
  animatedNodeIds: [],
  animatedRelationIds: [],
};

function clampProgress(value: number) {
  return Math.min(1, Math.max(0, value));
}

function easeOutCubic(value: number) {
  const progress = clampProgress(value);
  return 1 - ((1 - progress) ** 3);
}

function interpolate(from: number, to: number, progress: number) {
  return from + (to - from) * easeOutCubic(progress);
}

function timedProgress(elapsedMs: number | undefined, delayMs: number, durationMs: number) {
  if (elapsedMs === undefined) return null;
  if (durationMs <= 0) return 1;
  return clampProgress((elapsedMs - delayMs) / durationMs);
}

export function getKnowledgeGraphPresentationNodeOpacity({
  phase,
  targetNodeId,
  nodeId,
  directNodeIds,
  revealedNodeIds,
  elapsedMs,
  collapseDurationMs,
  nodeTimings,
  animatedNodeIds,
}: Pick<KnowledgeGraphPresentationState, 'phase' | 'targetNodeId' | 'directNodeIds' | 'revealedNodeIds' | 'elapsedMs' | 'collapseDurationMs' | 'nodeTimings'> & {
  nodeId: string;
  animatedNodeIds?: readonly string[];
}) {
  if (phase === 'idle' || !targetNodeId || nodeId === targetNodeId) return 1;
  const isAnimated = animatedNodeIds?.includes(nodeId) ?? directNodeIds.includes(nodeId);
  if (directNodeIds.includes(nodeId) && !isAnimated) return 1;
  if (directNodeIds.includes(nodeId)) {
    if (phase === 'collapsing') {
      const progress = timedProgress(elapsedMs, 0, collapseDurationMs ?? 0);
      return progress === null ? 0.12 : interpolate(1, 0.12, progress);
    }
    const timing = nodeTimings?.[nodeId];
    const progress = timing
      ? timedProgress(elapsedMs, timing.delayMs, timing.durationMs)
      : null;
    if (progress !== null && progress !== undefined) return interpolate(0.12, 1, progress);
    return phase === 'revealing' && !revealedNodeIds.includes(nodeId) ? 0.12 : 1;
  }
  return phase === 'collapsing' ? 0.3 : 0.42;
}

export function getKnowledgeGraphPresentationNodeScale({
  phase,
  targetNodeId,
  nodeId,
  directNodeIds,
  revealedNodeIds,
  elapsedMs,
  collapseDurationMs,
  nodeTimings,
  animatedNodeIds,
}: Pick<KnowledgeGraphPresentationState, 'phase' | 'targetNodeId' | 'directNodeIds' | 'revealedNodeIds' | 'elapsedMs' | 'collapseDurationMs' | 'nodeTimings'> & {
  nodeId: string;
  animatedNodeIds?: readonly string[];
}) {
  if (phase === 'idle' || !targetNodeId || nodeId === targetNodeId) return 1;
  const isAnimated = animatedNodeIds?.includes(nodeId) ?? directNodeIds.includes(nodeId);
  if (!directNodeIds.includes(nodeId) || !isAnimated) return 1;
  if (phase === 'collapsing') {
    const progress = timedProgress(elapsedMs, 0, collapseDurationMs ?? 0);
    return progress === null ? (revealedNodeIds.includes(nodeId) ? 1 : 0.88) : interpolate(1, 0.88, progress);
  }
  const timing = nodeTimings?.[nodeId];
  const progress = timing
    ? timedProgress(elapsedMs, timing.delayMs, timing.durationMs)
    : null;
  if (progress !== null && progress !== undefined) return interpolate(0.88, 1, progress);
  return revealedNodeIds.includes(nodeId) ? 1 : 0.88;
}

export function getKnowledgeGraphPresentationLinkProgress({
  phase,
  targetNodeId,
  sourceId,
  targetId,
  revealedRelationIds,
  elapsedMs,
  relationDurationMs,
  collapseDurationMs,
  animatedRelationIds,
}: Pick<KnowledgeGraphPresentationState, 'phase' | 'targetNodeId' | 'revealedRelationIds' | 'elapsedMs' | 'relationDurationMs' | 'collapseDurationMs'> & {
  sourceId: string;
  targetId: string;
  animatedRelationIds?: readonly string[];
}) {
  if (phase === 'idle' || !targetNodeId) return 1;
  const relationId = `${sourceId}:${targetId}`;
  const direct = sourceId === targetNodeId || targetId === targetNodeId;
  const isAnimated = animatedRelationIds?.includes(relationId) ?? direct;
  if (!direct || !isAnimated) return 1;
  if (phase === 'collapsing') {
    const progress = timedProgress(elapsedMs, 0, collapseDurationMs ?? 0);
    return progress === null
      ? (revealedRelationIds.includes(relationId) ? 1 : 0)
      : 1 - easeOutCubic(progress);
  }
  const progress = timedProgress(elapsedMs, 0, relationDurationMs ?? 0);
  return progress === null
    ? (revealedRelationIds.includes(relationId) ? 1 : 0)
    : easeOutCubic(progress);
}

export function getKnowledgeGraphPresentationLinkOpacity({
  phase,
  targetNodeId,
  sourceId,
  targetId,
  revealedRelationIds,
  elapsedMs,
  relationDurationMs,
  collapseDurationMs,
  animatedRelationIds,
}: Pick<KnowledgeGraphPresentationState, 'phase' | 'targetNodeId' | 'revealedRelationIds' | 'elapsedMs' | 'relationDurationMs' | 'collapseDurationMs'> & {
  sourceId: string;
  targetId: string;
  animatedRelationIds?: readonly string[];
}) {
  if (phase === 'idle' || !targetNodeId) return 1;
  const relationId = `${sourceId}:${targetId}`;
  const direct = sourceId === targetNodeId || targetId === targetNodeId;
  if (!direct) return phase === 'collapsing' ? 0.28 : 0.4;
  const isAnimated = animatedRelationIds?.includes(relationId) ?? direct;
  if (!isAnimated) return 1;
  const visibleProgress = getKnowledgeGraphPresentationLinkProgress({
    phase,
    targetNodeId,
    sourceId,
    targetId,
    revealedRelationIds,
    elapsedMs,
    relationDurationMs,
    collapseDurationMs,
    animatedRelationIds,
  });
  return 0.08 + visibleProgress * 0.92;
}

export function createKnowledgeGraphRevealPlan(input: RevealPlanInput): KnowledgeGraphRevealPlan {
  const key = `${input.graphVersion}:${input.targetNodeId}:${input.generation}`;
  if (input.reducedMotion) {
    return {
      key,
      focusDurationMs: 0,
      relationDurationMs: 0,
      cameraDurationMs: 0,
      collapseDurationMs: 0,
      animateParticles: false,
      nodes: input.nodeIds.map((nodeId) => ({ nodeId, delayMs: 0, durationMs: 0, batch: 'remainder' })),
    };
  }

  const durationMs = 180;
  const staggerSpanMs = KNOWLEDGE_GRAPH_MOTION.totalRevealDurationMs - durationMs;
  const individuallyStaggered = Math.min(input.nodeIds.length, KNOWLEDGE_GRAPH_MOTION.individualStaggerLimit);
  const stepMs = individuallyStaggered > 1 ? staggerSpanMs / (individuallyStaggered - 1) : 0;
  const batchDelayMs = individuallyStaggered > 0 ? staggerSpanMs : 0;
  return {
    key,
    focusDurationMs: KNOWLEDGE_GRAPH_MOTION.focusDurationMs,
    relationDurationMs: KNOWLEDGE_GRAPH_MOTION.relationDurationMs,
    cameraDurationMs: KNOWLEDGE_GRAPH_MOTION.cameraDurationMs,
    collapseDurationMs: KNOWLEDGE_GRAPH_MOTION.collapseDurationMs,
    animateParticles: true,
    nodes: input.nodeIds.map((nodeId, index) => ({
      nodeId,
      delayMs: index < individuallyStaggered ? Math.round(index * stepMs) : batchDelayMs,
      durationMs,
      batch: index < individuallyStaggered ? 'individual' : 'remainder',
    })),
  };
}

export class KnowledgeGraphTransitionGate {
  private key: string | null = null;
  private timers = new Set<ReturnType<typeof setTimeout>>();

  schedule(key: string, callback: () => void, delayMs: number) {
    if (this.key !== key) this.cancel(key);
    const timer = setTimeout(() => {
      this.timers.delete(timer);
      if (this.key === key) callback();
    }, delayMs);
    this.timers.add(timer);
    return timer;
  }

  cancel(nextKey: string | null = null) {
    this.timers.forEach(clearTimeout);
    this.timers.clear();
    this.key = nextKey;
  }

  dispose() {
    this.cancel();
  }
}

export function prefersReducedKnowledgeGraphMotion() {
  return typeof window !== 'undefined'
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
