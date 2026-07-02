export type AdaptivePathExecutionNodeStatus =
  | 'current'
  | 'completed'
  | 'skipped'
  | 'blocked'
  | 'locked'
  | 'next'
  | 'optional';

export type AdaptivePathContextWorkspaceIntent =
  | 'landing'
  | 'practice'
  | 'generation'
  | 'selection'
  | 'execution'
  | 'evidence-review';

export type AdaptivePathContextLoadState =
  | 'idle'
  | 'loading'
  | 'ready'
  | 'missing'
  | 'failed';

export type AdaptivePathContextRecoveryReason =
  | 'none'
  | 'loading'
  | 'auth-required'
  | 'path-not-found'
  | 'path-context-missing'
  | 'path-load-failed';

export interface AdaptivePathContextRecoveryState {
  shouldRecover: boolean;
  reason: AdaptivePathContextRecoveryReason;
  title: string;
  detail: string;
}

export function resolveAdaptivePathExecutionNodeStatus(input: {
  completed: boolean;
  failed: boolean;
  skipped: boolean;
  current: boolean;
  rawStatus: string;
  readinessState: string;
  pendingResult: boolean;
}): AdaptivePathExecutionNodeStatus {
  if (input.current && input.completed && input.pendingResult) return 'current';
  if (input.completed) return 'completed';
  if (input.failed || input.rawStatus === 'blocked') return 'blocked';
  if (
    input.rawStatus === 'locked' ||
    input.readinessState === 'locked' ||
    input.readinessState === 'evidence-needed' ||
    input.readinessState === 'needs-preparation'
  ) return 'locked';
  if (input.current || input.rawStatus === 'current') return 'current';
  if (input.skipped) return 'skipped';
  if (input.rawStatus === 'next') return 'next';
  return 'optional';
}

export function resolveAdaptivePathContextRecoveryState(input: {
  workspaceIntent: AdaptivePathContextWorkspaceIntent;
  activeGoal: boolean;
  authStatus: 'authenticated' | 'loading' | 'unauthenticated';
  isDemoMode: boolean;
  requestedPathId: string | null;
  hasLoadedPathContext: boolean;
  loadState: AdaptivePathContextLoadState;
}): AdaptivePathContextRecoveryState {
  const requiresPathContext =
    input.workspaceIntent === 'selection' ||
    input.workspaceIntent === 'execution' ||
    input.workspaceIntent === 'evidence-review';

  if (!requiresPathContext || !input.activeGoal || input.isDemoMode || input.hasLoadedPathContext) {
    return {
      shouldRecover: false,
      reason: 'none',
      title: '',
      detail: '',
    };
  }

  if (input.authStatus === 'loading' || input.loadState === 'loading') {
    return {
      shouldRecover: true,
      reason: 'loading',
      title: '正在查找学习路径',
      detail: '系统正在确认路径、节点和证据来源，暂不展示进度或执行入口。',
    };
  }

  if (input.authStatus === 'unauthenticated') {
    return {
      shouldRecover: true,
      reason: 'auth-required',
      title: '登录后继续当前路径',
      detail: '需要登录后才能恢复学习路径、选择记录和证据状态。',
    };
  }

  if (input.loadState === 'failed') {
    return {
      shouldRecover: true,
      reason: 'path-load-failed',
      title: '学习路径暂时无法读取',
      detail: '当前页面无法确认路径状态，先不要把进度或节点标记为可执行。',
    };
  }

  if (input.requestedPathId) {
    return {
      shouldRecover: true,
      reason: 'path-not-found',
      title: '没有找到这条学习路径',
      detail: '链接中的路径不属于当前目标或已经不可用。请重新生成路径，或回到证据页核对来源。',
    };
  }

  return {
    shouldRecover: true,
    reason: 'path-context-missing',
    title: '还没有可执行的学习路径',
    detail: '当前目标没有可恢复的路径上下文。请先生成路径，或从已有证据中选择可复核记录。',
  };
}
