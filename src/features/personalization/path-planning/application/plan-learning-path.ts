import type { ResourceNode } from '@/lib/resource-node-registry';

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

const assembledPlanByContext = new WeakMap<GoalContext, PlanLearningPathResult>();

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

function assembledPlanFor(context: GoalContext): PlanLearningPathResult {
  const cached = assembledPlanByContext.get(context);
  if (cached) return cached;
  const plan = assembleAdaptiveLearningPathPlan(context.input);
  assembledPlanByContext.set(context, plan);
  return plan;
}

function resourceNodesForPlan(context: GoalContext, plan: PlanLearningPathResult): ResourceNode[] {
  const nodesById = new Map(context.input.registry.nodes.map((node) => [node.id, node]));
  return plan.mainPath
    .map((node) => nodesById.get(node.nodeId))
    .filter((node): node is ResourceNode => Boolean(node));
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
        const eligibleIds = new Set(eligible.eligible.map((node) => node.id));
        const ordered = resourceNodesForPlan(context, assembledPlanFor(context))
          .filter((node) => eligibleIds.has(node.id));
        return { ordered };
      },
    },
    repair: {
      repair(context, ranked) {
        const repaired = resourceNodesForPlan(context, assembledPlanFor(context));
        if (repaired.length === 0) return ranked;
        const rankedIds = new Set(ranked.ordered.map((node) => node.id));
        return {
          ordered: repaired.filter((node) => rankedIds.has(node.id)),
        };
      },
    },
    assembler: {
      assemble(context, repaired) {
        const cached = assembledPlanFor(context);
        const cachedIds = resourceNodesForPlan(context, cached).map((node) => node.id);
        const repairedIds = repaired.ordered.map((node) => node.id);
        if (
          cachedIds.length === repairedIds.length
          && cachedIds.every((nodeId, index) => nodeId === repairedIds[index])
        ) {
          return cached;
        }
        return assembleAdaptiveLearningPathPlan(context.input, repairedIds);
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
