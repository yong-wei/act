type PendingSubmission = {
  status: 'pending';
  retryAfterMs: number;
};

export type OdysseySyncState =
  | { status: 'idle'; message: string }
  | { status: 'pending'; message: string }
  | { status: 'succeeded'; message: string }
  | { status: 'failed'; message: string };

export const ODYSSEY_SYNC_STATE: Record<OdysseySyncState['status'], OdysseySyncState> = {
  idle: { status: 'idle', message: '等待航行结果。' },
  pending: { status: 'pending', message: '正在同步成绩与学习路径…' },
  succeeded: { status: 'succeeded', message: '成绩与学习路径已同步。' },
  failed: { status: 'failed', message: '同步未完成，请重试。' },
};

export const shouldOfferOdysseySyncRetry = (state: OdysseySyncState) => state.status === 'failed';

const isPendingSubmission = (value: unknown): value is PendingSubmission =>
  Boolean(
    value
    && typeof value === 'object'
    && 'status' in value
    && value.status === 'pending'
    && 'retryAfterMs' in value
    && typeof value.retryAfterMs === 'number',
  );

export async function submitWithPendingRecovery<T>(
  submit: () => Promise<T>,
  options: {
    maxAttempts?: number;
    wait?: (milliseconds: number) => Promise<void>;
  } = {},
): Promise<T> {
  const maxAttempts = options.maxAttempts ?? 40;
  const wait = options.wait ?? ((milliseconds: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, milliseconds)));
  let result: T | undefined;
  let lastNetworkError: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    try {
      result = await submit();
      lastNetworkError = undefined;
    } catch (error) {
      lastNetworkError = error;
      if (attempt < maxAttempts - 1) {
        await wait(Math.min(2_000, 250 * (attempt + 1)));
        continue;
      }
    }
    if (!isPendingSubmission(result)) break;
    if (attempt < maxAttempts - 1) {
      await wait(Math.min(2_000, Math.max(250, result.retryAfterMs)));
    }
  }

  if (lastNetworkError) throw lastNetworkError;
  return result as T;
}

type SubmissionResult = {
  status?: string;
  message?: string;
  arenaSubmissionId?: string;
};

export async function synchronizeOdysseySubmission<T>(input: {
  submit: () => Promise<T>;
  arenaTaskId?: string;
  hasArenaPathContext: boolean;
  completeArenaPath: (submissionId: string) => Promise<boolean>;
  recoveryOptions?: Parameters<typeof submitWithPendingRecovery>[1];
}): Promise<{ state: OdysseySyncState; result: T | null }> {
  try {
    const result = await submitWithPendingRecovery(input.submit, input.recoveryOptions);
    const submissionResult = result as SubmissionResult | null;
    if (isPendingSubmission(submissionResult)) {
      return {
        state: { status: 'failed', message: '成绩仍在服务器处理中，请重试。' },
        result,
      };
    }
    if (!submissionResult || submissionResult.status === 'failed') {
      return {
        state: { status: 'failed', message: submissionResult?.message ?? '成绩同步失败，请重试。' },
        result,
      };
    }
    if (submissionResult.arenaSubmissionId) {
      if (input.hasArenaPathContext && !await input.completeArenaPath(submissionResult.arenaSubmissionId)) {
        return {
          state: { status: 'failed', message: '成绩已保存，但学习路径尚未确认完成。' },
          result,
        };
      }
    } else if (input.arenaTaskId) {
      return {
        state: { status: 'failed', message: 'Arena 提交尚未生成，请重试。' },
        result,
      };
    }
    return { state: ODYSSEY_SYNC_STATE.succeeded, result };
  } catch {
    return { state: ODYSSEY_SYNC_STATE.failed, result: null };
  }
}
