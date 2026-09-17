import { describe, expect, it } from 'vitest';

import {
  findPublishedCompanionInfograph,
  type PublishedResourceFeature,
} from '@/lib/published-resource-reference';

const HASH = 'a'.repeat(64);

function feature(input: {
  resourceId: string;
  kind: PublishedResourceFeature['backend']['kind'];
  token?: string;
  canonicalIds?: string[];
  executable?: boolean;
}): PublishedResourceFeature {
  const backend = input.kind === 'infographic'
    ? { kind: 'infographic' as const, token: input.token ?? input.resourceId.slice('act:infographic:'.length) }
    : { kind: input.kind as 'card' };
  return {
    identity: {
      resourceId: input.resourceId,
      projectionId: `proj-${HASH}`,
      projectionHash: HASH,
      snapshotId: `snap-${HASH}`,
      snapshotHash: HASH,
    },
    version: HASH,
    type: input.kind === 'infographic' ? 'infographic' : 'card',
    title: input.resourceId,
    summary: input.resourceId,
    canonicalIds: input.canonicalIds ?? [],
    bindingIds: [],
    bindingRoles: [],
    sourcePath: null,
    baselineDifficulty: null,
    estimatedMinutes: 5,
    estimateSource: 'policy-estimate',
    executable: input.executable ?? true,
    recommendable: true,
    limitation: null,
    backend,
  };
}

describe('findPublishedCompanionInfograph', () => {
  it('prefers the same-token infographic sibling of a published card', () => {
    const card = feature({ resourceId: 'act:card:ctc_target', kind: 'card', canonicalIds: ['ctc:target'] });
    const sibling = feature({
      resourceId: 'act:infographic:ctc_target',
      kind: 'infographic',
      canonicalIds: ['ctc:target'],
    });
    const other = feature({
      resourceId: 'act:infographic:ctc_other',
      kind: 'infographic',
      canonicalIds: ['ctc:target'],
    });
    expect(findPublishedCompanionInfograph({ resources: [other, sibling] }, card)).toEqual(sibling);
  });

  it('falls back to the unique infographic bound to the same canonical node', () => {
    const card = feature({ resourceId: 'act:card:course-card', kind: 'card', canonicalIds: ['ctc:shared'] });
    const companion = feature({
      resourceId: 'act:infographic:shared-figure',
      kind: 'infographic',
      canonicalIds: ['ctc:shared'],
    });
    expect(findPublishedCompanionInfograph({ resources: [companion] }, card)).toEqual(companion);
  });

  it('does not guess when several infographics share the card node', () => {
    const card = feature({ resourceId: 'act:card:course-card', kind: 'card', canonicalIds: ['ctc:shared'] });
    const first = feature({
      resourceId: 'act:infographic:alpha',
      kind: 'infographic',
      canonicalIds: ['ctc:shared'],
    });
    const second = feature({
      resourceId: 'act:infographic:beta',
      kind: 'infographic',
      canonicalIds: ['ctc:shared'],
    });
    expect(findPublishedCompanionInfograph({ resources: [first, second] }, card)).toBeNull();
  });
});
