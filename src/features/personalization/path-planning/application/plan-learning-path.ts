import {
  PATH_CONSTRAINT_REPAIR_VERSION,
  deterministicPathConstraintRepairAdapter,
} from '@/lib/adaptive-planning/path-constraint-repair';
import { rankResourceLearnerCandidates } from '@/lib/adaptive-planning/resource-ranker';

import {
  assembleAdaptiveLearningPathPlan,
  evaluateHardEligibility,
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
        return { nodes: context.input.registry.nodes };
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
        return {
          ordered: rankerResult.ranked.map((entry) => entry.node),
        };
      },
    },
    repair: {
      repair(context, ranked) {
        const repair = deterministicPathConstraintRepairAdapter.repair({
          draftNodeIds: ranked.ordered.map((node) => node.id),
          candidates: ranked.ordered.map((node) => ({
            nodeId: node.id,
            estimatedTimeMinutes: node.planningMetadata.estimatedTimeMinutes ?? 15,
            prerequisiteNodeIds: node.planningMetadata.prerequisites,
          })),
          constraints: {
            timeBudgetMinutes: context.input.constraints.timeBudgetMinutes,
            requiredCheckpointCount: 1,
            terminalValidationRequired: false,
          },
          versionRefs: {
            plannerVersion: 'adaptive-learning-path-planner.v1',
            repairVersion: PATH_CONSTRAINT_REPAIR_VERSION,
          },
        });
        const nodesById = new Map(ranked.ordered.map((node) => [node.id, node]));
        const ordered = repair.repairedNodeIds
          .map((nodeId) => nodesById.get(nodeId))
          .filter((node): node is NonNullable<typeof node> => Boolean(node));
        return { ordered: ordered.length > 0 ? ordered : ranked.ordered };
      },
    },
    assembler: {
      assemble(context, repaired) {
        void repaired;
        return assembleAdaptiveLearningPathPlan(context.input);
      },
    },
    explanation: {
      explain(_context, plan) {
        return plan;
      },
    },
  };
}

export function planLearningPath(input: PlanLearningPathInput): PlanLearningPathResult {
  const ports = createDefaultPlanLearningPathPorts();
  const context = ports.goalContext.load(input);
  const candidates = ports.candidates.discover(context);
  const eligibility = ports.eligibility.decide(context, candidates);
  const ranked = ports.ranking.rank(context, eligibility);
  const repaired = ports.repair.repair(context, ranked);
  const assembled = ports.assembler.assemble(context, repaired);
  return ports.explanation.explain(context, assembled);
}
