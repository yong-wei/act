/**
 * Node-detail source provenance in Authority shard materialization (#2043).
 *
 * Sources fill from the governed mapping ledger passed as an explicit input;
 * absence stays empty by explicit default and is visible on the coverage
 * receipt; snapshot-carried sourceMappings survive rather than being blanked.
 */

import { describe, expect, it } from 'vitest';

import {
  AUTHORITY_SHARD_ENVELOPE_CONTRACT,
  buildAuthorityDomainShards,
  type AuthorityShardEnvelope,
} from '@/lib/authority-domain-shards';
import {
  buildAuthorityDomainCatalog,
  type AuthorityDomainCatalogAuthoring,
} from '@/lib/authority-domain-catalog';
import type { AuthorityEngineeringBody } from '@/lib/authoritative-knowledge/authority-snapshot';

const SNAPSHOT_HASH = 'a'.repeat(64);
const SNAPSHOT_ID = `snap-${SNAPSHOT_HASH}`;
const RELEASE_ID = 'ctr:release:test-sources';

const NODE_A = 'ctc:node-a';
const NODE_B = 'ctc:node-b';

function envelope(): AuthorityShardEnvelope {
  return {
    contract: AUTHORITY_SHARD_ENVELOPE_CONTRACT,
    authority: {
      snapshotId: SNAPSHOT_ID,
      snapshotHash: SNAPSHOT_HASH,
      releaseId: RELEASE_ID,
      releaseSetId: 'release-set-test-sources',
      activationId: 'activation-test-sources',
      activationHash: 'b'.repeat(64),
      projectionId: null,
      projectionHash: null,
    },
    catalog: {
      catalogId: 'adc-test-sources',
      catalogHash: 'c'.repeat(64),
      catalogVersion: '1.0.0-sources-test',
    },
    teaching: {
      status: 'unavailable',
      projectionId: null,
      projectionHash: null,
      teachingCacheFamily: null,
    },
    match: { authority: true, catalog: true, teaching: null },
  };
}

function catalog() {
  const authoring: AuthorityDomainCatalogAuthoring = {
    contract: 'act-authority-domain-display-catalog-authoring/v1',
    catalogVersion: '1.0.0-sources-test',
    reviewStatus: 'reviewed',
    authorityBinding: {
      snapshotId: SNAPSHOT_ID,
      snapshotHash: SNAPSHOT_HASH,
      releaseId: RELEASE_ID,
      releaseSetId: 'release-set-test-sources',
    },
    domains: [{
      domainId: 'system-modeling',
      order: 1,
      displayName: '系统建模',
      summary: '建模',
      presentationRole: 'domain',
      visualRole: 'modeling',
    }],
    aggregate: {
      entryId: 'control-theory-integration',
      order: 0,
      displayName: '综合',
      summary: '汇总',
      presentationRole: 'aggregate',
      visualRole: 'aggregate',
    },
    memberships: [
      { canonicalId: NODE_A, domainIds: ['system-modeling'], preferredDomainId: 'system-modeling' },
      { canonicalId: NODE_B, domainIds: ['system-modeling'], preferredDomainId: 'system-modeling' },
    ],
  };
  return buildAuthorityDomainCatalog(authoring, [{ canonicalId: NODE_A }, { canonicalId: NODE_B }]);
}

function engineering(sourceMappings: AuthorityEngineeringBody['sourceMappings'] = []): AuthorityEngineeringBody {
  return {
    objects: [NODE_A, NODE_B].map((canonicalId, ordinal) => ({
      canonicalId,
      ordinal,
      canonicalType: 'DomainConcept',
      semanticName: canonicalId,
      reviewStatus: 'approved',
      publicationStatus: 'published',
      lifecycleStatus: 'active',
      payload: { displayName: canonicalId, description: '描述' },
    })),
    relations: [],
    sourceMappings,
    sourceObjects: sourceMappings.map((mapping) => ({
      sourceObjectId: mapping.sourceObjectId,
      ordinal: 0,
      sourceKind: 'textbook-section',
      payload: {
        source_id: 'dorf-modern-control-systems-14th-root-locus',
        section_id: 'cts:section-snap',
        preferred_label: 'Dorf §4 根轨迹',
      },
    })),
    evidence: [],
    releaseEntries: [],
    upstreamRagReferences: [],
    projectionIdentities: [],
    linkMetadata: [],
    v2Evidence: undefined,
  };
}

describe('materialize node-detail sources', () => {
  it('fills sources from the governed ledger input', () => {
    const materialized = buildAuthorityDomainShards({
      envelope: envelope(),
      catalog: catalog(),
      engineering: engineering(),
      sourceCitations: new Map([
        ['ctc:node-a', [
          { sourceEditionId: 'dorf-modern-control-systems-14th', sectionId: 'textbook-unit:dorf-modern-control-systems@14th-global-edition/chapter-chapter-04', label: 'Modern Control Systems (Dorf/Bishop, 14th) · chapter-chapter-04' },
        ]],
      ]),
      sourceCitationsContract: 'engineering-textbook-mapping-sources-input/v1',
    });
    expect(materialized.details[NODE_A]!.node.sources).toEqual([
      {
        sourceEditionId: 'dorf-modern-control-systems-14th',
        sectionId: 'textbook-unit:dorf-modern-control-systems@14th-global-edition/chapter-chapter-04',
        label: 'Modern Control Systems (Dorf/Bishop, 14th) · chapter-chapter-04',
      },
    ]);
    expect(materialized.details[NODE_B]!.node.sources).toEqual([]);
    expect(materialized.coverage.sourceCitations).toMatchObject({
      ledgerProvided: true,
      ledgerContract: 'engineering-textbook-mapping-sources-input/v1',
      nodesWithSources: 1,
      nodesCappedToLimit: 0,
      snapshotSourceMappingsPreserved: 0,
    });
  });

  it('keeps sources empty by explicit default and records the absence', () => {
    const materialized = buildAuthorityDomainShards({
      envelope: envelope(),
      catalog: catalog(),
      engineering: engineering(),
    });
    expect(materialized.details[NODE_A]!.node.sources).toEqual([]);
    expect(materialized.coverage.sourceCitations).toMatchObject({
      ledgerProvided: false,
      ledgerContract: null,
      nodesWithSources: 0,
    });
  });

  it('preserves snapshot-carried sourceMappings into node sources', () => {
    const materialized = buildAuthorityDomainShards({
      envelope: envelope(),
      catalog: catalog(),
      engineering: engineering([{
        mappingId: 'map-1',
        ordinal: 0,
        canonicalId: NODE_B,
        sourceObjectId: 'cts:source-object-1',
        payload: {},
      }]),
    });
    expect(materialized.details[NODE_B]!.node.sources).toEqual([{
      sourceEditionId: 'dorf-modern-control-systems-14th-root-locus',
      sectionId: 'cts:section-snap',
      label: 'Dorf §4 根轨迹',
    }]);
    expect(materialized.coverage.sourceCitations.snapshotSourceMappingsPreserved).toBe(1);
  });

  it('caps sources at the explicit limit and counts the capped node', () => {
    const many = Array.from({ length: 9 }, (_, index) => ({
      sourceEditionId: 'dorf-modern-control-systems-14th',
      sectionId: `textbook-unit:unit-${index}`,
      label: `出处 ${index}`,
    }));
    const materialized = buildAuthorityDomainShards({
      envelope: envelope(),
      catalog: catalog(),
      engineering: engineering(),
      sourceCitations: new Map([['ctc:node-a', many]]),
      sourceCitationsLimit: 4,
    });
    expect(materialized.details[NODE_A]!.node.sources).toHaveLength(4);
    expect(materialized.coverage.sourceCitations.nodesCappedToLimit).toBe(1);
  });
});
