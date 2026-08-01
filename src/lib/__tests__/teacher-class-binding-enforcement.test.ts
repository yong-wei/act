import { describe, expect, it, vi } from 'vitest';

import { isTeacherClassBindingEnforced } from '../teacher-class-binding-enforcement';

describe('teacher class binding enforcement receipt', () => {
  it('only enables the requirement after both release gate receipts are recorded', async () => {
    const findUnique = vi.fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ value: { version: 1, enabled: true, invariantVerifiedAt: '2026-07-24T00:00:00.000Z' } })
      .mockResolvedValueOnce({
        value: {
          version: 1,
          enabled: true,
          invariantVerifiedAt: '2026-07-24T00:00:00.000Z',
          producerInventoryVerifiedAt: '2026-07-24T00:00:00.000Z',
        },
      });
    const db = { platformSetting: { findUnique } };

    await expect(isTeacherClassBindingEnforced(db as never)).resolves.toBe(false);
    await expect(isTeacherClassBindingEnforced(db as never)).resolves.toBe(false);
    await expect(isTeacherClassBindingEnforced(db as never)).resolves.toBe(true);
  });

  it('fails closed if the receipt cannot be read', async () => {
    const db = { platformSetting: { findUnique: vi.fn().mockRejectedValue(new Error('database unavailable')) } };

    await expect(isTeacherClassBindingEnforced(db as never)).resolves.toBe(true);
  });
});
