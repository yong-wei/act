import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  isEngineeringPostRequisitePredicate,
  OverviewTeachingOrderError,
  planOverviewTeachingOrder,
} from '../teaching-projection/domain-fragments/adopt-engineering-prerequisites';
import { authorOverviewTeachingOrderFragment } from '../teaching-projection/domain-fragments/build-overview-teaching-order';
import { buildDomainTeachingFragment } from '../teaching-projection/domain-fragments/builder';
import { composeDomainTeachingProjection } from '../teaching-projection/domain-fragments/compose';
import { createDomainTeachingAuthorityEnvelope } from '../teaching-projection/domain-fragments/validate';

describe('planOverviewTeachingOrder', () => {
  it('adopts engineering post-requisites and ignores association/derived_from', () => {
    const plan = planOverviewTeachingOrder({
      overviews: [{ domainId: 'system-modeling', nodeIds: ['a', 'b', 'c'] }],
      engineeringRelations: [
        { id: 'eng-1', predicate: 'prerequisite', sourceId: 'a', targetId: 'b' },
        { id: 'eng-2', predicate: 'association', sourceId: 'b', targetId: 'c' },
        { id: 'eng-3', predicate: 'derived_from', sourceId: 'a', targetId: 'c' },
      ],
      existingTeaching: [],
    });
    expect(isEngineeringPostRequisitePredicate('prerequisite')).toBe(true);
    expect(isEngineeringPostRequisitePredicate('association')).toBe(false);
    expect(plan.adopted).toEqual([
      expect.objectContaining({
        sourceNodeId: 'a',
        targetNodeId: 'b',
        strength: 'REQUIRED',
        provenance: 'engineering-post-requisite',
        engineeringRelationId: 'eng-1',
      }),
    ]);
    expect(plan.extensions).toHaveLength(1);
    expect(plan.extensions[0]).toEqual(expect.objectContaining({
      provenance: 'teaching-extension',
      strength: 'RECOMMENDED',
    }));
  });

  it('does not emit an adopted edge that already exists as teaching', () => {
    const plan = planOverviewTeachingOrder({
      overviews: [{ domainId: 'system-modeling', nodeIds: ['a', 'b'] }],
      engineeringRelations: [
        { id: 'eng-1', predicate: 'follows', sourceId: 'a', targetId: 'b' },
      ],
      existingTeaching: [
        { sourceNodeId: 'a', targetNodeId: 'b', relationType: 'PREREQUISITE' },
      ],
    });
    expect(plan.adopted).toEqual([]);
    expect(plan.extensions).toEqual([]);
  });

  it('fails closed on a REQUIRED cycle', () => {
    expect(() => planOverviewTeachingOrder({
      overviews: [{ domainId: 'root-locus', nodeIds: ['a', 'b'] }],
      engineeringRelations: [
        { id: 'eng-1', predicate: 'prerequisite', sourceId: 'a', targetId: 'b' },
        { id: 'eng-2', predicate: 'leads_to', sourceId: 'b', targetId: 'a' },
      ],
      existingTeaching: [],
    })).toThrow(OverviewTeachingOrderError);
  });

  it('orients extension edges along domain-default catalog order, not canonical id sort', () => {
    const plan = planOverviewTeachingOrder({
      overviews: [{ domainId: 'system-modeling', nodeIds: ['z', 'a'] }],
      engineeringRelations: [],
      existingTeaching: [],
    });
    expect(plan.extensions).toEqual([
      expect.objectContaining({
        sourceNodeId: 'z',
        targetNodeId: 'a',
        strength: 'RECOMMENDED',
        provenance: 'teaching-extension',
      }),
    ]);
  });

  it('keeps existing recommended teaching strength and cross-domain endpoints', () => {
    const commit = 'a'.repeat(40);
    const binding = {
      releaseId: 'ctr:release:eng-domain-teaching-fixture-v1',
      releaseSetId: 'set-fixture-domain-teaching-v1',
      snapshotId: `snap-${'b'.repeat(64)}`,
      snapshotHash: 'b'.repeat(64),
    };
    const nodes = ['a', 'b', 'c'].map((canonicalId) => ({ canonicalId, lifecycleStatus: 'active' }));
    const envelope = createDomainTeachingAuthorityEnvelope({
      binding,
      sourceDatasetHash: 'd'.repeat(64),
      captureRevision: commit,
      authoringRevision: commit,
      nodes,
    });
    const { authoring } = authorOverviewTeachingOrderFragment({
      overviews: [
        { domainId: 'system-modeling', nodeIds: ['a', 'b'] },
        { domainId: 'root-locus', nodeIds: ['c'] },
      ],
      engineeringRelations: [],
      existingTeaching: [{
        sourceNodeId: 'a',
        targetNodeId: 'c',
        relationType: 'PREREQUISITE',
        strength: 'RECOMMENDED',
        domainKeys: ['system-modeling', 'root-locus'],
        evidenceRefs: ['prior-edge'],
        curatorId: 'prior-curator',
        curatorRationale: 'reviewed prior teaching edge',
        authorDecisionId: 'prior-1',
      }],
      envelope,
    });
    expect(authoring.relations).toEqual(expect.arrayContaining([
      expect.objectContaining({
        sourceNodeId: 'a',
        targetNodeId: 'c',
        strength: 'RECOMMENDED',
        evidenceRefs: ['prior-edge'],
        curatorId: 'prior-curator',
      }),
    ]));
  });

  it('connects a previously empty overview with extension edges', () => {
    const plan = planOverviewTeachingOrder({
      overviews: [{
        domainId: 'discrete-time-control-analysis',
        nodeIds: ['n1', 'n2', 'n3'],
      }],
      engineeringRelations: [],
      existingTeaching: [],
    });
    expect(plan.adopted).toEqual([]);
    expect(plan.extensions).toHaveLength(2);
  });

  it('builds a fragment that weakly connects an empty overview', () => {
    const commit = 'a'.repeat(40);
    const binding = {
      releaseId: 'ctr:release:eng-domain-teaching-fixture-v1',
      releaseSetId: 'set-fixture-domain-teaching-v1',
      snapshotId: `snap-${'b'.repeat(64)}`,
      snapshotHash: 'b'.repeat(64),
    };
    const nodes = ['n1', 'n2', 'n3'].map((canonicalId) => ({ canonicalId, lifecycleStatus: 'active' }));
    const envelope = createDomainTeachingAuthorityEnvelope({
      binding,
      sourceDatasetHash: 'd'.repeat(64),
      captureRevision: commit,
      authoringRevision: commit,
      nodes,
    });
    const { authoring } = authorOverviewTeachingOrderFragment({
      overviews: [{ domainId: 'discrete-time-control-analysis', nodeIds: ['n1', 'n2', 'n3'] }],
      engineeringRelations: [],
      existingTeaching: [],
      envelope,
    });
    const fragment = buildDomainTeachingFragment(authoring, envelope);
    const composed = composeDomainTeachingProjection({
      fragments: [fragment],
      authoringRevision: commit,
      authority: envelope,
    });
    expect(composed.manifest.gatePassed).toBe(true);
    expect(composed.manifest.relationCount).toBe(2);
    expect(composed.manifest.coreNodeCount).toBe(3);
  });

  it('connects every sealed domain-default overview including previously empty domains', async () => {
    const {
      planOverviewTeachingOrder: plan,
    } = await import('../teaching-projection/domain-fragments/adopt-engineering-prerequisites');
    const {
      readDomainOverviews,
      readEngineeringRelationsFromAuthoritySnapshot,
    } = await import('../teaching-projection/domain-fragments/build-overview-teaching-order');
    const overviews = readDomainOverviews(process.cwd());
    expect(overviews.length).toBeGreaterThanOrEqual(15);
    const result = plan({
      overviews,
      engineeringRelations: readEngineeringRelationsFromAuthoritySnapshot(process.cwd()),
      existingTeaching: [],
    });
    const emptyDomains = ['discrete-time-control-analysis', 'state-space-control-analysis-and-design'];
    for (const domainId of emptyDomains) {
      const overview = overviews.find((row) => row.domainId === domainId);
      expect(overview?.nodeIds.length).toBeGreaterThan(1);
      const incident = [...result.adopted, ...result.extensions].filter((edge) => edge.domainKeys.includes(domainId as typeof edge.domainKeys[number]));
      expect(incident.length).toBe(overview!.nodeIds.length - 1);
    }
  });

  it('does not let the shard loader infer teaching edges from engineering families', () => {
    const loader = readFileSync(
      path.resolve(process.cwd(), 'src/lib/authority-domain-shards/loader.ts'),
      'utf8',
    );
    expect(loader).not.toContain('planOverviewTeachingOrder');
    expect(loader).not.toContain('adopt-engineering-prerequisites');
  });

  it('publishes 15 weakly-connected domain overviews without rewriting engineering shards', () => {
    const overlayRoot = path.resolve(
      process.cwd(),
      'course-content/runtime/knowledge/teaching-projection/domain-fragments',
    );
    const pointer = JSON.parse(readFileSync(path.join(overlayRoot, 'current.json'), 'utf8')) as {
      projectionId: string;
    };
    const manifest = JSON.parse(
      readFileSync(path.join(overlayRoot, 'releases', pointer.projectionId, 'composed-manifest.json'), 'utf8'),
    ) as {
      domainCoverage: Array<{
        domainId: string;
        coverage: string;
        relationCount: number;
        uncoveredCoreNodeCount: number;
      }>;
    };
    expect(manifest.domainCoverage).toHaveLength(15);
    expect(manifest.domainCoverage.every((row) => (
      row.coverage === 'available'
      && row.relationCount > 0
      && row.uncoveredCoreNodeCount === 0
    ))).toBe(true);
    const fragmentRef = JSON.parse(
      readFileSync(path.join(overlayRoot, 'releases', pointer.projectionId, 'composed-manifest.json'), 'utf8'),
    ) as { fragments: Array<{ fragmentId: string }> };
    const published = JSON.parse(
      readFileSync(
        path.join(overlayRoot, 'releases', pointer.projectionId, 'fragments', `${fragmentRef.fragments[0]!.fragmentId}.json`),
        'utf8',
      ),
    ) as { relations: Array<{ strength: string; evidenceRefs: string[] }> };
    expect(published.relations.some((row) => row.strength === 'RECOMMENDED')).toBe(true);
    const builder = readFileSync(
      path.resolve(process.cwd(), 'src/lib/teaching-projection/domain-fragments/build-overview-teaching-order.ts'),
      'utf8',
    );
    expect(builder).toContain('LIVE_AUTHORITY_DOMAIN_TEACHING_ENGINEERING_RELATIVE');
    expect(builder).not.toContain('readEngineeringRelationsFromFamilyShards');
    expect(builder).not.toMatch(/writeFileSync\(/);
    const stageRuntime = readFileSync(
      path.resolve(process.cwd(), 'src/lib/authority-domain-shards/stage-domain-teaching-runtime.ts'),
      'utf8',
    );
    expect(stageRuntime).toContain('does not rematerialize Authority shards');
  });
});
