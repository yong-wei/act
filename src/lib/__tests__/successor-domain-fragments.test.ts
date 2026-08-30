import { describe, expect, it } from 'vitest';

import type { DomainTeachingFragmentAuthoring } from '@/lib/teaching-projection';
import {
  assertNotProductionSelectorPath,
  composeSuccessorDomainTeachingProjection,
  createSuccessorDomainTeachingEnvelope,
  LIVE_AUTHORING_COMPOSED_MANIFEST_RELATIVE,
  rebindFragmentAuthoringToSuccessorEnvelope,
  successorAuthorityBinding,
} from '@/lib/latest-authority-oss-cutover/successor-domain-fragments';
import { LatestAuthorityCutoverError } from '@/lib/latest-authority-oss-cutover/contracts';
import { createDomainTeachingAuthorityEnvelope } from '@/lib/teaching-projection';

const SNAPSHOT_HASH = 'e'.repeat(64);
const SOURCE_HASH = '2'.repeat(64);
const CAPTURE = 'a'.repeat(40);

function successorManifest() {
  return {
    snapshotId: `snap-${SNAPSHOT_HASH}`,
    snapshotHash: SNAPSHOT_HASH,
    releaseId: 'ctr:release:control-theory-engineering-v0.37',
    releaseSetId: 'actkg-authoritative-candidate-control-theory-engineering-v0.37-r4',
    sourceDatasetHash: SOURCE_HASH,
    captureRevision: CAPTURE,
  };
}

function authoring(): DomainTeachingFragmentAuthoring {
  return {
    fragmentKey: 'foundation-published-v1',
    fragmentVersion: '1',
    domainKeys: ['system-modeling'],
    authorityBinding: {
      releaseId: 'ctr:release:control-theory-engineering-v0.9',
      releaseSetId: 'actkg-authoritative-candidate-old',
      snapshotId: `snap-${'7'.repeat(64)}`,
      snapshotHash: '7'.repeat(64),
    },
    authoringRevision: 'b'.repeat(40),
    captureRevision: 'b'.repeat(40),
    sourceDatasetHash: '0'.repeat(64),
    evidenceRefs: ['course-content/authoring/lessons/1-2/design/1-2-boppps.md'],
    coreNodes: [
      {
        canonicalId: 'ctc:modeling-865eb1c8824e157c2f05a903',
        domainKeys: ['system-modeling'],
        pathEligible: true,
        cardPolicy: 'REQUIRED',
        moduleId: 'module-1-modeling',
        rationale: 'fixture node',
        sourceKind: 'PRIMARY_COVERS',
        sourceEvidence: ['course-content/authoring/lessons/1-2/design/1-2-boppps.md'],
      },
    ],
    relations: [],
  };
}

function liveObject(canonicalId: string): {
  canonicalId: string;
  reviewStatus: string;
  publicationStatus: string;
  lifecycleStatus: null;
} {
  return {
    canonicalId,
    reviewStatus: 'approved',
    publicationStatus: 'published',
    lifecycleStatus: null,
  };
}

describe('successor domain-fragment composition', () => {
  it('rebuilds the published fragment against the successor Authority identity', () => {
    const artifacts = composeSuccessorDomainTeachingProjection({
      manifest: successorManifest(),
      authorings: [authoring()],
      objects: [liveObject('ctc:modeling-865eb1c8824e157c2f05a903')],
    });
    const binding = successorAuthorityBinding(successorManifest());
    expect(artifacts.manifest.authorityBinding).toEqual(binding);
    expect(artifacts.fragments).toHaveLength(1);
    expect(artifacts.fragments[0]?.authorityBinding).toEqual(binding);
    expect(artifacts.manifest.authorityBinding.releaseId).toBe(
      'ctr:release:control-theory-engineering-v0.37',
    );
    expect(artifacts.manifest.projectionHash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('puts the complete snapshot node index into the envelope, not only fragment endpoints', () => {
    const extraId = 'ctc:modeling-00d2998755974a1329049aac';
    const envelope = createSuccessorDomainTeachingEnvelope({
      manifest: successorManifest(),
      authorings: [authoring()],
      objects: [
        liveObject('ctc:modeling-865eb1c8824e157c2f05a903'),
        liveObject(extraId),
      ],
    });
    expect(envelope.nodes.map((node) => node.canonicalId)).toEqual([
      extraId,
      'ctc:modeling-865eb1c8824e157c2f05a903',
    ].sort());
  });

  it('strips the pinned v0.9 claims before rebuild', () => {
    const envelope = createDomainTeachingAuthorityEnvelope({
      binding: successorAuthorityBinding(successorManifest()),
      sourceDatasetHash: SOURCE_HASH,
      captureRevision: CAPTURE,
      authoringRevision: CAPTURE,
      nodes: [{ canonicalId: 'ctc:modeling-865eb1c8824e157c2f05a903', lifecycleStatus: 'active' }],
    });
    const rebound = rebindFragmentAuthoringToSuccessorEnvelope(authoring(), envelope);
    expect(rebound.authorityBinding).toEqual(envelope.binding);
    expect(rebound.authoringRevision).toBe(CAPTURE);
    expect(rebound.captureRevision).toBe(CAPTURE);
    expect(rebound.sourceDatasetHash).toBe(SOURCE_HASH);
    expect(rebound.authoritySelection).toBeUndefined();
    expect(rebound.sourceInventoryDigest).toBeUndefined();
  });

  it('refuses to write production selectors', () => {
    expect(() => assertNotProductionSelectorPath(
      'course-content/authoring/knowledge/authority/current.json',
    )).toThrow(LatestAuthorityCutoverError);
    expect(() => assertNotProductionSelectorPath(
      LIVE_AUTHORING_COMPOSED_MANIFEST_RELATIVE,
    )).not.toThrow();
  });

  it('fails closed when a fragment endpoint is absent from the successor', () => {
    expect(() => composeSuccessorDomainTeachingProjection({
      manifest: successorManifest(),
      authorings: [authoring()],
      objects: [],
    })).toThrow(/missing fragment endpoint/);
  });
});
