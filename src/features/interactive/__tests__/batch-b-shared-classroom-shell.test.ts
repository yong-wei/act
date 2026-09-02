import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { BATCH_B_CANONICAL_IDS, resolveBatchBLesson } from '../shared/batch-b-classroom-shell';
import { resolveBatchALesson } from '../shared/batch-a-classroom-shell';

const repoRoot = process.cwd();

describe('batch-B shared classroom shell', () => {
  it('covers the closed canonical denominator and does not take Batch A', () => {
    expect(BATCH_B_CANONICAL_IDS).toEqual([
      '4-1', '4-2', '4-3', '4-4', '4-5', '4-6', '4-7',
      '5-1', '5-2', '5-3', '5-4', '5-5', '5-6',
      'cruise-comfort-boppps',
    ]);
    expect(resolveBatchBLesson('unit-4-1-design-task-expression')?.canonicalId).toBe('4-1');
    expect(resolveBatchBLesson('cruise-comfort-boppps')?.canonicalId).toBe('cruise-comfort-boppps');
    expect(resolveBatchBLesson('unit-1-2-modeling-from-object-to-system')).toBeNull();
    expect(resolveBatchALesson('unit-4-1-design-task-expression')).toBeNull();
  });

  it('deletes private batch-B course-app-route authorities', () => {
    const root = join(repoRoot, 'src/features/interactive/course-app-routes');
    const leftovers = existsSync(root)
      ? readdirSync(root).filter((name) => name !== '.gitkeep' && /^(unit-4-|unit-5-|cruise-)/.test(name))
      : [];
    expect(leftovers).toEqual([]);
    expect(existsSync(join(repoRoot, 'src/features/interactive/shared/batch-a-classroom-pages.tsx'))).toBe(true);
    for (const segment of [
      'unit-4-1-design-task-expression',
      'unit-4-2-controller-selection-first-start',
      'unit-4-3-initial-scheme-practice-first-validation',
      'unit-4-4-fixed-structure-optimization-modeling',
      'unit-4-5-constraint-aware-parameter-optimization',
      'unit-4-6-fixed-structure-boundary-structural-encoding',
      'unit-4-7-destroyer-hifi-design-closure',
      'unit-5-1-linear-backbone-boundaries',
      'unit-5-2-nonlinear-analysis-entry',
      'unit-5-3-mass-coordination-chain',
      'unit-5-4-data-driven-mpc-transition',
      'unit-5-5-policy-learning-entry-risk',
      'unit-5-6-method-comparison-cold-chain',
      'cruise-comfort-boppps',
    ]) {
      expect(existsSync(join(root, segment, 'entry.tsx')), segment).toBe(false);
      expect(existsSync(join(root, segment, 'student.tsx')), segment).toBe(false);
      expect(existsSync(join(root, segment, 'teacher.tsx')), segment).toBe(false);
    }
  });
});
