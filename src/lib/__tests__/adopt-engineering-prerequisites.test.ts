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
      contentNodeIds: ['a', 'b', 'c'],
      nodeUnits: new Map([['a', '2-1'], ['b', '2-2'], ['c', '2-3']]),
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
      contentNodeIds: ['a', 'b'],
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
      contentNodeIds: ['a', 'b'],
      engineeringRelations: [
        { id: 'eng-1', predicate: 'prerequisite', sourceId: 'a', targetId: 'b' },
        { id: 'eng-2', predicate: 'leads_to', sourceId: 'b', targetId: 'a' },
      ],
      existingTeaching: [],
    })).toThrow(OverviewTeachingOrderError);
  });

  it('orients extension edges along syllabus unit order, not canonical id sort', () => {
    const plan = planOverviewTeachingOrder({
      overviews: [{ domainId: 'system-modeling', nodeIds: ['z', 'a'] }],
      contentNodeIds: ['z', 'a'],
      nodeUnits: new Map([['z', '1-1'], ['a', '2-1']]),
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

  it('does not claim syllabus order between two unscheduled nodes', () => {
    const plan = planOverviewTeachingOrder({
      overviews: [{ domainId: 'system-modeling', nodeIds: ['a', 'b'] }],
      contentNodeIds: ['a', 'b'],
      existingTeaching: [],
    });
    expect(plan.extensions.every((edge) => edge.provenance === 'unscheduled-extension')).toBe(true);
  });

  it('omits overview members that are not course-content-related', () => {
    const plan = planOverviewTeachingOrder({
      overviews: [{ domainId: 'system-modeling', nodeIds: ['a', 'b', 'unrelated'] }],
      contentNodeIds: ['a', 'b'],
      nodeUnits: new Map([['a', '2-1'], ['b', '2-2']]),
      existingTeaching: [],
    });
    expect(plan.extensions).toHaveLength(1);
    expect(plan.extensions[0]).toEqual(expect.objectContaining({
      sourceNodeId: 'a',
      targetNodeId: 'b',
    }));
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
      contentNodeIds: ['a', 'b', 'c'],
      existingTeaching: [{
        sourceNodeId: 'a',
        targetNodeId: 'c',
        relationType: 'PREREQUISITE',
        strength: 'RECOMMENDED',
        domainKeys: ['system-modeling', 'root-locus'],
        evidenceRefs: ['src:3-1#sample'],
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
        evidenceRefs: ['src:3-1#sample'],
        curatorId: 'prior-curator',
      }),
    ]));
    expect(authoring.coreNodes.map((node) => node.canonicalId).sort()).toEqual(['a', 'b', 'c']);
  });

  it('connects a previously empty related overview with unit-order extensions', () => {
    const plan = planOverviewTeachingOrder({
      overviews: [{
        domainId: 'discrete-time-control-analysis',
        nodeIds: ['n1', 'n2', 'n3'],
      }],
      contentNodeIds: ['n1', 'n2', 'n3'],
      nodeUnits: new Map([['n1', '2-1'], ['n2', '2-2'], ['n3', '2-3']]),
      existingTeaching: [],
    });
    expect(plan.adopted).toEqual([]);
    expect(plan.extensions).toHaveLength(2);
  });

  it('builds a fragment that weakly connects related overview members', () => {
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
      contentNodeIds: ['n1', 'n2', 'n3'],
      nodeUnits: new Map([['n1', '2-1'], ['n2', '2-2'], ['n3', '2-3']]),
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

  it('connects live course-content-related overviews and ingests published course prerequisites', async () => {
    const {
      planOverviewTeachingOrder: plan,
    } = await import('../teaching-projection/domain-fragments/adopt-engineering-prerequisites');
    const {
      readCourseTeachingContent,
      readDomainOverviews,
    } = await import('../teaching-projection/domain-fragments/build-overview-teaching-order');
    const overviews = readDomainOverviews(process.cwd());
    const course = readCourseTeachingContent(process.cwd());
    const overviewIds = new Set(overviews.flatMap((row) => row.nodeIds));
    const related = course.contentNodeIds.filter((id) => overviewIds.has(id));
    expect(related.length).toBeGreaterThan(200);
    expect(course.existingTeaching.length).toBeGreaterThanOrEqual(139);
    const result = plan({
      overviews,
      contentNodeIds: related,
      nodeUnits: course.nodeUnits,
      existingTeaching: course.existingTeaching,
    });
    const relatedDomains = overviews.filter((overview) => overview.nodeIds.some((id) => related.includes(id)));
    expect(relatedDomains.length).toBeGreaterThanOrEqual(8);
    expect(result.extensions.every((edge) => edge.strength === 'RECOMMENDED')).toBe(true);
    const {
      authorOverviewTeachingOrderFragment,
      readCatalogDomainKeys,
    } = await import('../teaching-projection/domain-fragments/build-overview-teaching-order');
    const commit = 'a'.repeat(40);
    const envelopeNodes = [...new Set([
      ...related,
      ...course.existingTeaching.flatMap((edge) => [edge.sourceNodeId, edge.targetNodeId]),
    ])].sort().map((canonicalId) => ({ canonicalId, lifecycleStatus: 'active' }));
    const envelope = createDomainTeachingAuthorityEnvelope({
      binding: {
        releaseId: 'ctr:release:eng-domain-teaching-fixture-v1',
        releaseSetId: 'set-fixture-domain-teaching-v1',
        snapshotId: `snap-${'b'.repeat(64)}`,
        snapshotHash: 'b'.repeat(64),
      },
      sourceDatasetHash: 'd'.repeat(64),
      captureRevision: commit,
      authoringRevision: commit,
      nodes: envelopeNodes,
    });
    const { authoring } = authorOverviewTeachingOrderFragment({
      overviews,
      contentNodeIds: related,
      nodeUnits: course.nodeUnits,
      catalogDomainKeys: readCatalogDomainKeys(process.cwd()),
      existingTeaching: course.existingTeaching,
      envelope,
    });
    const published = new Set(authoring.relations.map((edge) => `${edge.sourceNodeId}\u001f${edge.targetNodeId}`));
    for (const edge of course.existingTeaching) {
      expect(published.has(`${edge.sourceNodeId}\u001f${edge.targetNodeId}`)).toBe(true);
    }
    expect(authoring.relations.filter((edge) => (
      (edge.curatorRationale ?? '').includes('follows syllabus unit order')
      && (edge.curatorRationale ?? '').includes('Unscheduled')
    ))).toEqual([]);
  });

  it('does not let the shard loader infer teaching edges from engineering families', () => {
    const loader = readFileSync(
      path.resolve(process.cwd(), 'src/lib/authority-domain-shards/loader.ts'),
      'utf8',
    );
    expect(loader).not.toContain('planOverviewTeachingOrder');
    expect(loader).not.toContain('adopt-engineering-prerequisites');
  });

  it('publishes course-related overlay coverage without rewriting engineering shards', () => {
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
      relationCount: number;
    };
    const related = manifest.domainCoverage.filter((row) => row.relationCount > 0);
    expect(related.length).toBeGreaterThanOrEqual(8);
    expect(related.every((row) => row.uncoveredCoreNodeCount === 0)).toBe(true);
    expect(manifest.relationCount).toBeGreaterThanOrEqual(139);
    const builder = readFileSync(
      path.resolve(process.cwd(), 'src/lib/teaching-projection/domain-fragments/build-overview-teaching-order.ts'),
      'utf8',
    );
    expect(builder).toContain('readCourseTeachingContent');
    expect(builder).not.toMatch(/writeFileSync\(/);
    const stageRuntime = readFileSync(
      path.resolve(process.cwd(), 'src/lib/authority-domain-shards/stage-domain-teaching-runtime.ts'),
      'utf8',
    );
    expect(stageRuntime).toContain('does not rematerialize Authority shards');
  });
});
