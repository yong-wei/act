import { describe, expect, it } from 'vitest';

import {
  DEFAULT_KNOWLEDGE_GRAPH_RELATION_FAMILIES,
  getAllFamiliesCheckedState,
  selectLearnerVisibleRelationEdges,
  toggleAllRelationFamilies,
  toggleRelationFamily,
} from '../graph/relation-family-controls';

describe('learner relation family controls', () => {
  it('defaults to post-requisite and association with child disabled', () => {
    expect(DEFAULT_KNOWLEDGE_GRAPH_RELATION_FAMILIES).toEqual([
      'post-requisite',
      'association',
    ]);
    expect(getAllFamiliesCheckedState(DEFAULT_KNOWLEDGE_GRAPH_RELATION_FAMILIES)).toBe('mixed');
  });

  it('turns a partial selection into all families and restores defaults from all', () => {
    const all = toggleAllRelationFamilies(['association']);

    expect(all).toEqual(['child', 'post-requisite', 'association']);
    expect(getAllFamiliesCheckedState(all)).toBe('true');
    expect(toggleAllRelationFamilies(all)).toEqual(DEFAULT_KNOWLEDGE_GRAPH_RELATION_FAMILIES);
  });

  it('exposes accurate unchecked and mixed states for individual family changes', () => {
    expect(getAllFamiliesCheckedState([])).toBe('false');
    expect(toggleRelationFamily(DEFAULT_KNOWLEDGE_GRAPH_RELATION_FAMILIES, 'post-requisite'))
      .toEqual(['association']);
    expect(toggleRelationFamily(DEFAULT_KNOWLEDGE_GRAPH_RELATION_FAMILIES, 'child'))
      .toEqual(['child', 'post-requisite', 'association']);
  });

  it('shows zero associations before selection and caps selected one-hop associations at 24', () => {
    const associationLinks = Array.from({ length: 30 }, (_, index) => ({
      id: index < 4
        ? ['association-z', 'association-a', 'association-m', 'association-b'][index]
        : `association-${String(index).padStart(2, '0')}`,
      sourceId: 'selected',
      targetId: `node-${index}`,
      relation: 'related',
      strength: index < 4 ? 0.95 : 0.8,
    }));
    const links = [
      ...associationLinks,
      { id: 'unrelated-association', sourceId: 'other-a', targetId: 'other-b', relation: 'related', strength: 1 },
      { id: 'post-edge', sourceId: 'selected', targetId: 'post', relation: 'prerequisite', strength: 0.2 },
    ];
    const activeDomainNodeIds = new Set([
      'selected',
      'post',
      'other-a',
      'other-b',
      ...associationLinks.map((link) => link.targetId),
    ]);

    const beforeSelection = selectLearnerVisibleRelationEdges({
      links,
      activeDomainNodeIds,
      enabledFamilies: DEFAULT_KNOWLEDGE_GRAPH_RELATION_FAMILIES,
      selectedNodeId: null,
    });
    expect(beforeSelection.map((edge) => edge.family)).toEqual(['post-requisite']);

    const afterSelection = selectLearnerVisibleRelationEdges({
      links,
      activeDomainNodeIds,
      enabledFamilies: DEFAULT_KNOWLEDGE_GRAPH_RELATION_FAMILIES,
      selectedNodeId: 'selected',
    });
    const associations = afterSelection.filter((edge) => edge.family === 'association');
    expect(associations).toHaveLength(24);
    expect(associations.slice(0, 4).flatMap((edge) => edge.relationIds)).toEqual([
      'association-a',
      'association-b',
      'association-m',
      'association-z',
    ]);
    expect(associations.every((edge) => edge.sourceId === 'selected' || edge.targetId === 'selected')).toBe(true);
    expect(associations.flatMap((edge) => edge.relationIds)).not.toContain('unrelated-association');
  });

  it('never leaks a previous-domain association through retry or cache reuse', () => {
    const links = [
      { id: 'domain-a-association', sourceId: 'a-selected', targetId: 'a-peer', relation: 'related', strength: 1 },
      { id: 'domain-b-association', sourceId: 'b-selected', targetId: 'b-peer', relation: 'related', strength: 0.7 },
    ];

    const domainBWithStaleSelection = selectLearnerVisibleRelationEdges({
      links,
      activeDomainNodeIds: new Set(['b-selected', 'b-peer']),
      enabledFamilies: ['association'],
      selectedNodeId: 'a-selected',
    });
    expect(domainBWithStaleSelection).toEqual([]);

    const domainBWithCurrentSelection = selectLearnerVisibleRelationEdges({
      links,
      activeDomainNodeIds: new Set(['b-selected', 'b-peer']),
      enabledFamilies: ['association'],
      selectedNodeId: 'b-selected',
    });
    expect(domainBWithCurrentSelection.flatMap((edge) => edge.relationIds)).toEqual([
      'domain-b-association',
    ]);
  });
});
