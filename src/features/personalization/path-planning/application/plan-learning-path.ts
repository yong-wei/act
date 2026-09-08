import {
  PATH_CONSTRAINT_REPAIR_VERSION,
  deterministicPathConstraintRepairAdapter,
} from '@/features/personalization/path-planning/path-constraint-repair';
import { rankResourceLearnerCandidates } from '@/features/personalization/path-planning/resource-ranker';
import { buildResourceSemanticProjection } from '@/lib/resource-node-registry';
import { resolvePublishedGoalCanonicalIds } from '@/lib/published-resource-planning';
import { resolveEngineeringResourceOrder } from '../engineering-resource-order';

import { personalizationPluginRegistry } from '@/features/personalization/plugins/public-api';
import {
  assembleAdaptiveLearningPathPlan,
  evaluateHardEligibility,
  getRegisteredAdaptiveLearningPathGoal,
} from '../internal/assemble-plan';
import type {
  EligibilityDecision,
  GoalContext,
  PlanLearningPathInput,
  PlanLearningPathPorts,
  PlanLearningPathResult,
} from '../ports';

export function loadGoalContext(input: PlanLearningPathInput): GoalContext {
  const index = input.registry.featureIndex;
  if (!index) return { input };
  const registered = getRegisteredAdaptiveLearningPathGoal(input.goal.id);
  const groups = input.goal.knowledgeTargets.map((target) => ({ target,
    ids: resolvePublishedGoalCanonicalIds(index, [target, ...(registered?.knowledgeTargetAliases?.[target] ?? [])]),
  }));
  const canonicalTargetIds = [...new Set(groups.flatMap((group) => group.ids))];
  return { canonicalTargetIds, input: { ...input, registry: { ...input.registry,
    nodes: input.registry.nodes.map((node) => node.publishedResource ? {
      ...node, planningMetadata: { ...node.planningMetadata,
        goalCoverage: groups.filter((group) => group.ids.some((id) => node.publishedResource!.canonicalIds.includes(id)))
          .map((group) => group.target),
      },
    } : node),
  } } };
}

export function evaluateEligibility(context: GoalContext): EligibilityDecision {
  const { eligible, blocked } = evaluateHardEligibility(
    context.input.registry.nodes,
    context.input.constraints,
  );
  return {
    eligible,
    excluded: blocked,
  };
}

export function createDefaultPlanLearningPathPorts(): PlanLearningPathPorts {
  return {
    goalContext: { load: loadGoalContext },
    candidates: {
      discover(context) {
        const nodes = context.input.registry.nodes;
        const plugin = personalizationPluginRegistry.get(context.input.goal.id);
        if (plugin?.status !== 'active' || !plugin.pathPlanningPolicy) {
          return { nodes };
        }
        const allowedTypes = new Set(plugin.pathPlanningPolicy.allowedResourceMix);
        return {
          nodes: nodes.filter((node) => allowedTypes.has(node.type) || node.publishedResource?.recommendable === true),
        };
      },
    },
    eligibility: {
      decide(context, candidates) {
        const { eligible, blocked } = evaluateHardEligibility(
          candidates.nodes,
          context.input.constraints,
        );
        return { eligible, excluded: blocked };
      },
    },
    ranking: {
      rank(context, eligible) {
        const rankerResult = rankResourceLearnerCandidates({
          candidates: eligible.eligible.map((node) => ({
            node,
            planningUnit: buildResourceSemanticProjection(node).planningUnit,
            limitations: [],
          })),
          scene: 'path',
          targetGraphNodeIds: context.input.goal.knowledgeTargets,
          selectedGraphNodeIds: [],
          learnerState: context.input.learnerState,
          preferredResourceTypes: context.input.resourcePreferences,
          difficultyRhythm: context.input.difficultyRhythm,
          timeBudgetMinutes: context.input.constraints.timeBudgetMinutes,
          completedNodeIds: context.input.constraints.completedNodeIds ?? [],
          availableOutcomeRefs: context.input.constraints.availableOutcomeRefs ?? [],
          teacherAssignedNodeIds: context.input.constraints.teacherAssignedNodeIds ?? [],
          registry: context.input.registry,
        });
        const ranked = rankerResult.ranked.map((entry) => entry.node);
        const rankedIds = new Set(ranked.map((node) => node.id));
        return {
          ordered: [
            ...ranked,
            ...eligible.eligible.filter((node) => !rankedIds.has(node.id)),
          ],
        };
      },
    },
    repair: {
      repair(context, ranked) {
        const registeredGoal = getRegisteredAdaptiveLearningPathGoal(context.input.goal.id);
        const checkpointResourceTypes = new Set(registeredGoal?.checkpointPolicy.checkpointResourceTypes ?? []);
        const completedNodeIds = new Set(context.input.constraints.completedNodeIds ?? []);
        const repair = deterministicPathConstraintRepairAdapter.repair({
          draftNodeIds: ranked.ordered.map((node) => node.id),
          candidates: ranked.ordered.map((node) => {
            const isCheckpoint = Boolean(node.checkpoint) ||
              node.type === 'checkpoint' ||
              checkpointResourceTypes.has(node.type);
            const isOfficialTerminal = (node.type === 'simulation' || node.type === 'arena_task') &&
              node.planningMetadata.terminalConstraints.includes('terminal-validation');
            return {
              nodeId: node.id,
              estimatedTimeMinutes: completedNodeIds.has(node.id)
                ? 0
                : node.planningMetadata.estimatedTimeMinutes ?? 15,
              prerequisiteNodeIds: node.planningMetadata.prerequisites,
              checkpointRole: isCheckpoint
                ? node.checkpoint?.assessmentPurpose ?? 'formative'
                : undefined,
              terminalValidation: isOfficialTerminal ? 'official' as const : undefined,
              removable: false,
            };
          }),
          constraints: {
            timeBudgetMinutes: context.input.constraints.timeBudgetMinutes,
            requiredCheckpointCount: registeredGoal?.checkpointPolicy.minCheckpoints ?? 0,
            terminalValidationRequired: registeredGoal?.checkpointPolicy.requiresTerminalValidation ?? false,
          },
          versionRefs: {
            plannerVersion: 'adaptive-learning-path-planner.v1',
            repairVersion: PATH_CONSTRAINT_REPAIR_VERSION,
          },
        });
        const nodesById = new Map(ranked.ordered.map((node) => [node.id, node]));
        return {
          ordered: repair.repairedNodeIds
            .map((nodeId) => nodesById.get(nodeId))
            .filter((node): node is NonNullable<typeof node> => Boolean(node)),
        };
      },
    },
    assembler: {
      assemble(context, repaired) {
        return assembleAdaptiveLearningPathPlan(
          context.input,
          repaired.ordered.map((node) => node.id),
        );
      },
    },
    explanation: {
      explain(_context, plan) {
        return plan;
      },
    },
  };
}

export function planLearningPath(
  input: PlanLearningPathInput,
  ports: PlanLearningPathPorts = createDefaultPlanLearningPathPorts(),
): PlanLearningPathResult {
  const context = ports.goalContext.load(input);
  const candidates = ports.candidates.discover(context);
  const eligibility = ports.eligibility.decide(context, candidates);
  const ranked = ports.ranking.rank(context, eligibility);
  if (context.input.registry.featureIndex && context.canonicalTargetIds?.length) {
    const excluded = new Set(context.input.excludedNodeIds ?? []);
    const mastery = context.input.learnerState?.knowledgeMastery?.tags ?? {};
    const mastered = new Set(Object.entries(mastery).filter(([, value]) =>
      (value.posteriorMastery ?? 0) >= 0.85 && (value.confidence ?? 0) >= 0.6 && (value.evidenceCount ?? 0) > 0)
      .map(([id]) => id));
    context.input = { ...context.input, registry: resolveEngineeringResourceOrder({
      registry: context.input.registry, rankedCandidates: ranked.ordered.filter((node) => !excluded.has(node.id)),
      targetCanonicalIds: context.canonicalTargetIds, completedNodeIds: context.input.constraints.completedNodeIds,
      masteredCanonicalIds: mastered,
    }) };
  }
  const currentNodes = new Map(context.input.registry.nodes.map((node) => [node.id, node]));
  const repaired = ports.repair.repair(context, context.input.registry.engineeringOrder ? { ordered: ranked.ordered
    .map((node) => currentNodes.get(node.id) ?? node).filter((node) => node.eligibility.pathEligible) } : ranked);
  const assembled = ports.assembler.assemble(context, repaired);
  const explained = ports.explanation.explain(context, assembled);
  if (!context.input.registry.featureIndex) return explained;
  const withReference = (node: PlanLearningPathResult['mainPath'][number]) => {
    const engineering = context.input.registry.engineeringOrder?.constraints.filter((entry) => entry.dependentNodeId === node.nodeId) ?? [];
    const prerequisiteBasis = node.prerequisiteNodeIds.flatMap<NonNullable<typeof node.prerequisiteBasis>[number]>((id) => {
      const sources = engineering.filter((entry) => entry.prerequisiteNodeId === id);
      return sources.length ? sources.map((entry) => ({ nodeId: id, source: 'ENGINEERING' as const,
        relationId: entry.relationId, sourceCanonicalId: entry.sourceCanonicalId, targetCanonicalId: entry.targetCanonicalId,
      })) : [{ nodeId: id, source: 'PlanningUnit' as const }];
    });
    const resource = currentNodes.get(node.nodeId)?.publishedResource;
    if (!resource) return { ...node, prerequisiteBasis };
    const values = resource.canonicalIds.map((id) => context.input.learnerState?.knowledgeMastery?.tags?.[id])
      .filter((entry) => entry && typeof entry.posteriorMastery === 'number' && (entry.confidence ?? 0) >= 0.6 && (entry.evidenceCount ?? 0) > 0);
    return { ...node, prerequisiteBasis, resourceFeatureRef: { ...resource.identity, resourceVersion: resource.version,
      indexId: resource.indexId, learnerPreparedness: values.length
        ? values.reduce((sum, entry) => sum + entry!.posteriorMastery!, 0) / values.length : null,
    } };
  };
  return { ...explained, mainPath: explained.mainPath.map(withReference),
    explanations: { ...explained.explanations, engineeringOrder: context.input.registry.engineeringOrder },
    policyBundle: explained.policyBundle ? { ...explained.policyBundle, paths: explained.policyBundle.paths.map((path) => ({
      ...path, planNodes: path.planNodes?.map(withReference),
    })) } : explained.policyBundle,
  };
}
