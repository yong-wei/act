/**
 * Locale refresh must replace the whole governed display projection
 * (#1740): dropping formula/rich-text fields on the replaceDisplay path
 * would strip canvas labels after a language switch.
 */

import { describe, expect, it } from 'vitest';

import {
  AUTHORITY_SHARD_ENVELOPE_CONTRACT,
  type AuthorityShardObject,
  type AuthorityShardPublicEnvelope,
  type PublicAuthorityNodeNeighborhoodShard,
  type PublicAuthorityRootShard,
} from '@/lib/authority-domain-shards/contracts';
import {
  createEmptyAuthorityShardWorkspace,
  mergeAuthorityShard,
} from '../active-authority-shard-store';

function envelope(localeProfileVersion: string): AuthorityShardPublicEnvelope {
  return {
    contract: AUTHORITY_SHARD_ENVELOPE_CONTRACT,
    authorityCatalogVersion: 'acv-formula-merge-test',
    teachingVersion: null,
    localeProfileVersion,
    match: { authority: true, catalog: true, teaching: null },
  };
}

function rootShard(localeProfileVersion: string): PublicAuthorityRootShard {
  return {
    shardClass: 'root',
    envelope: envelope(localeProfileVersion),
    root: {
      kind: 'presentation-root-catalog',
      domains: [],
      aggregate: {
        kind: 'presentation-aggregate',
        order: 0,
        displayName: '控制理论工程',
        summary: '',
        presentationRole: 'aggregate',
        visualRole: 'aggregate',
        domainCount: 0,
      },
    },
  };
}

function formulaObject(label: string, renderKey: string): AuthorityShardObject {
  return {
    id: 'ctf:merge-1',
    canonicalType: 'Formula',
    label,
    aliases: [],
    description: null,
    governance: { reviewStatus: 'approved', publicationStatus: 'published', lifecycleStatus: null },
    semanticSupport: { supported: true, readOnly: true },
    memberships: [{ domainId: 'system-modeling', visualRole: 'time', preferred: true }],
    mathematics: {
      state: 'available',
      display: 'inline',
      latex: '\\tau',
      macroProfileId: 'ctmacro:katex-default-v1',
      macroProfileHash: '9da48a920152b4ea1ca7eacd8b5d8f94aeb54ca3218b47ec08923611a3942b74',
      accessibleLabel: `tau ${label}`,
      copyLatex: '\\tau',
      renderKey,
    },
  };
}

function neighborhood(
  localeProfileVersion: string,
  object: AuthorityShardObject,
): PublicAuthorityNodeNeighborhoodShard {
  return {
    shardClass: 'node-neighborhood',
    envelope: envelope(localeProfileVersion),
    nodeId: object.id,
    limit: 32,
    truncated: false,
    objects: [object],
    relations: [],
    boundaries: [],
  };
}

describe('authority shard store governed display merge (#1740)', () => {
  it('keeps governed mathematics through a locale refresh merge', () => {
    let state = createEmptyAuthorityShardWorkspace();
    state = mergeAuthorityShard(state, rootShard('alp-zh'));
    state = mergeAuthorityShard(state, neighborhood('alp-zh', formulaObject('时间常数', 'z'.repeat(32))));
    expect(state.objectsByCanonicalId['ctf:merge-1']?.mathematics?.state).toBe('available');
    expect(state.objectsByCanonicalId['ctf:merge-1']?.label).toBe('时间常数');

    // Locale switch: the same shard returns under a new locale profile and
    // replaces the display projection wholesale.
    state = mergeAuthorityShard(state, neighborhood('alp-en', formulaObject('time constant', 'e'.repeat(32))));
    expect(state.objectsByCanonicalId['ctf:merge-1']?.label).toBe('time constant');
    const mathematics = state.objectsByCanonicalId['ctf:merge-1']?.mathematics;
    expect(mathematics?.state).toBe('available');
    if (mathematics?.state !== 'available') return;
    expect(mathematics.renderKey).toBe('e'.repeat(32));
    expect(mathematics.accessibleLabel).toBe('tau time constant');
  });

  it('keeps the existing governed projection when the locale is unchanged', () => {
    let state = createEmptyAuthorityShardWorkspace();
    state = mergeAuthorityShard(state, rootShard('alp-zh'));
    state = mergeAuthorityShard(state, neighborhood('alp-zh', formulaObject('时间常数', 'z'.repeat(32))));
    // Same locale profile: memberships merge; display fields stay put.
    state = mergeAuthorityShard(state, neighborhood('alp-zh', {
      ...formulaObject('时间常数', 'z'.repeat(32)),
      mathematics: undefined,
    }));
    expect(state.objectsByCanonicalId['ctf:merge-1']?.mathematics?.state).toBe('available');
  });
});
