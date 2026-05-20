import { describe, expect, it } from 'vitest';

import { parseSessionDataQualityReportOptions } from '../../../../scripts/db/session-data-quality-report-options';

describe('parseSessionDataQualityReportOptions', () => {
  it('parses session, lesson, date, and json flags', () => {
    expect(parseSessionDataQualityReportOptions([
      'node',
      'report-session-data-quality.ts',
      '--session-id=session-a,session-b',
      '--lesson-key=5-2',
      '--lesson-key=unit-5-2-nonlinear-analysis-entry-v1',
      '--from=2026-05-20T00:00:00.000Z',
      '--to=2026-05-21T00:00:00.000Z',
      '--json',
      '--compact',
    ])).toEqual({
      json: true,
      compact: true,
      filters: {
        sessionIds: ['session-a', 'session-b'],
        lessonKeys: ['5-2', 'unit-5-2-nonlinear-analysis-entry-v1'],
        from: new Date('2026-05-20T00:00:00.000Z'),
        to: new Date('2026-05-21T00:00:00.000Z'),
      },
    });
  });

  it('rejects non-ISO and impossible calendar dates', () => {
    expect(() => parseSessionDataQualityReportOptions([
      'node',
      'report-session-data-quality.ts',
      '--from=2026-02-31',
    ])).toThrow('Invalid --from date: 2026-02-31');

    expect(() => parseSessionDataQualityReportOptions([
      'node',
      'report-session-data-quality.ts',
      '--to=05/20/2026',
    ])).toThrow('Invalid --to date: 05/20/2026');
  });
});
