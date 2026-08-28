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
        return {
          nodes: evaluateEligibility(context).eligible,
        };
      },
    },
    eligibility: {
      decide(context) {
        return evaluateEligibility(context);
      },
    },
    ranking: {
      rank(_context, eligible) {
        return { ordered: eligible.eligible };
      },
    },
    repair: {
      repair(_context, ranked) {
        return ranked;
      },
    },
    assembler: {
      assemble(context) {
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
  const context = loadGoalContext(input);
  evaluateEligibility(context);
  return assembleAdaptiveLearningPathPlan(context.input);
}
