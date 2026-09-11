import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  completeAdaptivePathAfterPersistedRun,
  persistPathLaunchedCourseDemoIfCurrentStep,
  shouldPersistPathLaunchedCourseDemo,
} from '../persisted-run-client';

describe('completeAdaptivePathAfterPersistedRun', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
      journey: null,
    }), { status: 200 })));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('writes a governed path completion after a persisted simulation run', async () => {
    vi.stubGlobal('window', {
      location: {
        search: '?source=adaptive-path-center&goal=control-correction&goalId=control-correction&pathId=path-1&nodeId=node-sim&intent=path-execution&returnHref=%2Fassessment%2Fadaptive-practice%3Fgoal%3Dcontrol-correction%26intent%3Dpath-execution%26pathId%3Dpath-1%26nodeId%3Dnode-sim&resourceType=simulation',
      },
    });

    await completeAdaptivePathAfterPersistedRun({
      simulationRunId: 'sim-run-1',
      resourceType: 'simulation',
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/learning-paths/path-1/execute',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"simulationRef":{"id":"sim-run-1"}'),
      }),
    );
  });

  it('writes a governed path completion after a persisted control-workbench run', async () => {
    vi.stubGlobal('window', {
      location: {
        search: '?source=adaptive-path-center&goal=control-correction&goalId=control-correction&pathId=path-1&nodeId=node-workbench&intent=path-execution&returnHref=%2Fassessment%2Fadaptive-practice%3Fgoal%3Dcontrol-correction%26intent%3Dpath-execution%26pathId%3Dpath-1%26nodeId%3Dnode-workbench&resourceType=control_workbench',
      },
    });

    await completeAdaptivePathAfterPersistedRun({
      simulationRunId: 'wb-run-1',
      resourceType: 'control_workbench',
    });

    expect(fetch).toHaveBeenCalledWith(
      '/api/learning-paths/path-1/execute',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"resourceType":"control_workbench"'),
      }),
    );
  });

  it('does not write path completion for standalone launches', async () => {
    vi.stubGlobal('window', { location: { search: '' } });
    await completeAdaptivePathAfterPersistedRun({
      simulationRunId: 'sim-run-1',
      resourceType: 'simulation',
    });
    expect(fetch).not.toHaveBeenCalled();
  });

  it('persists a path-launched course demo only on the bound step', async () => {
    const launchContext = {
      source: 'adaptive-path-center' as const,
      goalId: 'control-correction',
      pathId: 'path-1',
      nodeId: 'simulation:control-correction-step-response-lab',
      routeIntent: 'path-execution' as const,
      returnHref: '/assessment/adaptive-practice?goal=control-correction&intent=path-execution&pathId=path-1&nodeId=simulation:control-correction-step-response-lab',
      resourceType: 'simulation',
    };
    expect(shouldPersistPathLaunchedCourseDemo({
      launchContext,
      currentStepId: 'step-11',
      targetStepId: 'step-11',
    })).toBe(true);
    expect(shouldPersistPathLaunchedCourseDemo({
      launchContext,
      currentStepId: 'step-10',
      targetStepId: 'step-11',
    })).toBe(false);

    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (String(url).includes('/api/simulation/runs')) {
        return new Response(JSON.stringify({ simulationRunId: 'course-demo-run-1' }), { status: 200 });
      }
      return new Response(JSON.stringify({ journey: null }), { status: 200 });
    }));
    vi.stubGlobal('window', {
      location: {
        search: '?source=adaptive-path-center&goal=control-correction&goalId=control-correction&pathId=path-1&nodeId=simulation:control-correction-step-response-lab&intent=path-execution&returnHref=%2Fassessment%2Fadaptive-practice%3Fgoal%3Dcontrol-correction%26intent%3Dpath-execution%26pathId%3Dpath-1%26nodeId%3Dsimulation%3Acontrol-correction-step-response-lab&resourceType=simulation&step=step-11',
      },
    });

    await persistPathLaunchedCourseDemoIfCurrentStep('step-11');

    expect(fetch).toHaveBeenCalledWith(
      '/api/simulation/runs',
      expect.objectContaining({
        method: 'POST',
        body: expect.stringContaining('"kind":"path-course-demo"'),
      }),
    );
  });

  it('wires course demo persist through the shared manifest submit used by Unit 3-6', () => {
    const controller = readFileSync(
      join(process.cwd(), 'src/features/interactive/shared/manifest-runtime/submission-controller.ts'),
      'utf8',
    );
    const studentPage = readFileSync(
      join(process.cwd(), 'src/features/interactive/unit-3-6-zero-design-workshop/student-page.tsx'),
      'utf8',
    );
    expect(controller).toContain('persistPathLaunchedCourseDemoIfCurrentStep');
    expect(studentPage).toContain('submitManifestStepResponse');
  });
});
