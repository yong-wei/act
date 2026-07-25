import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import { getRelationLabel } from '@/lib/knowledge-labels';
import {
  deriveKnowledgeGraphRelationEvidenceState,
  getKnowledgeGraphRelationContract,
  KNOWLEDGE_GRAPH_RELATION_CONTRACTS,
  projectKnowledgeGraphRelations,
} from '../graph/relation-contract';

describe('knowledge graph relation contract', () => {
  const associationContractFixtures = [
    ['causes', '因果作用', '本节点导致目标结果', '本节点由来源条件或机制导致'],
    ['demonstrates', '示范说明', '本节点展示目标性质或过程', '本节点由来源实例或表征展示'],
    ['equivalent_to', '条件等价', '本节点在已声明模型与条件下等价于目标', '本节点在已声明模型与条件下等价于来源'],
    ['exemplifies', '举例说明', '本节点是目标性质或概念的实例', '本节点由来源实例具体说明'],
    ['extends', '概念扩展', '本节点的既有概念扩展到目标', '本节点扩展来源概念的适用范围或变化维度'],
    ['has_stage', '过程阶段', '本节点过程包含目标阶段', '本节点是来源过程的一个状态或阶段'],
    ['precedes', '演化先后', '本节点在过程或参数演化中先于目标', '本节点在过程或参数演化中后于来源'],
    ['produces', '产生结果', '本节点产生目标现象或结果', '本节点由来源机制或状态产生'],
    ['provides_context', '提供语境', '本节点为目标提供理解语境', '本节点的理解语境由来源提供'],
    ['refined_by', '被精化', '本节点由目标进一步精化', '本节点进一步精化来源概念'],
    ['refines', '精化概念', '本节点进一步精化目标概念', '本节点由来源进一步精化'],
  ] as const;

  it.each(associationContractFixtures)(
    'defines the zero-instance %s association contract without learning-order semantics',
    (canonicalType, _label, source, target) => {
      expect(getKnowledgeGraphRelationContract(canonicalType)).toMatchObject({
        canonicalType,
        family: 'association',
        direction: 'unordered',
        detailSentence: { source, target },
      });
    }
  );

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

    expect(runtimeRelations).toHaveLength(16571);
    expect(first.blocked).toBe(false);
    expect(first.diagnostics).toEqual([]);
    expect(first).toEqual(second);

    const runtimeRelationKeys = new Set(runtimeRelations.map((relation) => [
      relation.source_id,
      relation.target_id,
      relation.relation_type,
    ].join('::')));
    const repairedIndependentRelations = [
      {
        duplicateId: '相位裕度直觉|超调量|new',
        repairedId: 'rel-7442cec3d3050d07',
        inferred: ['相位裕度直觉_5_L2c003', '超调量_4_bad49999', 'cross_domain'],
        reviewed: ['相位裕度直觉_5_L2c003', '超调量_3_fc3f5b17', 'cross_domain'],
      },
      {
        duplicateId: '自然频率|调节时间|new',
        repairedId: 'rel-8e69c8bcadde04ce',
        inferred: ['自然频率_3_ab7d6dc0', '调节时间_3_bc329c21', 'leads_to'],
        reviewed: ['自然频率_10_51a8b7d0', '调节时间_10_fcbccf4e', 'leads_to'],
      },
      {
        duplicateId: '调节时间|复平面可行域|new',
        repairedId: 'rel-bbc232259eca7c42',
        inferred: ['调节时间_3_bc329c21', '复平面可行域_4_Lsum001', 'cross_domain'],
        reviewed: ['调节时间_10_fcbccf4e', '复平面可行域_4_Lsum001', 'cross_domain'],
      },
      {
        duplicateId: 'rel-1a7ab41a342835de',
        repairedId: 'rel-28c96a22359801a0',
        inferred: ['超调量_4_bad49999', '时域指标到极点参数映射_3_13003', 'cross_domain'],
        reviewed: ['超调量_3_fc3f5b17', '时域指标到极点参数映射_3_13003', 'cross_domain'],
      },
      {
        duplicateId: 'rel-66570c2ff086f209',
        repairedId: 'rel-ce718c4a5291b4f6',
        inferred: ['阻尼比_3_b849784e', '调节时间_3_bc329c21', 'leads_to'],
        reviewed: ['阻尼比_3_b849784e', '调节时间_10_fcbccf4e', 'leads_to'],
      },
      {
        duplicateId: 'rel-6ab4c0be5e41bb63',
        repairedId: 'rel-016f51d02a8e3ffe',
        inferred: ['调节时间_3_bc329c21', '时域指标到极点参数映射_3_13003', 'cross_domain'],
        reviewed: ['调节时间_10_fcbccf4e', '时域指标到极点参数映射_3_13003', 'cross_domain'],
      },
      {
        duplicateId: 'rel-8b2033d899c32f9f',
        repairedId: 'rel-5528ea8f39da8b32',
        inferred: ['阻尼比_3_b849784e', '超调量_4_bad49999', 'leads_to'],
        reviewed: ['阻尼比_3_b849784e', '超调量_3_fc3f5b17', 'leads_to'],
      },
    ] as const;

    expect(repairedIndependentRelations).toHaveLength(7);
    const relationIds = runtimeRelations.map((relation) => relation.relation_id);
    for (const reason of repairedIndependentRelations) {
      expect(relationIds.filter((id) => id === reason.duplicateId)).toHaveLength(1);
      expect(relationIds.filter((id) => id === reason.repairedId)).toHaveLength(1);
      expect(runtimeRelationKeys).toContain(reason.inferred.join('::'));
      expect(runtimeRelationKeys).toContain(reason.reviewed.join('::'));
    }
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

describe('shared evidence availability derivation', () => {
  it('derives availability from evidence-bearing fields through one shared helper', () => {
    const base = { id: 'relation', sourceId: 'a', targetId: 'b', type: 'related' };

    expect(deriveKnowledgeGraphRelationEvidenceState({ ...base, rationale: '作者依据' })).toBe('available');
    expect(deriveKnowledgeGraphRelationEvidenceState(base)).toBe('unavailable');
  });

  it('honors an authoritative evidence_state declared by a governed projection', () => {
    const base = { id: 'relation', sourceId: 'a', targetId: 'b', type: 'related' };

    expect(deriveKnowledgeGraphRelationEvidenceState({ ...base, evidence_state: 'available' })).toBe('available');
    expect(
      deriveKnowledgeGraphRelationEvidenceState({ ...base, rationale: '作者依据', evidence_state: 'unavailable' })
    ).toBe('unavailable');
  });

  it('ignores invalid declared states instead of trusting them', () => {
    const base = { id: 'relation', sourceId: 'a', targetId: 'b', type: 'related' };

    expect(deriveKnowledgeGraphRelationEvidenceState({ ...base, evidence_state: 'bogus' })).toBe('unavailable');
    expect(
      deriveKnowledgeGraphRelationEvidenceState({ ...base, rationale: '作者依据', evidence_state: 42 })
    ).toBe('available');
  });

  it('keeps projection evidence states on the shared helper', () => {
    const result = projectKnowledgeGraphRelations([
      { id: 'declared-available', sourceId: 'a', targetId: 'b', type: 'related', evidence_state: 'available' },
      { id: 'declared-unavailable', sourceId: 'c', targetId: 'd', type: 'related', evidence_state: 'unavailable', rationale: '作者依据' },
    ]);

    expect(result.contributingRelations.map((relation) => relation.evidenceState)).toEqual([
      'available',
      'unavailable',
    ]);
  });
});

describe('canonical association relation type', () => {
  it('registers association with unordered association-family semantics and a label', () => {
    expect(getKnowledgeGraphRelationContract('association')).toMatchObject({
      canonicalType: 'association',
      family: 'association',
      direction: 'unordered',
      densityPolicy: expect.objectContaining({ scope: 'selected-one-hop' }),
      detailSentence: {
        source: '本节点与目标节点存在语义关联',
        target: '本节点与来源节点存在语义关联',
      },
    });
    expect(getRelationLabel('association')).toBe('语义关联');
  });

  it('round-trips the three-value projected relation vocabulary without contract violations', () => {
    const result = projectKnowledgeGraphRelations([
      { id: 'projected-contains', sourceId: 'a', targetId: 'b', type: 'contains' },
      { id: 'projected-prerequisite', sourceId: 'b', targetId: 'c', type: 'prerequisite' },
      { id: 'projected-association', sourceId: 'c', targetId: 'a', type: 'association' },
    ]);

    expect(result.blocked).toBe(false);
    expect(result.diagnostics).toEqual([]);
    expect(result.contributingRelations.map((relation) => [
      relation.canonicalType,
      relation.family,
      relation.direction,
    ])).toEqual([
      ['contains', 'child', 'parent-to-child'],
      ['prerequisite', 'post-requisite', 'earlier-to-later'],
      ['association', 'association', 'unordered'],
    ]);
  });

  it('deduplicates canonical association edges with unordered reverse identity', () => {
    const result = projectKnowledgeGraphRelations([
      { id: 'association-forward', sourceId: 'a', targetId: 'b', type: 'association' },
      { id: 'association-reverse', sourceId: 'b', targetId: 'a', type: 'association' },
    ]);

    expect(result.blocked).toBe(false);
    expect(result.visualEdges).toHaveLength(1);
    expect(result.visualEdges[0]).toMatchObject({
      key: 'association|a|b',
      family: 'association',
      direction: 'unordered',
    });
    expect(result.visualEdges[0].contributingRelations.map((relation) => relation.relationId)).toEqual([
      'association-forward',
      'association-reverse',
    ]);
  });

  it('keeps every previously registered canonical type unchanged', () => {
    const previouslyRegistered = {
      contains: ['child', 'parent-to-child'],
      prerequisite: ['post-requisite', 'earlier-to-later'],
      provides_foundation: ['post-requisite', 'earlier-to-later'],
      follows: ['post-requisite', 'earlier-to-later'],
      leads_to: ['post-requisite', 'earlier-to-later'],
      applies_to: ['association', 'unordered'],
      opposite: ['association', 'unordered'],
      related: ['association', 'unordered'],
      cross_domain: ['association', 'unordered'],
      generalizes: ['association', 'unordered'],
      instance_of: ['association', 'unordered'],
      supports: ['association', 'unordered'],
      enables: ['association', 'unordered'],
      complements: ['association', 'unordered'],
      contrasts_with: ['association', 'unordered'],
      derives: ['association', 'unordered'],
      describes_migration_of: ['association', 'unordered'],
      determines: ['association', 'unordered'],
      embodies: ['association', 'unordered'],
      informs: ['association', 'unordered'],
      quantified_by: ['association', 'unordered'],
      uses: ['association', 'unordered'],
      visualized_by: ['association', 'unordered'],
      causes: ['association', 'unordered'],
      demonstrates: ['association', 'unordered'],
      equivalent_to: ['association', 'unordered'],
      exemplifies: ['association', 'unordered'],
      extends: ['association', 'unordered'],
      has_stage: ['association', 'unordered'],
      precedes: ['association', 'unordered'],
      produces: ['association', 'unordered'],
      provides_context: ['association', 'unordered'],
      refined_by: ['association', 'unordered'],
      refines: ['association', 'unordered'],
    } as const;

    expect(Object.keys(previouslyRegistered)).toHaveLength(34);
    expect(
      KNOWLEDGE_GRAPH_RELATION_CONTRACTS
        .map((contract) => contract.canonicalType)
        .filter((canonicalType) => !(canonicalType in previouslyRegistered))
    ).toEqual(['association']);
    for (const [canonicalType, [family, direction]] of Object.entries(previouslyRegistered)) {
      expect(getKnowledgeGraphRelationContract(canonicalType)).toMatchObject({
        canonicalType,
        family,
        direction,
      });
    }
  });
});
