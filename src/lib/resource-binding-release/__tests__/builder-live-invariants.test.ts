import { existsSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { loadCurrentResourceBindingRelease } from '@/lib/resource-binding-release/store';

const repoRoot = process.cwd();
const current = join(repoRoot, 'course-content/runtime/knowledge/resource-bindings/current.json');

describe.skipIf(!existsSync(current))('live binding release builder invariants', () => {
  it('excludes lesson entries and whole-book textbooks, and does not spray a step across its unit', () => {
    const loaded = loadCurrentResourceBindingRelease(repoRoot);
    expect(loaded).not.toBeNull();
    const resources = loaded!.resources;
    const bindings = loaded!.bindings;
    expect(resources.some((row) => row.resourceType === 'lesson' || row.resourceId.startsWith('act:lesson:'))).toBe(false);
    expect(resources.some((row) => row.resourceType === 'textbook' && !row.resourceId.includes('section'))).toBe(false);

    const unitBindings = bindings.filter((row) =>
      row.teachingOrder?.unitId === '1-3' || row.resourceId.includes(':1-3:'));
    const stepBindings = unitBindings.filter((row) => row.resourceType === 'step');
    expect(stepBindings.length).toBeGreaterThan(0);
    const byStep = new Map<string, Set<string>>();
    for (const binding of stepBindings) {
      const set = byStep.get(binding.resourceId) ?? new Set<string>();
      set.add(binding.canonicalId);
      byStep.set(binding.resourceId, set);
    }
    const unitCanonicals = new Set(unitBindings.map((row) => row.canonicalId));
    expect([...byStep.values()].every((set) => set.size < unitCanonicals.size)).toBe(true);
    expect(bindings.some((row) => row.appearance === 'first')).toBe(true);
    expect(bindings.some((row) => row.appearance === 'revisit')).toBe(true);
  });
});
