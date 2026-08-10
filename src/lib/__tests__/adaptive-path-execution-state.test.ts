import { describe, expect, it } from 'vitest';

import {
  resolveAdaptivePathLandingState,
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

  it('keeps a skipped historical node skipped even when its old readiness was locked', () => {
    expect(resolveAdaptivePathExecutionNodeStatus({
      completed: false,
      failed: false,
      skipped: true,
      current: false,
      rawStatus: 'locked',
      readinessState: 'locked',
      pendingResult: false,
    })).toBe('skipped');
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

describe('resolveAdaptivePathLandingState', () => {
  it('keeps cold-start content hidden until learner and path data are both ready', () => {
    expect(resolveAdaptivePathLandingState({
      authStatus: 'authenticated',
      learnerStateLoadState: 'loading',
      pathContextLoadState: 'loading',
      hasLoadedPathContext: false,
    })).toBe('loading');

    expect(resolveAdaptivePathLandingState({
      authStatus: 'authenticated',
      learnerStateLoadState: 'ready',
      pathContextLoadState: 'loading',
      hasLoadedPathContext: false,
    })).toBe('loading');
  });

  it('shows the active path only after its context has loaded', () => {
    expect(resolveAdaptivePathLandingState({
      authStatus: 'authenticated',
      learnerStateLoadState: 'ready',
      pathContextLoadState: 'ready',
      hasLoadedPathContext: true,
    })).toBe('active');
  });

  it('shows cold-start content only after both sources confirm there is no path', () => {
    expect(resolveAdaptivePathLandingState({
      authStatus: 'authenticated',
      learnerStateLoadState: 'ready',
      pathContextLoadState: 'missing',
      hasLoadedPathContext: false,
    })).toBe('cold-start');
  });

  it('keeps load failures distinct from a confirmed missing path', () => {
    expect(resolveAdaptivePathLandingState({
      authStatus: 'authenticated',
      learnerStateLoadState: 'failed',
      pathContextLoadState: 'missing',
      hasLoadedPathContext: false,
    })).toBe('failed');

    expect(resolveAdaptivePathLandingState({
      authStatus: 'authenticated',
      learnerStateLoadState: 'ready',
      pathContextLoadState: 'failed',
      hasLoadedPathContext: false,
    })).toBe('failed');
  });
});
