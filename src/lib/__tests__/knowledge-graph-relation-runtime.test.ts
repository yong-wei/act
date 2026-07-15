import { describe, expect, it } from 'vitest';
import fs from 'node:fs';

import { getRelationCategory, getRelationLabel } from '@/lib/knowledge-labels';

const runtimeModulePath = '../knowledge-graph-relation-runtime';

async function loadRuntimeModule() {
  try {
    return await import(runtimeModulePath);
  } catch {
    return null;
  }
}

function relation(overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id: 'relation-1',
    source_id: 'node-a',
    target_id: 'node-b',
    relation_type: 'related',
    strength: 0.8,
    ...overrides,
  };
}

function jsonl(...rows: Record<string, unknown>[]) {
  return `${rows.map((row) => JSON.stringify(row)).join('\n')}\n`;
}

describe('knowledge graph relation shared labeling contract', () => {
  it.each([undefined, null, '', '   ', 'not_registered']) (
    'rejects missing, empty, or unknown relation type %j instead of defaulting to related',
    (relationType) => {
      expect(() => getRelationLabel(relationType)).toThrow(/relation type/i);
      expect(() => getRelationCategory(relationType)).toThrow(/relation type/i);
    }
  );

  it('classifies canonical and alias types through the normative relation contract', () => {
    expect(getRelationCategory('contains')).toBe('membership');
    expect(getRelationCategory('follows')).toBe('prerequisite');
    expect(getRelationCategory('applies_to')).toBe('related');
    expect(getRelationCategory('电路应用')).toBe('related');
    expect(getRelationLabel('电路应用')).toBe('方法应用');
  });
});

describe('runtime knowledge relation loading and coverage boundary', () => {
  it('blocks an empty or whitespace-only canonical relation source', async () => {
    const runtime = await loadRuntimeModule();
    expect(runtime).not.toBeNull();
    for (const content of ['', '\n  \n']) {
      const result = runtime!.inspectRuntimeKnowledgeRelationCoverage(content, { nodeIds: new Set(['node-a']) });
      expect(result.report.ok).toBe(false);
      expect(result.report.diagnostics).toEqual(expect.arrayContaining([
        expect.objectContaining({ code: 'EMPTY_RUNTIME_RELATIONS', blocking: true }),
      ]));
      expect(result.runtimeLinks).toEqual([]);
    }
  });
  it('reports malformed JSONL as a machine-readable blocking loading failure', async () => {
    const runtime = await loadRuntimeModule();
    expect(runtime).not.toBeNull();

    const result = runtime!.inspectRuntimeKnowledgeRelationCoverage(
      `${JSON.stringify(relation())}\n{"id":\n`
    );

    expect(result.report.ok).toBe(false);
    expect(result.report.diagnostics).toContainEqual(expect.objectContaining({
      blocking: true,
      code: 'MALFORMED_RELATION_JSONL',
      line: 2,
      stage: 'loading',
    }));
  });

  it.each([
    [{ relation_type: undefined }, 'INVALID_RELATION_FIELD_FAMILY'],
    [{ relation_type: '' }, 'EMPTY_RELATION_TYPE'],
    [{ relation_type: 'not_registered' }, 'UNKNOWN_RELATION_TYPE'],
  ])('blocks missing, empty, and unknown types without related fallback', async (overrides, code) => {
    const runtime = await loadRuntimeModule();
    expect(runtime).not.toBeNull();
    const row = relation(overrides);
    if (overrides.relation_type === undefined) delete row.relation_type;

    const result = runtime!.inspectRuntimeKnowledgeRelationCoverage(jsonl(row));

    expect(result.report.ok).toBe(false);
    expect(result.report.diagnostics).toContainEqual(expect.objectContaining({
      blocking: true,
      code,
    }));
    expect(result.runtimeLinks).toEqual([]);
  });

  it('blocks duplicate relation ids before runtime links are exposed', async () => {
    const runtime = await loadRuntimeModule();
    expect(runtime).not.toBeNull();

    const result = runtime!.inspectRuntimeKnowledgeRelationCoverage(jsonl(
      relation(),
      relation({ target_id: 'node-c' })
    ));

    expect(result.report.diagnostics).toContainEqual(expect.objectContaining({
      blocking: true,
      code: 'DUPLICATE_RELATION_ID',
      relationIds: ['relation-1'],
    }));
    expect(result.runtimeLinks).toEqual([]);
  });

  it('blocks reverse child membership with both relation ids', async () => {
    const runtime = await loadRuntimeModule();
    expect(runtime).not.toBeNull();

    const result = runtime!.inspectRuntimeKnowledgeRelationCoverage(jsonl(
      relation({ id: 'child-a-b', relation_type: 'contains' }),
      relation({ id: 'child-b-a', relation_type: 'contains', source_id: 'node-b', target_id: 'node-a' })
    ));

    expect(result.report.diagnostics).toContainEqual(expect.objectContaining({
      blocking: true,
      code: 'REVERSE_CHILD_RELATION',
      relationIds: expect.arrayContaining(['child-a-b', 'child-b-a']),
    }));
  });

  it('diagnoses post-requisite cycles and marks their relations motion-ineligible', async () => {
    const runtime = await loadRuntimeModule();
    expect(runtime).not.toBeNull();

    const result = runtime!.inspectRuntimeKnowledgeRelationCoverage(jsonl(
      relation({ id: 'post-a-b', relation_type: 'prerequisite' }),
      relation({ id: 'post-b-a', relation_type: 'follows', source_id: 'node-b', target_id: 'node-a' })
    ));

    expect(result.report.ok).toBe(true);
    expect(result.report.diagnostics).toContainEqual(expect.objectContaining({
      blocking: false,
      code: 'POST_REQUISITE_CYCLE',
      motionEligible: false,
      nodeIds: ['node-a', 'node-b'],
      relationIds: ['post-a-b', 'post-b-a'],
      stage: 'projection',
    }));
    expect(result.runtimeLinks.every((link: { motionEligible: boolean }) => !link.motionEligible)).toBe(true);
  });

  it('excludes exact synthetic chapter membership from runtime relation links', async () => {
    const runtime = await loadRuntimeModule();
    expect(runtime).not.toBeNull();

    const result = runtime!.inspectRuntimeKnowledgeRelationCoverage(jsonl(relation({
      id: 'chapter-link:chapter-node:chapter-1->node-a',
      source_id: 'chapter-node:chapter-1',
      target_id: 'node-a',
      relation_type: 'contains',
    })));

    expect(result.report.ok).toBe(true);
    expect(result.report.diagnostics).toContainEqual(expect.objectContaining({
      blocking: false,
      code: 'SYNTHETIC_CHAPTER_LINK_EXCLUDED',
    }));
    expect(result.runtimeLinks).toEqual([]);
  });

  it('keeps every contributing relation until the visual projection boundary', async () => {
    const runtime = await loadRuntimeModule();
    expect(runtime).not.toBeNull();

    const result = runtime!.inspectRuntimeKnowledgeRelationCoverage(jsonl(
      relation({ id: 'related-1', strength: 0.4 }),
      relation({ id: 'related-2', strength: 0.9 })
    ));

    expect(result.report.ok).toBe(true);
    expect(result.projection.contributingRelations).toHaveLength(2);
    expect(result.projection.visualEdges).toHaveLength(1);
    expect(result.runtimeLinks.map((link: { id: string }) => link.id)).toEqual(['association|node-a|node-b']);
    expect(result.inspectionLinks.map((link: { id: string }) => link.id)).toEqual(['related-1', 'related-2']);
    expect(result.runtimeLinks[0].provenance.rawRelation).toEqual(relation({ id: 'related-1', strength: 0.4 }));
  });

  it('builds lossless directional inspection items from the same contract', async () => {
    const runtime = await loadRuntimeModule();
    expect(runtime).not.toBeNull();
    const result = runtime!.inspectRuntimeKnowledgeRelationCoverage(jsonl(
      relation({ id: 'applies-1', relation_type: 'applies_to' }),
      relation({ id: 'supports-1', relation_type: 'supports', strength: 0.9 })
    ));
    const nodes = new Map([
      ['node-a', { id: 'node-a', name: 'A', nodeType: 'THEORY' }],
      ['node-b', { id: 'node-b', name: 'B', nodeType: 'THEORY' }],
    ]);

    const sourceItems = runtime!.buildRuntimeKnowledgeRelationInspectionItems(
      result.inspectionLinks,
      nodes,
      'node-a'
    );
    const targetItems = runtime!.buildRuntimeKnowledgeRelationInspectionItems(
      result.inspectionLinks,
      nodes,
      'node-b'
    );

    expect(sourceItems).toHaveLength(2);
    expect(sourceItems.map((item: { relationId: string }) => item.relationId)).toEqual([
      'supports-1',
      'applies-1',
    ]);
    expect(sourceItems[1]).toEqual(expect.objectContaining({
      canonicalType: 'applies_to',
      category: 'related',
      direction: 'unordered',
      evidenceState: 'unavailable',
      family: 'association',
      inspectionSentence: '本节点可应用于目标',
      relationId: 'applies-1',
      sourceId: 'node-a',
      targetId: 'node-b',
    }));
    expect(targetItems.find((item: { relationId: string }) => item.relationId === 'applies-1'))
      .toEqual(expect.objectContaining({
        inspectionSentence: '本节点可接受来源方法的应用',
      }));
  });

  it('classifies contains inspection as membership instead of learning order', async () => {
    const runtime = await loadRuntimeModule();
    const result = runtime!.inspectRuntimeKnowledgeRelationCoverage(jsonl(
      relation({ id: 'contains-1', relation_type: 'contains' })
    ));
    const items = runtime!.buildRuntimeKnowledgeRelationInspectionItems(
      result.inspectionLinks,
      new Map([
        ['node-a', { id: 'node-a', name: '父级', nodeType: 'THEORY' }],
        ['node-b', { id: 'node-b', name: '子级', nodeType: 'THEORY' }],
      ]),
      'node-a'
    );
    expect(items[0]).toEqual(expect.objectContaining({
      category: 'membership',
      family: 'child',
      inspectionSentence: '本节点包含目标子级',
    }));
  });

  it('uses one contract for loading, labeling, projection, and inspection coverage', async () => {
    const runtime = await loadRuntimeModule();
    expect(runtime).not.toBeNull();

    const result = runtime!.inspectRuntimeKnowledgeRelationCoverage(jsonl(relation()));

    expect(result.report.stageAgreement).toBe(true);
    expect(result.report.coverage.length).toBeGreaterThan(20);
    expect(result.report.coverage.every((item: { stages: Record<string, string> }) => (
      new Set(Object.values(item.stages)).size === 1
    ))).toBe(true);
  });

  it('accepts all 16,545 current canonical runtime relations without changing the source', async () => {
    const runtime = await loadRuntimeModule();
    expect(runtime).not.toBeNull();
    const source = fs.readFileSync('course-content/runtime/knowledge/graph/relations.jsonl', 'utf8');

    const result = runtime!.inspectRuntimeKnowledgeRelationCoverage(source);

    expect(result.report.ok).toBe(true);
    expect(result.report.counts.parsedRelations).toBe(16_545);
    expect(result.projection.contributingRelations).toHaveLength(16_545);
    expect(result.inspectionLinks).toHaveLength(16_545);
    expect(result.runtimeLinks).toHaveLength(result.projection.visualEdges.length);
  });
});
