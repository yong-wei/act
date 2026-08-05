import { describe, expect, it } from 'vitest';

import { projectAdaptivePathCorrectionOutcome } from '../adaptive-path-correction-outcomes';

const decision = (overrides: Record<string, unknown> = {}) => ({
  decision: 'confirmed',
  createdAt: '2026-08-05T10:00:00.000Z',
  applicationResult: { applied: true, nodeIds: ['node-1', 'node-2'] },
  ...overrides,
});

describe('projectAdaptivePathCorrectionOutcome', () => {
  it('projects a later completed execution as improved', () => {
    expect(projectAdaptivePathCorrectionOutcome({
      decision: decision(),
      executions: [{ nodeId: 'node-1', resourceType: 'checkpoint', status: 'completed', completedAt: '2026-08-05T11:00:00.000Z' }],
    })).toMatchObject({ state: 'improved', evidenceCount: 1 });
  });

  it('projects a later failed execution as needs-review', () => {
    expect(projectAdaptivePathCorrectionOutcome({
      decision: decision(),
      executions: [{ nodeId: 'node-2', resourceType: 'checkpoint', status: 'failed', failedAt: '2026-08-05T11:00:00.000Z' }],
    })).toMatchObject({ state: 'needs-review', evidenceCount: 1 });
  });

  it('keeps missing follow-up evidence pending and excludes earlier executions', () => {
    expect(projectAdaptivePathCorrectionOutcome({
      decision: decision(),
      executions: [
        { nodeId: 'node-1', resourceType: 'checkpoint', status: 'completed', completedAt: '2026-08-05T10:00:00.000Z' },
        { nodeId: 'other-node', resourceType: 'checkpoint', status: 'failed', failedAt: '2026-08-05T11:00:00.000Z' },
      ],
    })).toMatchObject({ state: 'pending-verification', limitation: 'no-follow-up-evidence', evidenceCount: 0 });
  });

  it('projects conflicting later evidence as indeterminate', () => {
    expect(projectAdaptivePathCorrectionOutcome({
      decision: decision(),
      executions: [
        { nodeId: 'node-1', resourceType: 'checkpoint', status: 'completed', completedAt: '2026-08-05T11:00:00.000Z' },
        { nodeId: 'node-1', resourceType: 'checkpoint', status: 'failed', failedAt: '2026-08-05T12:00:00.000Z' },
      ],
    })).toMatchObject({ state: 'indeterminate', limitation: 'conflicting-follow-up-evidence', evidenceCount: 2 });
  });

  it('does not classify a low-confidence terminal completion as improved', () => {
    expect(projectAdaptivePathCorrectionOutcome({
      decision: decision({ applicationResult: { applied: true, nodeIds: ['terminal-node'] } }),
      terminalNodeId: 'terminal-node',
      terminalState: 'low-confidence',
      executions: [{ nodeId: 'terminal-node', resourceType: 'arena_task', status: 'completed', completedAt: '2026-08-05T11:00:00.000Z' }],
    })).toMatchObject({ state: 'indeterminate', limitation: 'insufficient-confidence' });
  });

  it('excludes decisions that were not applied', () => {
    expect(projectAdaptivePathCorrectionOutcome({
      decision: decision({ decision: 'deferred', applicationResult: { applied: false, nodeIds: ['node-1'] } }),
      executions: [{ nodeId: 'node-1', resourceType: 'checkpoint', status: 'completed', completedAt: '2026-08-05T11:00:00.000Z' }],
    })).toBeNull();
  });

  it('marks malformed applied decisions indeterminate instead of guessing', () => {
    expect(projectAdaptivePathCorrectionOutcome({
      decision: decision({ createdAt: 'not-a-date' }),
      executions: [],
    })).toMatchObject({ state: 'indeterminate', limitation: 'invalid-decision-timestamp' });
  });
});
