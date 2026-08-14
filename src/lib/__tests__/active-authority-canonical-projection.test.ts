import { describe, expect, it, vi } from 'vitest';

import {
  CTKG_0_2_PROJECTION_DIRECTIONS,
  STANDARD_PUBLIC_BUNDLE_PROTOCOL,
  type AuthoritativeKnowledgeSnapshot,
  type ConsumerSemanticSupport,
} from '@/lib/authoritative-knowledge';
import {
  buildCanvasProjection,
} from '@/lib/authoritative-knowledge/projections';

const mocks = vi.hoisted(() => ({ resolve: vi.fn() }));

vi.mock('@/lib/authoritative-knowledge/engineering-authority-consumers', () => ({
  resolveActiveEngineeringGraphAuthority: mocks.resolve,
  resolveConfiguredAuthorityRoot: () => '/tmp/authority',
}));

import { readActiveCanvas, readActiveNode } from '@/app/api/knowledge/_active-authority';

const support: ConsumerSemanticSupport = {
  consumerId: 'engineering-graph',
  supportedObjectTypes: ['DomainConcept', 'Formula'],
  supportedPredicates: ['association'],
};

function activeSnapshot(): AuthoritativeKnowledgeSnapshot {
  const hash = 'a'.repeat(64);
  const commit = 'b'.repeat(40);
  return {
    authorityState: 'active',
    productionAuthoritative: false,
    historical: false,
    releaseSet: {
      id: 'set-1',
      controlledPath: 'authority/releases/snapshot-1',
      lockVersion: 'actkg-engineering-authority-snapshot/v1',
      candidateState: 'ACTIVE_AUTHORITY',
    },
    release: {
      id: 'release-1',
      releaseSetId: 'set-1',
      releaseVersion: 'v1',
      releaseStatus: 'RELEASED',
      protocol: STANDARD_PUBLIC_BUNDLE_PROTOCOL,
      authority: 'ActKG',
      scope: 'engineering',
      contractHash: hash,
      releaseHash: hash,
      schemaRawHash: hash,
      releaseRawHash: hash,
      notesRawHash: hash,
      captureRevision: commit,
      lockRawHash: hash,
      schemaVersion: '0.2.0',
      projectionId: null,
      projectionDigest: null,
      sourceDatasetHash: null,
    },
    receipt: null,
    objects: [
      {
        releaseId: 'release-1',
        canonicalId: 'node-1',
        ordinal: 0,
        canonicalType: 'DomainConcept',
        semanticName: 'root_locus',
        reviewStatus: 'REVIEWED',
        publicationStatus: 'PUBLISHED',
        lifecycleStatus: 'ACTIVE',
        payload: {
          preferred_labels: [{ language: 'zh-CN', text: '根轨迹' }],
          description: '工程 Authority 节点',
        },
      },
      {
        releaseId: 'release-1',
        canonicalId: 'node-2',
        ordinal: 1,
        canonicalType: 'Formula',
        semanticName: 'characteristic_equation',
        reviewStatus: 'REVIEWED',
        publicationStatus: 'PUBLISHED',
        lifecycleStatus: 'ACTIVE',
        payload: { preferred_labels: [{ language: 'zh-CN', text: '特征方程' }] },
      },
    ],
    relations: [
      {
        releaseId: 'release-1',
        relationId: 'relation-1',
        ordinal: 0,
        qualityTier: 'GOLD',
        sourceId: 'node-1',
        targetId: 'node-2',
        relationType: 'association',
        reviewStatus: 'REVIEWED',
        publicationStatus: 'PUBLISHED',
        direct: true,
        payload: { direction: CTKG_0_2_PROJECTION_DIRECTIONS[3] },
      },
    ],
    sourceMappings: [],
    sourceObjects: [],
    evidence: [],
    projectionNodes: [],
    projectionLinks: [],
  };
}

describe('active Authority canonical projections', () => {
  it('returns a non-empty canvas and node detail without a standard runtime Projection', () => {
    const snapshot = activeSnapshot();
    mocks.resolve.mockReturnValue({
      status: 'ready',
      consumerId: 'engineering-graph',
      snapshotId: 'snapshot-1',
      snapshotHash: 'c'.repeat(64),
      releaseId: 'release-1',
      releaseSetId: 'set-1',
      objectCount: 2,
      relationCount: 1,
      engineering: {},
      manifest: {},
      teachingProjectionRequired: false,
      activationMode: 'use-combination',
      consumerStatus: 'READY',
      activationId: 'activation-1',
      activationHash: 'd'.repeat(64),
      combination: {
        authorityReleaseId: 'release-1',
        authoritySnapshotId: 'snapshot-1',
        authoritySnapshotHash: 'c'.repeat(64),
        projectionId: null,
        projectionHash: null,
        scopeId: null,
        captureRevision: null,
      },
      projectionId: null,
      projectionHash: null,
      snapshot,
    });

    const canvas = readActiveCanvas();
    expect(canvas.status).toBe('available');
    if (canvas.status !== 'available') return;
    expect(canvas.projection.nodes.map((node) => node.id)).toEqual(['node-1', 'node-2']);
    expect(canvas.projection.relations).toHaveLength(1);
    expect(canvas.projection.source.projectionDigest).toBeNull();

    const detail = readActiveNode('STUDENT', 'node-1');
    expect(detail.status).toBe('available');
    if (detail.status !== 'available') return;
    expect(detail.projection.node.id).toBe('node-1');
    expect(detail.projection.node.adjacency).toHaveLength(1);
  });

  it('keeps standard candidate runtime validation fail-closed for the same empty projection rows', () => {
    expect(() => buildCanvasProjection(activeSnapshot(), support)).toThrow(
      'standard runtime Projection is empty or missing',
    );
  });
});
