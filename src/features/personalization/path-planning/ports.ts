import type { ResourceNode } from '@/lib/resource-node-registry';

import type {
  AdaptiveLearningPathAlternative,
  AdaptiveLearningPathPlan,
  AdaptiveLearningPathPlannerInput,
} from './internal/assemble-plan';

export type PlanLearningPathInput = AdaptiveLearningPathPlannerInput;
export type PlanLearningPathResult = AdaptiveLearningPathPlan;

export interface GoalContext {
  input: PlanLearningPathInput;
  canonicalTargetIds?: string[];
}

export interface CandidateSet {
  nodes: ResourceNode[];
}

export interface EligibilityDecision {
  eligible: ResourceNode[];
  excluded: AdaptiveLearningPathAlternative[];
}

export interface RankedCandidates {
  ordered: ResourceNode[];
}

export interface GoalContextLoader {
  load(input: PlanLearningPathInput): GoalContext;
}

export interface CandidateProvider {
  discover(context: GoalContext): CandidateSet;
}

export interface EligibilityPolicy {
  decide(context: GoalContext, candidates: CandidateSet): EligibilityDecision;
}

export interface RankingStrategy {
  rank(context: GoalContext, eligible: EligibilityDecision): RankedCandidates;
}

export interface ConstraintRepair {
  repair(context: GoalContext, ranked: RankedCandidates): RankedCandidates;
}

export interface PathAssembler {
  assemble(context: GoalContext, repaired: RankedCandidates): PlanLearningPathResult;
}

export interface ExplanationBuilder {
  explain(context: GoalContext, plan: PlanLearningPathResult): PlanLearningPathResult;
}

export interface PlanLearningPathPorts {
  goalContext: GoalContextLoader;
  candidates: CandidateProvider;
  eligibility: EligibilityPolicy;
  ranking: RankingStrategy;
  repair: ConstraintRepair;
  assembler: PathAssembler;
  explanation: ExplanationBuilder;
}

export const PLAN_LEARNING_PATH_STAGE_ORDER = [
  'GoalContextLoader',
  'CandidateProvider',
  'EligibilityPolicy',
  'RankingStrategy',
  'ConstraintRepair',
  'PathAssembler',
  'ExplanationBuilder',
] as const;
