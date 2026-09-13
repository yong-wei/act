import type { ResourceNode, ResourceNodeType } from '@/lib/resource-node-registry';

import {
  appearanceRank,
  isAppearanceAdmissible,
  teachingOrderProximity,
  type KnowledgeResourceAdmission,
} from './application/mastery-thresholds';
import type { KnowledgeExpansionMode } from './knowledge-scope';
import { expandKnowledgeOrder } from './knowledge-scope';
import type { TeachingPrerequisiteEdge } from './live-teaching-prerequisites';
import {
  KNOWLEDGE_MASTERY_MIN_CONFIDENCE,
  KNOWLEDGE_MASTERY_MIN_EVIDENCE_COUNT,
  KNOWLEDGE_MASTERY_SKIP_THRESHOLD,
  KNOWLEDGE_PATH_HEURISTIC_TIMEOUT_MS,
  KNOWLEDGE_PATH_MAX_STEPS,
  resolveKnowledgePathPolicy,
  type KnowledgePathPolicy,
} from './knowledge-path-policy';
import { isAssertionLikeKnowledgeLabel, resolvePlanningResourceTitle } from './planning-resource-titles';

export {
  KNOWLEDGE_PATH_HEURISTIC_TIMEOUT_MS,
  KNOWLEDGE_PATH_MAX_STEPS,
  KNOWLEDGE_MASTERY_SKIP_THRESHOLD,
};

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
  masteryById?: Readonly<Record<string, number>>;
  deadline: number;
  policy?: Partial<KnowledgePathPolicy>;
  admissionOf?: (canonicalId: string) => KnowledgeResourceAdmission;
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

/** Keep the default head of the ordered path. The selected goal is a long-horizon target. */
export function clipKnowledgeSkeleton(
  knowledgeIds: readonly string[],
  _targets: readonly string[] = [],
  maxSteps = KNOWLEDGE_PATH_MAX_STEPS,
): string[] {
  return knowledgeIds.slice(0, maxSteps);
}

export function isAssertionLikeKnowledge(
  id: string,
  options: { label?: string; assertionIds?: ReadonlySet<string> } = {},
): boolean {
  if (options.assertionIds?.has(id)) return true;
  if (id.toLowerCase().includes('knowledgestatement')) return true;
  return isAssertionLikeKnowledgeLabel(options.label ?? '');
}

export function selectPriorityKnowledgeSkeleton(
  knowledgeIds: readonly string[],
  masteryById: Readonly<Record<string, number | undefined>> = {},
  options: {
    maxSteps?: number;
    skipThreshold?: number;
    policy?: Partial<KnowledgePathPolicy>;
    labels?: ReadonlyMap<string, string>;
    assertionIds?: ReadonlySet<string>;
    keepIds?: readonly string[];
  } = {},
): string[] {
  const policy = resolveKnowledgePathPolicy(options.policy);
  const maxSteps = options.maxSteps ?? policy.maxSteps;
  const skipThreshold = options.skipThreshold ?? policy.masterySkipThreshold;
  const keep = new Set(options.keepIds ?? []);
  const remaining = knowledgeIds.filter((id) => {
    if ((masteryById[id] ?? 0) >= skipThreshold) return false;
    if (keep.has(id)) return true;
    return !isAssertionLikeKnowledge(id, {
      label: options.labels?.get(id),
      assertionIds: options.assertionIds,
    });
  });
  return clipKnowledgeSkeleton(remaining, [], maxSteps);
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

export function isCourseLikeResource(node: ResourceNode): boolean {
  return node.type === 'lesson_step'
    || node.type === 'handout'
    || node.publishedResource?.type === 'lesson'
    || node.publishedResource?.type === 'step'
    || node.publishedResource?.type === 'handout';
}

export interface ResourceRankContext extends Pick<
  SkeletonFillContext,
  'styleKinds' | 'preferredTypes' | 'timeBudgetMinutes' | 'difficultyRhythm' | 'knowledgeIds' | 'masteryById' | 'policy'
> {
  fillIndex?: number;
  currentCanonicalId?: string;
  mounted?: readonly MountedKnowledgeResource[];
}

export function rankBoundResources(
  nodes: readonly ResourceNode[],
  context: ResourceRankContext,
): ResourceNode[] {
  return [...nodes].sort((left, right) => {
    const delta = resourceFillScore(right, context) - resourceFillScore(left, context);
    if (delta !== 0) return delta;
    const appearance = appearanceRank(left.publishedResource?.appearance)
      - appearanceRank(right.publishedResource?.appearance);
    if (appearance !== 0) return appearance;
    const order = teachingOrderProximity(left.publishedResource?.teachingOrder ?? null)
      - teachingOrderProximity(right.publishedResource?.teachingOrder ?? null);
    return order !== 0 ? order : left.id.localeCompare(right.id);
  });
}

export function scoreFilledPath(
  mounted: readonly MountedKnowledgeResource[],
  context: Pick<SkeletonFillContext, 'knowledgeIds' | 'styleKinds' | 'preferredTypes' | 'timeBudgetMinutes' | 'policy'>,
): number {
  if (context.knowledgeIds.length === 0) return 0;
  const policy = resolveKnowledgePathPolicy(context.policy);
  const coverage = mounted.length / context.knowledgeIds.length;
  if (mounted.length === 0) return 0;
  const portraitShare = mounted.filter((entry) => context.preferredTypes.includes(entry.node.type)).length
    / mounted.length;
  const styleShare = mounted.filter((entry) => context.styleKinds.includes(entry.node.type)).length
    / mounted.length;
  const minutes = pathMinutes(mounted);
  const budget = Math.max(context.timeBudgetMinutes, 1);
  const timeFit = 1 - Math.min(1, Math.abs(minutes - budget) / budget);
  return coverage * policy.pathCoverageWeight
    + portraitShare * policy.pathPortraitWeight
    + styleShare * policy.pathStyleWeight
    + timeFit * policy.pathTimeWeight
    + coursePlacementScore(mounted, policy) * policy.pathCoursePlacementWeight;
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

export function isTrustedKnowledgeMastery(
  tag: { posteriorMastery?: number; confidence?: number; evidenceCount?: number } | undefined,
): tag is { posteriorMastery: number; confidence: number; evidenceCount: number } {
  return typeof tag?.posteriorMastery === 'number'
    && (tag.confidence ?? 0) >= KNOWLEDGE_MASTERY_MIN_CONFIDENCE
    && (tag.evidenceCount ?? 0) >= KNOWLEDGE_MASTERY_MIN_EVIDENCE_COUNT;
}

export function masteryByCanonicalId(
  tags: Record<string, {
    posteriorMastery?: number;
    confidence?: number;
    evidenceCount?: number;
  } | undefined> | undefined,
): Record<string, number> {
  const mastery: Record<string, number> = {};
  for (const [id, tag] of Object.entries(tags ?? {})) {
    if (isTrustedKnowledgeMastery(tag)) mastery[id] = tag.posteriorMastery;
  }
  return mastery;
}

function fillDeterministic(context: SkeletonFillContext): SkeletonFill {
  const mounted: MountedKnowledgeResource[] = [];
  const used = new Set<string>();
  context.knowledgeIds.forEach((canonicalId, fillIndex) => {
    const picked = rankBoundResources(
      available(context, canonicalId, used, mounted.at(-1)?.node, fillIndex),
      {
        ...context,
        fillIndex,
        currentCanonicalId: canonicalId,
        mounted,
      },
    )[0];
    if (!picked) return;
    if (!fitsBudget(mounted, picked, context.timeBudgetMinutes, isTarget(canonicalId, context))) return;
    markUsed(used, picked);
    mounted.push({ node: picked, canonicalId });
  });
  return {
    mounted,
    method: 'deterministic',
    score: scoreFilledPath(mounted, context),
  };
}

function fillHeuristic(context: SkeletonFillContext): SkeletonFill | null {
  type Beam = { mounted: MountedKnowledgeResource[]; used: Set<string>; score: number };
  let beams: Beam[] = [{ mounted: [], used: new Set(), score: 0 }];
  for (const [fillIndex, canonicalId] of context.knowledgeIds.entries()) {
    if (Date.now() >= context.deadline) return null;
    const next: Beam[] = [];
    for (const beam of beams) {
      const choices = rankBoundResources(
        available(context, canonicalId, beam.used, beam.mounted.at(-1)?.node, fillIndex),
        {
          ...context,
          fillIndex,
          currentCanonicalId: canonicalId,
          mounted: beam.mounted,
        },
      )
        .filter((node) => fitsBudget(beam.mounted, node, context.timeBudgetMinutes, isTarget(canonicalId, context)))
        .slice(0, BRANCH_FACTOR);
      if (choices.length === 0) {
        next.push(beam);
        continue;
      }
      for (const node of choices) {
        const used = new Set(beam.used);
        markUsed(used, node);
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
  previous?: ResourceNode,
  fillIndex = 0,
): ResourceNode[] {
  const previousTitle = previous ? planningResourceTitleKey(previous) : '';
  const admission = context.admissionOf?.(canonicalId) ?? 'first-and-revisit';
  let pool = (context.byKnowledge.get(canonicalId) ?? []).filter((node) => {
    if (isUsed(used, node)) return false;
    if (previousTitle && planningResourceTitleKey(node) === previousTitle) return false;
    return isAppearanceAdmissible(node.publishedResource?.appearance, admission);
  });
  const wantsSim = context.styleKinds.some((kind) => SIMULATION_KIND_HINT.has(kind));
  if (!wantsSim) {
    const withoutSim = pool.filter((node) => !SIMULATION_KIND_HINT.has(node.type));
    if (withoutSim.length > 0) pool = withoutSim;
  }
  const policy = resolveKnowledgePathPolicy(context.policy);
  const last = Math.max(context.knowledgeIds.length - 1, 1);
  if (fillIndex / last < policy.courseCapstoneRatio) {
    const withoutCourse = pool.filter((node) => !isCourseLikeResource(node));
    if (withoutCourse.length > 0) return withoutCourse;
    return [];
  }
  return pool;
}

export function planningResourceIdentity(node: ResourceNode): string {
  return node.publishedResource?.identity.resourceId
    ?? node.sourceRef
    ?? node.id;
}

function planningResourceTitleKey(node: ResourceNode): string {
  const raw = (node.publishedResource?.title ?? node.title).trim();
  return resolvePlanningResourceTitle(raw, {
    canonicalIds: node.publishedResource?.canonicalIds,
    resourceId: node.publishedResource?.identity.resourceId,
  }).trim().toLowerCase();
}

function isUsed(used: ReadonlySet<string>, node: ResourceNode): boolean {
  return used.has(node.id) || used.has(planningResourceIdentity(node));
}

function markUsed(used: Set<string>, node: ResourceNode): void {
  used.add(node.id);
  used.add(planningResourceIdentity(node));
}

function resourceFillScore(node: ResourceNode, context: ResourceRankContext): number {
  const policy = resolveKnowledgePathPolicy(context.policy);
  let score = 0;
  if (context.preferredTypes.includes(node.type)) score += policy.preferredTypeBonus;
  if (context.styleKinds.includes(node.type)) score += policy.styleKindBonus;
  const slice = Math.max(context.timeBudgetMinutes / Math.max(context.knowledgeIds.length, 1), 1);
  const minutes = node.planningMetadata.estimatedTimeMinutes ?? 15;
  score += policy.timeSliceBonus * (1 - Math.min(1, Math.abs(minutes - slice) / slice));
  if (context.difficultyRhythm === 'gentle'
    && (node.type === 'knowledge_card' || node.type === 'textbook_section' || node.type === 'handout')) {
    score += policy.rhythmBonus;
  }
  if (context.difficultyRhythm === 'challenge'
    && (node.type === 'simulation' || node.type === 'arena_task' || node.type === 'exercise')) {
    score += policy.rhythmBonus;
  }
  score += coursePositionAdjustment(node, context, policy);
  score += courseSequenceAdjustment(node, context, policy);
  score -= unmetCoursePrerequisitePenalty(node, context, policy);
  return score;
}

function coursePositionAdjustment(
  node: ResourceNode,
  context: ResourceRankContext,
  policy: KnowledgePathPolicy,
): number {
  if (!isCourseLikeResource(node) || context.fillIndex === undefined) return 0;
  const last = Math.max(context.knowledgeIds.length - 1, 1);
  const ratio = context.fillIndex / last;
  if (ratio >= policy.courseCapstoneRatio) return policy.courseCapstoneBonus;
  return -policy.courseEarlyPenalty;
}

function courseSequenceAdjustment(
  node: ResourceNode,
  context: ResourceRankContext,
  policy: KnowledgePathPolicy,
): number {
  if (!isCourseLikeResource(node)) return 0;
  const previous = (context.mounted ?? []).map((entry) => entry.node).filter(isCourseLikeResource);
  if (previous.length === 0) return 0;
  const last = previous[previous.length - 1]!;
  const lastOrder = last.publishedResource?.teachingOrder;
  const nextOrder = node.publishedResource?.teachingOrder;
  if (!lastOrder || !nextOrder) return -policy.courseUnmetPenalty;
  if (lastOrder.unitId === nextOrder.unitId) {
    const lastStep = lastOrder.stepIndex ?? -1;
    const nextStep = nextOrder.stepIndex ?? lastStep + 1;
    if (nextStep > lastStep) return policy.courseCapstoneBonus;
    return -policy.courseEarlyPenalty * 2;
  }
  return -policy.courseUnmetPenalty * 4;
}

function unmetCoursePrerequisitePenalty(
  node: ResourceNode,
  context: ResourceRankContext,
  policy: KnowledgePathPolicy,
): number {
  if (!isCourseLikeResource(node)) return 0;
  const covered = unique([
    ...node.planningMetadata.knowledgeCoverage,
    ...(node.publishedResource?.canonicalIds ?? []),
  ]).filter((id) => context.knowledgeIds.includes(id));
  if (covered.length < policy.wideCourseMinBindings) return 0;
  const current = context.currentCanonicalId;
  const fillIndex = context.fillIndex ?? 0;
  const mastery = context.masteryById ?? {};
  const unmet = covered.filter((id) => {
    if (id === current) return false;
    if ((mastery[id] ?? 0) >= policy.masterySkipThreshold) return false;
    const position = context.knowledgeIds.indexOf(id);
    return position === -1 || position > fillIndex;
  });
  return unmet.length * policy.courseUnmetPenalty;
}

function coursePlacementScore(
  mounted: readonly MountedKnowledgeResource[],
  policy: KnowledgePathPolicy,
): number {
  if (mounted.length === 0) return 0;
  let score = 0;
  mounted.forEach((entry, index) => {
    if (!isCourseLikeResource(entry.node)) return;
    const ratio = mounted.length === 1 ? 1 : index / (mounted.length - 1);
    if (ratio >= policy.courseCapstoneRatio) score += 0.4;
    else score -= 0.6;
  });
  return score;
}

function mountedKey(mounted: readonly MountedKnowledgeResource[]): string {
  return mounted.map((entry) => entry.node.id).join('\0');
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}

export function diversifyMountedStyles(
  styles: Array<{
    kinds: readonly ResourceNodeType[];
    mounted: MountedKnowledgeResource[];
  }>,
  context: SkeletonFillContext,
): void {
  if (styles.length < 2) return;
  const foundation = styles[0];
  for (const style of styles.slice(1)) {
    if (!foundation) continue;
    const wantsSim = style.kinds.some((kind) => SIMULATION_KIND_HINT.has(kind));
    const length = Math.min(foundation.mounted.length, style.mounted.length);
    for (let index = 0; index < length; index += 1) {
      const current = style.mounted[index];
      const baseline = foundation.mounted[index];
      if (!current || !baseline) continue;
      const shared = planningResourceIdentity(baseline.node);
      if (planningResourceIdentity(current.node) !== shared) continue;
      if (wantsSim && SIMULATION_KIND_HINT.has(current.node.type)) continue;
      const used = new Set(
        style.mounted.flatMap((entry) => [entry.node.id, planningResourceIdentity(entry.node)]),
      );
      used.delete(current.node.id);
      used.delete(shared);
      const ranked = rankBoundResources(
        available(context, current.canonicalId, used, style.mounted[index - 1]?.node, index),
        {
          ...context,
          styleKinds: style.kinds,
          fillIndex: index,
          currentCanonicalId: current.canonicalId,
          mounted: style.mounted.slice(0, index),
        },
      ).filter((node) => {
        if (planningResourceIdentity(node) === shared) return false;
        if (!style.kinds.includes(node.type)) return false;
        return wantsSim ? SIMULATION_KIND_HINT.has(node.type) : node.type !== current.node.type;
      });
      if (ranked[0]) style.mounted[index] = { node: ranked[0], canonicalId: current.canonicalId };
    }
  }
}

const SIMULATION_KIND_HINT = new Set<ResourceNodeType>(['simulation', 'control_workbench', 'arena_task']);
