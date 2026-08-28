import { describe, expect, it } from 'vitest';

import { runDecisionTransaction } from '../application/decision-transaction';

describe('runDecisionTransaction', () => {
  it('commits both writes only after the callback succeeds', async () => {
    const committed: string[] = [];
    const db = {
      $transaction: async <T>(fn: (tx: { write: (name: string) => void }) => Promise<T>) => {
        const staged: string[] = [];
        const result = await fn({ write: (name) => { staged.push(name); } });
        committed.push(...staged);
        return result;
      },
    };

    await runDecisionTransaction(db, async (tx) => {
      tx.write('event');
      tx.write('outbox');
    });

    expect(committed).toEqual(['event', 'outbox']);
  });

  it('discards the first write when the second write throws', async () => {
    const committed: string[] = [];
    const db = {
      $transaction: async <T>(fn: (tx: { write: (name: string) => void }) => Promise<T>) => {
        const staged: string[] = [];
        try {
          const result = await fn({
            write: (name) => {
              if (name === 'outbox') throw new Error('outbox unavailable');
              staged.push(name);
            },
          });
          committed.push(...staged);
          return result;
        } catch (error) {
          throw error;
        }
      },
    };

    await expect(runDecisionTransaction(db, async (tx) => {
      tx.write('event');
      tx.write('outbox');
    })).rejects.toThrow('outbox unavailable');
    expect(committed).toEqual([]);
  });
});
