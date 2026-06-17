import { describe, expect, it } from 'vitest';

import { resolveAdaptivePathExecutionNodeStatus } from '../adaptive-path-execution-state';

describe('resolveAdaptivePathExecutionNodeStatus', () => {
  it('keeps a completed current complex node current while its result is pending sync', () => {
    expect(resolveAdaptivePathExecutionNodeStatus({
      completed: true,
      failed: false,
      skipped: false,
      current: true,
      rawStatus: 'completed',
      readinessState: 'ready',
      pendingResult: true,
    })).toBe('current');
  });

  it('marks completed nodes completed after their result binding is available', () => {
    expect(resolveAdaptivePathExecutionNodeStatus({
      completed: true,
      failed: false,
      skipped: false,
      current: true,
      rawStatus: 'completed',
      readinessState: 'ready',
      pendingResult: false,
    })).toBe('completed');
  });
});
