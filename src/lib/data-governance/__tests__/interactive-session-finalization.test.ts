import { describe, expect, it, vi } from 'vitest';

import { finalizeInteractiveLessonSession } from '../interactive-session-finalization';

describe('finalizeInteractiveLessonSession', () => {
  const steps = [
    { id: 'step-01', stage: 'B' },
    { id: 'step-02', stage: 'P1' },
    { id: 'step-03', stage: 'P3' },
  ];

  it('finishes the classroom before tracking session_finalize telemetry', async () => {
    const trace: string[] = [];
    const trackSessionFinalize = vi.fn((data: { finalStepId: string }) => {
      trace.push(`finalize:${data.finalStepId}`);
    });

    const telemetry = await finalizeInteractiveLessonSession({
      currentStepId: 'step-03',
      steps,
      finishSession: async () => {
        trace.push('finish');
      },
      trackSessionFinalize,
    });

    expect(trace).toEqual(['finish', 'finalize:step-03']);
    expect(trackSessionFinalize).toHaveBeenCalledWith(expect.objectContaining({
      currentStepId: 'step-03',
      finalStepId: 'step-03',
      completionRatio: 1,
      outcome: 'success',
      countAfterSessionEnd: true,
    }));
    expect(telemetry).toMatchObject({
      finalStepId: 'step-03',
      outcome: 'success',
    });
  });

  it('does not track session_finalize when classroom finish fails', async () => {
    const trackSessionFinalize = vi.fn();

    await expect(finalizeInteractiveLessonSession({
      currentStepId: 'step-02',
      steps,
      finishSession: async () => {
        throw new Error('finish failed');
      },
      trackSessionFinalize,
    })).rejects.toThrow('finish failed');

    expect(trackSessionFinalize).not.toHaveBeenCalled();
  });
});
