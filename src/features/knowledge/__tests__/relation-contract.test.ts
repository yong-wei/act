import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  getKnowledgeGraphRelationContract,
  KNOWLEDGE_GRAPH_RELATION_CONTRACTS,
  projectKnowledgeGraphRelations,
} from '../graph/relation-contract';

describe('knowledge graph relation contract', () => {
  it.each([
    ['defines', 'related'],
    ['governs', 'related'],
    ['implements', 'related'],
    ['influences', 'related'],
    ['example', 'instance_of'],
    ['explains', 'informs'],
    ['引出机械建模', 'leads_to'],
    ['引出电路建模', 'leads_to'],
    ['机电类比', 'cross_domain'],
    ['非线性扩展', 'generalizes'],
    ['建模基础', 'provides_foundation'],
    ['电路应用', 'applies_to'],
  ])('normalizes the alias %s to %s without changing direction', (alias, canonicalType) => {
    const contract = getKnowledgeGraphRelationContract(alias);
    const canonicalContract = getKnowledgeGraphRelationContract(canonicalType);

    expect(contract).toMatchObject({ canonicalType });
    expect(contract?.aliases).toContain(alias);
    expect(contract).toMatchObject({
      family: canonicalContract?.family,
      direction: canonicalContract?.direction,
      detailSentence: canonicalContract?.detailSentence,
    });
  });

  it('covers every canonical type present in runtime relations.jsonl', () => {
    const runtimeTypes = new Set(
      readFileSync(
        path.join(process.cwd(), 'course-content/runtime/knowledge/graph/relations.jsonl'),
        'utf8'
      )
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => (JSON.parse(line) as { relation_type: string }).relation_type)
    );
    const canonicalTypes = new Set(
      KNOWLEDGE_GRAPH_RELATION_CONTRACTS.map((contract) => contract.canonicalType)
    );

    expect([...runtimeTypes].filter((type) => !canonicalTypes.has(type))).toEqual([]);
  });

  it('projects the complete runtime relations.jsonl without blocking and with stable output', () => {
    const runtimeRelations = readFileSync(
      path.join(process.cwd(), 'course-content/runtime/knowledge/graph/relations.jsonl'),
      'utf8'
    )
      .trim()
      .split('\n')
      .filter(Boolean)
      .map((line) => JSON.parse(line) as Record<string, unknown>);

    const first = projectKnowledgeGraphRelations(runtimeRelations);
    const second = projectKnowledgeGraphRelations(runtimeRelations);

    expect(runtimeRelations).toHaveLength(16545);
    expect(first.blocked).toBe(false);
    expect(first.diagnostics).toEqual([]);
    expect(first).toEqual(second);
  });

  it('defines zero-instance follows as an earlier-to-later directed relation', () => {
    expect(getKnowledgeGraphRelationContract('follows')).toMatchObject({
      canonicalType: 'follows',
      family: 'post-requisite',
      direction: 'earlier-to-later',
      authoringGrammar: {
        en: 'source is followed by target',
        zh: 'target 是 source 的学习后续',
      },
      detailSentence: {
        source: '本节点之后学习目标节点',
        target: '本节点是来源节点的学习后续',
      },
    });
  });

  it('defines family-specific density policies in the shared contract', () => {
    expect(getKnowledgeGraphRelationContract('contains')?.densityPolicy).toEqual({
      defaultVisible: false,
      scope: 'all-eligible',
    });
    expect(getKnowledgeGraphRelationContract('prerequisite')?.densityPolicy).toEqual({
      defaultVisible: true,
      scope: 'all-eligible',
    });
    expect(getKnowledgeGraphRelationContract('related')?.densityPolicy).toEqual({
      beforeSelection: 0,
      defaultVisible: true,
      maxEdges: 24,
      orderBy: ['strength-desc', 'stable-id'],
      scope: 'selected-one-hop',
    });
  });

  describe.each(['ordinary', 'synthetic'] as const)('%s relation field families', (relationKind) => {
    const familyCases = [
      { fieldFamily: 'id', canonicalKey: 'id', aliasKey: 'relationId' },
      { fieldFamily: 'type', canonicalKey: 'type', aliasKey: 'relationType' },
      { fieldFamily: 'source', canonicalKey: 'sourceId', aliasKey: 'source_id' },
      { fieldFamily: 'target', canonicalKey: 'targetId', aliasKey: 'target_id' },
    ] as const;
    const duplicateCases = ['blank', 'same', 'conflict'] as const;

    it.each(familyCases.flatMap((family) => duplicateCases.map((duplicateKind) => ({
      ...family,
      duplicateKind,
    }))))('blocks $fieldFamily aliases when the redundant field is $duplicateKind', ({
      aliasKey,
      canonicalKey,
      duplicateKind,
      fieldFamily,
    }) => {
      const relation: Record<string, unknown> = relationKind === 'synthetic'
        ? {
          id: 'chapter-link:chapter-node:chapter-1->node-a',
          sourceId: 'chapter-node:chapter-1',
          targetId: 'node-a',
          type: 'contains',
        }
        : { id: 'ordinary', sourceId: 'a', targetId: 'b', type: 'related' };
      relation[aliasKey] = duplicateKind === 'blank'
        ? '   '
        : duplicateKind === 'same'
          ? relation[canonicalKey]
          : `${String(relation[canonicalKey])}-conflict`;

      const result = projectKnowledgeGraphRelations([relation]);

      expect(result.blocked).toBe(true);
      expect(result.visualEdges).toEqual([]);
      expect(result.diagnostics).toContainEqual(expect.objectContaining({
        code: 'INVALID_RELATION_FIELD_FAMILY',
        blocking: true,
        fieldFamily,
      }));
    });
  });

  it('allows only the exact id plus relation_id runtime compatibility pair', () => {
    const result = projectKnowledgeGraphRelations([
      {
        id: 'runtime-id',
        relation_id: 'runtime-id',
        source_id: 'a',
        target_id: 'b',
        relation_type: 'related',
      },
    ]);

    expect(result.blocked).toBe(false);
    expect(result.diagnostics).toEqual([]);
    expect(result.visualEdges).toHaveLength(1);
  });

  it.each(['   ', 'runtime-id-conflict'])(
    'rejects a non-exact id plus relation_id compatibility candidate: %j',
    (relationIdAlias) => {
      const result = projectKnowledgeGraphRelations([
        {
          id: 'runtime-id',
          relation_id: relationIdAlias,
          source_id: 'a',
          target_id: 'b',
          relation_type: 'related',
        },
      ]);

      expect(result.blocked).toBe(true);
      expect(result.visualEdges).toEqual([]);
      expect(result.diagnostics).toContainEqual(expect.objectContaining({
        code: 'INVALID_RELATION_FIELD_FAMILY',
        blocking: true,
        fieldFamily: 'id',
      }));
    }
  );

  it.each([
    ['ordinary space', 'runtime id'],
    ['tab', 'runtime\tid'],
    ['newline', 'runtime\nid'],
    ['non-breaking space', 'runtime\u00a0id'],
  ])('rejects whitespace inside the id plus relation_id compatibility pair: %s', (_, value) => {
    const result = projectKnowledgeGraphRelations([
      {
        id: value,
        relation_id: value,
        source_id: 'a',
        target_id: 'b',
        relation_type: 'related',
      },
    ]);

    expect(result.blocked).toBe(true);
    expect(result.visualEdges).toEqual([]);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'INVALID_RELATION_FIELD_FAMILY',
      blocking: true,
      fieldFamily: 'id',
    }));
  });

  it('uses directed keys for child and post-requisite edges', () => {
    const result = projectKnowledgeGraphRelations([
      { id: 'child', sourceId: 'parent', targetId: 'child', type: 'contains' },
      { id: 'post', sourceId: 'early', targetId: 'late', type: 'prerequisite' },
    ]);

    expect(result.visualEdges.map((edge) => edge.key)).toEqual([
      'child|parent|child',
      'post|early|late',
    ]);
  });

  it('uses an unordered stable key for association edges while preserving authored direction', () => {
    const rawRelation = {
      id: 'association',
      sourceId: 'z-node',
      targetId: 'a-node',
      type: 'supports',
    };
    const result = projectKnowledgeGraphRelations([rawRelation]);

    expect(result.visualEdges[0]).toMatchObject({
      key: 'association|a-node|z-node',
      sourceId: 'a-node',
      targetId: 'z-node',
    });
    expect(result.contributingRelations[0]).toMatchObject({
      sourceId: 'z-node',
      targetId: 'a-node',
    });
    expect(result.contributingRelations[0].rawRelation).toBe(rawRelation);
  });

  it('excludes an exact synthetic chapter membership from every relation projection output', () => {
    const result = projectKnowledgeGraphRelations([
      {
        id: 'chapter-link:chapter-node:chapter-1->node-a',
        sourceId: 'chapter-node:chapter-1',
        targetId: 'node-a',
        type: 'contains',
      },
    ]);

    expect(result.blocked).toBe(false);
    expect(result.visualEdges).toEqual([]);
    expect(result.contributingRelations).toEqual([]);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'SYNTHETIC_CHAPTER_LINK_EXCLUDED',
      blocking: false,
      relationIds: ['chapter-link:chapter-node:chapter-1->node-a'],
    }));
  });

  it.each([
    {
      id: ' chapter-link:chapter-node:chapter-1->node-a',
      sourceId: 'chapter-node:chapter-1',
      targetId: 'node-a',
      type: 'contains',
    },
    {
      id: 'chapter-link:chapter-node:chapter-1->node-a ',
      sourceId: 'chapter-node:chapter-1',
      targetId: 'node-a',
      type: 'contains',
    },
    {
      id: 'chapter-link:chapter-node:chapter-1 ->node-a',
      sourceId: 'chapter-node:chapter-1 ',
      targetId: 'node-a',
      type: 'contains',
    },
    {
      id: 'chapter-link:chapter-node:chapter-1-> node-a',
      sourceId: 'chapter-node:chapter-1',
      targetId: ' node-a',
      type: 'contains',
    },
    {
      id: 'chapter-link:chapter-node:chapter-1->node-a',
      sourceId: 'chapter-node:chapter-1',
      targetId: 'node-a',
      type: 'contains ',
    },
    {
      id: 'chapter-link:chapter-node:chapter-1->node-a',
      sourceId: 'chapter-node:chapter-1',
      targetId: 'node-a',
      relationType: 'contains',
      relation: 'contains ',
    },
  ])('rejects synthetic chapter membership with raw field whitespace: %o', (relation) => {
    const result = projectKnowledgeGraphRelations([relation]);

    expect(result.blocked).toBe(true);
    expect(result.visualEdges).toEqual([]);
    expect(result.diagnostics[0]).toMatchObject({ blocking: true });
    expect(result.diagnostics[0].fieldFamily).toBeTruthy();
  });

  it.each([
    {
      id: 'chapter-link:forged',
      sourceId: 'chapter-node:chapter-1',
      targetId: 'node-a',
      type: 'contains',
    },
    {
      id: 'chapter-link:ordinary-node->node-a',
      sourceId: 'ordinary-node',
      targetId: 'node-a',
      type: 'contains',
    },
    {
      id: 'chapter-link:chapter-node:chapter-1->node-a',
      sourceId: 'chapter-node:chapter-1',
      targetId: 'node-a',
      type: 'related',
    },
    {
      id: 'chapter-link:chapter-node:chapter-1->',
      sourceId: 'chapter-node:chapter-1',
      targetId: '',
      type: 'contains',
    },
    {
      id: 'ordinary-id',
      sourceId: 'chapter-node:chapter-1',
      targetId: 'node-a',
      type: 'contains',
    },
  ])('blocks malformed or forged synthetic chapter membership: %o', (relation) => {
    const result = projectKnowledgeGraphRelations([relation]);

    expect(result.blocked).toBe(true);
    expect(result.visualEdges).toEqual([]);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ blocking: true }));
  });

  it('blocks duplicate exact synthetic chapter membership instead of excluding it', () => {
    const relation = {
      id: 'chapter-link:chapter-node:chapter-1->node-a',
      sourceId: 'chapter-node:chapter-1',
      targetId: 'node-a',
      type: 'contains',
    };
    const result = projectKnowledgeGraphRelations([relation, { ...relation }]);

    expect(result.blocked).toBe(true);
    expect(result.visualEdges).toEqual([]);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'DUPLICATE_RELATION_ID',
      blocking: true,
      relationIds: [relation.id],
    }));
    expect(result.diagnostics).not.toContainEqual(expect.objectContaining({
      code: 'SYNTHETIC_CHAPTER_LINK_EXCLUDED',
    }));
  });

  it.each([
    ['', 'EMPTY_RELATION_TYPE'],
    ['   ', 'EMPTY_RELATION_TYPE'],
    ['not_registered', 'UNKNOWN_RELATION_TYPE'],
  ])('blocks an invalid relation type %j with a machine-readable diagnostic', (type, code) => {
    const result = projectKnowledgeGraphRelations([
      { id: 'invalid', sourceId: 'a', targetId: 'b', type },
    ]);

    expect(result.blocked).toBe(true);
    expect(result.visualEdges).toEqual([]);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code,
      blocking: true,
      relationIds: ['invalid'],
    }));
  });

  it('blocks every relation sharing a duplicate relation id', () => {
    const result = projectKnowledgeGraphRelations([
      { id: 'duplicate', sourceId: 'a', targetId: 'b', type: 'related' },
      { id: 'duplicate', sourceId: 'b', targetId: 'c', type: 'supports' },
    ]);

    expect(result.blocked).toBe(true);
    expect(result.visualEdges).toEqual([]);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'DUPLICATE_RELATION_ID',
      blocking: true,
      relationIds: ['duplicate'],
    }));
  });

  it('withholds every renderer-ready edge when valid and invalid relations are mixed', () => {
    const valid = { id: 'valid', sourceId: 'a', targetId: 'b', type: 'related' };
    const result = projectKnowledgeGraphRelations([
      valid,
      { id: 'invalid', sourceId: 'b', targetId: 'c', type: 'not_registered' },
    ]);

    expect(result.blocked).toBe(true);
    expect(result.visualEdges).toEqual([]);
    expect(result.contributingRelationsUse).toBe('diagnostics-only');
    expect(result.contributingRelations).toHaveLength(1);
    expect(result.contributingRelations[0].rawRelation).toBe(valid);
  });

  it('blocks both directions of a reverse child pair', () => {
    const result = projectKnowledgeGraphRelations([
      { id: 'child-forward', sourceId: 'a', targetId: 'b', type: 'contains' },
      { id: 'child-reverse', sourceId: 'b', targetId: 'a', type: 'contains' },
    ]);

    expect(result.blocked).toBe(true);
    expect(result.visualEdges).toEqual([]);
    expect(result.contributingRelations).toHaveLength(2);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'REVERSE_CHILD_RELATION',
      blocking: true,
      relationIds: ['child-forward', 'child-reverse'],
    }));
  });

  it('blocks contains self-child relations', () => {
    const result = projectKnowledgeGraphRelations([
      { id: 'self-child', sourceId: 'a', targetId: 'a', type: 'contains' },
    ]);

    expect(result.blocked).toBe(true);
    expect(result.visualEdges).toEqual([]);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'SELF_CHILD_RELATION',
      blocking: true,
      relationIds: ['self-child'],
    }));
  });

  it.each([
    { rationale: '   ' },
    { evidence: [] },
    { provenance: {} },
    { sourceMetadata: { note: '  ', nested: { evidence: [] } } },
  ])('treats blank or recursively empty evidence as unavailable: %o', (evidenceFields) => {
    const result = projectKnowledgeGraphRelations([
      { id: 'no-evidence', sourceId: 'a', targetId: 'b', type: 'related', ...evidenceFields },
    ]);

    expect(result.contributingRelations[0]).toMatchObject({
      evidenceState: 'unavailable',
      evidenceText: '关系依据未提供',
    });
  });

  it('merges association visuals without losing raw semantics or provenance', () => {
    const first = {
      id: 'association-1',
      sourceId: 'a',
      targetId: 'b',
      type: 'supports',
      provenance: { sourceDocument: 'lesson-a.md' },
    };
    const second = {
      id: 'association-2',
      sourceId: 'b',
      targetId: 'a',
      type: 'explains',
      rationale: '作者态依据',
    };
    const result = projectKnowledgeGraphRelations([first, second]);

    expect(result.blocked).toBe(false);
    expect(result.visualEdges).toHaveLength(1);
    expect(result.visualEdges[0].contributingRelations).toHaveLength(2);
    expect(result.visualEdges[0].contributingRelations.map((relation) => relation.canonicalType)).toEqual([
      'supports',
      'informs',
    ]);
    expect(result.visualEdges[0].contributingRelations[0].rawRelation).toBe(first);
    expect(result.visualEdges[0].contributingRelations[1].rawRelation).toBe(second);
  });

  it('merges same-direction contributions and derives one explicit visual strength', () => {
    const result = projectKnowledgeGraphRelations([
      { id: 'post-weak', sourceId: 'a', targetId: 'b', type: 'prerequisite', strength: 0.4 },
      { id: 'post-strong', sourceId: 'a', targetId: 'b', type: 'leads_to', strength: 0.9 },
    ]);

    expect(result.blocked).toBe(false);
    expect(result.visualEdges).toHaveLength(1);
    expect(result.visualEdges[0]).toMatchObject({
      strength: 0.9,
      strengthPolicy: 'max-contributing-strength',
    });
    expect(result.visualEdges[0].contributingRelations.map((relation) => relation.strength)).toEqual([
      0.4,
      0.9,
    ]);
  });

  it('normalizes missing and non-finite strengths to null', () => {
    const result = projectKnowledgeGraphRelations([
      { id: 'missing', sourceId: 'a', targetId: 'b', type: 'related' },
      { id: 'nan', sourceId: 'a', targetId: 'b', type: 'supports', strength: Number.NaN },
      { id: 'infinity', sourceId: 'a', targetId: 'b', type: 'informs', strength: Number.POSITIVE_INFINITY },
    ]);

    expect(result.visualEdges[0].strength).toBeNull();
    expect(result.contributingRelations.map((relation) => relation.strength)).toEqual([null, null, null]);
  });

  it('preserves negative strengths and selects the greatest finite contribution', () => {
    const result = projectKnowledgeGraphRelations([
      { id: 'negative-low', sourceId: 'a', targetId: 'b', type: 'related', strength: -2 },
      { id: 'negative-high', sourceId: 'a', targetId: 'b', type: 'supports', strength: -1 },
    ]);

    expect(result.visualEdges[0].strength).toBe(-1);
    expect(result.contributingRelations.map((relation) => relation.strength)).toEqual([-2, -1]);
  });

  it('keeps equal strengths stable without creating another visual edge', () => {
    const result = projectKnowledgeGraphRelations([
      { id: 'equal-a', sourceId: 'a', targetId: 'b', type: 'related', strength: 0.5 },
      { id: 'equal-b', sourceId: 'b', targetId: 'a', type: 'supports', strength: 0.5 },
    ]);

    expect(result.visualEdges).toHaveLength(1);
    expect(result.visualEdges[0].strength).toBe(0.5);
    expect(result.visualEdges[0].contributingRelations.map((relation) => relation.relationId)).toEqual([
      'equal-a',
      'equal-b',
    ]);
  });

  it('escapes endpoint components so delimiter-bearing ids cannot collide', () => {
    const result = projectKnowledgeGraphRelations([
      { id: 'first', sourceId: 'a|b', targetId: 'c', type: 'related' },
      { id: 'second', sourceId: 'a', targetId: 'b|c', type: 'related' },
    ]);

    expect(result.visualEdges).toHaveLength(2);
    expect(new Set(result.visualEdges.map((edge) => edge.key)).size).toBe(2);
    expect(result.visualEdges.map((edge) => edge.key)).toEqual([
      'association|a%7Cb|c',
      'association|a|b%7Cc',
    ]);
  });

  it('blocks endpoint strings with isolated surrogates without throwing', () => {
    const result = projectKnowledgeGraphRelations([
      { id: 'invalid-unicode', sourceId: '\uD800', targetId: 'b', type: 'related' },
    ]);

    expect(result.blocked).toBe(true);
    expect(result.visualEdges).toEqual([]);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'INVALID_RELATION_ENDPOINT_ENCODING',
      blocking: true,
      relationIds: ['invalid-unicode'],
    }));
  });

  it('validates synthetic endpoint UTF-16 before chapter-link exclusion', () => {
    const sourceId = `chapter-node:${String.fromCharCode(0xd800)}`;
    const targetId = 'node-a';
    const result = projectKnowledgeGraphRelations([
      {
        id: `chapter-link:${sourceId}->${targetId}`,
        sourceId,
        targetId,
        type: 'contains',
      },
    ]);

    expect(result.blocked).toBe(true);
    expect(result.visualEdges).toEqual([]);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: 'INVALID_RELATION_ENDPOINT_ENCODING',
      blocking: true,
    }));
    expect(result.diagnostics).not.toContainEqual(expect.objectContaining({
      code: 'SYNTHETIC_CHAPTER_LINK_EXCLUDED',
    }));
  });

  it('orders association endpoints by locale-independent UTF-16 code units', () => {
    const result = projectKnowledgeGraphRelations([
      { id: 'locale-independent', sourceId: 'ä', targetId: 'z', type: 'related' },
    ]);

    expect(result.visualEdges[0]).toMatchObject({
      key: 'association|z|%C3%A4',
      sourceId: 'z',
      targetId: 'ä',
    });
  });

  it('keeps different families on the same endpoints as separate visual edges', () => {
    const result = projectKnowledgeGraphRelations([
      { id: 'child', sourceId: 'a', targetId: 'b', type: 'contains' },
      { id: 'post', sourceId: 'a', targetId: 'b', type: 'leads_to' },
      { id: 'association', sourceId: 'a', targetId: 'b', type: 'related' },
    ]);

    expect(result.blocked).toBe(false);
    expect(result.visualEdges.map((edge) => edge.key)).toEqual([
      'child|a|b',
      'post|a|b',
      'association|a|b',
    ]);
  });
});
