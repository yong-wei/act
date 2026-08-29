import type { ArenaCompanionContext } from '@/features/ai/companion/arena-companion-context';
import { PERSONALIZATION_INTERVENTION_POLICY_REVISION } from '../constants';
import {
  generateIntervention,
  shouldIntervene,
  type InterventionDecision,
  type InterventionPayload,
  type InterventionRules,
  type StudentState,
} from '../policy';
import { assertPersonalizationOwnerScope } from '@/features/personalization/recommendations/scope';

export interface DecideInterventionInput {
  actorUserId: string;
  subjectUserId: string;
  role: string;
  studentState: StudentState;
  rules?: Partial<InterventionRules>;
  arenaContext?: ArenaCompanionContext;
}

export interface DecideInterventionResult {
  decision: InterventionDecision;
  payload: InterventionPayload;
  policyRevision: string;
  ownerUserId: string;
  grantsMastery: false;
}

export function decideIntervention(input: DecideInterventionInput): DecideInterventionResult {
  assertPersonalizationOwnerScope(input);
  const decision = shouldIntervene(input.studentState, input.rules, input.arenaContext);
  const payload = generateIntervention(decision, input.studentState, input.arenaContext);
  return {
    decision,
    payload,
    policyRevision: PERSONALIZATION_INTERVENTION_POLICY_REVISION,
    ownerUserId: input.subjectUserId,
    grantsMastery: false,
  };
}
