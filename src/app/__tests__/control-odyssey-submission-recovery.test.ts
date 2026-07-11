import { describe, expect, it, vi } from 'vitest';
import {
  ODYSSEY_SYNC_STATE,
  shouldOfferOdysseySyncRetry,
  submitWithPendingRecovery,
  synchronizeOdysseySubmission,
} from '@/resources/interactive-learning/control-odyssey/submission-recovery';

describe('submitWithPendingRecovery', () => {
  it('polls an authoritative pending run until the Arena submission is bound', async () => {
    const submit = vi.fn()
      .mockResolvedValueOnce({ status: 'pending', runId: 'run-1', retryAfterMs: 500 })
      .mockResolvedValueOnce({ id: 'log-1', arenaSubmissionId: 'submission-1' });
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(submitWithPendingRecovery(submit, { wait })).resolves.toEqual({
      id: 'log-1',
      arenaSubmissionId: 'submission-1',
    });
    expect(wait).toHaveBeenCalledWith(500);
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it('retries transient network failures without converting them into completion', async () => {
    const submit = vi.fn()
      .mockRejectedValueOnce(new Error('network unavailable'))
      .mockResolvedValueOnce({ id: 'log-1', arenaSubmissionId: 'submission-1' });
    const wait = vi.fn().mockResolvedValue(undefined);

    await expect(submitWithPendingRecovery(submit, { wait })).resolves.toMatchObject({
      arenaSubmissionId: 'submission-1',
    });
    expect(wait).toHaveBeenCalledWith(250);
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it('surfaces permanent action failures as retryable failed state', async () => {
    const completeArenaPath = vi.fn();
    const outcome = await synchronizeOdysseySubmission({
      submit: vi.fn().mockResolvedValue({ status: 'failed', message: '服务器拒绝同步。' }),
      arenaTaskId: 'task-1',
      hasArenaPathContext: true,
      completeArenaPath,
    });

    expect(outcome.state).toEqual({ status: 'failed', message: '服务器拒绝同步。' });
    expect(completeArenaPath).not.toHaveBeenCalled();
  });

  it('turns pending exhaustion into a retryable state and succeeds on the same run retry', async () => {
    const submit = vi.fn()
      .mockResolvedValueOnce({ status: 'pending', runId: 'run-1', retryAfterMs: 1 })
      .mockResolvedValueOnce({ id: 'log-1', arenaSubmissionId: 'submission-1' });
    const input = {
      submit,
      arenaTaskId: 'task-1',
      hasArenaPathContext: false,
      completeArenaPath: vi.fn(),
      recoveryOptions: { maxAttempts: 1, wait: vi.fn() },
    };

    const exhausted = await synchronizeOdysseySubmission(input);
    const retried = await synchronizeOdysseySubmission(input);

    expect(exhausted.state.status).toBe('failed');
    expect(shouldOfferOdysseySyncRetry(exhausted.state)).toBe(true);
    expect(retried.state).toEqual(ODYSSEY_SYNC_STATE.succeeded);
    expect(submit).toHaveBeenCalledTimes(2);
  });

  it('reports permanent network exhaustion as failed instead of synchronized', async () => {
    const outcome = await synchronizeOdysseySubmission({
      submit: vi.fn().mockRejectedValue(new Error('offline')),
      hasArenaPathContext: false,
      completeArenaPath: vi.fn(),
      recoveryOptions: { maxAttempts: 2, wait: vi.fn().mockResolvedValue(undefined) },
    });

    expect(outcome.state).toEqual(ODYSSEY_SYNC_STATE.failed);
    expect(shouldOfferOdysseySyncRetry(outcome.state)).toBe(true);
  });

  it('keeps path completion failure retryable and succeeds with the same submission', async () => {
    const submit = vi.fn().mockResolvedValue({ id: 'log-1', arenaSubmissionId: 'submission-1' });
    const completeArenaPath = vi.fn()
      .mockResolvedValueOnce(false)
      .mockResolvedValueOnce(true);
    const input = {
      submit,
      arenaTaskId: 'task-1',
      hasArenaPathContext: true,
      completeArenaPath,
    };

    const first = await synchronizeOdysseySubmission(input);
    const retried = await synchronizeOdysseySubmission(input);

    expect(first.state.status).toBe('failed');
    expect(retried.state).toEqual(ODYSSEY_SYNC_STATE.succeeded);
    expect(submit).toHaveBeenCalledTimes(2);
    expect(completeArenaPath).toHaveBeenCalledTimes(2);
    expect(completeArenaPath).toHaveBeenNthCalledWith(1, 'submission-1');
    expect(completeArenaPath).toHaveBeenNthCalledWith(2, 'submission-1');
  });

  it('exposes accurate idle, pending, succeeded, and failed UI labels', () => {
    expect(ODYSSEY_SYNC_STATE).toEqual({
      idle: { status: 'idle', message: '等待航行结果。' },
      pending: { status: 'pending', message: '正在同步成绩与学习路径…' },
      succeeded: { status: 'succeeded', message: '成绩与学习路径已同步。' },
      failed: { status: 'failed', message: '同步未完成，请重试。' },
    });
    expect(shouldOfferOdysseySyncRetry(ODYSSEY_SYNC_STATE.idle)).toBe(false);
    expect(shouldOfferOdysseySyncRetry(ODYSSEY_SYNC_STATE.pending)).toBe(false);
    expect(shouldOfferOdysseySyncRetry(ODYSSEY_SYNC_STATE.succeeded)).toBe(false);
    expect(shouldOfferOdysseySyncRetry(ODYSSEY_SYNC_STATE.failed)).toBe(true);
  });
});
