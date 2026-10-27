import { beforeEach, describe, expect, it, vi } from 'vitest';

const shardMocks = vi.hoisted(() => ({
  loadNodeDetailShard: vi.fn(),
}));

vi.mock('@/lib/authority-domain-shards/loader', () => ({
  loadNodeDetailShard: shardMocks.loadNodeDetailShard,
}));

vi.mock('@/lib/authority-domain-shards/store', () => {
  class AuthorityShardStoreError extends Error {
    readonly code: string;

    constructor(code: string, message: string) {
      super(message);
      this.name = 'AuthorityShardStoreError';
      this.code = code;
    }
  }

  return { AuthorityShardStoreError };
});

import { AuthorityShardStoreError } from '@/lib/authority-domain-shards/store';
import { readAuthorityKnowledgeNode } from '@/lib/konling-knowledge-authority-node';

describe('readAuthorityKnowledgeNode', () => {
  beforeEach(() => {
    shardMocks.loadNodeDetailShard.mockReset();
  });

  it('maps a server-owned detail shard and ignores any client-supplied title', () => {
    shardMocks.loadNodeDetailShard.mockReturnValue({
      node: {
        id: 'ctkg:bode-margin',
        canonicalType: 'criterion',
        label: '伯德图裕度',
        typeLabel: '稳定判据',
        aliases: ['幅值裕度'],
        description: '由伯德图读取相位裕度与幅值裕度。',
        teachingFields: { concept_kind: 'frequency-domain' },
      },
    });

    expect(readAuthorityKnowledgeNode('ctkg:bode-margin')).toEqual({
      id: 'ctkg:bode-margin',
      name: '伯德图裕度',
      nodeType: '稳定判据',
      description: '由伯德图读取相位裕度与幅值裕度。',
      tags: ['幅值裕度'],
      knowledgeDim: 'frequency-domain',
    });
  });

  it('returns null when the shard store rejects the id', () => {
    shardMocks.loadNodeDetailShard.mockImplementation(() => {
      throw new AuthorityShardStoreError('node-id-invalid', 'invalid detail node id');
    });

    expect(readAuthorityKnowledgeNode('')).toBeNull();
  });
});
