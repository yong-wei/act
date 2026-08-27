import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { worktreeIsClean } from '../../../tools/boundary/git-source';
import { checkTeachingProjectionPublishing } from '../../../tools/teaching-projection-publishing/check';

describe('teaching projection publishing CLI', () => {
  it('owns publish qualify and rebase outside the product barrel', () => {
    const result = checkTeachingProjectionPublishing(process.cwd());
    expect(result.files.filter((path) => path.startsWith('tools/teaching-projection-publishing/publish/'))).toHaveLength(10);
    expect(result.files.filter((path) => path.startsWith('tools/teaching-projection-publishing/qualify/'))).toHaveLength(14);
    expect(result.files.filter((path) => path.startsWith('tools/teaching-projection-publishing/rebase/'))).toHaveLength(16);
    expect(existsSync(join(process.cwd(), 'src/lib/teaching-projection/publish'))).toBe(false);
    expect(existsSync(join(process.cwd(), 'src/lib/teaching-projection/qualify'))).toBe(false);
    expect(existsSync(join(process.cwd(), 'src/lib/teaching-projection/rebase'))).toBe(false);
    expect(result.callers.some((path) => path.endsWith('remote-activate-actkg-v018-production-cutover.sh'))).toBe(true);
    expect(result.callers.some((path) => path.endsWith('remote-activate-actkg-v022-production-cutover.sh'))).toBe(true);
    expect(result.receipt.executed).toBe(false);
    expect(result.receipt.productionActivation).toBe(false);
    const remaining = result.failures.filter((item) => item !== 'dirty-worktree');
    if (result.failures.includes('dirty-worktree')) {
      expect(worktreeIsClean(process.cwd())).toBe(false);
    }
    expect(remaining).toEqual([]);
    if (!result.failures.includes('dirty-worktree')) {
      expect(result.ok).toBe(true);
      expect(result.callers.length).toBeGreaterThanOrEqual(19);
    }
  });
});
