import { describe, expect, it } from 'vitest';

import {
  createWorkspaceParameterTelemetryBuffer,
  WORKSPACE_PARAM_IDLE_FLUSH_MS,
} from '../session-framework/workspace-parameter-telemetry';

describe('workspace parameter telemetry', () => {
  it('coalesces slider ticks into one sampled workspace_param_change payload', () => {
    const buffer = createWorkspaceParameterTelemetryBuffer();

    buffer.record('step-04', { gain: 1, source: 'slider' }, 1_000);
    buffer.record('step-04', { gain: 2, source: 'slider' }, 1_100);
    buffer.record('step-04', { gain: 3, source: 'slider' }, 1_200);

    expect(buffer.collectDue(1_200 + WORKSPACE_PARAM_IDLE_FLUSH_MS - 1)).toEqual([]);

    expect(buffer.collectDue(1_200 + WORKSPACE_PARAM_IDLE_FLUSH_MS)).toEqual([
      {
        stepId: 'step-04',
        data: {
          gain: 3,
          source: 'slider',
          sampled: true,
          changeCount: 3,
          flushReason: 'idle',
          firstClientEventAt: 1_000,
          lastClientEventAt: 1_200,
        },
        clientEventAt: 1_200,
      },
    ]);
  });

  it('flushes the current step before a step leave or submit event is emitted', () => {
    const buffer = createWorkspaceParameterTelemetryBuffer();

    buffer.record('step-04', { damping: 0.4 }, 2_000);
    buffer.record('step-05', { damping: 0.5 }, 2_100);

    expect(buffer.flushStep('step-04', 'step_leave')).toEqual([
      {
        stepId: 'step-04',
        data: {
          damping: 0.4,
          sampled: true,
          changeCount: 1,
          flushReason: 'step_leave',
          firstClientEventAt: 2_000,
          lastClientEventAt: 2_000,
        },
        clientEventAt: 2_000,
      },
    ]);

    expect(buffer.flushAll('session_finalize')).toEqual([
      {
        stepId: 'step-05',
        data: {
          damping: 0.5,
          sampled: true,
          changeCount: 1,
          flushReason: 'session_finalize',
          firstClientEventAt: 2_100,
          lastClientEventAt: 2_100,
        },
        clientEventAt: 2_100,
      },
    ]);
  });
});
