import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BATCH_A_CANONICAL_IDS, resolveBatchALesson } from '../shared/batch-a-classroom-shell';

const repoRoot = process.cwd();

describe('batch-A shared classroom shell', () => {
  it('covers the closed canonical denominator and no extra lessons', () => {
    expect(BATCH_A_CANONICAL_IDS).toEqual([
      '1-1', '1-2', '1-3', '1-4', '1-5',
      '2-1', '2-2', '2-3', '2-4',
      '3-1', '3-2', '3-3', '3-4', '3-5', '3-6', '3-7', '3-8', '3-9',
    ]);
    expect(resolveBatchALesson('unit-1-2-modeling-from-object-to-system')?.canonicalId).toBe('1-2');
    expect(resolveBatchALesson('unit-4-1-design-task-expression')).toBeNull();
    expect(resolveBatchALesson('cruise-comfort-boppps')).toBeNull();
  });

  it('deletes private batch-A course-app-route authorities', () => {
    const root = join(repoRoot, 'src/features/interactive/course-app-routes');
    const leftovers = readdirSync(root).filter((name) =>
      /^(unit-1-|unit-2-|unit-3-)/.test(name),
    );
    expect(leftovers).toEqual([]);
    expect(existsSync(join(repoRoot, 'src/features/interactive/shared/batch-a-classroom-pages.tsx'))).toBe(true);
  });
});
