import { describe, expect, it } from 'vitest';

import type { ActiveCanvasNode, ActiveCanvasRelation } from '../active-authority-graph-contracts';
import {
  activeNodeRelationSummaries,
  activeNodeSearch,
  createActiveAuthorityGraphModel,
  expandActiveAuthorityOneHop,
  materializeActiveNodeScope,
  presentActiveNodeType,
  presentActiveRelation,
  presentGovernanceLabel,
  presentSourceCitation,
  selectInitialPrimaryDomainScope,
  selectInitialScope,
  visibleActiveGraph,
} from '../active-authority-presentation';

function node(id: string, canonicalType: string, label = id, aliases: readonly string[] = []): ActiveCanvasNode {
  return {
    id,
    canonicalType,
    label,
    aliases,
    description: null,
    governance: { reviewStatus: null, publicationStatus: null, lifecycleStatus: null },
    semanticSupport: { supported: true, readOnly: true },
  };
}

function relation(id: string, predicate: string, sourceId: string, targetId: string, direction: string | null): ActiveCanvasRelation {
  return {
    id,
    predicate,
    sourceId,
    targetId,
    direction,
    direct: null,
    qualityTier: 'GOLD',
    governance: { reviewStatus: null, publicationStatus: null },
    semanticSupport: { supported: true, readOnly: true },
  };
}

describe('active Authority presentation adapter', () => {
  it('uses controlled semantic vocabulary and fails closed for unknown values', () => {
    expect(presentActiveNodeType('DomainConcept')).toMatchObject({ label: '领域概念', supported: true });
    expect(presentActiveNodeType('internal_node_type')).toMatchObject({ label: '类型暂不可解释', supported: false });
    expect(presentActiveNodeType('internal_node_type').label).not.toContain('internal_node_type');
    expect(JSON.stringify(presentActiveNodeType('internal_node_type'))).not.toContain('internal_node_type');
    expect(presentActiveRelation('association', 'unordered')).toMatchObject({ label: '关联', kind: 'undirected', supported: true });
    expect(presentActiveRelation('applies_to', 'source_to_target')).toMatchObject({ label: '适用于', kind: 'directed', supported: true });
    expect(presentActiveRelation('internal_predicate', 'internal_direction')).toMatchObject({ label: '关系暂不可解释', supported: false });
    expect(presentActiveRelation('internal_predicate', 'internal_direction').directionLabel).not.toContain('internal_');
    expect(JSON.stringify(presentActiveRelation('internal_predicate', 'internal_direction'))).not.toContain('internal_');
  });

  it('keeps only valid nodes and exact real edges with deterministic adjacency', () => {
    const response = {
      nodes: [
        node('b', 'Formula', '公式 B'), node('a', 'DomainConcept', '概念 A'), node('isolated', 'KnowledgeStatement', '孤立对象'),
        node('unknown', 'future_type', 'unknown'), node('same-as-key', 'SystemModel', 'same-as-key'),
      ],
      relations: [
        relation('edge-b', 'association', 'a', 'b', 'unordered'),
        relation('edge-a', 'applies_to', 'b', 'a', 'source_to_target'),
        relation('edge-unknown', 'internal_predicate', 'a', 'b', 'source_to_target'),
        relation('edge-missing-endpoint', 'association', 'a', 'missing', 'unordered'),
      ],
    };
    const model = createActiveAuthorityGraphModel(response);
    expect(model.nodes.map((item) => item.key)).toEqual(['a', 'b', 'isolated']);
    expect(model.relations.map((item) => item.key)).toEqual(['edge-a', 'edge-b']);
    expect(model.adjacency.get('a')?.map((item) => item.key)).toEqual(['edge-a', 'edge-b']);
    expect(model.adjacency.get('isolated')).toEqual([]);
    expect(model.omittedNodeCount).toBe(2);
    expect(model.omittedRelationCount).toBe(2);
  });

  it('selects a deterministic connected entry and materializes only a direct one-hop search neighborhood', () => {
    const model = createActiveAuthorityGraphModel({
      nodes: [node('z', 'DomainConcept', 'Z'), node('a', 'DomainConcept', 'A'), node('b', 'Formula', 'B'), node('isolated', 'KnowledgeStatement', '孤立')],
      relations: [relation('edge', 'association', 'a', 'b', 'unordered')],
    });
    expect([...selectInitialScope(model, 2)]).toEqual(['a', 'b']);
    expect([...materializeActiveNodeScope(model, 'isolated', 4)]).toEqual(['isolated']);
    expect(activeNodeSearch(model, '孤立').map((item) => item.key)).toEqual(['isolated']);
    expect(activeNodeSearch(model, '', 'Formula').map((item) => item.key)).toEqual(['b']);
    expect([...expandActiveAuthorityOneHop(model, new Set(['a']), 'a', 3)]).toEqual(['a', 'b']);
    expect(visibleActiveGraph(model, new Set(['a', 'missing'])).relations).toEqual([]);
  });

  it('searches localized aliases while retaining canonical id selection', () => {
    const model = createActiveAuthorityGraphModel({
      nodes: [node('stable-id', 'DomainConcept', '稳定性', ['系统稳定', 'stability'])],
      relations: [],
    });
    expect(activeNodeSearch(model, '系统稳定').map((item) => item.key)).toEqual(['stable-id']);
    expect(activeNodeSearch(model, 'stability')[0]).toMatchObject({
      key: 'stable-id',
      label: '稳定性',
      aliases: ['系统稳定', 'stability'],
    });
  });

  it('keeps Formula and KnowledgeStatement out of the initial domain layer while retaining them for explicit disclosure', () => {
    const model = createActiveAuthorityGraphModel({
      nodes: [
        node('concept', 'DomainConcept', '概念'),
        node('model', 'SystemModel', '模型'),
        node('formula', 'Formula', '公式'),
        node('statement', 'KnowledgeStatement', '陈述'),
      ],
      relations: [
        relation('teaching', 'association', 'concept', 'model', 'unordered'),
        relation('formula-link', 'association', 'concept', 'formula', 'unordered'),
      ],
    });
    expect([...selectInitialPrimaryDomainScope(model, 8)]).toEqual(['concept', 'model']);
    expect(activeNodeSearch(model, '', 'Formula').map((item) => item.key)).toEqual(['formula']);
    expect([...materializeActiveNodeScope(model, 'formula', 4)]).toContain('formula');
  });

  it('slides a saturated scope to reveal the selected boundary node next hop', () => {
    const nodes = Array.from({ length: 26 }, (_, index) => node(`n${String(index).padStart(2, '0')}`, 'DomainConcept', `节点 ${index}`));
    const relations = nodes.slice(0, -1).map((current, index) => relation(`edge-${index}`, 'association', current.id, nodes[index + 1].id, 'unordered'));
    const model = createActiveAuthorityGraphModel({ nodes, relations });
    const direct = materializeActiveNodeScope(model, 'n13', 24);
    expect([...direct]).toEqual(['n13', 'n12', 'n14']);
    expect(direct.has('n11')).toBe(false);

    const saturated = new Set(nodes.slice(0, 24).map((item) => item.id));
    const slid = expandActiveAuthorityOneHop(model, saturated, 'n23', 24);
    expect(slid.size).toBe(3);
    expect([...slid]).toEqual(['n23', 'n22', 'n24']);
    expect(slid.has('n24')).toBe(true);
    expect([...slid].some((key) => key === 'n25')).toBe(false);
  });

  it('projects detail adjacency with semantic neighbor labels and controlled source fallback', () => {
    const model = createActiveAuthorityGraphModel({
      nodes: [node('a', 'DomainConcept', '概念 A'), node('b', 'Formula', '公式 B')],
      relations: [relation('edge', 'association', 'a', 'b', 'unordered')],
    });
    const summaries = activeNodeRelationSummaries({
      id: 'a', canonicalType: 'DomainConcept', label: '概念 A', description: null,
      adjacency: [{ relationId: 'edge', predicate: 'association', direction: 'unordered', qualityTier: 'GOLD', neighborId: 'b', traversal: 'outgoing', readOnly: true }],
      sources: [{ sourceEditionId: 'internal-edition', sectionId: 'internal-section' }],
      semanticSupport: { supported: true, readOnly: true },
    }, model);
    expect(summaries).toEqual([expect.objectContaining({ relationLabel: '关联', neighborLabel: '公式 B' })]);
    expect(JSON.stringify(summaries)).not.toContain('internal_');
    expect(presentSourceCitation([{ sourceEditionId: 'internal-edition', sectionId: 'internal-section' }])).toBe('来源定位暂不可用');
    expect(presentGovernanceLabel('internal_status')).toBe('状态暂不可解释');
  });
});
