import { describe, expect, it } from 'vitest';

import type { CanvasProjection } from '@/lib/authoritative-knowledge';
import {
  CANDIDATE_GRAPH_SUPPORT,
  CANDIDATE_RELEASE_SELECTOR,
  getCandidatePredicatePresentation,
  getCandidateDetailDirectionLabel,
  getCandidateTypePresentation,
  resolveCandidateRelationDirection,
  selectCandidateGraphView,
} from '../candidate-graph-contracts';
import {
  isCandidateGraphPubliclyActivated,
  resolveCandidateGraphAccess,
} from '../candidate-graph-policy';

function projection(): CanvasProjection {
  return {
    projectionVersion: 'act.canvas.v2',
    source: {
      authorityState: 'candidate',
      releaseSetId: CANDIDATE_RELEASE_SELECTOR.releaseSetId,
      releaseId: CANDIDATE_RELEASE_SELECTOR.releaseId,
      productionAuthoritative: false,
      historical: false,
      releaseHash: 'b'.repeat(64),
      schemaVersion: '0.2.0',
      projectionDigest: 'f324255fd77cf5bf3bacf4cc55a7a082faca3339fff2b8410ddca37a00226255',
      sourceDatasetHash: 'd'.repeat(64),
    },
    release: {
      label: '控制理论工程聚合发布版',
      version: 'v0.2',
      scope: 'control-theory-engineering',
    },
    fields: {
      included: ['node.id', 'relation.direction'],
      hidden: ['node.payload', 'artifact.bytes'],
    },
    coverage: {
      status: 'partial',
      objectCount: 3,
      relationCount: 2,
      goldRelationCount: 1,
      silverRelationCount: 1,
      sourceObjectCount: 0,
      evidenceSegmentCount: 0,
      releaseEntryCount: 5,
      goldNodeCount: 2,
      silverNodeCount: 1,
      upstreamRagReferenceCount: 1,
    },
    teachingSemantics: {
      status: 'unavailable',
      message: '教学关系尚未发布',
    },
    nodes: [
      {
        id: 'concept',
        canonicalType: 'DomainConcept',
        label: '根轨迹',
        description: null,
        governance: {
          reviewStatus: 'approved',
          publicationStatus: 'published',
          lifecycleStatus: null,
        },
        releaseTier: 'gold',
        candidate: false,
        semanticName: 'root_locus',
        sourceCoverageCount: 2,
        conceptKind: 'analysis_method',
        semanticSupport: { supported: true, readOnly: true },
      },
      {
        id: 'formula',
        canonicalType: 'Formula',
        label: '特征方程',
        description: null,
        governance: {
          reviewStatus: 'approved',
          publicationStatus: 'published',
          lifecycleStatus: null,
        },
        releaseTier: 'gold',
        candidate: false,
        semanticName: 'characteristic_equation',
        sourceCoverageCount: 1,
        conceptKind: null,
        semanticSupport: { supported: true, readOnly: true },
      },
      {
        id: 'future',
        canonicalType: 'FutureSchemaType',
        label: '未来对象',
        description: null,
        governance: {
          reviewStatus: 'approved',
          publicationStatus: 'published',
          lifecycleStatus: null,
        },
        releaseTier: 'silver',
        candidate: false,
        semanticName: null,
        sourceCoverageCount: 0,
        conceptKind: null,
        semanticSupport: { supported: false, readOnly: true },
      },
    ],
    relations: [
      {
        id: 'gold',
        predicate: 'is_a',
        sourceId: 'concept',
        targetId: 'formula',
        direction: 'source_to_target',
        direct: null,
        qualityTier: 'GOLD',
        governance: { reviewStatus: null, publicationStatus: null },
        relationFamily: 'domain_semantic',
        evidenceState: 'available',
        releaseTier: 'gold',
        semanticSupport: { supported: true, readOnly: true },
      },
      {
        id: 'silver',
        predicate: 'future_predicate',
        sourceId: 'future',
        targetId: 'concept',
        direction: 'source_to_target',
        direct: null,
        qualityTier: 'SILVER',
        governance: { reviewStatus: null, publicationStatus: null },
        relationFamily: 'domain_semantic',
        evidenceState: 'available',
        releaseTier: 'silver',
        semanticSupport: { supported: false, readOnly: true },
      },
    ],
  };
}

describe('candidate authoritative graph contracts', () => {
  it('fixes the selector on the aggregate ReleaseSet and current semantic support vocabulary', () => {
    expect(CANDIDATE_RELEASE_SELECTOR).toEqual({
      authorityState: 'candidate',
      releaseSetId: 'actkg-authoritative-candidate-v2',
      releaseId: 'control-theory-engineering-v0.2',
    });
    expect(CANDIDATE_GRAPH_SUPPORT.supportedObjectTypes).toEqual([
      'DomainConcept',
      'Formula',
      'KnowledgeStatement',
      'SystemModel',
    ]);
    expect(CANDIDATE_GRAPH_SUPPORT.supportedPredicates).toEqual([
      'association',
      'applies_to',
      'derived_from',
      'has_component',
      'has_formula',
      'has_representation',
      'is_a',
      'part_of',
      'used_to_analyze',
    ]);
  });

  it('renders four known types and preserves an upstream generic type', () => {
    expect(getCandidateTypePresentation('DomainConcept')).toMatchObject({
      label: '领域概念',
      generic: false,
    });
    expect(getCandidateTypePresentation('Formula').label).toBe('公式');
    expect(getCandidateTypePresentation('KnowledgeStatement').label).toBe('知识陈述');
    expect(getCandidateTypePresentation('SystemModel').label).toBe('系统模型');
    expect(getCandidateTypePresentation('FutureSchemaType')).toEqual({
      canonicalType: 'FutureSchemaType',
      label: 'FutureSchemaType',
      tone: 'generic',
      generic: true,
    });
  });

  it('registers exact Chinese predicate, direction, line style, and explanation contracts for all nine aggregate predicates', () => {
    expect([
      ['association', '关联', 'undirected', 'dashed'],
      ['applies_to', '适用于', 'source-to-target', 'dashed'],
      ['derived_from', '推导自', 'source-to-target', 'solid'],
      ['has_component', '包含组成部分', 'source-to-target', 'solid'],
      ['has_formula', '具有公式', 'source-to-target', 'solid'],
      ['has_representation', '具有表示', 'source-to-target', 'solid'],
      ['is_a', '属于', 'source-to-target', 'solid'],
      ['part_of', '组成部分', 'source-to-target', 'solid'],
      ['used_to_analyze', '用于分析', 'source-to-target', 'dotted'],
    ].map(([predicate, label, direction, lineStyle]) => {
      const presentation = getCandidatePredicatePresentation(predicate);
      return {
        predicate: presentation.predicate,
        label: presentation.label,
        direction: presentation.direction,
        lineStyle: presentation.lineStyle,
        registered: presentation.registered,
        explained: presentation.explanation.length > 0,
      };
    })).toEqual([
      { predicate: 'association', label: '关联', direction: 'undirected', lineStyle: 'dashed', registered: true, explained: true },
      { predicate: 'applies_to', label: '适用于', direction: 'source-to-target', lineStyle: 'dashed', registered: true, explained: true },
      { predicate: 'derived_from', label: '推导自', direction: 'source-to-target', lineStyle: 'solid', registered: true, explained: true },
      { predicate: 'has_component', label: '包含组成部分', direction: 'source-to-target', lineStyle: 'solid', registered: true, explained: true },
      { predicate: 'has_formula', label: '具有公式', direction: 'source-to-target', lineStyle: 'solid', registered: true, explained: true },
      { predicate: 'has_representation', label: '具有表示', direction: 'source-to-target', lineStyle: 'solid', registered: true, explained: true },
      { predicate: 'is_a', label: '属于', direction: 'source-to-target', lineStyle: 'solid', registered: true, explained: true },
      { predicate: 'part_of', label: '组成部分', direction: 'source-to-target', lineStyle: 'solid', registered: true, explained: true },
      { predicate: 'used_to_analyze', label: '用于分析', direction: 'source-to-target', lineStyle: 'dotted', registered: true, explained: true },
    ]);
    expect(getCandidatePredicatePresentation('future_predicate')).toMatchObject({
      label: 'future_predicate',
      registered: false,
      direction: null,
    });
    expect(getCandidatePredicatePresentation('represented_by').registered).toBe(false);
  });

  it('keeps association undirected at both endpoints and normalizes upstream raw directions', () => {
    const association = resolveCandidateRelationDirection(
      getCandidatePredicatePresentation('association'),
      'unordered',
    );
    expect(association).toMatchObject({ kind: 'undirected', label: '无向/双向' });
    expect(getCandidateDetailDirectionLabel({
      direction: association,
      traversal: 'outgoing',
    })).toBe('无向/双向');
    expect(getCandidateDetailDirectionLabel({
      direction: association,
      traversal: 'incoming',
    })).toBe('无向/双向');

    const directed = resolveCandidateRelationDirection(
      getCandidatePredicatePresentation('is_a'),
      'source_to_target',
    );
    expect(directed).toMatchObject({ kind: 'directed', rawDirection: 'source_to_target' });
    expect(getCandidateDetailDirectionLabel({
      direction: directed,
      traversal: 'outgoing',
    })).toBe('出向（来源→目标）');
    expect(getCandidateDetailDirectionLabel({
      direction: directed,
      traversal: 'incoming',
    })).toBe('入向（来源→目标）');

    const unknown = resolveCandidateRelationDirection(
      getCandidatePredicatePresentation('future_predicate'),
      'target-first-custom',
    );
    expect(unknown).toEqual({
      kind: 'unknown',
      label: '原始方向：target-first-custom',
      rawDirection: 'target-first-custom',
    });
    expect(getCandidateDetailDirectionLabel({
      direction: unknown,
      traversal: 'outgoing',
    })).toBe('原始方向：target-first-custom');

    // 本地登记不得静默覆盖上游 raw direction：即使 association 登记为无向，
    // raw source_to_target 仍按有向保留展示。
    const rawDirectedAssociation = resolveCandidateRelationDirection(
      getCandidatePredicatePresentation('association'),
      'source_to_target',
    );
    expect(rawDirectedAssociation).toMatchObject({
      kind: 'directed',
      rawDirection: 'source_to_target',
    });

    // raw 未声明时不得从本地登记推断方向。
    const undeclared = resolveCandidateRelationDirection(
      getCandidatePredicatePresentation('is_a'),
      null,
    );
    expect(undeclared).toEqual({
      kind: 'unknown',
      label: '原始方向未声明',
      rawDirection: null,
    });
  });

  it('keeps one-hop heterogeneous context and derives core versus extension from aggregate release tiers', () => {
    const extension = selectCandidateGraphView(projection(), {
      canonicalType: 'DomainConcept',
      governance: 'EXTENSION',
    });
    expect(extension.nodes.map((node) => node.id)).toEqual(['concept', 'formula', 'future']);
    expect(extension.relations.map((relation) => relation.id)).toEqual(['gold', 'silver']);

    const core = selectCandidateGraphView(projection(), {
      canonicalType: 'DomainConcept',
      governance: 'CORE',
    });
    expect(core.nodes.map((node) => node.id)).toEqual(['concept', 'formula']);
    expect(core.relations.map((relation) => relation.id)).toEqual(['gold']);

    const coreAll = selectCandidateGraphView(projection(), {
      canonicalType: null,
      governance: 'CORE',
    });
    expect(coreAll.nodes.map((node) => node.id)).toEqual(['concept', 'formula']);
    expect(coreAll.nodes.every((node) => node.releaseTier === 'gold')).toBe(true);
    expect(coreAll.relations.map((relation) => relation.id)).toEqual(['gold']);

    const extensionAll = selectCandidateGraphView(projection(), {
      canonicalType: null,
      governance: 'EXTENSION',
    });
    expect(extensionAll.nodes.map((node) => node.id)).toEqual(['concept', 'formula', 'future']);
    expect(extensionAll.relations.map((relation) => relation.id)).toEqual(['gold', 'silver']);
  });
});

describe('candidate graph activation policy', () => {
  it('requires V2 and Konling acceptance on the same fixed ReleaseSet', () => {
    expect(isCandidateGraphPubliclyActivated({})).toBe(false);
    expect(isCandidateGraphPubliclyActivated({
      AUTHORITATIVE_KNOWLEDGE_GRAPH_PUBLIC_ACTIVATION: 'false',
    })).toBe(false);
    expect(isCandidateGraphPubliclyActivated({
      AUTHORITATIVE_KNOWLEDGE_GRAPH_PUBLIC_ACTIVATION: 'true',
    })).toBe(false);
    expect(isCandidateGraphPubliclyActivated({
      AUTHORITATIVE_KNOWLEDGE_GRAPH_PUBLIC_ACTIVATION: 'TRUE',
      AUTHORITATIVE_KNOWLEDGE_GRAPH_V2_ACCEPTED_RELEASE_SET_ID: CANDIDATE_RELEASE_SELECTOR.releaseSetId,
      AUTHORITATIVE_KNOWLEDGE_GRAPH_KONLING_ACCEPTED_RELEASE_SET_ID: CANDIDATE_RELEASE_SELECTOR.releaseSetId,
    })).toBe(false);
    expect(isCandidateGraphPubliclyActivated({
      AUTHORITATIVE_KNOWLEDGE_GRAPH_PUBLIC_ACTIVATION: 'true',
      AUTHORITATIVE_KNOWLEDGE_GRAPH_V2_ACCEPTED_RELEASE_SET_ID: CANDIDATE_RELEASE_SELECTOR.releaseSetId,
    })).toBe(false);
    expect(isCandidateGraphPubliclyActivated({
      AUTHORITATIVE_KNOWLEDGE_GRAPH_PUBLIC_ACTIVATION: 'true',
      AUTHORITATIVE_KNOWLEDGE_GRAPH_V2_ACCEPTED_RELEASE_SET_ID: 'different-release-set',
      AUTHORITATIVE_KNOWLEDGE_GRAPH_KONLING_ACCEPTED_RELEASE_SET_ID: CANDIDATE_RELEASE_SELECTOR.releaseSetId,
    })).toBe(false);
    expect(isCandidateGraphPubliclyActivated({
      AUTHORITATIVE_KNOWLEDGE_GRAPH_PUBLIC_ACTIVATION: 'true',
      AUTHORITATIVE_KNOWLEDGE_GRAPH_V2_ACCEPTED_RELEASE_SET_ID: CANDIDATE_RELEASE_SELECTOR.releaseSetId,
      AUTHORITATIVE_KNOWLEDGE_GRAPH_KONLING_ACCEPTED_RELEASE_SET_ID: 'different-release-set',
    })).toBe(false);
    expect(isCandidateGraphPubliclyActivated({
      AUTHORITATIVE_KNOWLEDGE_GRAPH_PUBLIC_ACTIVATION: 'true',
      AUTHORITATIVE_KNOWLEDGE_GRAPH_V2_ACCEPTED_RELEASE_SET_ID: CANDIDATE_RELEASE_SELECTOR.releaseSetId,
      AUTHORITATIVE_KNOWLEDGE_GRAPH_KONLING_ACCEPTED_RELEASE_SET_ID: CANDIDATE_RELEASE_SELECTOR.releaseSetId,
    })).toBe(true);
  });

  it('keeps the fixed candidate diagnostic administrator-only after activation', () => {
    expect(resolveCandidateGraphAccess('STUDENT', false).allowed).toBe(false);
    expect(resolveCandidateGraphAccess('TEACHER', false).allowed).toBe(false);
    expect(resolveCandidateGraphAccess('ADMIN', false)).toMatchObject({
      allowed: true,
      controlledVerification: true,
    });
    expect(resolveCandidateGraphAccess('STUDENT', true).allowed).toBe(false);
    expect(resolveCandidateGraphAccess('TEACHER', true).allowed).toBe(false);
    expect(resolveCandidateGraphAccess('ADMIN', true).allowed).toBe(true);
    expect(resolveCandidateGraphAccess('UNKNOWN', true)).toEqual({
      allowed: false,
      role: null,
      controlledVerification: false,
    });
  });
});
