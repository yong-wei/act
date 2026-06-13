import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';

import { getRelationLabel } from '@/lib/knowledge-labels';
import {
  buildDefaultSelectedRelationTypes,
  getRelationFocusState,
  isHighSignalRelation,
  limitStructureRelationDensity,
  relationPassesDensity,
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
  KNOWLEDGE_NODE_SCALE_CONTRACT,
} from '../graph/visual-config';

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

    runtimeRelationTypes.forEach((relationType) => {
      expect(source).toContain(`${relationType}: '${relationType}'`);
    });
    expect(source).toContain("explains: 'informs'");
    expect(source).toContain("example: 'instance_of'");
    expect(source).toContain("引出机械建模: 'leads_to'");
    expect(source).toContain("引出电路建模: 'leads_to'");
    expect(source).toContain("机电类比: 'cross_domain'");
    expect(source).toContain("非线性扩展: 'generalizes'");
    expect(source).toContain("建模基础: 'provides_foundation'");
    expect(source).toContain("电路应用: 'applies_to'");
    expect(source).not.toContain("return RELATION_TYPE_MAP[key] ?? 'related';");
  });

  it('loads file graph links without flattening specialized relation types', async () => {
    const { loadKnowledgeGraphData } = await import('@/lib/knowledge-graph-source');
    const graph = await loadKnowledgeGraphData();
    const loadedRelationTypes = new Set(graph.links.map((link) => link.relationType));
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
    expect(contains.hasArrow).toBe(false);
    expect(follows.dash.length).toBeGreaterThan(0);
    expect(appliesTo.dash).not.toEqual(follows.dash);
    expect(opposite.hasArrow).toBe(false);
    expect(related.width).toBeLessThan(prerequisite.width);
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

  it('keeps relation legend wording aligned with actual non-color encodings', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/knowledge-graph-system.tsx'),
      'utf8'
    );
    const twoDimensionalRendererSource = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-2d.tsx'),
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
    expect(source).toContain('getRelationLegendItems');
    expect(source).toContain('data-knowledge-relation-legend-sample');
    expect(source).toContain('item.sampleStyle.lightColor');
    expect(source).toContain('item.sampleStyle.darkColor');
    expect(source).not.toContain('实线箭头：前置/基础');
    expect(twoDimensionalRendererSource).toContain('ctx.quadraticCurveTo(controlX, controlY, target.x, target.y)');
    expect(twoDimensionalRendererSource).toContain('drawEndpointMarker(ctx, style.endpoint');
    expect(twoDimensionalRendererSource).toContain('getQuadraticTangentAngle(source.x, source.y, controlX, controlY, target.x, target.y, 0.65)');

    expect(getRelationStyle('prerequisite').dash).toEqual([]);
    expect(getRelationStyle('leads_to').dash.length).toBeGreaterThan(0);
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

  it('derives connected visible nodes from capped density links', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/knowledge-graph-system.tsx'),
      'utf8'
    );

    expect(source).toContain('const densityFilteredLinks = useMemo');
    expect(source).toContain('focusNodeId: hoveredNode?.id ?? selectedNode?.id ?? null');
    expect(source).toContain("const isFocusedLink = relationDensityMode === 'focused'");
    expect(source).toContain('if (!selectedRelationTypes.includes(relationType)) return false;');
    expect(source).toContain('if (strength < minRelationStrength && !isFocusedLink) return false;');
    expect(source).toContain('焦点邻域会保留直连弱关系，关系类型筛选仍然生效。');
    expect(source).toContain('densityFilteredLinks.forEach((link) => {');
    expect(source).not.toContain('filteredLinksByRelation.forEach((link) => {');
    expect(source).not.toContain('&& !densityFocused');
  });

  it('keeps weak edges hidden in structure mode but reveals focused-neighborhood weak edges', () => {
    const weakRelated = {
      sourceId: 'node-a',
      targetId: 'node-b',
      relation: 'related',
      relationType: 'related',
      strength: 0.35,
    };

    expect(relationPassesDensity(weakRelated, { densityMode: 'structure' })).toBe(false);
    expect(
      relationPassesDensity(weakRelated, {
        densityMode: 'focused',
        focusNodeId: 'node-a',
      })
    ).toBe(true);
    expect(getRelationFocusState('node-a', 'node-b', 'node-a')).toBe('active');
    expect(getRelationFocusState('node-a', 'node-b', 'node-c')).toBe('dimmed');
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

  it('maps 3D relation encodings to non-color differences across weak and special relations', () => {
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
    expect(opposite3d.directionalParticles).toBeGreaterThan(related3d.directionalParticles);
    expect(opposite3d.particleWidth).toBeGreaterThan(related3d.particleWidth);
    expect(appliesTo3d.directionalParticles).toBeGreaterThan(prerequisite3d.directionalParticles);
    expect(crossDomain3d.directionalParticles).toBe(prerequisite3d.directionalParticles);
    expect(generalizes3d.arrowLength).toBe(prerequisite3d.arrowLength);
    expect(supports3d.particleWidth).toBeLessThan(prerequisite3d.particleWidth);
    expect(enables3d.particleSpeed).toBe(appliesTo3d.particleSpeed);
  });
});
