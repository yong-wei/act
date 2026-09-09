import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isEngineeringPostRequisitePredicate, planOverviewTeachingOrder } from '../teaching-projection/domain-fragments/adopt-engineering-prerequisites';
import { authorOverviewTeachingOrderFragment } from '../teaching-projection/domain-fragments/build-overview-teaching-order';
import { createDomainTeachingAuthorityEnvelope } from '../teaching-projection/domain-fragments/validate';

describe('published prerequisite adoption without inferred gap filling', () => {
  it('adopts a real engineering prerequisite without turning association into order', () => {
    const plan = planOverviewTeachingOrder({
      overviews: [{ domainId: 'system-modeling', nodeIds: ['a', 'b'] }],
      contentNodeIds: ['a', 'b'], existingTeaching: [],
      engineeringRelations: [
        { id: 'eng-1', predicate: 'prerequisite', sourceId: 'a', targetId: 'b' },
        { id: 'eng-2', predicate: 'association', sourceId: 'a', targetId: 'b' },
      ],
    });
    expect(isEngineeringPostRequisitePredicate('prerequisite')).toBe(true);
    expect(isEngineeringPostRequisitePredicate('association')).toBe(false);
    expect(plan.adopted).toEqual([expect.objectContaining({ sourceNodeId: 'a', targetNodeId: 'b',
      strength: 'REQUIRED', engineeringRelationId: 'eng-1' })]);
    expect(plan.extensions).toEqual([]);
  });

  it.each([
    new Map([['a', '2-1'], ['b', '2-2']]),
    new Map([['a', '2-1'], ['b', '2-1']]),
    new Map<string, string>(),
  ])('requires an author decision instead of scheduled or unscheduled ordering', (nodeUnits) => {
    expect(() => planOverviewTeachingOrder({
      overviews: [{ domainId: 'system-modeling', nodeIds: ['a', 'b'] }],
      contentNodeIds: ['a', 'b'], nodeUnits, existingTeaching: [], engineeringRelations: [],
    })).toThrow('automatic gap filling is forbidden');
  });

  it('does not duplicate a published teaching pair', () => {
    const plan = planOverviewTeachingOrder({
      overviews: [{ domainId: 'system-modeling', nodeIds: ['a', 'b'] }], contentNodeIds: ['a', 'b'],
      engineeringRelations: [{ id: 'eng-1', predicate: 'follows', sourceId: 'a', targetId: 'b' }],
      existingTeaching: [{ sourceNodeId: 'a', targetNodeId: 'b', relationType: 'PREREQUISITE' }],
    });
    expect(plan.adopted).toEqual([]);
    expect(plan.extensions).toEqual([]);
  });

  it('rejects a REQUIRED cycle involving retained teaching and adopted engineering', () => {
    expect(() => planOverviewTeachingOrder({
      overviews: [{ domainId: 'root-locus', nodeIds: ['a', 'b'] }], contentNodeIds: ['a', 'b'],
      engineeringRelations: [{ id: 'eng-1', predicate: 'prerequisite', sourceId: 'b', targetId: 'a' }],
      existingTeaching: [{ sourceNodeId: 'a', targetNodeId: 'b', relationType: 'PREREQUISITE', strength: 'REQUIRED' }],
    })).toThrow('REQUIRED');
  });

  it('preserves explicit recommended strength and cross-domain endpoints', () => {
    const envelope = createDomainTeachingAuthorityEnvelope({
      binding: { releaseId: 'release', releaseSetId: 'set', snapshotId: 'snap-' + 'b'.repeat(64), snapshotHash: 'b'.repeat(64) },
      sourceDatasetHash: 'd'.repeat(64), captureRevision: 'a'.repeat(40), authoringRevision: 'a'.repeat(40),
      nodes: ['a', 'b', 'c'].map((canonicalId) => ({ canonicalId, lifecycleStatus: 'active' })),
    });
    const prior = { sourceNodeId: 'a', targetNodeId: 'c', relationType: 'PREREQUISITE', strength: 'RECOMMENDED' as const,
      domainKeys: ['system-modeling', 'root-locus'] as const, evidenceRefs: ['src:3-1#sample'],
      curatorId: 'prior-curator', curatorRationale: 'reviewed prior teaching edge', authorDecisionId: 'prior-1' };
    const { authoring } = authorOverviewTeachingOrderFragment({
      overviews: [{ domainId: 'system-modeling', nodeIds: ['a', 'b'] }, { domainId: 'root-locus', nodeIds: ['c'] }],
      contentNodeIds: ['a', 'b', 'c'],
      existingTeaching: [
        { ...prior, domainKeys: [...prior.domainKeys] },
        { ...prior, targetNodeId: 'b', domainKeys: ['system-modeling'], authorDecisionId: 'prior-2' },
      ], envelope,
    });
    expect(authoring.relations).toContainEqual(expect.objectContaining({
      sourceNodeId: 'a', targetNodeId: 'c', strength: 'RECOMMENDED', evidenceRefs: ['src:3-1#sample'], curatorId: 'prior-curator',
    }));
    expect(authoring.relations).toHaveLength(2);
  });

  it('keeps runtime readers free of authoring inference', () => {
    const loader = readFileSync(path.join(process.cwd(), 'src/lib/authority-domain-shards/loader.ts'), 'utf8');
    expect(loader).not.toContain('planOverviewTeachingOrder');
    expect(loader).not.toContain('validateCourseOrderDecisions');
  });
});
