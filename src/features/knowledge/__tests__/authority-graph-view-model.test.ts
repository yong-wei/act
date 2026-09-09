import { describe, expect, it } from 'vitest';

import {
  assertRejectsLegacyGraphDto,
  createAuthorityGraphViewModel,
  filterViewModelPreservingIdentities,
  toSharedRuntimeRelationType,
} from '../authority-graph-view-model';
import {
  createEmptyGraphRuntimeSession,
  createGraphRuntimeSessionStore,
} from '../graph-runtime-session';
import type { ActiveCanvasNode, ActiveCanvasRelation } from '../active-authority-graph-contracts';

function node(id: string, canonicalType: string, label: string): ActiveCanvasNode {
  return {
    id,
    canonicalType,
    label,
    aliases: [],
    description: null,
    governance: { reviewStatus: null, publicationStatus: null, lifecycleStatus: null },
    semanticSupport: { supported: true, readOnly: true },
  };
}

function relation(id: string, predicate: string, sourceId: string, targetId: string): ActiveCanvasRelation {
  return {
    id,
    predicate,
    sourceId,
    targetId,
    direction: 'source_to_target',
    direct: null,
    qualityTier: 'GOLD',
    governance: { reviewStatus: null, publicationStatus: null },
    semanticSupport: { supported: true, readOnly: true },
    layer: 'ACT_TEACHING',
    relationFamily: 'teaching-prerequisite',
  };
}

describe('authority graph view model', () => {
  it('shows equivalent prerequisites once while preserving both sources and strength', () => {
    const teaching = { ...relation('teaching', 'PREREQUISITE', 'ctc:a', 'ctc:b'), strength: 'REQUIRED' as const };
    const engineering = { ...relation('engineering', 'prerequisite', 'ctc:a', 'ctc:b'), layer: 'ENGINEERING' as const, relationFamily: 'prerequisite-order' };
    const view = createAuthorityGraphViewModel({
      nodes: [node('ctc:a', 'DomainConcept', '自然频率'), node('ctc:b', 'DomainConcept', '峰值时间')],
      relations: [engineering, teaching],
      enabledRelationFamilies: ['teaching-prerequisite', 'prerequisite-order'],
    });
    expect(view.edges).toHaveLength(1);
    expect(view.edges[0].sources?.map((source) => source.id).sort()).toEqual(['engineering', 'teaching']);
    expect(view.edges[0].sources?.find((source) => source.id === 'teaching')?.strength).toBe('REQUIRED');
    expect(view.edges[0].sourceId).toBe('ctc:a');
    expect(view.edges[0].targetId).toBe('ctc:b');
  });

  it('rejects legacy graph DTOs and omits unavailable names', () => {
    expect(() => assertRejectsLegacyGraphDto({ id: 'x', positionX: 1 })).toThrow(/legacy graph DTO/);
    const view = createAuthorityGraphViewModel({
      nodes: [
        node('ctc:a', 'DomainConcept', '稳定性'),
        node('ctc:missing', 'DomainConcept', 'ctc:missing'),
      ],
      relations: [relation('edge-1', 'PREREQUISITE', 'ctc:a', 'ctc:missing')],
    });
    expect(view.nodes.map((row) => row.canonicalId)).toEqual(['ctc:a']);
    expect(view.edges).toHaveLength(0);
    expect(view.rootNavigation).toEqual([]);
  });

  it('keeps every formal visual family and card star without a second text marker', () => {
    const view = createAuthorityGraphViewModel({
      nodes: [node('ctc:a', 'DomainConcept', '稳定性')],
      relations: [],
      bindings: [
        { canonicalId: 'ctc:a', subtype: 'video', current: true, accessible: true },
        { canonicalId: 'ctc:a', subtype: 'card', current: true, accessible: true },
        { canonicalId: 'ctc:a', subtype: 'exercise', current: true, accessible: true },
        { canonicalId: 'ctc:a', subtype: 'handout', current: false, accessible: true },
      ],
      crossDomainCanonicalIds: ['ctc:a'],
    });
    expect(view.nodes[0]?.decoration.hasCardStar).toBe(true);
    expect(view.nodes[0]?.decoration.hasCrossDomainHalo).toBe(true);
    expect(view.nodes[0]?.decoration.visualFamilies).toEqual(['exercise', 'media']);
    expect(view.nodes[0]?.decoration.glyphRadius).toBeGreaterThanOrEqual(14);
    expect(view.nodes[0]?.decoration.glyphRadius).toBeLessThanOrEqual(24);
  });

  it('filters node types and families without changing remaining identities', () => {
    const view = createAuthorityGraphViewModel({
      nodes: [
        node('ctc:a', 'DomainConcept', '稳定性'),
        node('ctc:b', 'Formula', '特征方程'),
      ],
      relations: [relation('edge-1', 'PREREQUISITE', 'ctc:a', 'ctc:b')],
    });
    const filtered = filterViewModelPreservingIdentities(view, {
      enabledNodeTypes: ['DomainConcept'],
    });
    expect(filtered.nodes.map((row) => row.canonicalId)).toEqual(['ctc:a']);
    expect(filtered.edges).toHaveLength(0);
    expect(view.nodes[0]?.canonicalId).toBe('ctc:a');
  });

  it('maps Authority teaching and engineering families onto known shared runtime relation types', () => {
    expect(toSharedRuntimeRelationType({
      predicate: 'PREREQUISITE',
      relationFamily: 'teaching-prerequisite',
    })).toBe('prerequisite');
    expect(toSharedRuntimeRelationType({
      predicate: 'has_component',
      relationFamily: 'structure',
    })).toBe('contains');
    expect(toSharedRuntimeRelationType({
      predicate: 'derived_from',
      relationFamily: 'derivation-and-representation',
    })).toBe('derived_from');
    expect(toSharedRuntimeRelationType({
      predicate: 'part_of',
      relationFamily: 'structure',
    })).toBe('part_of');
    expect(toSharedRuntimeRelationType({
      predicate: 'unknown_act_predicate',
      relationFamily: 'structure',
    })).toBe('related');
  });
});

describe('graph runtime session isolation', () => {
  it('restores each data mode independently without label mapping', () => {
    const store = createGraphRuntimeSessionStore();
    store.write('active', { selectedNodeId: 'ctc:a', cameraKey: 'active-cam' });
    store.write('legacy', { selectedNodeId: 'legacy-1', cameraKey: 'legacy-cam' });
    expect(store.restore('active').selectedNodeId).toBe('ctc:a');
    expect(store.restore('legacy').selectedNodeId).toBe('legacy-1');
    expect(createEmptyGraphRuntimeSession().selectedNodeId).toBeNull();
  });
});
