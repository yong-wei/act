/**
 * Bounded force lifecycle for the shared knowledge graph renderers (#1739).
 *
 * Both renderers run D3 force simulations. Every dimension gets explicit
 * warmup, cooldown tick and time ceilings, a settle signal (engine stop) and
 * a static fallback for reduced motion and non-live (test) environments.
 * The lifecycle must stay bounded: no renderer may run an unbounded
 * continuously hot simulation.
 */

import type { GraphDimension } from '../graph-runtime-session';

export interface KnowledgeForceLifecycle {
  /** Synchronous ticks before the first frame; deterministic settling. */
  warmupTicks: number;
  /** Live tick budget after (re)heat; the engine stops at zero. */
  cooldownTicks: number;
  /** Wall-clock ceiling in milliseconds for one cooldown phase. */
  cooldownTimeMs: number;
  /** True when the simulation must stay static (seeds render as-is). */
  staticLayout: boolean;
}

export const KNOWLEDGE_FORCE_WARMUP_TICKS: Record<GraphDimension, number> = {
  '2d': 40,
  '3d': 60,
};

export const KNOWLEDGE_FORCE_COOLDOWN_TICKS: Record<GraphDimension, number> = {
  '2d': 120,
  '3d': 150,
};

export const KNOWLEDGE_FORCE_COOLDOWN_TIME_MS = 4000;

/**
 * With alphaDecay 0.05 the engine cools below alphaMin within ~135 ticks,
 * so the per-dimension cooldown budgets above both bound and complete one
 * settle phase; the tick ceiling stays a hard bound either way.
 */
export const KNOWLEDGE_FORCE_ALPHA_DECAY = 0.05;
export const KNOWLEDGE_FORCE_ALPHA_MIN = 0.001;

const STATIC_FORCE_LIFECYCLE: KnowledgeForceLifecycle = {
  warmupTicks: 0,
  cooldownTicks: 0,
  cooldownTimeMs: 0,
  staticLayout: true,
};

/**
 * Reduced-motion viewers and non-live environments (Vitest) render the
 * deterministic seed layout without running the engine; camera fit and
 * label placement still consume the engine-stop settle signal.
 */
export function resolveKnowledgeForceLifecycle(input: {
  dimension: GraphDimension;
  liveEngine: boolean;
  reducedMotion?: boolean;
}): KnowledgeForceLifecycle {
  if (!input.liveEngine || input.reducedMotion) return STATIC_FORCE_LIFECYCLE;
  return {
    warmupTicks: KNOWLEDGE_FORCE_WARMUP_TICKS[input.dimension],
    cooldownTicks: KNOWLEDGE_FORCE_COOLDOWN_TICKS[input.dimension],
    cooldownTimeMs: KNOWLEDGE_FORCE_COOLDOWN_TIME_MS,
    staticLayout: false,
  };
}

/**
 * Structural signature of a graph payload. The renderers reuse the previous
 * engine payload while the signature is unchanged so selection, hover and
 * pure re-renders never restart the simulation; only node/link structure or
 * an explicit relayout may reheat it (#1739: filter-only stability).
 */
export function computeKnowledgeForceStructureSignature(
  nodes: ReadonlyArray<{ id: string }>,
  links: ReadonlyArray<{ sourceId?: unknown; targetId?: unknown; source?: unknown; target?: unknown }>,
  extra: ReadonlyArray<string | number | null | undefined> = [],
): string {
  const nodeId = (value: unknown): string => (
    typeof value === 'object' && value !== null && 'id' in (value as Record<string, unknown>)
      ? String((value as Record<string, unknown>).id)
      : String(value ?? '')
  );
  const nodePart = nodes.map((node) => node.id).sort().join(',');
  const linkPart = links.map((link) => `${nodeId(link.source ?? link.sourceId)}→${nodeId(link.target ?? link.targetId)}`)
    .sort()
    .join(',');
  const extraPart = extra.map((value) => String(value ?? '')).join('|');
  return `${nodes.length}:${nodePart}#${links.length}:${linkPart}#${extraPart}`;
}
