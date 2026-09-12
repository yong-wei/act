import type { ResourceNode, ResourceNodeType } from '@/lib/resource-node-registry';

import type { KnowledgeExpansionMode } from './knowledge-scope';
import { expandKnowledgeOrder } from './knowledge-scope';
import type { TeachingPrerequisiteEdge } from './live-teaching-prerequisites';

export const KNOWLEDGE_PATH_HEURISTIC_TIMEOUT_MS = 50;
export const KNOWLEDGE_PATH_MAX_STEPS = 12;
const BEAM_WIDTH = 8;
const BRANCH_FACTOR = 3;

export interface KnowledgeSkeleton {
  knowledgeIds: string[];
  mode: KnowledgeExpansionMode;
}

export interface MountedKnowledgeResource {
  node: ResourceNode;
  canonicalId: string;
}

export interface SkeletonFillContext {
  knowledgeIds: readonly string[];
  targetIds?: readonly string[];
  byKnowledge: ReadonlyMap<string, readonly ResourceNode[]>;
  styleKinds: readonly ResourceNodeType[];
  preferredTypes: readonly ResourceNodeType[];
  timeBudgetMinutes: number;
  difficultyRhythm?: 'gentle' | 'steady' | 'challenge';
  deadline: number;
}

export interface SkeletonFill {
  mounted: MountedKnowledgeResource[];
  method: 'heuristic' | 'deterministic' | 'deterministic-timeout';
  score: number;
}

export function buildKnowledgeSkeleton(
  targets: readonly string[],
  edges: readonly TeachingPrerequisiteEdge[],
  mode: KnowledgeExpansionMode,
): KnowledgeSkeleton {
  return {
    knowledgeIds: expandKnowledgeOrder(targets, edges, mode),
    mode,
  };
}

/** Keep the goal-proximal suffix so a cap does not drop the target for distant ancestors. */
export function clipKnowledgeSkeleton(
  knowledgeIds: readonly string[],
  targets: readonly string[],
  maxSteps = KNOWLEDGE_PATH_MAX_STEPS,
): string[] {
  if (knowledgeIds.length <= maxSteps) return [...knowledgeIds];
  const targetSet = new Set(targets);
  let lastTarget = -1;
  for (let index = 0; index < knowledgeIds.length; index += 1) {
    if (targetSet.has(knowledgeIds[index]!)) lastTarget = index;
  }
  const end = lastTarget >= 0 ? lastTarget + 1 : knowledgeIds.length;
  return knowledgeIds.slice(Math.max(0, end - maxSteps), end);
}

export function indexResourcesByKnowledge(
  knowledgeIds: readonly string[],
  candidates: readonly ResourceNode[],
  canonicalIdsOf: (node: ResourceNode) => string[],
): Map<string, ResourceNode[]> {
  const allowed = new Set(knowledgeIds);
  const index = new Map<string, ResourceNode[]>();
  for (const id of knowledgeIds) index.set(id, []);
  for (const node of candidates) {
    for (const id of canonicalIdsOf(node)) {
      if (!allowed.has(id)) continue;
      index.get(id)!.push(node);
    }
  }
  return index;
}

export function rankBoundResources(
  nodes: readonly ResourceNode[],
  context: Pick<SkeletonFillContext, 'styleKinds' | 'preferredTypes' | 'timeBudgetMinutes' | 'difficultyRhythm' | 'knowledgeIds'>,
): ResourceNode[] {
  return [...nodes].sort((left, right) => {
    const delta = resourceFillScore(right, context) - resourceFillScore(left, context);
    return delta !== 0 ? delta : left.id.localeCompare(right.id);
  });
}

export function scoreFilledPath(
  mounted: readonly MountedKnowledgeResource[],
  context: Pick<SkeletonFillContext, 'knowledgeIds' | 'styleKinds' | 'preferredTypes' | 'timeBudgetMinutes'>,
): number {
  if (context.knowledgeIds.length === 0) return 0;
  const coverage = mounted.length / context.knowledgeIds.length;
  if (mounted.length === 0) return 0;
  const portraitShare = mounted.filter((entry) => context.preferredTypes.includes(entry.node.type)).length
    / mounted.length;
  const styleShare = mounted.filter((entry) => context.styleKinds.includes(entry.node.type)).length
    / mounted.length;
  const minutes = mounted.reduce((sum, entry) => sum + (entry.node.planningMetadata.estimatedTimeMinutes ?? 15), 0);
  const budget = Math.max(context.timeBudgetMinutes, 1);
  const timeFit = 1 - Math.min(1, Math.abs(minutes - budget) / budget);
  return coverage * 4 + portraitShare * 3 + styleShare * 2 + timeFit;
}

export function fillKnowledgeSkeleton(context: SkeletonFillContext): SkeletonFill {
  const deterministic = fillDeterministic(context);
  if (context.knowledgeIds.length === 0) {
    return { ...deterministic, method: 'deterministic' };
  }
  if (Date.now() >= context.deadline) {
    return { ...deterministic, method: 'deterministic-timeout' };
  }
  const heuristic = fillHeuristic(context);
  if (!heuristic) {
    return { ...deterministic, method: 'deterministic-timeout' };
  }
  return heuristic.mounted.length > 0 || deterministic.mounted.length === 0
    ? heuristic
    : deterministic;
}

function fillDeterministic(context: SkeletonFillContext): SkeletonFill {
  const mounted: MountedKnowledgeResource[] = [];
  const used = new Set<string>();
  for (const canonicalId of context.knowledgeIds) {
    const picked = rankBoundResources(available(context, canonicalId, used), context)[0];
    if (!picked) continue;
    if (!fitsBudget(mounted, picked, context.timeBudgetMinutes, isTarget(canonicalId, context))) continue;
    used.add(picked.id);
    mounted.push({ node: picked, canonicalId });
  }
  return {
    mounted,
    method: 'deterministic',
    score: scoreFilledPath(mounted, context),
  };
}

function fillHeuristic(context: SkeletonFillContext): SkeletonFill | null {
  type Beam = { mounted: MountedKnowledgeResource[]; used: Set<string>; score: number };
  let beams: Beam[] = [{ mounted: [], used: new Set(), score: 0 }];
  for (const canonicalId of context.knowledgeIds) {
    if (Date.now() >= context.deadline) return null;
    const next: Beam[] = [];
    for (const beam of beams) {
      const choices = rankBoundResources(available(context, canonicalId, beam.used), context)
        .filter((node) => fitsBudget(beam.mounted, node, context.timeBudgetMinutes, isTarget(canonicalId, context)))
        .slice(0, BRANCH_FACTOR);
      if (choices.length === 0) {
        next.push(beam);
        continue;
      }
      for (const node of choices) {
        const used = new Set(beam.used);
        used.add(node.id);
        const mounted = [...beam.mounted, { node, canonicalId }];
        next.push({
          mounted,
          used,
          score: scoreFilledPath(mounted, context),
        });
      }
    }
    next.sort((left, right) =>
      right.score - left.score
      || mountedKey(left.mounted).localeCompare(mountedKey(right.mounted)),
    );
    beams = next.slice(0, BEAM_WIDTH);
    if (beams.length === 0) break;
  }
  const best = beams[0];
  if (!best) return null;
  return {
    mounted: best.mounted,
    method: 'heuristic',
    score: scoreFilledPath(best.mounted, context),
  };
}

function isTarget(canonicalId: string, context: SkeletonFillContext): boolean {
  return (context.targetIds ?? []).includes(canonicalId);
}

function fitsBudget(
  mounted: readonly MountedKnowledgeResource[],
  node: ResourceNode,
  timeBudgetMinutes: number,
  force: boolean,
): boolean {
  if (force || mounted.length === 0) return true;
  return pathMinutes(mounted) + (node.planningMetadata.estimatedTimeMinutes ?? 15) <= timeBudgetMinutes;
}

function pathMinutes(mounted: readonly MountedKnowledgeResource[]): number {
  return mounted.reduce((sum, entry) => sum + (entry.node.planningMetadata.estimatedTimeMinutes ?? 15), 0);
}

function available(
  context: SkeletonFillContext,
  canonicalId: string,
  used: ReadonlySet<string>,
): ResourceNode[] {
  return (context.byKnowledge.get(canonicalId) ?? []).filter((node) => !used.has(node.id));
}

function resourceFillScore(
  node: ResourceNode,
  context: Pick<SkeletonFillContext, 'styleKinds' | 'preferredTypes' | 'timeBudgetMinutes' | 'difficultyRhythm' | 'knowledgeIds'>,
): number {
  let score = 0;
  if (context.preferredTypes.includes(node.type)) score += 8;
  if (context.styleKinds.includes(node.type)) score += 5;
  const slice = Math.max(context.timeBudgetMinutes / Math.max(context.knowledgeIds.length, 1), 1);
  const minutes = node.planningMetadata.estimatedTimeMinutes ?? 15;
  score += 2 * (1 - Math.min(1, Math.abs(minutes - slice) / slice));
  if (context.difficultyRhythm === 'gentle'
    && (node.type === 'knowledge_card' || node.type === 'textbook_section' || node.type === 'handout')) {
    score += 1;
  }
  if (context.difficultyRhythm === 'challenge'
    && (node.type === 'simulation' || node.type === 'arena_task' || node.type === 'exercise')) {
    score += 1;
  }
  return score;
}

function mountedKey(mounted: readonly MountedKnowledgeResource[]): string {
  return mounted.map((entry) => entry.node.id).join('\0');
}
