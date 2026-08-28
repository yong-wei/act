import { describe, expect, it } from 'vitest';

import {
  assertInterventionLifecycleEventType,
  decideIntervention,
  PersonalizationInterventionEventError,
} from '../public-api';
import { PERSONALIZATION_INTERVENTION_POLICY_REVISION } from '../constants';
import { PersonalizationPolicyScopeError } from '@/features/personalization/recommendations/scope';
import type { StudentState } from '../policy';

const failedState: StudentState = {
  currentTask: 'PID',
  currentAttempt: 3,
  attemptHistory: [
    { attemptNumber: 1, params: { kp: 1 }, result: { overshoot: 10 }, isSuccessful: false },
    { attemptNumber: 2, params: { kp: 2 }, result: { overshoot: 12 }, isSuccessful: false },
  ],
};

describe('DecideIntervention policy', () => {
  it('returns a scoped decision that does not grant mastery', () => {
    const result = decideIntervention({
      actorUserId: 'student-1',
      subjectUserId: 'student-1',
      role: 'STUDENT',
      studentState: failedState,
    });

    expect(result.grantsMastery).toBe(false);
    expect(result.policyRevision).toBe(PERSONALIZATION_INTERVENTION_POLICY_REVISION);
    expect(result.ownerUserId).toBe('student-1');
    expect(result.decision.shouldIntervene).toBe(true);
    expect(result.payload.content.length).toBeGreaterThan(0);
  });

  it('fails closed across learner identities', () => {
    expect(() => decideIntervention({
      actorUserId: 'student-1',
      subjectUserId: 'student-2',
      role: 'student',
      studentState: failedState,
    })).toThrow(PersonalizationPolicyScopeError);
  });

  it('rejects events outside the lifecycle whitelist', () => {
    expect(() => assertInterventionLifecycleEventType('PROMPT_OPENED')).toThrow(PersonalizationInterventionEventError);
    expect(() => assertInterventionLifecycleEventType('HINT_REQUESTED')).not.toThrow();
    expect(() => assertInterventionLifecycleEventType('RESOURCE_USED')).not.toThrow();
    expect(() => assertInterventionLifecycleEventType('COMPLETED')).not.toThrow();
  });
});
