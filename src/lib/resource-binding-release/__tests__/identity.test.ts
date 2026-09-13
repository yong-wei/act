import { describe, expect, it } from 'vitest';

import {
  authorityRevisionLabel,
  bindingIdFor,
  bindingReleaseIdFor,
  nextBindingRevision,
  parseBindingRevision,
} from '@/lib/resource-binding-release/identity';

describe('resource binding release identity', () => {
  it('derives the Authority revision label and binding release id', () => {
    const label = authorityRevisionLabel(
      'ctr:release:control-theory-engineering-v0.37',
      'actkg-authoritative-candidate-control-theory-engineering-v0.37-r6',
    );
    expect(label).toBe('control-theory-engineering-v0.37-r6');
    expect(bindingReleaseIdFor(label, 2)).toBe('control-theory-engineering-v0.37-r6-b2');
    expect(parseBindingRevision('control-theory-engineering-v0.37-r6-b2', label)).toBe(2);
  });

  it('advances the next binding revision from existing release directories', () => {
    expect(nextBindingRevision(
      'course-content/runtime/knowledge/resource-bindings',
      'control-theory-engineering-v0.37-r6',
    )).toBeGreaterThanOrEqual(3);
  });

  it('keeps binding ids stable for the same resource, anchor and canonical', () => {
    const left = bindingIdFor({
      resourceId: 'act:step:1-3:step-04',
      anchorKey: 'step:step-04',
      canonicalId: 'ctc:time-constant',
      role: 'EXPLAINS',
      scopeId: '1-3',
    });
    const right = bindingIdFor({
      resourceId: 'act:step:1-3:step-04',
      anchorKey: 'step:step-04',
      canonicalId: 'ctc:time-constant',
      role: 'EXPLAINS',
      scopeId: '1-3',
    });
    expect(left).toBe(right);
    expect(left.startsWith('bind-')).toBe(true);
  });
});
