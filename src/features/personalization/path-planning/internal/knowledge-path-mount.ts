import type { ResourceNode, ResourceNodeType } from '@/lib/resource-node-registry';
import { resolvePublishedGoalCanonicalIds } from '@/lib/published-resource-planning';

import {
  ADAPTIVE_LEARNING_PATH_POLICY_FAMILIES,
  getRegisteredAdaptiveLearningPathGoal,
  type AdaptiveLearningPathPlan,
  type AdaptiveLearningPathPlanNode,
  type AdaptiveLearningPathPlannerInput,
  type AdaptiveLearningPathPolicyBundle,
  type AdaptiveLearningPathPolicyFamily,
  type AdaptiveLearningPathStyleId,
} from './assemble-plan';
import { goalCanonicalIds, isPresetAdaptiveLearningGoal } from '../goal-canonical-knowledge';
import {
  buildKnowledgeSkeleton,
  fillKnowledgeSkeleton,
  indexResourcesByKnowledge,
  isAssertionLikeKnowledge,
  masteryByCanonicalId,
  scoreFilledPath,
  selectPriorityKnowledgeSkeleton,
} from '../knowledge-path-assembly';
import {
  resolveKnowledgePathPolicy,
  type KnowledgePathPolicy,
} from '../knowledge-path-policy';
import {
  loadPlanningAssertionKnowledgeIds,
  loadPlanningKnowledgeLabels,
  resolvePlanningResourceTitle,
} from '../planning-resource-titles';
import { expandFeasibleKnowledgeIds } from '../knowledge-scope';
import {
  loadLiveTeachingPrerequisiteEdges,
  type TeachingPrerequisiteEdge,
} from '../live-teaching-prerequisites';

const FOUNDATION_TYPES: ResourceNodeType[] = [
  'knowledge_card', 'textbook_section', 'lesson_step', 'handout', 'quiz', 'slides',
];
const SIMULATION_TYPES: ResourceNodeType[] = [
  'simulation', 'control_workbench', 'arena_task',
];
const DEFAULT_PREFERENCE_TYPES: ResourceNodeType[] = [
  'knowledge_card', 'textbook_section', 'lesson_step', 'quiz',
];

const STYLE_META: Array<{
  family: AdaptiveLearningPathPolicyFamily;
  styleId: AdaptiveLearningPathStyleId;
  label: string;
  kinds: ResourceNodeType[];
}> = [
  {
    family: 'foundation-remediation',
    styleId: 'foundation-remediation',
    label: '基础补救',
    kinds: FOUNDATION_TYPES,
  },
  {
    family: 'simulation-driven',
    styleId: 'arena-simulation-sprint',
    label: '仿真冲刺',
    kinds: SIMULATION_TYPES,
  },
  {
    family: 'preference-matched',
    styleId: 'preference-matched-route',
    label: '偏好匹配',
    kinds: DEFAULT_PREFERENCE_TYPES,
  },
];

export interface KnowledgePathMountOptions {
  prerequisiteEdges?: TeachingPrerequisiteEdge[];
  heuristicTimeoutMs?: number;
  now?: Date;
  policy?: Partial<KnowledgePathPolicy>;
}

export function shouldAssembleByKnowledgePath(input: AdaptiveLearningPathPlannerInput): boolean {
  return Boolean(input.registry.featureIndex && isPresetAdaptiveLearningGoal(input.goal.id));
}

export function assembleKnowledgePathPlan(
  input: AdaptiveLearningPathPlannerInput,
  options: KnowledgePathMountOptions = {},
): AdaptiveLearningPathPlan {
  const now = (options.now ?? input.now ?? new Date()).toISOString();
  const policy = resolveKnowledgePathPolicy(options.policy);
  const targets = goalCanonicalIds(input.goal.id);
  const edges = options.prerequisiteEdges
    ?? input.planningScope?.edges
    ?? loadLiveTeachingPrerequisiteEdges();
  const excluded = new Set(input.excludedNodeIds ?? []);
  const completed = input.constraints.completedNodeIds ?? [];
  const feasibleKnowledge = new Set(
    input.planningScope
      ? input.planningScope.knowledgeIds
      : expandFeasibleKnowledgeIds(targets, edges),
  );
  const scopedIds = (node: ResourceNode) =>
    nodeCanonicalIds(node, input).filter((id) => feasibleKnowledge.has(id));
  const candidates = input.registry.nodes.filter((node) =>
    isBoundCandidate(node, input, excluded) && scopedIds(node).length > 0,
  );
  const preferredTypes = preferredResourceTypes(input);
  const hasPortrait = preferredTypes.length > 0;
  const masteryById = masteryByCanonicalId(input.learnerState?.knowledgeMastery?.tags);
  const deadline = Date.now() + (options.heuristicTimeoutMs ?? policy.heuristicTimeoutMs);
  const byKnowledge = indexResourcesByKnowledge([...feasibleKnowledge], candidates, scopedIds);
  const expandedIds = buildKnowledgeSkeleton(targets, edges, 'required')
    .knowledgeIds
    .filter((id) => feasibleKnowledge.has(id));
  const labels = loadPlanningKnowledgeLabels();
  const assertionIds = loadPlanningAssertionKnowledgeIds();
  const knowledgeIds = selectPriorityKnowledgeSkeleton(expandedIds, masteryById, {
    policy,
    labels,
    assertionIds,
    keepIds: targets,
  });
  const droppedAssertions = expandedIds.some((id) =>
    !targets.includes(id)
    && isAssertionLikeKnowledge(id, { label: labels.get(id), assertionIds }),
  );
  const styles = STYLE_META.map((style) => {
    const kinds = style.family === 'preference-matched' && preferredTypes.length
      ? preferredTypes
      : style.kinds;
    const fill = fillKnowledgeSkeleton({
      knowledgeIds,
      targetIds: targets,
      byKnowledge,
      styleKinds: kinds,
      preferredTypes,
      timeBudgetMinutes: input.constraints.timeBudgetMinutes,
      difficultyRhythm: input.difficultyRhythm,
      masteryById,
      deadline,
      policy,
    });
    return {
      style,
      knowledgeIds,
      clipped: expandedIds.length > knowledgeIds.length,
      masteredDropped: expandedIds.some((id) => (masteryById[id] ?? 0) >= policy.masterySkipThreshold)
        && knowledgeIds[0] !== expandedIds[0],
      mounted: fill.mounted,
      fill,
      pathScore: scoreFilledPath(fill.mounted, {
        knowledgeIds,
        styleKinds: kinds,
        preferredTypes,
        timeBudgetMinutes: input.constraints.timeBudgetMinutes,
        policy,
      }) + (input.preferredStyleId === style.styleId ? 10 : 0),
    };
  });

  const rankedStyles = [...styles].sort((left, right) =>
    right.pathScore - left.pathScore
    || left.style.styleId.localeCompare(right.style.styleId),
  );
  const nonEmpty = pickMainStyle(styles, rankedStyles, {
    hasPortrait,
    preferredStyleId: input.preferredStyleId,
  });
  const mainPath = toPlanNodes(nonEmpty.mounted, completed, input.constraints.currentNodeId ?? null, feasibleKnowledge);
  const policyBundle = buildBundle(styles, completed, input, targets, preferredTypes.length > 0, feasibleKnowledge);
  const fallbackReasons = [
    ...(targets.length === 0 ? ['goal-knowledge-unbound'] : []),
    ...(mainPath.length === 0 ? ['knowledge-path-empty'] : []),
    ...(preferredTypes.length === 0 ? ['trusted-portrait-unavailable'] : []),
    ...(nonEmpty.fill.method === 'deterministic-timeout' ? ['heuristic-timeout'] : []),
    ...(styles.some((entry) => entry.clipped) ? ['path-length-capped'] : []),
    ...(styles.some((entry) => entry.masteredDropped) ? ['mastered-knowledge-skipped'] : []),
    ...(droppedAssertions ? ['assertion-knowledge-skipped'] : []),
  ];
  const registeredGoal = getRegisteredAdaptiveLearningPathGoal(input.goal.id);
  const policyFamily = nonEmpty.style.family;
  return {
    id: `adaptive-path:${input.studentId}:${input.goal.id}`,
    userId: input.studentId,
    goal: {
      ...input.goal,
      knowledgeTargets: targets,
      learningGoal: registeredGoal?.learningGoal,
      learningGoalPackage: registeredGoal?.learningGoal,
    },
    stage: 'stage-1-rules-graph',
    policyFamily,
    policyMetadata: ADAPTIVE_LEARNING_PATH_POLICY_FAMILIES[policyFamily],
    policyBundle,
    excludedPolicyFamilies: ['contextual-bandit', 'reinforcement-learning', 'long-horizon-hybrid'],
    status: mainPath.length > 0 ? 'ready' : 'fallback',
    currentNodeId: mainPath[0]?.nodeId ?? null,
    mainPath,
    alternatives: [],
    score: {
      total: mainPath.length,
      objectives: {
        learningGain: mainPath.length,
        engagement: 0,
        constraintSatisfaction: 1,
        diversity: policyBundle.diversity.maxResourceOverlap,
        fatigue: 0,
        dropoutRisk: 0,
      },
    },
    confidence: {
      level: preferredTypes.length > 0 ? 'medium' : 'low',
      score: preferredTypes.length > 0 ? 0.55 : 0.2,
      sourceCoverage: targets.length ? 1 : 0,
    },
    explanations: {
      selectedReasons: [
        'goal-knowledge-path',
        'knowledge-skeleton',
        'bound-resource-fill',
        `fill:${nonEmpty.fill.method}`,
      ],
      rejectedAlternatives: [],
      fallbackReasons,
      configurationFulfillment: [],
    },
    executionStatus: {
      adopted: false,
      completedNodeIds: completed,
      activeNodeId: mainPath[0]?.nodeId ?? null,
      updatedAt: now,
    },
    deviations: [],
    corrections: [],
    feedbackEvents: [],
    visualization: {
      map: {
        mainPathNodeIds: mainPath.map((node) => node.nodeId),
        branchPaths: [],
        currentNodeId: mainPath[0]?.nodeId ?? null,
        completedNodeIds: completed,
        riskNodeIds: [],
        blockedNodes: [],
        alternatives: [],
      },
      timeline: {
        generatedAt: now,
        windows: [{
          days: input.constraints.timelineWindowDays ?? 7,
          nodeIds: mainPath.map((node) => node.nodeId),
          estimatedMinutes: mainPath.reduce((sum, node) => sum + node.estimatedTimeMinutes, 0),
        }],
      },
      evidence: {
        evidenceBasis: input.learnerState ? 'adaptive-learner-state' : 'fallback',
        confidence: {
          level: preferredTypes.length > 0 ? 'medium' : 'low',
          score: preferredTypes.length > 0 ? 0.55 : 0.2,
          sourceCoverage: targets.length ? 1 : 0,
        },
        sourceCoverage: {},
        learnerStateDeficits: [],
        capabilityEvidence: [],
        prerequisiteReasons: mainPath.map((node) => ({
          nodeId: node.nodeId,
          prerequisiteNodeIds: node.prerequisiteNodeIds,
        })),
        teacherPolicy: mainPath.map((node) => ({ nodeId: node.nodeId, policy: node.teacherPolicy })),
        alternatives: [],
      },
    },
  };
}

function isBoundCandidate(
  node: ResourceNode,
  input: AdaptiveLearningPathPlannerInput,
  excluded: Set<string>,
): boolean {
  if (excluded.has(node.id)) return false;
  if (!input.constraints.privacyScopes.includes(node.planningMetadata.privacyLevel)) return false;
  if (node.planningMetadata.teacherPolicy === 'blocked') return false;
  if (node.planningMetadata.teacherPolicy === 'teacher-only') return false;
  if (!(node.launchTarget ?? node.renderTarget)) return false;
  return nodeCanonicalIds(node, input).length > 0;
}

function nodeCanonicalIds(node: ResourceNode, input: AdaptiveLearningPathPlannerInput): string[] {
  const published = node.publishedResource?.canonicalIds ?? [];
  const coverage = node.planningMetadata.knowledgeCoverage;
  const mapped = input.registry.featureIndex
    ? resolvePublishedGoalCanonicalIds(input.registry.featureIndex, coverage)
    : [];
  return unique([...published, ...coverage.filter((id) => id.startsWith('ctc:') || id.startsWith('ctkg:')), ...mapped]);
}

function pickMainStyle<T extends {
  style: (typeof STYLE_META)[number];
  mounted: unknown[];
}>(
  styles: T[],
  ranked: T[],
  input: { hasPortrait: boolean; preferredStyleId?: string },
): T {
  if (input.preferredStyleId) {
    const preferred = styles.find((entry) =>
      entry.style.styleId === input.preferredStyleId && entry.mounted.length > 0,
    );
    if (preferred) return preferred;
  }
  if (!input.hasPortrait) {
    const foundation = styles.find((entry) =>
      entry.style.family === 'foundation-remediation' && entry.mounted.length > 0,
    );
    if (foundation) return foundation;
  }
  return ranked.find((entry) => entry.mounted.length > 0) ?? styles[0]!;
}

function preferredResourceTypes(input: AdaptiveLearningPathPlannerInput): ResourceNodeType[] {
  if (input.resourcePreferences?.length) return input.resourcePreferences;
  const modalities = input.learnerState?.resourcePreference?.preferredModalities ?? [];
  return modalities.filter((item): item is ResourceNodeType => typeof item === 'string');
}

function toPlanNodes(
  mounted: Array<{ node: ResourceNode; canonicalId: string }>,
  completedNodeIds: string[],
  currentNodeId: string | null,
  feasibleKnowledge: ReadonlySet<string>,
): AdaptiveLearningPathPlanNode[] {
  return mounted.map((entry, index) => {
    const node = entry.node;
    const target = node.launchTarget ?? node.renderTarget ?? '';
    const previous = mounted[index - 1]?.node.id;
    const published = node.publishedResource;
    const isCompleted = completedNodeIds.includes(node.id);
    return {
      nodeId: node.id,
      resourceFeatureRef: published ? {
        ...published.identity,
        resourceVersion: published.version,
        indexId: published.indexId,
      } : undefined,
      planningUnitId: `planning-unit:${node.id}`,
      resourceId: published?.identity.resourceId ?? `resource:${node.id}`,
      resourceNodeId: node.id,
      title: resolvePlanningResourceTitle(node.title, {
        canonicalIds: unique([
          entry.canonicalId,
          ...node.planningMetadata.knowledgeCoverage,
          ...(published?.canonicalIds ?? []),
        ]),
        resourceId: published?.identity.resourceId ?? node.sourceRef,
      }),
      type: node.type,
      pathNodeType: node.pathSemantics.type,
      displayName: node.pathSemantics.displayName,
      iconKey: node.pathSemantics.iconKey,
      shapeHint: node.pathSemantics.shapeHint,
      evidenceBehavior: node.pathSemantics.evidenceBehavior,
      evidenceStatus: 'instrumented',
      externalResource: node.externalResource,
      checkpoint: node.checkpoint,
      sourceKind: node.sourceKind,
      sourceRef: node.sourceRef,
      target,
      estimatedTimeMinutes: node.planningMetadata.estimatedTimeMinutes ?? 15,
      cognitiveLoad: node.planningMetadata.cognitiveLoad,
      effort: node.planningMetadata.cost.effort,
      prerequisiteNodeIds: previous ? [previous] : [],
      prerequisiteBasis: previous ? [{
        nodeId: previous,
        source: 'PlanningUnit',
        sourceCanonicalId: mounted[index - 1]?.canonicalId,
        targetCanonicalId: entry.canonicalId,
      }] : [],
      knowledgeCoverage: unique([
        ...node.planningMetadata.knowledgeCoverage.filter((id) => feasibleKnowledge.has(id)),
        ...(published?.canonicalIds ?? []).filter((id) => feasibleKnowledge.has(id)),
        entry.canonicalId,
      ]),
      launchBinding: {
        kind: 'resource-node',
        target,
        sourceRef: { kind: node.sourceKind, ref: node.sourceRef },
      },
      teacherPolicy: node.planningMetadata.teacherPolicy,
      privacyLevel: node.planningMetadata.privacyLevel,
      terminalConstraints: node.planningMetadata.terminalConstraints,
      score: 1,
      reasonCodes: ['knowledge-path-mount', `knowledge:${entry.canonicalId}`],
      status: isCompleted ? 'completed' : node.id === currentNodeId || index === 0 ? 'current' : 'next',
      readiness: {
        state: 'ready',
        message: '可以开始。',
        unlockMessage: null,
        reasonCodes: [],
        fallbackNodeIds: [],
        missingCompetencies: [],
        missingEvidenceCount: 0,
        missingCompletedNodeIds: [],
        missingOutcomeRefs: [],
      },
    };
  });
}

function buildBundle(
  styles: Array<{
    style: (typeof STYLE_META)[number];
    knowledgeIds: string[];
    mounted: Array<{ node: ResourceNode; canonicalId: string }>;
  }>,
  completed: string[],
  input: AdaptiveLearningPathPlannerInput,
  targets: string[],
  hasPortrait: boolean,
  feasibleKnowledge: ReadonlySet<string>,
): AdaptiveLearningPathPolicyBundle {
  const paths: AdaptiveLearningPathPolicyBundle['paths'] = styles.map((entry) => {
    const planNodes = toPlanNodes(
      entry.mounted,
      completed,
      input.constraints.currentNodeId ?? null,
      feasibleKnowledge,
    );
    const minutes = planNodes.reduce((sum, node) => sum + node.estimatedTimeMinutes, 0);
    const resourceMix = countBy(planNodes.map((node) => node.type));
    const limitations = [
      ...(targets.length === 0 ? ['goal-knowledge-unbound'] : []),
      ...(planNodes.length === 0 ? ['knowledge-path-empty'] : []),
      ...(!hasPortrait && entry.style.family === 'preference-matched' ? ['trusted-portrait-unavailable'] : []),
    ];
    return {
      styleId: entry.style.styleId,
      policyFamily: entry.style.family,
      label: entry.style.label,
      nodeIds: planNodes.map((node) => node.nodeId),
      activeNodeIds: planNodes.filter((node) => node.status === 'current').map((node) => node.nodeId),
      lockedNodeIds: [],
      readinessSummary: planNodes.map((node) => ({
        nodeId: node.nodeId,
        state: node.readiness?.state ?? 'ready',
        message: node.readiness?.message ?? '可以开始。',
      })),
      unlockMessages: [],
      planNodes,
      nodeSummaries: planNodes.map((node) => ({
        nodeId: node.nodeId,
        planningUnitId: node.planningUnitId,
        title: node.title,
        pathNodeType: node.pathNodeType,
        displayName: node.displayName,
        iconKey: node.iconKey,
        shapeHint: node.shapeHint,
        evidenceBehavior: node.evidenceBehavior,
        evidenceStatus: node.evidenceStatus,
        estimatedTimeMinutes: node.estimatedTimeMinutes,
        cognitiveLoad: node.cognitiveLoad,
        effort: node.effort,
        knowledgeCoverage: node.knowledgeCoverage,
        status: node.status,
      })),
      targetDeficits: [],
      strategy: {
        family: entry.style.family,
        strategyId: entry.style.styleId,
        name: entry.style.label,
        portraitBasis: hasPortrait && entry.style.family === 'preference-matched'
          ? preferredResourceTypes(input)
          : [],
        generic: !hasPortrait,
        preferredTypeShare: preferredShare(planNodes, entry.style.kinds),
        weaknessResourceCount: 0,
        comprehensiveTaskCount: planNodes.filter((node) =>
          node.type === 'simulation' || node.type === 'arena_task',
        ).length,
      },
      evidenceBasis: ['teaching-projection', 'bound-resources'],
      estimatedMinutes: minutes,
      modalityMix: resourceMix,
      resourceMix,
      overlap: { maxWithOtherOptions: 0 },
      effort: {
        estimatedMinutes: minutes,
        relative: minutes <= 30 ? 'short' : minutes <= 70 ? 'medium' : 'long',
      },
      expectedTargetLift: planNodes.length,
      terminalValidationNodeIds: [],
      terminalValidationStrategy: { nodeIds: [], summary: '按知识点路径挂载，不另加终点门禁。' },
      checkpointNodeIds: planNodes.filter((node) => node.type === 'checkpoint').map((node) => node.nodeId),
      limitations,
    };
  });

  for (const path of paths) {
    path.overlap.maxWithOtherOptions = Math.max(
      0,
      ...paths
        .filter((other) => other.styleId !== path.styleId)
        .map((other) => jaccard(path.nodeIds, other.nodeIds)),
    );
  }

  return {
    families: STYLE_META.map((style) => style.family),
    overlapThreshold: 1,
    status: paths.some((path) => path.nodeIds.length > 0) ? 'ready' : 'low-resource-fallback',
    paths,
    diversity: {
      maxResourceOverlap: Math.max(0, ...paths.map((path) => path.overlap.maxWithOtherOptions)),
      minModalityDistance: 0,
      minEstimatedEffortDifference: 0,
      minTerminalValidationDifference: 0,
      pairwiseResourceOverlap: pairMetrics(paths, (left, right) => ({
        left: left.policyFamily,
        right: right.policyFamily,
        overlap: jaccard(left.nodeIds, right.nodeIds),
      })),
      pairwiseModalityDistance: [],
      pairwiseEstimatedEffortDifference: [],
      pairwiseTerminalValidationDifference: [],
      modalityMixByPolicy: Object.fromEntries(paths.map((path) => [path.policyFamily, path.modalityMix])),
      estimatedEffortByPolicy: Object.fromEntries(paths.map((path) => [path.policyFamily, path.estimatedMinutes])),
      terminalValidationDifference: 0,
    },
    fallbackReasons: paths.flatMap((path) => path.limitations).filter((value, index, all) => all.indexOf(value) === index),
  };
}

function preferredShare(nodes: AdaptiveLearningPathPlanNode[], kinds: ResourceNodeType[]): number {
  if (nodes.length === 0) return 0;
  return nodes.filter((node) => kinds.includes(node.type)).length / nodes.length;
}

function jaccard(left: string[], right: string[]): number {
  const a = new Set(left);
  const b = new Set(right);
  const intersection = [...a].filter((id) => b.has(id)).length;
  const union = new Set([...a, ...b]).size;
  return union === 0 ? 0 : intersection / union;
}

function pairMetrics<T>(
  paths: T[],
  build: (left: T, right: T) => {
    left: AdaptiveLearningPathPolicyFamily;
    right: AdaptiveLearningPathPolicyFamily;
    overlap: number;
  },
) {
  const rows = [];
  for (let i = 0; i < paths.length; i += 1) {
    for (let j = i + 1; j < paths.length; j += 1) {
      rows.push(build(paths[i]!, paths[j]!));
    }
  }
  return rows;
}

function countBy(values: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const value of values) counts[value] = (counts[value] ?? 0) + 1;
  return counts;
}

function unique(values: string[]): string[] {
  return [...new Set(values)];
}
