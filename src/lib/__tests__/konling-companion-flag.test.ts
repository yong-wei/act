import { afterEach, describe, expect, it } from 'vitest';

import { isKonlingCompanionEnabled } from '@/lib/konling-companion-flag';

describe('isKonlingCompanionEnabled', () => {
  afterEach(() => {
    delete process.env.KONLING_COMPANION_ENABLED;
  });

  it('defaults to enabled', () => {
    delete process.env.KONLING_COMPANION_ENABLED;
    expect(isKonlingCompanionEnabled()).toBe(true);
  });

  it('disables only on explicit falsey values', () => {
    process.env.KONLING_COMPANION_ENABLED = 'false';
    expect(isKonlingCompanionEnabled()).toBe(false);
    process.env.KONLING_COMPANION_ENABLED = '0';
    expect(isKonlingCompanionEnabled()).toBe(false);
    process.env.KONLING_COMPANION_ENABLED = 'off';
    expect(isKonlingCompanionEnabled()).toBe(false);
  });

  it('treats true as enabled', () => {
    process.env.KONLING_COMPANION_ENABLED = 'true';
    expect(isKonlingCompanionEnabled()).toBe(true);
  });
});
