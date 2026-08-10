import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/prisma', () => ({ prisma: {} }));

import { buildKnowledgeGraphRootPayload } from '@/lib/knowledge-graph-source';
import {
  getKnowledgeGraphNodeBoundaryIntersection,
  isKnowledgeGraphPointInsideNodeBoundary,
} from '../graph/edge-geometry';
import { getKnowledgeGraphRendererNodeBoundary } from '../graph/edge-presentation';
import { selectLearnerVisibleRelationEdges } from '../graph/relation-family-controls';
import {
  CONCEPT_MACRO_CATEGORY_SHAPES,
  getKnowledgeConceptNodeShape,
  getKnowledgeGraphCompositeContrastRatio,
  getKnowledgeGraphEdgeRenderModulation,
  getKnowledgeGraphEffectiveEdgeOpacity,
  getKnowledgeGraphEffectiveEdgeWidth,
  getKnowledgeGraphEvidenceEdgeModulation,
  getKnowledgeNodeScale,
  KNOWLEDGE_GRAPH_FAMILY_PRESENTATION_CONFIG,
  resolveConceptMacroCategory,
} from '../graph/visual-config';

describe('evidence edge modulation', () => {
  it.each([undefined, null, 'available'] as const)('returns identity modulation for absent or available state: %s', (state) => {
    expect(getKnowledgeGraphEvidenceEdgeModulation(state)).toEqual({ opacityFactor: 1, widthFactor: 1 });
  });

  it('returns a bounded muted variant for unavailable evidence', () => {
    const muted = getKnowledgeGraphEvidenceEdgeModulation('unavailable');

    expect(muted.opacityFactor).toBeLessThan(1);
    expect(muted.widthFactor).toBeLessThan(1);
  });

  it('keeps the muted variant above the 3:1 contrast floor in every family, focus, and theme', () => {
    const muted = getKnowledgeGraphEvidenceEdgeModulation('unavailable');

    Object.values(KNOWLEDGE_GRAPH_FAMILY_PRESENTATION_CONFIG).forEach(({ sampleStyle }) => {
      for (const focusState of ['neutral', 'active'] as const) {
        const availableOpacity = getKnowledgeGraphEffectiveEdgeOpacity(sampleStyle, 1, focusState);
        const mutedOpacity = availableOpacity * muted.opacityFactor;

        expect(mutedOpacity).toBeLessThan(availableOpacity);
        expect(getKnowledgeGraphCompositeContrastRatio(sampleStyle.lightColor, '#ffffff', mutedOpacity)).toBeGreaterThanOrEqual(3);
        expect(getKnowledgeGraphCompositeContrastRatio(sampleStyle.darkColor, '#091540', mutedOpacity)).toBeGreaterThanOrEqual(3);
      }
    });
  });

  it('renders muted edges distinguishable from available edges without relying on color alone', () => {
    const muted = getKnowledgeGraphEvidenceEdgeModulation('unavailable');

    Object.values(KNOWLEDGE_GRAPH_FAMILY_PRESENTATION_CONFIG).forEach(({ sampleStyle }) => {
      for (const renderer of ['2d', '3d'] as const) {
        const availableWidth = getKnowledgeGraphEffectiveEdgeWidth(sampleStyle, 1, 'neutral', renderer);
        const mutedWidth = availableWidth * muted.widthFactor;

        expect(mutedWidth).toBeLessThanOrEqual(availableWidth * 0.7);
      }
    });
  });

  it('stacks candidate muting through one floor-safe render modulation', () => {
    expect(getKnowledgeGraphEdgeRenderModulation({})).toEqual({ opacityFactor: 1, widthFactor: 1 });
    expect(getKnowledgeGraphEdgeRenderModulation({ evidenceState: 'available' })).toEqual({ opacityFactor: 1, widthFactor: 1 });

    const evidenceOnly = getKnowledgeGraphEdgeRenderModulation({ evidenceState: 'unavailable' });
    const candidateOnly = getKnowledgeGraphEdgeRenderModulation({ candidate: true });
    const stacked = getKnowledgeGraphEdgeRenderModulation({ candidate: true, evidenceState: 'unavailable' });

    expect(evidenceOnly.opacityFactor).toBeGreaterThanOrEqual(0.82);
    expect(candidateOnly.opacityFactor).toBe(evidenceOnly.opacityFactor);
    expect(stacked.opacityFactor).toBe(evidenceOnly.opacityFactor);
    expect(candidateOnly.widthFactor).toBeLessThan(1);
    expect(candidateOnly.widthFactor).toBeGreaterThan(evidenceOnly.widthFactor);
    expect(stacked.widthFactor).toBeCloseTo(evidenceOnly.widthFactor * candidateOnly.widthFactor, 6);

    Object.values(KNOWLEDGE_GRAPH_FAMILY_PRESENTATION_CONFIG).forEach(({ sampleStyle }) => {
      for (const modulation of [evidenceOnly, candidateOnly, stacked]) {
        const mutedOpacity = getKnowledgeGraphEffectiveEdgeOpacity(sampleStyle, 1, 'neutral') * modulation.opacityFactor;
        expect(getKnowledgeGraphCompositeContrastRatio(sampleStyle.lightColor, '#ffffff', mutedOpacity)).toBeGreaterThanOrEqual(3);
        expect(getKnowledgeGraphCompositeContrastRatio(sampleStyle.darkColor, '#091540', mutedOpacity)).toBeGreaterThanOrEqual(3);
      }
    });
  });
});

describe('concept macro-category resolution', () => {
  it.each([
    ['system_kind', 'systems'],
    ['system_component', 'systems'],
    ['signal_role', 'systems'],
    ['model_kind', 'models'],
    ['representation_kind', 'models'],
    ['mathematical_object', 'models'],
    ['theoretical_construct', 'models'],
    ['analysis_method', 'methods'],
    ['design_method', 'methods'],
    ['criterion', 'criteria-and-metrics'],
    ['performance_metric', 'criteria-and-metrics'],
    ['phenomenon', 'phenomena-and-objects'],
    ['system_property', 'phenomena-and-objects'],
    ['constraint', 'constraints-and-tasks'],
    ['task_kind', 'constraints-and-tasks'],
  ] as const)('groups ActKG concept kind %s into %s', (conceptKind, category) => {
    expect(resolveConceptMacroCategory({ conceptKind })).toBe(category);
  });

  it('covers all fifteen ActKG concept kinds in the grouping table', () => {
    const kinds = [
      'system_kind', 'system_component', 'signal_role', 'model_kind', 'representation_kind',
      'mathematical_object', 'system_property', 'phenomenon', 'analysis_method', 'design_method',
      'criterion', 'performance_metric', 'constraint', 'task_kind', 'theoretical_construct',
    ];

    expect(kinds).toHaveLength(15);
    kinds.forEach((conceptKind) => {
      expect(resolveConceptMacroCategory({ conceptKind })).not.toBe('neutral');
    });
  });

  it('lets conceptKind take precedence over the legacy nodeType mapping', () => {
    expect(resolveConceptMacroCategory({ conceptKind: 'analysis_method', nodeType: 'ETHICS' })).toBe('methods');
  });

  it.each([
    [{ nodeType: 'SCENARIO' }, 'phenomena-and-objects'],
    [{ nodeType: 'ETHICS' }, 'constraints-and-tasks'],
    [{ nodeType: 'THEORY', knowledgeDim: 'PROCEDURAL' }, 'methods'],
    [{ nodeType: 'THEORY', knowledgeDim: 'METACOGNITIVE' }, 'criteria-and-metrics'],
    [{ nodeType: 'THEORY', knowledgeDim: 'FACTUAL' }, 'phenomena-and-objects'],
    [{ nodeType: 'THEORY', knowledgeDim: 'CONCEPTUAL' }, 'models'],
  ] as const)('falls back to the legacy nodeType/knowledgeDim mapping: %o → %s', (node, category) => {
    expect(resolveConceptMacroCategory(node)).toBe(category);
  });

  it('renders unknown or missing classification neutral without throwing', () => {
    expect(resolveConceptMacroCategory({ conceptKind: 'unknown_future_kind' })).toBe('neutral');
    expect(resolveConceptMacroCategory({})).toBe('neutral');
    expect(resolveConceptMacroCategory({ nodeType: 'THEORY' })).toBe('neutral');
  });

  it('assigns one shape per macro-category with a nodeType fallback for neutral nodes', () => {
    const shapes = new Set(Object.values(CONCEPT_MACRO_CATEGORY_SHAPES));
    expect(shapes.size).toBe(6);

    expect(getKnowledgeConceptNodeShape({ conceptKind: 'system_kind' })).toBe('hexagon');
    expect(getKnowledgeConceptNodeShape({ conceptKind: 'unknown_future_kind', nodeType: 'ETHICS' })).toBe('hexagon');
    expect(getKnowledgeConceptNodeShape({ nodeType: 'THEORY', knowledgeDim: 'PROCEDURAL' })).toBe('triangle');
    expect(getKnowledgeConceptNodeShape({ nodeType: undefined })).toBe('circle');
  });
});

describe('coverage as a tertiary node scale signal', () => {
  const baseInput = { metadata: { importance: 'core' }, degree: 8 };

  it('keeps the radius byte-identical when coverage is absent', () => {
    const withoutCoverage = getKnowledgeNodeScale(baseInput);
    const withUndefined = getKnowledgeNodeScale({ ...baseInput, sourceCoverageCount: undefined });
    const withNull = getKnowledgeNodeScale({ ...baseInput, sourceCoverageCount: null });

    expect(withUndefined).toEqual(withoutCoverage);
    expect(withNull).toEqual(withoutCoverage);
  });

  it('never penalizes explicit zero coverage', () => {
    expect(getKnowledgeNodeScale({ ...baseInput, sourceCoverageCount: 0 }).radius)
      .toBe(getKnowledgeNodeScale(baseInput).radius);
  });

  it('lets higher coverage render larger within the existing bounds', () => {
    const low = getKnowledgeNodeScale({ metadata: { importance: 3 }, degree: 4, sourceCoverageCount: 1 });
    const high = getKnowledgeNodeScale({ metadata: { importance: 3 }, degree: 4, sourceCoverageCount: 3 });
    const focusedHigh = getKnowledgeNodeScale({ metadata: { importance: 3 }, degree: 4, focused: true, sourceCoverageCount: 99 });

    expect(high.radius).toBeGreaterThan(low.radius);
    expect(high.radius).toBeLessThanOrEqual(10);
    expect(focusedHigh.radius).toBeLessThanOrEqual(12);
  });

  it('keeps teaching importance dominant over coverage', () => {
    const coreWithoutCoverage = getKnowledgeNodeScale({ metadata: { importance: 'core' }, degree: 0 });
    const weakWithCoverage = getKnowledgeNodeScale({ metadata: { importance: 'supporting' }, degree: 0, sourceCoverageCount: 99 });

    expect(coreWithoutCoverage.radius).toBeGreaterThan(weakWithCoverage.radius);
  });

  it('caps the coverage effect so extreme counts plateau', () => {
    expect(getKnowledgeNodeScale({ ...baseInput, sourceCoverageCount: 99 }).radius)
      .toBe(getKnowledgeNodeScale({ ...baseInput, sourceCoverageCount: 3 }).radius);
  });
});

describe('learner edge evidence plumbing', () => {
  const domainNodeIds = new Set(['node-a', 'node-b', 'node-c']);
  const associationLinks = [
    { id: 'link-1', relation: 'supports', relationType: 'supports', sourceId: 'node-a', targetId: 'node-b', strength: 0.9 },
    { id: 'link-2', relation: 'supports', relationType: 'supports', sourceId: 'node-b', targetId: 'node-a', strength: 0.8 },
  ];

  it('aggregates merged edges like the server runtime: any available wins', () => {
    const edges = selectLearnerVisibleRelationEdges({
      links: [
        { ...associationLinks[0], evidenceState: 'unavailable' as const },
        { ...associationLinks[1], evidenceState: 'available' as const },
      ],
      activeDomainNodeIds: domainNodeIds,
      enabledFamilies: ['association'],
      selectedNodeId: 'node-a',
    });

    expect(edges).toHaveLength(1);
    expect(edges[0]?.evidenceState).toBe('available');
  });

  it('reports unavailable only when every contribution lacks evidence', () => {
    const edges = selectLearnerVisibleRelationEdges({
      links: associationLinks.map((link) => ({ ...link, evidenceState: 'unavailable' as const })),
      activeDomainNodeIds: domainNodeIds,
      enabledFamilies: ['association'],
      selectedNodeId: 'node-a',
    });

    expect(edges[0]?.evidenceState).toBe('unavailable');
  });

  it('keeps the state absent when no link carries evidence information', () => {
    const edges = selectLearnerVisibleRelationEdges({
      links: associationLinks,
      activeDomainNodeIds: domainNodeIds,
      enabledFamilies: ['association'],
      selectedNodeId: 'node-a',
    });

    expect(edges[0]?.evidenceState).toBeUndefined();
  });

  it('never hides or reorders edges solely because of evidence state', () => {
    const withoutState = selectLearnerVisibleRelationEdges({
      links: associationLinks,
      activeDomainNodeIds: domainNodeIds,
      enabledFamilies: ['association'],
      selectedNodeId: 'node-a',
    });
    const withState = selectLearnerVisibleRelationEdges({
      links: associationLinks.map((link) => ({ ...link, evidenceState: 'unavailable' as const })),
      activeDomainNodeIds: domainNodeIds,
      enabledFamilies: ['association'],
      selectedNodeId: 'node-a',
    });

    expect(withState.map((edge) => [edge.key, edge.family, edge.strength])).toEqual(
      withoutState.map((edge) => [edge.key, edge.family, edge.strength])
    );
  });
});

describe('renderer modulation and legend wiring', () => {
  it('wires the same render modulation into both renderers without breaking the locked call shapes', () => {
    const twoDimensional = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-2d.tsx'), 'utf8'
    );
    const threeDimensional = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-canvas.tsx'), 'utf8'
    );

    for (const source of [twoDimensional, threeDimensional]) {
      expect(source).toContain('getKnowledgeGraphEdgeRenderModulation({');
      expect(source).toContain('renderModulation.opacityFactor');
      expect(source).toContain('renderModulation.widthFactor');
    }
    expect(twoDimensional).toContain('getKnowledgeGraphEffectiveEdgeOpacity(style, strength, focusState)');
    expect(threeDimensional).toContain('getKnowledgeGraphEffectiveEdgeOpacity(style, strength, focusState)');
  });

  it('shares shape and coverage inputs between 3D render and pointer hit-test paths', () => {
    const source = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-canvas.tsx'), 'utf8'
    );
    const pointerSection = source.slice(source.indexOf('const handleCanvasPointerDown'));

    expect(pointerSection).toContain('sourceShape: getKnowledgeConceptNodeShape(source)');
    expect(pointerSection).toContain('targetShape: getKnowledgeConceptNodeShape(target)');
    expect(pointerSection).toContain('sourceCoverageCount: node.sourceCoverageCount');
  });

  it('matches the legend evidence swatch pair to the canvas modulation', () => {
    const legendSource = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/relation-family-control.tsx'), 'utf8'
    );
    const muted = getKnowledgeGraphEvidenceEdgeModulation('unavailable');

    expect(legendSource).toContain('getKnowledgeGraphEvidenceEdgeModulation');
    expect(legendSource).toContain('依据可用');
    expect(legendSource).toContain('依据未提供');
    expect(legendSource).toContain('item.sampleStyle.width * evidenceMuted.widthFactor');
    expect(legendSource).toContain('item.sampleStyle.opacity * evidenceMuted.opacityFactor');
    expect(legendSource).toContain('KNOWLEDGE_GRAPH_FAMILY_PRESENTATION_CONFIG[family]');
    expect(legendSource).toContain('data-knowledge-relation-family-sample={family}');
    expect(muted.opacityFactor).toBeLessThan(1);
  });
});

describe('concept shape geometry', () => {
  it('maps every macro-category shape to a renderer boundary in both renderers', () => {
    const shapes = Object.values(CONCEPT_MACRO_CATEGORY_SHAPES);
    expect(new Set(shapes).size).toBe(6);

    shapes.forEach((shape) => {
      const twoD = getKnowledgeGraphRendererNodeBoundary({ renderer: '2d', shape, presentationRadius: 10 });
      const threeD = getKnowledgeGraphRendererNodeBoundary({ renderer: '3d', shape, presentationRadius: 10 });
      expect(twoD.presentationRadius).toBe(10);
      expect(threeD.presentationRadius).toBe(10);
      for (const boundary of [twoD, threeD]) {
        const directions = boundary.shape === 'square' || boundary.shape === 'rectangle'
          || boundary.shape === 'circle' || boundary.shape.startsWith('regular-')
          ? [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0.5, y: 0.5, z: 0 }]
          : [{ x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0.5, y: 0.5, z: 0.3 }];
        for (const direction of directions) {
          const point = getKnowledgeGraphNodeBoundaryIntersection({ x: 0, y: 0, z: 0 }, direction, boundary);
          expect(Number.isFinite(point.x)).toBe(true);
          expect(Number.isFinite(point.y)).toBe(true);
          expect(Math.hypot(point.x, point.y, point.z)).toBeGreaterThan(0);
        }
      }
    });
  });

  it('lets the concept shape override the nodeType boundary', () => {
    expect(getKnowledgeGraphRendererNodeBoundary({ renderer: '2d', nodeType: 'THEORY', shape: 'triangle', presentationRadius: 8 }).shape)
      .toBe('regular-triangle');
    expect(getKnowledgeGraphRendererNodeBoundary({ renderer: '3d', nodeType: 'THEORY', shape: 'diamond', presentationRadius: 8 }).shape)
      .toBe('octahedron');
    expect(getKnowledgeGraphRendererNodeBoundary({ renderer: '2d', nodeType: 'THEORY', presentationRadius: 8 }).shape)
      .toBe('circle');
  });

  it('clips edges at the polygon vertex for concept shapes', () => {
    for (const shape of ['regular-triangle', 'regular-diamond', 'regular-pentagon', 'regular-hexagon'] as const) {
      const boundary = { shape, presentationRadius: 10 };
      // canvas y 轴向下，顶点朝上即几何 (0,-1) 方向。
      const vertex = getKnowledgeGraphNodeBoundaryIntersection({ x: 0, y: 0 }, { x: 0, y: -1 }, boundary);

      expect(vertex.y).toBeCloseTo(-12, 6);
      expect(isKnowledgeGraphPointInsideNodeBoundary({ x: 0, y: 0 }, { x: 0, y: 0 }, boundary)).toBe(true);
      expect(isKnowledgeGraphPointInsideNodeBoundary({ x: 0, y: -11.9 }, { x: 0, y: 0 }, boundary)).toBe(true);
      expect(isKnowledgeGraphPointInsideNodeBoundary({ x: 0, y: -12.1 }, { x: 0, y: 0 }, boundary)).toBe(false);
    }
  });

  it('keeps polyhedron boundaries finite and centered for new 3D shapes', () => {
    for (const shape of ['tetrahedron', 'octahedron', 'pentagonal-prism'] as const) {
      const boundary = { shape, presentationRadius: 5 };

      expect(isKnowledgeGraphPointInsideNodeBoundary({ x: 0, y: 0, z: 0 }, { x: 0, y: 0, z: 0 }, boundary)).toBe(true);
      expect(isKnowledgeGraphPointInsideNodeBoundary({ x: 50, y: 50, z: 50 }, { x: 0, y: 0, z: 0 }, boundary)).toBe(false);
      for (const direction of [
        { x: 1, y: 0, z: 0 }, { x: 0, y: 1, z: 0 }, { x: 0, y: 0, z: 1 }, { x: 0.4, y: -0.5, z: 0.75 },
      ]) {
        const point = getKnowledgeGraphNodeBoundaryIntersection({ x: 0, y: 0, z: 0 }, direction, boundary);
        const distance = Math.hypot(point.x, point.y, point.z);
        expect(Number.isFinite(distance)).toBe(true);
        expect(distance).toBeGreaterThan(0);
        expect(distance).toBeLessThanOrEqual(5.000001);
      }
    }
  });
});

describe('inspector evidence swatch parity', () => {
  it('matches the canvas modulation for the same family and evidence state', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { createElement } = await import('react');
    const { RelationEvidenceSwatch } = await import('../graph/relation-evidence-swatch');

    const style = KNOWLEDGE_GRAPH_FAMILY_PRESENTATION_CONFIG['post-requisite'].sampleStyle;
    const muted = getKnowledgeGraphEvidenceEdgeModulation('unavailable');
    const available = renderToStaticMarkup(createElement(RelationEvidenceSwatch, {
      evidenceState: 'available', family: 'post-requisite', isLightTheme: true,
    }));
    const unavailable = renderToStaticMarkup(createElement(RelationEvidenceSwatch, {
      evidenceState: 'unavailable', family: 'post-requisite', isLightTheme: true,
    }));

    expect(available).toContain(`stroke-width="${style.width}"`);
    expect(available).toContain(`opacity="${style.opacity}"`);
    expect(unavailable).toContain(`stroke-width="${style.width * muted.widthFactor}"`);
    expect(unavailable).toContain(`opacity="${style.opacity * muted.opacityFactor}"`);
    expect(unavailable).toContain('data-knowledge-relation-evidence-swatch="unavailable"');
  });

  it('renders unknown evidence state unmuted instead of guessing', async () => {
    const { renderToStaticMarkup } = await import('react-dom/server');
    const { createElement } = await import('react');
    const { RelationEvidenceSwatch } = await import('../graph/relation-evidence-swatch');

    const style = KNOWLEDGE_GRAPH_FAMILY_PRESENTATION_CONFIG.association.sampleStyle;
    const unknown = renderToStaticMarkup(createElement(RelationEvidenceSwatch, {
      family: 'association', isLightTheme: false,
    }));

    expect(unknown).toContain(`stroke-width="${style.width}"`);
    expect(unknown).toContain(`opacity="${style.opacity}"`);
    expect(unknown).toContain('data-knowledge-relation-evidence-swatch="unknown"');
  });

  it('keeps the honest fallback wording in inspector rows and wires the shared swatch', () => {
    const panelSource = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/resource-panel/resource-panel.tsx'), 'utf8'
    );

    expect(panelSource).toContain('RelationEvidenceSwatch');
    expect(panelSource).toContain(`formatRelationEvidence(node) ?? '关系依据未提供'`);
  });
});

describe('candidate governance visibility', () => {
  const snapshot = {
    nodes: [
      { id: 'node-a', candidate: false },
      { id: 'node-b' },
      { id: 'node-candidate', candidate: true },
    ],
    links: [
      { id: 'link-plain', sourceId: 'node-a', targetId: 'node-b' },
      { id: 'link-candidate', sourceId: 'node-a', targetId: 'node-candidate' },
    ],
    corridorLinks: [
      { id: 'corridor-candidate', sourceId: 'node-b', targetId: 'node-candidate' },
    ],
    corridorCycleEdgeIds: ['corridor-candidate'],
    membershipLinks: [
      { id: 'membership-a', sourceId: 'chapter-node:第 1 章', targetId: 'node-a' },
      { id: 'membership-candidate', sourceId: 'chapter-node:第 1 章', targetId: 'node-candidate' },
    ],
  };

  it.each(['student', 'audit', undefined, null] as const)('excludes candidates and incident edges for learner-facing role %s', async (role) => {
    const { filterKnowledgeGraphCandidateSnapshot } = await import('../graph/candidate-visibility');
    const scoped = filterKnowledgeGraphCandidateSnapshot(snapshot, role);

    expect(scoped.nodes.map((node) => node.id)).toEqual(['node-a', 'node-b']);
    expect(scoped.links.map((link) => link.id)).toEqual(['link-plain']);
    expect(scoped.corridorLinks).toEqual([]);
    expect(scoped.membershipLinks.map((link) => link.id)).toEqual(['membership-a']);
    expect(scoped.corridorCycleEdgeIds).toEqual(['corridor-candidate']);
    expect(scoped.hiddenCandidateNodeCount).toBe(1);
  });

  it.each(['teacher', 'admin'] as const)('keeps every candidate for review role %s', async (role) => {
    const { filterKnowledgeGraphCandidateSnapshot } = await import('../graph/candidate-visibility');
    const scoped = filterKnowledgeGraphCandidateSnapshot(snapshot, role);

    expect(scoped.nodes).toHaveLength(3);
    expect(scoped.links).toHaveLength(2);
    expect(scoped.corridorLinks).toHaveLength(1);
    expect(scoped.membershipLinks).toHaveLength(2);
    expect(scoped.hiddenCandidateNodeCount).toBe(0);
  });

  it('leaves non-candidate graphs byte-identical for learner roles', async () => {
    const { filterKnowledgeGraphCandidateSnapshot } = await import('../graph/candidate-visibility');
    const plain = {
      ...snapshot,
      nodes: snapshot.nodes.filter((node) => node.candidate !== true),
      links: snapshot.links.filter((link) => link.id === 'link-plain'),
      corridorLinks: [],
      membershipLinks: snapshot.membershipLinks.filter((link) => link.id === 'membership-a'),
    };
    const scoped = filterKnowledgeGraphCandidateSnapshot(plain, 'student');

    expect(scoped.nodes).toEqual(plain.nodes);
    expect(scoped.links).toEqual(plain.links);
    expect(scoped.corridorLinks).toEqual([]);
    expect(scoped.membershipLinks).toEqual(plain.membershipLinks);
    expect(scoped.hiddenCandidateNodeCount).toBe(0);
  });

  it('wires the view-model filter, count annotation, and teacher rendering into the system', () => {
    const systemSource = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/knowledge-graph-system.tsx'), 'utf8'
    );
    const twoDimensional = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-2d.tsx'), 'utf8'
    );
    const threeDimensional = readFileSync(
      path.join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-canvas.tsx'), 'utf8'
    );

    expect(systemSource).toContain('filterKnowledgeGraphCandidateSnapshot(navigationSnapshot, viewerRole)');
    expect(systemSource).toContain('selectKnowledgeNavigationSnapshot(graphCache, navigation.view)');
    expect(systemSource).toContain('已隐藏 ${hiddenCandidateNodeCount} 个候选');
    expect(systemSource).toContain('isKnowledgeGraphTeacherReviewRole(viewerRole)');

    expect(twoDimensional).toContain('KNOWLEDGE_GRAPH_CANDIDATE_PRESENTATION');
    expect(twoDimensional).toContain('node.candidate === true');
    expect(twoDimensional).toContain('setLineDash([4 / globalScale, 3 / globalScale])');
    expect(threeDimensional).toContain('LineDashedMaterial');
    expect(threeDimensional).toContain('node.candidate === true');
  });
});

describe('root catalog candidate passthrough', () => {
  it('carries candidate identity through the server root catalog contract', () => {
    const payload = buildKnowledgeGraphRootPayload({
      source: 'file',
      nodes: [
        { id: 'node-a', name: '节点 A', nodeType: 'THEORY', description: '', positionX: 0, positionY: 0, positionZ: 0, chapterName: '稳定性' },
        { id: 'node-candidate', name: '候选节点', nodeType: 'THEORY', description: '', positionX: 0, positionY: 0, positionZ: 0, chapterName: '稳定性', candidate: true },
      ],
      links: [],
    });

    const candidateEntry = payload.rootCatalog?.find((entry) => entry.nodeId === 'node-candidate');
    const plainEntry = payload.rootCatalog?.find((entry) => entry.nodeId === 'node-a');

    expect(candidateEntry?.candidate).toBe(true);
    expect(plainEntry).toBeDefined();
    expect(plainEntry && 'candidate' in plainEntry).toBe(false);
  });
});
