import { describe, expect, it } from 'vitest';
import { recloseCourseGovernance } from '../../../scripts/knowledge/reclose-current-course-governance';

function fixture(): Parameters<typeof recloseCourseGovernance>[0] {
  const sourceScopeHash = 'a'.repeat(64);
  return {
    sourceScopeHash, scopeHash: 'b'.repeat(64), authorityCaptureHash: 'c'.repeat(64),
    members: ['a', 'b'], retiredMembers: ['retired'],
    sourceDispositions: ['a', 'b', 'retired'].flatMap((canonicalId) =>
      (['containment', 'prerequisite', 'association'] as const).map((family) => ({
        scopeHash: sourceScopeHash, canonicalId, family,
        kind: canonicalId === 'a' && family !== 'association' ? 'PUBLISHED_EDGE' as const : 'NO_RELATION' as const,
        edgeId: canonicalId === 'a' && family !== 'association' ? 'old-' + family : null,
        evidenceRefs: ['reviewed-course.md'], rationale: 'Existing reviewed disposition.',
      }))),
    semanticCache: {
      contract: 'authority-semantic-cache/v1', cacheHash: 'd'.repeat(64),
      entries: ['a', 'b', 'retired'].map((recordId) => ({
        recordId, kind: 'object', predecessorRevision: recordId,
        successorRevision: recordId === 'retired' ? null : recordId,
        disposition: recordId === 'retired' ? 'RETIRED' : 'REUSED',
      })),
      summary: { reusedCount: 2, recomputedCount: 0, retiredCount: 1, objectCount: 2, relationCount: 0 },
    },
    historicalEdges: [{ edgeId: 'old-containment', source: 'a', target: 'b', family: 'containment' }],
    courseEdges: [{ edgeId: 'new-course-order', sourceNodeId: 'a', targetNodeId: 'b', evidenceRefs: ['approved-plan.md'] }],
  };
}

describe('course governance reclosure', () => {
  it('reuses unchanged families and binds prerequisite dispositions to real course edges', () => {
    const input = fixture();
    const result = recloseCourseGovernance(input);
    expect(result.closure.status).toBe('COMPLETE');
    expect(result.dispositions).toHaveLength(6);
    expect(result.retiredDispositionCount).toBe(3);
    expect(result.recomputedCount).toBe(2);
    expect(result.reusedCount).toBe(4);
    expect(result.dispositions.filter((row) => row.family === 'prerequisite').map((row) => row.edgeId))
      .toEqual(['new-course-order', 'new-course-order']);
    expect(result.dispositions.find((row) => row.canonicalId === 'a' && row.family === 'containment')?.edgeId)
      .toBe('old-containment');
  });

  it.each(['retirement', 'changed-object', 'scope-loss', 'missing-edge', 'retired-target', 'missing-evidence', 'missing-disposition', 'duplicate-disposition'])('rejects unsupported reclosure: %s', (caseName) => {
    const input = fixture();
    if (caseName === 'retirement') input.retiredMembers = [];
    if (caseName === 'changed-object') input.semanticCache = { ...input.semanticCache,
      entries: input.semanticCache.entries.map((row, index) => index === 0 ? { ...row, disposition: 'RECOMPUTED' } : row) };
    if (caseName === 'scope-loss') input.members = ['a'];
    if (caseName === 'missing-edge') input.courseEdges = [];
    if (caseName === 'retired-target') input.historicalEdges = [{ ...input.historicalEdges[0], target: 'retired' }];
    if (caseName === 'missing-evidence') input.courseEdges = [{ ...input.courseEdges[0], evidenceRefs: [] }];
    if (caseName === 'missing-disposition') input.sourceDispositions = input.sourceDispositions.slice(0, -1);
    if (caseName === 'duplicate-disposition') input.sourceDispositions = [...input.sourceDispositions, input.sourceDispositions[0]];
    expect(() => recloseCourseGovernance(input)).toThrow('course governance:');
  });
});
