import { describe, expect, it } from 'vitest';

import {
  ACTIVE_AUTHORITY_ROOT_UNAVAILABLE_LABEL,
  activeAuthorityRootPackingMetadataKeys,
  packActiveAuthorityRootEntries,
  toActiveAuthorityRootPackingNodes,
} from '../active-authority-root-entries';
import type { PublicAuthorityRootShard } from '@/lib/authority-domain-shards/contracts';

const VISUAL_ROLES = [
  'modeling',
  'design',
  'time',
  'stability',
  'frequency',
  'root-locus',
  'discrete',
  'state-space',
] as const;

function catalog(domainCount: number, extras?: Partial<PublicAuthorityRootShard['root']['domains'][number]>): PublicAuthorityRootShard['root'] {
  return {
    kind: 'presentation-root-catalog',
    domains: Array.from({ length: domainCount }, (_, index) => ({
      kind: 'presentation-domain' as const,
      order: index + 1,
      displayName: extras?.displayName ?? `领域${index + 1}`,
      summary: extras?.summary ?? `摘要${index + 1}`,
      presentationRole: 'domain' as const,
      visualRole: extras?.visualRole ?? VISUAL_ROLES[index % VISUAL_ROLES.length],
      memberCount: 3,
    })),
    aggregate: {
      kind: 'presentation-aggregate',
      order: 0,
      displayName: '控制理论综合',
      summary: '汇总入口',
      presentationRole: 'aggregate',
      visualRole: 'aggregate',
      domainCount,
    },
  };
}

describe('active Authority root packing adapter', () => {
  it('creates one packing node per catalog domain plus the aggregate entry', () => {
    expect(toActiveAuthorityRootPackingNodes(catalog(3))).toHaveLength(4);
    expect(toActiveAuthorityRootPackingNodes(catalog(5))).toHaveLength(6);
    expect(toActiveAuthorityRootPackingNodes(catalog(8))).toHaveLength(9);
  });

  it('keeps packing metadata free of Authority identities', () => {
    const keys = new Set(activeAuthorityRootPackingMetadataKeys(catalog(3)));
    expect([...keys].sort()).toEqual(['isCollapsedRoot', 'nodeCount', 'presentationKind']);
    expect(toActiveAuthorityRootPackingNodes(catalog(3)).map((node) => node.id)).toEqual([
      'root-entry-00',
      'root-entry-01',
      'root-entry-02',
      'root-entry-03',
    ]);
  });

  it('packs the same catalog and viewport deterministically', () => {
    const first = packActiveAuthorityRootEntries(catalog(4), { viewportWidth: 1440, viewportHeight: 900 });
    const second = packActiveAuthorityRootEntries(catalog(4), { viewportWidth: 1440, viewportHeight: 900 });
    expect(first.map((entry) => ({ id: entry.packingId, x: entry.x, y: entry.y }))).toEqual(
      second.map((entry) => ({ id: entry.packingId, x: entry.x, y: entry.y })),
    );
    expect(first.filter((entry) => entry.kind === 'domain')).toHaveLength(4);
    expect(first.filter((entry) => entry.kind === 'aggregate')).toHaveLength(1);
  });

  it('fails closed when a domain label or summary is missing', () => {
    const missingName = catalog(1, { displayName: '  ', summary: '摘要', visualRole: 'state-space' });
    const packed = packActiveAuthorityRootEntries(missingName, { viewportWidth: 800, viewportHeight: 600 });
    expect(packed[0]?.unavailable).toBe(true);
    expect(packed[0]?.name).toBe(ACTIVE_AUTHORITY_ROOT_UNAVAILABLE_LABEL);
    expect(packed[0]?.name).not.toContain('state-space');
  });
});
