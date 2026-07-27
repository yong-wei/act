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
    },
    release: {
      label: '根轨迹局部发布版',
      version: 'v0.1',
      scope: 'root-locus',
    },
    coverage: {
      status: 'partial',
      objectCount: 3,
      relationCount: 2,
      goldRelationCount: 1,
      silverRelationCount: 1,
      sourceObjectCount: 1,
      evidenceSegmentCount: 1,
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
          reviewStatus: 'REVIEWED',
          publicationStatus: 'PUBLISHED',
          lifecycleStatus: 'ACTIVE',
        },
        semanticSupport: { supported: true, readOnly: true },
      },
      {
        id: 'formula',
        canonicalType: 'Formula',
        label: '特征方程',
        description: null,
        governance: {
          reviewStatus: 'REVIEWED',
          publicationStatus: 'PUBLISHED',
          lifecycleStatus: 'ACTIVE',
        },
        semanticSupport: { supported: true, readOnly: true },
      },
      {
        id: 'future',
        canonicalType: 'FutureSchemaType',
        label: '未来对象',
        description: null,
        governance: {
          reviewStatus: 'REVIEWED',
          publicationStatus: 'PUBLISHED',
          lifecycleStatus: 'ACTIVE',
        },
        semanticSupport: { supported: false, readOnly: true },
      },
    ],
    relations: [
      {
        id: 'gold',
        predicate: 'represented_by',
        sourceId: 'concept',
        targetId: 'formula',
        direction: null,
        direct: true,
        qualityTier: 'GOLD',
        governance: { reviewStatus: 'REVIEWED', publicationStatus: 'PUBLISHED' },
        semanticSupport: { supported: true, readOnly: true },
      },
      {
        id: 'silver',
        predicate: 'future_predicate',
        sourceId: 'future',
        targetId: 'concept',
        direction: null,
        direct: true,
        qualityTier: 'SILVER',
        governance: { reviewStatus: 'REVIEWED', publicationStatus: 'PUBLISHED' },
        semanticSupport: { supported: false, readOnly: true },
      },
    ],
  };
}

describe('candidate authoritative graph contracts', () => {
  it('fixes the selector and current semantic support vocabulary', () => {
    expect(CANDIDATE_RELEASE_SELECTOR).toEqual({
      authorityState: 'candidate',
      releaseSetId: 'actkg-authoritative-candidate-v1',
      releaseId: 'root-locus-engineering-v0.1',
    });
    expect(CANDIDATE_GRAPH_SUPPORT.supportedObjectTypes).toEqual([
      'DomainConcept',
      'Formula',
      'KnowledgeStatement',
      'SystemModel',
    ]);
    expect(CANDIDATE_GRAPH_SUPPORT.supportedPredicates).toHaveLength(6);
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

  it('registers exact Chinese predicate, direction, line style, and explanation contracts', () => {
    expect([
      ['association', '关联', 'undirected', 'dashed'],
      ['represented_by', '表示为', 'source-to-target', 'solid'],
      ['applies_to', '适用于', 'source-to-target', 'dashed'],
      ['derived_from', '推导自', 'source-to-target', 'solid'],
      ['used_to_analyze', '用于分析', 'source-to-target', 'dotted'],
      ['is_a', '属于', 'source-to-target', 'solid'],
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
      { predicate: 'represented_by', label: '表示为', direction: 'source-to-target', lineStyle: 'solid', registered: true, explained: true },
      { predicate: 'applies_to', label: '适用于', direction: 'source-to-target', lineStyle: 'dashed', registered: true, explained: true },
      { predicate: 'derived_from', label: '推导自', direction: 'source-to-target', lineStyle: 'solid', registered: true, explained: true },
      { predicate: 'used_to_analyze', label: '用于分析', direction: 'source-to-target', lineStyle: 'dotted', registered: true, explained: true },
      { predicate: 'is_a', label: '属于', direction: 'source-to-target', lineStyle: 'solid', registered: true, explained: true },
    ]);
    expect(getCandidatePredicatePresentation('future_predicate')).toMatchObject({
      label: 'future_predicate',
      registered: false,
      direction: null,
    });
  });

  it('keeps association undirected at both endpoints and preserves unknown raw direction', () => {
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
      getCandidatePredicatePresentation('represented_by'),
      null,
    );
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
  });

  it('keeps one-hop heterogeneous context and applies core versus extension filters', () => {
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

  it('allows only ADMIN controlled verification while closed and all known roles after activation', () => {
    expect(resolveCandidateGraphAccess('STUDENT', false).allowed).toBe(false);
    expect(resolveCandidateGraphAccess('TEACHER', false).allowed).toBe(false);
    expect(resolveCandidateGraphAccess('ADMIN', false)).toMatchObject({
      allowed: true,
      controlledVerification: true,
    });
    expect(resolveCandidateGraphAccess('STUDENT', true).allowed).toBe(true);
    expect(resolveCandidateGraphAccess('TEACHER', true).allowed).toBe(true);
    expect(resolveCandidateGraphAccess('ADMIN', true).allowed).toBe(true);
    expect(resolveCandidateGraphAccess('UNKNOWN', true)).toEqual({
      allowed: false,
      role: null,
      controlledVerification: false,
    });
  });
});
