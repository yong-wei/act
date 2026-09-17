import { describe, expect, it } from 'vitest';

import { presentPublishedResourceAnchors, type ResourceBindingLaunchRow } from '@/lib/resource-binding-release/query';

function row(
  overrides: Partial<ResourceBindingLaunchRow>,
): ResourceBindingLaunchRow {
  return {
    bindingId: 'b1',
    canonicalId: 'ctc:example',
    appearance: 'reference',
    anchorLabel: 'INTRODUCTION',
    href: '/textbooks/dorf/10.1',
    ...overrides,
  };
}

describe('presentPublishedResourceAnchors', () => {
  it('hides duplicate whole-section self launches from the textbook preview', () => {
    const href = '/textbooks/dorf-modern-control-systems/14th%20Global%20Edition/chapter-chapter-10/section-10.1';
    const rows = Array.from({ length: 8 }, (_, index) => row({
      bindingId: `b${index}`,
      canonicalId: `ctc:${index}`,
      href,
    }));
    expect(presentPublishedResourceAnchors(rows, href)).toEqual([]);
  });

  it('keeps unique intra-resource headings once', () => {
    const href = '/textbooks/dorf/10.1';
    expect(presentPublishedResourceAnchors([
      row({ bindingId: 'a', canonicalId: 'c1', anchorLabel: '滞后网络', href: `${href}#lag`, appearance: 'first' }),
      row({ bindingId: 'b', canonicalId: 'c2', anchorLabel: '滞后网络', href: `${href}#lag`, appearance: 'first' }),
      row({ bindingId: 'c', canonicalId: 'c3', anchorLabel: '相位裕度', href: `${href}#pm`, appearance: 'revisit' }),
    ], href)).toEqual([
      { label: '滞后网络', appearance: 'first', href: `${href}#lag` },
      { label: '相位裕度', appearance: 'revisit', href: `${href}#pm` },
    ]);
  });
});
