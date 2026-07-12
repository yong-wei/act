export const KNOWLEDGE_GRAPH_MOTION = {
  focusDurationMs: 160,
  relationDurationMs: 220,
  cameraDurationMs: 240,
  collapseDurationMs: 160,
  totalRevealDurationMs: 360,
  individualStaggerLimit: 24,
} as const;

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
