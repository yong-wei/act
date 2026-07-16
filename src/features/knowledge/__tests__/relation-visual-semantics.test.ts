import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { getRelationLabel } from '@/lib/knowledge-labels';
import { KNOWLEDGE_GRAPH_RELATION_CONTRACTS } from '../graph/relation-contract';
import {
  buildFocusNeighborhood,
  buildGraphStatistics,
  buildDefaultSelectedRelationTypes,
  calculateGraphClarityMetrics,
  getBoundedKnowledgeNodeImportanceScore,
  getRelationFocusState,
  getRelationFamily,
  isHighSignalRelation,
  isNodeInFocusNeighborhood,
  isNodeVisibleInFocusedGraph,
  limitStructureRelationDensity,
  relationPassesActiveFilters,
  relationPassesDensity,
  relationPassesFocusNeighborhoodSeedFilters,
} from '../graph/filter-utils';
import {
  assertRuntimeRelationStyleCoverage,
  getGraphFilterLabel,
  getKnowledgeNodeScale,
  getRelationLegendItems,
  getRelationSemantic,
  getRelationStyle,
  getRelationThreeDimensionalEncoding,
  hexToRgba,
  KNOWLEDGE_GRAPH_FAMILY_PRESENTATION_CONFIG,
  KNOWLEDGE_NODE_SCALE_CONTRACT,
} from '../graph/visual-config';
import * as visualConfig from '../graph/visual-config';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({
  prisma: {
    knowledgeLink: {
      findMany: vi.fn(async () => []),
    },
    knowledgeNode: {
      findMany: vi.fn(async () => []),
    },
  },
}));

describe('knowledge graph relation visual semantics', () => {
  const runtimeRelationTypes = Array.from(
    new Set(
      readFileSync(
        path.join(process.cwd(), 'course-content/runtime/knowledge/graph/relations.jsonl'),
        'utf8'
      )
        .trim()
        .split('\n')
        .filter(Boolean)
        .map((line) => {
          const row = JSON.parse(line) as { relation_type?: string; relationType?: string; relation?: string };
          return row.relation_type ?? row.relationType ?? row.relation ?? 'related';
        })
    )
  ).sort();

  it('covers every runtime relation type with explicit teaching semantics', () => {
    expect(assertRuntimeRelationStyleCoverage(runtimeRelationTypes)).toEqual([]);

    runtimeRelationTypes.forEach((relationType) => {
      const semantic = getRelationSemantic(relationType);
      expect(semantic.label).toMatch(/[\u4e00-\u9fff]/);
      expect(semantic.visualFamily).toBeTruthy();
      expect(semantic.direction).toMatch(/^(directed|undirected|bidirectional)$/);
      expect(semantic.density).toMatch(/^(structure|context|optional|weak)$/);
      expect(semantic.legendExplanation).toMatch(/[\u4e00-\u9fff]/);
    });
  });

  it('rejects unknown runtime relations instead of silently using weak related styling', () => {
    expect(() => getRelationStyle('not_authored_relation')).toThrow(/Unknown knowledge graph relation type/);
    expect(assertRuntimeRelationStyleCoverage(['contains', 'not_authored_relation'])).toEqual([
      'not_authored_relation',
    ]);
  });

  it('keeps runtime relation types intact through the unified knowledge graph source', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/lib/knowledge-graph-source.ts'),
      'utf8'
    );
    const contractByInputType = new Map(
      KNOWLEDGE_GRAPH_RELATION_CONTRACTS.flatMap((contract) => (
        [contract.canonicalType, ...contract.aliases].map((inputType) => [inputType, contract.canonicalType] as const)
      ))
    );

    expect(runtimeRelationTypes.filter((relationType) => !contractByInputType.has(relationType))).toEqual([]);
    expect(contractByInputType.get('explains')).toBe('informs');
    expect(contractByInputType.get('example')).toBe('instance_of');
    expect(contractByInputType.get('引出机械建模')).toBe('leads_to');
    expect(contractByInputType.get('引出电路建模')).toBe('leads_to');
    expect(contractByInputType.get('机电类比')).toBe('cross_domain');
    expect(contractByInputType.get('非线性扩展')).toBe('generalizes');
    expect(contractByInputType.get('建模基础')).toBe('provides_foundation');
    expect(contractByInputType.get('电路应用')).toBe('applies_to');
    expect(source).toContain('assertRuntimeKnowledgeRelationCoverage(rawRelations');
    expect(source).not.toContain('RELATION_TYPE_MAP');
  });

  it('loads file graph links without flattening specialized relation types', async () => {
    const { loadKnowledgeGraphData } = await import('@/lib/knowledge-graph-source');
    const graph = await loadKnowledgeGraphData();
    const loadedRelationTypes = new Set((graph.inspectionLinks ?? []).map((link) => link.relationType));
    const missing = runtimeRelationTypes.filter((relationType) => !loadedRelationTypes.has(relationType));

    expect(graph.source).toBe('file');
    expect(missing).toEqual([]);
    expect(loadedRelationTypes.has('related')).toBe(true);
    expect(loadedRelationTypes.has('cross_domain')).toBe(true);
    expect(loadedRelationTypes.has('visualized_by')).toBe(true);
  });

  it('gives core relation families distinct non-color visual encodings', () => {
    const prerequisite = getRelationStyle('prerequisite');
    const contains = getRelationStyle('contains');
    const follows = getRelationStyle('follows');
    const appliesTo = getRelationStyle('applies_to');
    const opposite = getRelationStyle('opposite');
    const related = getRelationStyle('related');

    expect(prerequisite.hasArrow).toBe(true);
    expect(contains.hasArrow).toBe(true);
    expect(follows.dash).toEqual(prerequisite.dash);
    expect(appliesTo.dash).not.toEqual(follows.dash);
    expect(opposite.hasArrow).toBe(false);
    expect(related).toBe(appliesTo);
    expect(opposite).toBe(appliesTo);
  });

  it('caches platform color token lookups across alpha conversions until theme changes', () => {
    const documentElement = {
      className: 'theme-dark',
      getAttribute: vi.fn((name: string) => (name === 'data-theme' ? 'dark' : '')),
    };
    let tokenValue = '210 80% 54%';
    const getPropertyValue = vi.fn((name: string) => (
      name === '--platform-chart-1' ? tokenValue : ''
    ));
    const getComputedStyleMock = vi.fn(() => ({ getPropertyValue }));

    vi.stubGlobal('document', { documentElement });
    vi.stubGlobal('getComputedStyle', getComputedStyleMock);

    try {
      expect(hexToRgba('hsl(var(--platform-chart-1))', 0.7)).toBe('hsla(210, 80%, 54%, 0.7)');
      expect(hexToRgba('hsl(var(--platform-chart-1))', 0.42)).toBe('hsla(210, 80%, 54%, 0.42)');
      expect(getComputedStyleMock).toHaveBeenCalledTimes(1);

      tokenValue = '221 72% 46%';
      documentElement.className = 'theme-light';
      expect(hexToRgba('hsl(var(--platform-chart-1))', 0.7)).toBe('hsla(221, 72%, 46%, 0.7)');
      expect(getComputedStyleMock).toHaveBeenCalledTimes(2);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('selects high-signal structure before weak related edges by default', () => {
    const selected = buildDefaultSelectedRelationTypes([
      'related',
      'governs',
      'prerequisite',
      'contains',
      'follows',
      'applies_to',
    ]);

    expect(selected).toEqual(['contains', 'prerequisite', 'follows']);
    expect(isHighSignalRelation('related')).toBe(false);
    expect(isHighSignalRelation('contains')).toBe(true);
  });

  it('keeps compact family samples aligned with the shared presentation config', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/knowledge-graph-system.tsx'),
      'utf8'
    );
    const familyControlSource = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/relation-family-control.tsx'),
      'utf8'
    );
    const twoDimensionalRendererSource = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-2d.tsx'),
      'utf8'
    );
    const threeDimensionalRendererSource = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-canvas.tsx'),
      'utf8'
    );
    const legendItems = getRelationLegendItems();
    const legendByType = new Map(legendItems.map((item) => [item.type, item]));
    expect(legendItems.length).toBeGreaterThanOrEqual(8);
    expect(legendItems.every((item) => item.sampleStyle === getRelationStyle(item.type))).toBe(true);
    runtimeRelationTypes.forEach((relationType) => {
      const legendItem = legendByType.get(relationType);
      expect(legendItem).toBeDefined();
      expect(legendItem?.label).toBe(getRelationLabel(relationType));
      expect(legendItem?.legendExplanation).toMatch(/[\u4e00-\u9fff]/);
    });
    expect(getRelationSemantic('derives').label).toBe('推导得到');
    expect(getRelationSemantic('uses').label).toBe('使用工具');
    expect(getRelationSemantic('complements').label).toBe('互补说明');
    expect(getRelationSemantic('visualized_by').label).toBe('图形呈现');
    expect(Object.keys(KNOWLEDGE_GRAPH_FAMILY_PRESENTATION_CONFIG)).toEqual([
      'child',
      'post-requisite',
      'association',
    ]);
    expect(familyControlSource).toContain('KNOWLEDGE_GRAPH_FAMILY_PRESENTATION_CONFIG[family]');
    expect(familyControlSource).toContain('data-knowledge-relation-family-sample={family}');
    expect(twoDimensionalRendererSource).toContain('getKnowledgeGraphEdgePresentation');
    expect(threeDimensionalRendererSource).toContain('getKnowledgeGraphEdgePresentation');
    expect(source).toContain('max-h-[min(36rem,calc(100dvh-9rem))]');
    expect(familyControlSource).toContain('item.sampleStyle.lightColor');
    expect(familyControlSource).toContain('item.sampleStyle.darkColor');
    expect(source).not.toContain('data-knowledge-relation-legend-sample');
    expect(source).not.toContain('实线箭头：前置/基础');
    expect(twoDimensionalRendererSource).toContain('ctx.quadraticCurveTo(drawPath.control.x, drawPath.control.y, drawPath.end.x, drawPath.end.y)');
    expect(twoDimensionalRendererSource).toContain('getKnowledgeGraphEndpointArrow(fullPath');
    expect(twoDimensionalRendererSource).toContain('createKnowledgeGraphRendererEdgePath');
    expect(twoDimensionalRendererSource).toContain('getKnowledgeGraphEffectiveEdgeOpacity(style, strength, focusState)');
    expect(threeDimensionalRendererSource).toContain('getKnowledgeGraphEffectiveEdgeOpacity(style, strength, focusState)');
    expect(threeDimensionalRendererSource).toContain('sampleKnowledgeGraphEdgePath(drawPath)');
    expect(threeDimensionalRendererSource).toContain('const ringInnerRadius = presentationRadius + 0.6');
    expect(threeDimensionalRendererSource).toContain('new THREE.RingGeometry(ringInnerRadius, ringOuterRadius, 32)');

    expect(getRelationStyle('prerequisite').dash).toEqual([]);
    expect(getRelationStyle('leads_to').dash).toEqual(getRelationStyle('prerequisite').dash);
    expect(getRelationStyle('applies_to').dash).not.toEqual(getRelationStyle('leads_to').dash);
    expect(getRelationStyle('opposite').hasArrow).toBe(false);
  });

  it('defines bounded node scale with teaching importance before degree', () => {
    expect(KNOWLEDGE_NODE_SCALE_CONTRACT.minRadius).toBeGreaterThanOrEqual(4);
    expect(KNOWLEDGE_NODE_SCALE_CONTRACT.maxRadius).toBeLessThanOrEqual(12);
    expect(KNOWLEDGE_NODE_SCALE_CONTRACT.focusRadiusGain).toBeGreaterThan(1);

    const coreNode = getKnowledgeNodeScale({
      metadata: { importance: 'core' },
      degree: 0,
      focused: false,
    });
    const highDegreeNode = getKnowledgeNodeScale({
      metadata: {},
      degree: 80,
      focused: false,
    });
    const focusedNode = getKnowledgeNodeScale({
      metadata: { importance: 'core' },
      degree: 80,
      focused: true,
    });
    const tierThreeNode = getKnowledgeNodeScale({
      metadata: { importance: 3 },
      degree: 0,
      focused: false,
    });
    const tierFourNode = getKnowledgeNodeScale({
      metadata: { importance: 4 },
      degree: 0,
      focused: false,
    });
    const tierFiveNode = getKnowledgeNodeScale({
      metadata: { importance: 5 },
      degree: 0,
      focused: false,
    });

    expect(coreNode.radius).toBeGreaterThan(highDegreeNode.radius);
    expect(highDegreeNode.radius).toBeLessThanOrEqual(KNOWLEDGE_NODE_SCALE_CONTRACT.maxRadius);
    expect(focusedNode.radius).toBeGreaterThan(coreNode.radius);
    expect(focusedNode.radius).toBeLessThanOrEqual(KNOWLEDGE_NODE_SCALE_CONTRACT.focusMaxRadius);
    expect(coreNode.scaleClass).toMatch(/^knowledge-node-scale-/);
    expect(tierFourNode.radius).toBeGreaterThan(tierThreeNode.radius);
    expect(tierFiveNode.radius).toBeGreaterThan(tierFourNode.radius);
    expect(tierFiveNode.radius).toBeLessThanOrEqual(KNOWLEDGE_NODE_SCALE_CONTRACT.maxRadius);
  });

  it('localizes graph filters and hides raw schema field names from visible UI', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/knowledge-graph-system.tsx'),
      'utf8'
    );

    expect(getGraphFilterLabel('category')).toBe('知识类别');
    expect(getGraphFilterLabel('bloom_level')).toBe('认知层级');
    expect(source).toContain("getGraphFilterLabel('category')");
    expect(source).toContain("getGraphFilterLabel('bloom_level')");
    expect(source).not.toContain('category 筛选');
    expect(source).not.toContain('bloom_level 筛选');
  });

  it('derives learner-visible edges from family state and current domain scope', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/knowledge-graph-system.tsx'),
      'utf8'
    );

    expect(source).toContain('const graphStatistics = useMemo');
    expect(source).toContain('const graphFilterFocusNodeId = explicitFocusNodeId && nodeFilterIdSet.has(explicitFocusNodeId)');
    expect(source).toContain('const explicitFocusNodeId = inspection.explicitFocusNodeId;');
    expect(source).toContain('buildFocusNeighborhood(displayLinks, graphFilterFocusNodeId, filteredNodeIdSet)');
    expect(source).toContain('data-knowledge-clarity-summary="desktop"');
    expect(source).toContain('selectLearnerVisibleRelationEdges({');
    expect(source).toContain('activeDomainNodeIds: domainMemberNodeIdSet');
    expect(source).toContain('selectedNodeId: selectedNode?.id ?? null');
    expect(source).toContain('graphDegree: graphStatistics.degreeByNodeId.get(node.id) ?? 0');
    expect(source).not.toContain('relationPassesActiveFilters(link');
    expect(source).not.toContain('densityFilteredLinks');
  });

  it('keeps weak edges hidden in structure mode but reveals focused-neighborhood weak edges', () => {
    const weakRelated = {
      id: 'weak-related',
      sourceId: 'node-a',
      targetId: 'node-b',
      relation: 'related',
      relationType: 'related',
      strength: 0.35,
    };
    const weakPrerequisite = {
      id: 'weak-prerequisite',
      sourceId: 'node-a',
      targetId: 'node-c',
      relation: 'prerequisite',
      relationType: 'prerequisite',
      strength: 0.35,
    };
    const focusNeighborhood = buildFocusNeighborhood([weakRelated], 'node-a');
    const noFocusNeighborhood = buildFocusNeighborhood([weakRelated, weakPrerequisite], null);

    expect(relationPassesDensity(weakRelated, { densityMode: 'structure' })).toBe(false);
    expect(
      relationPassesDensity(weakRelated, {
        densityMode: 'focused',
        focusNodeId: null,
        focusNeighborhood: noFocusNeighborhood,
      })
    ).toBe(false);
    expect(
      relationPassesDensity(weakPrerequisite, {
        densityMode: 'focused',
        focusNodeId: null,
        focusNeighborhood: noFocusNeighborhood,
      })
    ).toBe(true);
    expect(
      relationPassesDensity(weakRelated, {
        densityMode: 'focused',
        focusNodeId: 'node-a',
        focusNeighborhood,
      })
    ).toBe(true);
    expect(getRelationFocusState('node-a', 'node-b', 'node-a')).toBe('active');
    expect(getRelationFocusState('node-a', 'node-b', 'node-c')).toBe('dimmed');
  });

  it('keeps all-relations mode independent from relation-type selection', () => {
    const weakRelated = {
      sourceId: 'node-a',
      targetId: 'node-b',
      relation: 'related',
      relationType: 'related',
      strength: 0.1,
    };

    expect(
      relationPassesActiveFilters(weakRelated, {
        densityMode: 'all',
        selectedRelationTypes: [],
        minRelationStrength: 0.9,
      })
    ).toBe(true);
    expect(
      relationPassesActiveFilters(weakRelated, {
        densityMode: 'structure',
        selectedRelationTypes: [],
        minRelationStrength: 0,
      })
    ).toBe(false);
  });

  it('preserves the hover-only focus center in focused neighborhoods', () => {
    const focusNeighborhood = buildFocusNeighborhood([
      {
        id: 'direct',
        sourceId: 'hovered',
        targetId: 'neighbor',
        relation: 'prerequisite',
        relationType: 'prerequisite',
        strength: 1,
      },
      {
        id: 'contextual',
        sourceId: 'neighbor',
        targetId: 'context',
        relation: 'applies_to',
        relationType: 'applies_to',
        strength: 1,
      },
    ], 'hovered');

    expect(isNodeInFocusNeighborhood('hovered', focusNeighborhood)).toBe(true);
    expect(isNodeInFocusNeighborhood('neighbor', focusNeighborhood)).toBe(true);
    expect(isNodeInFocusNeighborhood('context', focusNeighborhood)).toBe(true);
    expect(isNodeInFocusNeighborhood('unrelated', focusNeighborhood)).toBe(false);
  });

  it('keeps focused nodes aligned with relation-type filtered visible links', () => {
    const links = [
      {
        id: 'strong',
        sourceId: 'focus',
        targetId: 'strong-only',
        relation: 'prerequisite',
        relationType: 'prerequisite',
        strength: 1,
      },
      {
        id: 'filtered',
        sourceId: 'focus',
        targetId: 'weak-only',
        relation: 'related',
        relationType: 'related',
        strength: 1,
      },
    ];
    const focusNeighborhood = buildFocusNeighborhood(links, 'focus');
    const visibleLinks = links.filter((link) =>
      relationPassesActiveFilters(link, {
        densityMode: 'focused',
        selectedRelationTypes: ['prerequisite'],
        minRelationStrength: 0,
        focusNodeId: 'focus',
        focusNeighborhood,
      })
    );
    const visibleNodeIds = new Set(visibleLinks.flatMap((link) => [link.sourceId, link.targetId]));

    expect(visibleLinks.map((link) => link.id)).toEqual(['strong']);
    expect(isNodeVisibleInFocusedGraph('focus', focusNeighborhood, visibleNodeIds)).toBe(true);
    expect(isNodeVisibleInFocusedGraph('strong-only', focusNeighborhood, visibleNodeIds)).toBe(true);
    expect(isNodeVisibleInFocusedGraph('weak-only', focusNeighborhood, visibleNodeIds)).toBe(false);
  });

  it('prevents contextual focus links from bypassing filtered direct focus links', () => {
    const links = [
      {
        id: 'filtered-direct',
        sourceId: 'focus',
        targetId: 'bridge',
        relation: 'related',
        relationType: 'related',
        strength: 1,
      },
      {
        id: 'contextual',
        sourceId: 'bridge',
        targetId: 'context',
        relation: 'prerequisite',
        relationType: 'prerequisite',
        strength: 1,
      },
    ];
    const seedLinks = links.filter((link) =>
      relationPassesFocusNeighborhoodSeedFilters(link, {
        densityMode: 'focused',
        selectedRelationTypes: ['prerequisite'],
        minRelationStrength: 0,
        focusNodeId: 'focus',
      })
    );
    const focusNeighborhood = buildFocusNeighborhood(seedLinks, 'focus');
    const visibleLinks = links.filter((link) =>
      relationPassesActiveFilters(link, {
        densityMode: 'focused',
        selectedRelationTypes: ['prerequisite'],
        minRelationStrength: 0,
        focusNodeId: 'focus',
        focusNeighborhood,
      })
    );

    expect(seedLinks.map((link) => link.id)).toEqual(['contextual']);
    expect(focusNeighborhood.directLinkIds.size).toBe(0);
    expect(focusNeighborhood.contextualLinkIds.size).toBe(0);
    expect(visibleLinks).toEqual([]);
  });

  it('computes graph statistics and bounded clarity metrics for representative states', () => {
    const nodes = [
      {
        id: 'root',
        name: '根节点',
        nodeType: 'THEORY' as const,
        description: '',
        positionX: 0,
        positionY: 0,
        positionZ: 0,
        metadata: { importance: 5 },
      },
      {
        id: 'neighbor',
        name: '一阶邻居',
        nodeType: 'THEORY' as const,
        description: '',
        positionX: 0,
        positionY: 0,
        positionZ: 0,
        metadata: { importance: 3 },
      },
      {
        id: 'context',
        name: '二阶上下文',
        nodeType: 'THEORY' as const,
        description: '',
        positionX: 0,
        positionY: 0,
        positionZ: 0,
        metadata: { importance: 'supporting' },
      },
      {
        id: 'weak-only',
        name: '弱关联节点',
        nodeType: 'THEORY' as const,
        description: '',
        positionX: 0,
        positionY: 0,
        positionZ: 0,
        metadata: { importance: 'supporting' },
      },
    ];
    const links = [
      { id: 'direct', sourceId: 'root', targetId: 'neighbor', relation: 'prerequisite', relationType: 'prerequisite', strength: 1 },
      { id: 'contextual', sourceId: 'neighbor', targetId: 'context', relation: 'applies_to', relationType: 'applies_to', strength: 0.9 },
      { id: 'weak', sourceId: 'context', targetId: 'weak-only', relation: 'related', relationType: 'related', strength: 0.2 },
    ];

    const statistics = buildGraphStatistics(nodes, links);
    const focusNeighborhood = buildFocusNeighborhood(links, 'root');
    const focusedLinks = links.filter((link) =>
      relationPassesDensity(link, {
        densityMode: 'focused',
        focusNodeId: 'root',
        focusNeighborhood,
      })
    );
    const clarityMetrics = calculateGraphClarityMetrics(nodes, focusedLinks, focusNeighborhood);

    expect(statistics.degreeByNodeId.get('root')).toBe(1);
    expect(statistics.maxDegree).toBe(2);
    expect(statistics.relationFamilyCounts.structure).toBe(1);
    expect(statistics.relationFamilyCounts.context).toBe(0);
    expect(statistics.relationFamilyCounts.optional).toBe(1);
    expect(statistics.relationFamilyCounts.weak).toBe(1);
    expect(statistics.importanceScoreByNodeId.get('root')).toBe(1);
    expect(getBoundedKnowledgeNodeImportanceScore({ importance: 4 })).toBe(0.8);
    expect(getRelationFamily('related')).toBe('weak');
    expect(focusNeighborhood.firstOrderNodeIds.has('neighbor')).toBe(true);
    expect(focusNeighborhood.secondOrderNodeIds.has('context')).toBe(true);
    expect(focusedLinks.map((link) => link.id)).toEqual(['direct', 'contextual']);
    expect(clarityMetrics.visibleEdgeCount).toBe(2);
    expect(clarityMetrics.weakEdgeRatio).toBe(0);
    expect(clarityMetrics.selectedNeighborhoodEdgeRatio).toBe(1);
    expect(clarityMetrics.maxNodeRadius).toBeLessThanOrEqual(KNOWLEDGE_NODE_SCALE_CONTRACT.focusMaxRadius);
  });

  it('caps default structure density while leaving stronger skeleton edges first', () => {
    const denseContains = Array.from({ length: 900 }, (_, index) => ({
      sourceId: `source-${index}`,
      targetId: `target-${index}`,
      relation: 'contains',
      relationType: 'contains',
      strength: index % 2 === 0 ? 1 : 0.85,
    }));

    const limited = limitStructureRelationDensity(denseContains);

    expect(limited.length).toBeLessThan(denseContains.length);
    expect(limited.length).toBeLessThanOrEqual(360);
    expect(limited[0]?.strength).toBe(1);
  });

  it('keeps explicitly selected optional relation families visible under structure caps', () => {
    const optionalLinks = [
      {
        sourceId: 'applies-source',
        targetId: 'applies-target',
        relation: 'applies_to',
        relationType: 'applies_to',
        strength: 0.95,
      },
      {
        sourceId: 'opposite-source',
        targetId: 'opposite-target',
        relation: 'opposite',
        relationType: 'opposite',
        strength: 0.9,
      },
      {
        sourceId: 'related-source',
        targetId: 'related-target',
        relation: 'related',
        relationType: 'related',
        strength: 0.85,
      },
    ];

    expect(limitStructureRelationDensity(optionalLinks).map((link) => link.relationType)).toEqual([
      'applies_to',
      'opposite',
      'related',
    ]);
  });

  it('limits dense optional relation families instead of rendering all of them', () => {
    const denseRelated = Array.from({ length: 150 }, (_, index) => ({
      sourceId: `related-source-${index}`,
      targetId: `related-target-${index}`,
      relation: 'related',
      relationType: 'related',
      strength: 0.9,
    }));

    expect(limitStructureRelationDensity(denseRelated)).toHaveLength(80);
  });

  it('prioritizes focused-node links before applying structure caps', () => {
    const focusedLinks = Array.from({ length: 12 }, (_, index) => ({
      sourceId: 'focus-node',
      targetId: `target-${index}`,
      relation: 'contains',
      relationType: 'contains',
      strength: 0.8,
    }));

    expect(limitStructureRelationDensity(focusedLinks)).toHaveLength(4);
    expect(limitStructureRelationDensity(focusedLinks, { focusNodeId: 'focus-node' })).toHaveLength(12);
  });

  it('maps 3D relation encodings through the shared family contract', () => {
    const prerequisite3d = getRelationThreeDimensionalEncoding('prerequisite');
    const related3d = getRelationThreeDimensionalEncoding('related');
    const opposite3d = getRelationThreeDimensionalEncoding('opposite');
    const appliesTo3d = getRelationThreeDimensionalEncoding('applies_to');
    const crossDomain3d = getRelationThreeDimensionalEncoding('cross_domain');
    const generalizes3d = getRelationThreeDimensionalEncoding('generalizes');
    const supports3d = getRelationThreeDimensionalEncoding('supports');
    const enables3d = getRelationThreeDimensionalEncoding('enables');

    expect(prerequisite3d.arrowLength).toBeGreaterThan(0);
    expect(related3d.arrowLength).toBe(0);
    expect(opposite3d).toEqual(related3d);
    expect(appliesTo3d).toEqual(related3d);
    expect(crossDomain3d).toEqual(related3d);
    expect(generalizes3d).toEqual(related3d);
    expect(supports3d).toEqual(related3d);
    expect(enables3d).toEqual(related3d);
  });

  it('defines a semantic-map contract that keeps default edges fine and non-color differentiated', () => {
    const contract = (visualConfig as any).KNOWLEDGE_GRAPH_SEMANTIC_MAP_CONTRACT;

    expect(contract).toBeDefined();
    expect(contract.maxDefaultEdgeWidth).toBeLessThanOrEqual(1.42);
    expect(contract.maxDefaultEdgeOpacity).toBeGreaterThanOrEqual(0.86);
    expect(contract.dimmedNeighborhoodOpacity).toBeLessThanOrEqual(0.22);
    expect(contract.activeNeighborhoodWidthGain).toBeGreaterThanOrEqual(1.5);
    expect(contract.activeNeighborhoodWidthGain).toBeLessThanOrEqual(1.8);
    expect(contract.semanticRegionKinds).toContain('chapter-territory');
    expect(contract.conceptReferences).toEqual([
      'layered-research-atlas',
      'night-bridge-semantic-map',
      'daylight-engineering-atlas',
    ]);

    runtimeRelationTypes.forEach((relationType) => {
      const style = getRelationStyle(relationType);
      expect(style.width).toBeLessThanOrEqual(contract.maxDefaultEdgeWidth);
      expect(style.opacity).toBeLessThanOrEqual(contract.maxDefaultEdgeOpacity);
      const effectiveWidth = (visualConfig as any).getKnowledgeGraphEffectiveEdgeWidth;
      expect(effectiveWidth).toBeTypeOf('function');
      expect(effectiveWidth(style, 1, 'neutral', '2d')).toBeLessThanOrEqual(contract.maxDefaultEdgeWidth);
      expect(effectiveWidth(style, 1, 'neutral', '3d')).toBeLessThanOrEqual(contract.maxDefaultEdgeWidth);
      expect(effectiveWidth(style, 1, 'active', '2d')).toBeLessThanOrEqual(
        contract.maxDefaultEdgeWidth * contract.activeNeighborhoodWidthGain
      );
      expect(effectiveWidth(style, 1, 'active', '3d')).toBeLessThanOrEqual(
        contract.maxDefaultEdgeWidth * contract.activeNeighborhoodWidthGain
      );
      expect(getRelationThreeDimensionalEncoding(relationType).particleWidth).toBeLessThanOrEqual(
        contract.maxDefaultEdgeWidth
      );
      expect(
        style.dash.length > 0
        || style.endpoint !== 'none'
        || style.curvature !== 0
        || style.hasArrow
      ).toBe(true);
    });
  });

  it('derives semantic chapter territories from graph semantics and platform tokens', () => {
    const getKnowledgeSemanticRegionStyle = (visualConfig as any).getKnowledgeSemanticRegionStyle as
      | ((node: { id?: string; metadata?: Record<string, unknown> | null; graphDegree?: number | null }, isLightTheme?: boolean) => {
        enabled: boolean;
        fillColor: string;
        strokeColor: string;
        fillOpacity: number;
        strokeOpacity: number;
        radiusMultiplier: number;
        maxRadius: number;
        label: string;
      })
      | undefined;

    expect(getKnowledgeSemanticRegionStyle).toBeTypeOf('function');
    const chapterRegion = getKnowledgeSemanticRegionStyle?.({
      id: 'chapter-node:频域分析',
      metadata: { isVirtualChapter: true, nodeCount: 48 },
      graphDegree: 32,
    }, false);
    const lightChapterRegion = getKnowledgeSemanticRegionStyle?.({
      id: 'chapter-node:时域分析',
      metadata: { isVirtualChapter: true, nodeCount: 12 },
      graphDegree: 8,
    }, true);
    const normalNodeRegion = getKnowledgeSemanticRegionStyle?.({
      id: 'concept:transfer-function',
      metadata: { importance: 'core' },
      graphDegree: 24,
    }, false);

    expect(chapterRegion?.enabled).toBe(true);
    expect(chapterRegion?.label).toBe('chapter-territory');
    expect(chapterRegion?.fillColor).toMatch(/^hsl\(var\(--platform-/);
    expect(chapterRegion?.strokeColor).toMatch(/^hsl\(var\(--platform-/);
    expect(chapterRegion?.fillOpacity).toBeLessThanOrEqual(0.2);
    expect(chapterRegion?.strokeOpacity).toBeLessThanOrEqual(0.32);
    expect(chapterRegion?.radiusMultiplier).toBeGreaterThan(lightChapterRegion?.radiusMultiplier ?? 0);
    expect(normalNodeRegion?.enabled).toBe(false);
    expect(normalNodeRegion?.fillOpacity).toBe(0);
  });

  it('uses the shared semantic-map contract in 2D, 3D, legend, and governance evidence checks', () => {
    const twoDimensionalRendererSource = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-2d.tsx'),
      'utf8'
    );
    const threeDimensionalRendererSource = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-canvas.tsx'),
      'utf8'
    );
    const threeLinkPresentationSource = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/three-link-presentation.ts'),
      'utf8'
    );
    const governanceSource = readFileSync(
      path.join(process.cwd(), 'scripts/tests/test-commercial-ui-governance.ts'),
      'utf8'
    );
    const visualConfigSource = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/visual-config.ts'),
      'utf8'
    );

    expect(visualConfigSource).toContain('KNOWLEDGE_GRAPH_SEMANTIC_MAP_CONTRACT');
    expect(twoDimensionalRendererSource).toContain('getKnowledgeSemanticRegionStyle');
    expect(twoDimensionalRendererSource).toContain('getKnowledgeGraphEffectiveEdgeOpacity');
    expect(twoDimensionalRendererSource).toContain('getKnowledgeGraphEffectiveEdgeWidth');
    expect(threeDimensionalRendererSource).toContain('getKnowledgeSemanticRegionStyle');
    expect(threeDimensionalRendererSource).toContain('getKnowledgeGraphEffectiveEdgeOpacity');
    expect(threeDimensionalRendererSource).toContain('getKnowledgeGraphEdgeEmphasisState');
    expect(threeDimensionalRendererSource).toContain("from './three-link-presentation'");
    expect(threeDimensionalRendererSource).toContain('createKnowledgeGraphPresentationLinkGroup');
    expect(threeDimensionalRendererSource).toContain('updateKnowledgeGraph3DLine');
    expect(threeLinkPresentationSource).toContain('THREE.TubeGeometry');
    expect(governanceSource).toContain('validateKnowledgeGraphSemanticMapEvidence');
    expect(governanceSource).toContain('knowledge-graph-semantic-map-486/browser-evidence.json');
    expect(governanceSource).toContain('legendSharedContract');
    expect(governanceSource).toContain('getKnowledgeGraphEffectiveEdgeWidth');
    expect(governanceSource).toContain('imageFormat');
  });

  it('requires semantic-map browser screenshots to be real image artifacts with accurate extensions', () => {
    const evidence = JSON.parse(readFileSync(
      path.join(process.cwd(), 'artifacts/knowledge-graph-semantic-map-486/browser-evidence.json'),
      'utf8'
    )) as { browserStates: Record<string, { screenshot: string }> };

    Object.values(evidence.browserStates).forEach((state) => {
      const screenshotPath = state.screenshot;
      const bytes = readFileSync(path.join(process.cwd(), screenshotPath));
      const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8;
      const isPng = bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47;

      expect(isJpeg || isPng).toBe(true);
      expect(screenshotPath.endsWith(isJpeg ? '.jpg' : '.png')).toBe(true);
    });
  });
});
