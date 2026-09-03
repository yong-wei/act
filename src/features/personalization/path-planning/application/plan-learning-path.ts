import {
  PATH_CONSTRAINT_REPAIR_VERSION,
  deterministicPathConstraintRepairAdapter,
} from '@/features/personalization/path-planning/path-constraint-repair';
import { rankResourceLearnerCandidates } from '@/features/personalization/path-planning/resource-ranker';

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
  return { input };
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
          nodes: nodes.filter((node) => allowedTypes.has(node.type)),
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
            planningUnit: null,
            limitations: [],
          })),
          scene: 'path',
          targetGraphNodeIds: context.input.goal.knowledgeTargets,
          selectedGraphNodeIds: [],
          learnerState: context.input.learnerState,
          preferredResourceTypes: context.input.resourcePreferences,
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
  const repaired = ports.repair.repair(context, ranked);
  const assembled = ports.assembler.assemble(context, repaired);
  return ports.explanation.explain(context, assembled);
}
