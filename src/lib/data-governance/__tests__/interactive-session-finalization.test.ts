import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it, vi } from 'vitest';

import { finalizeInteractiveLessonSession } from '../interactive-session-finalization';

describe('finalizeInteractiveLessonSession', () => {
  const repoRoot = process.cwd();
  const steps = [
    { id: 'step-01', stage: 'B' },
    { id: 'step-02', stage: 'P1' },
    { id: 'step-03', stage: 'P3' },
  ];

  it('owns finalization telemetry assembly instead of importing the legacy builder', () => {
    const adapterSource = readFileSync(
      join(repoRoot, 'src/lib/data-governance/interactive-session-finalization.ts'),
      'utf8',
    );

    expect(adapterSource).not.toContain('buildSessionFinalizeTelemetry');
    expect(adapterSource).not.toContain('session-finalize-telemetry');
    expect(adapterSource).toContain('function buildInteractiveSessionFinalizeTelemetry');
  });

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

  it('reports partial finalization when the teacher ends before assessment and summary', async () => {
    const trackSessionFinalize = vi.fn();

    const telemetry = await finalizeInteractiveLessonSession({
      currentStepId: 'step-02',
      steps,
      finishSession: async () => {},
      trackSessionFinalize,
    });

    expect(telemetry).toMatchObject({
      currentStepId: 'step-02',
      finalStepId: 'step-02',
      finalStepIndex: 1,
      totalSteps: 3,
      completionRatio: 2 / 3,
      endedBeforeAssessment: true,
      endedBeforeSummary: true,
      outcome: 'partial',
      countAfterSessionEnd: true,
    });
    expect(trackSessionFinalize).toHaveBeenCalledWith(telemetry);
  });
});
