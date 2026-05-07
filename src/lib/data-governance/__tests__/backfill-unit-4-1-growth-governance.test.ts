import { describe, expect, it } from 'vitest';

import { parseUnit41BackfillOptions } from '../../../../scripts/db/backfill-unit-4-1-growth-options';

describe('parseUnit41BackfillOptions', () => {
  it('parses skip-growth-evaluations without changing dry-run and snapshot flags', () => {
    const options = parseUnit41BackfillOptions([
      'node',
      'backfill-unit-4-1-growth-governance.ts',
      '--session-id=custom-session',
      '--skip-growth-evaluations',
      '--dry-run',
      '--force-snapshots',
    ]);

    expect(options).toEqual({
      sessionId: 'custom-session',
      dryRun: true,
      forceSnapshots: true,
      skipGrowthEvaluations: true,
    });
  });
});
