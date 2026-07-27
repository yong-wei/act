import { describe, expect, it } from 'vitest';

import { normalizeOdysseyOfficialTelemetry } from '../odyssey/telemetry';

describe('Odyssey Arena telemetry', () => {
  it('labels a missing settlingTime metric as 调节时间', () => {
    expect(normalizeOdysseyOfficialTelemetry({
      maxOvershoot: 7,
      steadyError: 3,
    })).toEqual({
      ok: false,
      reason: '缺少通关遥测：调节时间、操作强度。',
    });
  });
});
