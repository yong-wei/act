import { describe, expect, it } from 'vitest';

import {
  resolveAdaptivePathContextRecoveryState,
  resolveAdaptivePathExecutionNodeStatus,
} from '../adaptive-path-execution-state';

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

describe('resolveAdaptivePathContextRecoveryState', () => {
  it('does not recover generic landing or generation workspaces without a path', () => {
    expect(resolveAdaptivePathContextRecoveryState({
      workspaceIntent: 'landing',
      activeGoal: true,
      authStatus: 'authenticated',
      isDemoMode: false,
      requestedPathId: null,
      hasLoadedPathContext: false,
      loadState: 'missing',
    }).shouldRecover).toBe(false);

    expect(resolveAdaptivePathContextRecoveryState({
      workspaceIntent: 'generation',
      activeGoal: true,
      authStatus: 'authenticated',
      isDemoMode: false,
      requestedPathId: null,
      hasLoadedPathContext: false,
      loadState: 'missing',
    }).shouldRecover).toBe(false);
  });

  it('blocks path-selection from showing comparable routes when no path context exists', () => {
    expect(resolveAdaptivePathContextRecoveryState({
      workspaceIntent: 'selection',
      activeGoal: true,
      authStatus: 'authenticated',
      isDemoMode: false,
      requestedPathId: null,
      hasLoadedPathContext: false,
      loadState: 'missing',
    })).toMatchObject({
      shouldRecover: true,
      reason: 'path-context-missing',
    });
  });

  it('keeps explicit bad path ids out of execution and evidence surfaces', () => {
    for (const workspaceIntent of ['execution', 'evidence-review'] as const) {
      expect(resolveAdaptivePathContextRecoveryState({
        workspaceIntent,
        activeGoal: true,
        authStatus: 'authenticated',
        isDemoMode: false,
        requestedPathId: 'missing-path',
        hasLoadedPathContext: false,
        loadState: 'missing',
      })).toMatchObject({
        shouldRecover: true,
        reason: 'path-not-found',
      });
    }
  });

  it('lets a loaded path context render the requested workspace', () => {
    expect(resolveAdaptivePathContextRecoveryState({
      workspaceIntent: 'evidence-review',
      activeGoal: true,
      authStatus: 'authenticated',
      isDemoMode: false,
      requestedPathId: 'path-1',
      hasLoadedPathContext: true,
      loadState: 'ready',
    }).shouldRecover).toBe(false);
  });
});
