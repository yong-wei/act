import { describe, expect, it } from 'vitest';

import { buildSessionFinalizeTelemetry } from '../session-finalize-telemetry';

describe('buildSessionFinalizeTelemetry', () => {
  const steps = [
    { id: 'step-01', stage: 'B' },
    { id: 'step-02', stage: 'O' },
    { id: 'step-03', stage: 'P1' },
    { id: 'step-04', stage: 'P2' },
    { id: 'step-05', stage: 'P3' },
    { id: 'step-06', stage: 'P3' },
  ];

  it('records partial completion when a teacher ends the class before assessment and summary', () => {
    expect(buildSessionFinalizeTelemetry({
      currentStepId: 'step-04',
      steps,
    })).toMatchObject({
      currentStepId: 'step-04',
      finalStepId: 'step-04',
      finalStepIndex: 3,
      totalSteps: 6,
      completionRatio: 4 / 6,
      endedBeforeAssessment: true,
      endedBeforeSummary: true,
      outcome: 'partial',
    });
  });

  it('keeps a completed finalization successful when the last step is reached', () => {
    expect(buildSessionFinalizeTelemetry({
      currentStepId: 'step-06',
      steps,
    })).toMatchObject({
      finalStepId: 'step-06',
      finalStepIndex: 5,
      totalSteps: 6,
      completionRatio: 1,
      endedBeforeAssessment: false,
      endedBeforeSummary: false,
      outcome: 'success',
    });
  });
});
