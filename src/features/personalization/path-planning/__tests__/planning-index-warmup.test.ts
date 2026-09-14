import { describe, expect, it } from 'vitest';

import { warmupPlanningIndexes } from '../planning-index-warmup';

describe('warmupPlanningIndexes', () => {
  it('does not throw when live indexes are present', () => {
    expect(() => warmupPlanningIndexes(process.cwd())).not.toThrow();
  });
});
