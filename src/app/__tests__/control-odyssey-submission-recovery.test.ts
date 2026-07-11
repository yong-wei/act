import { describe, expect, it, vi } from 'vitest';
import { submitWithPendingRecovery } from '@/resources/interactive-learning/control-odyssey/submission-recovery';

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
});
