import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildKnowledgeGraphEdgeLaneCurvatures,
  createKnowledgeGraphRendererEdgePath,
  getKnowledgeGraphEdgeEmphasisState,
  getKnowledgeGraphEdgePresentation,
  getKnowledgeGraphNodeEmphasisOpacity,
  getKnowledgeGraphPresentationLinkKey,
  selectKnowledgeGraphStructuralForegroundEdgeIds,
  KNOWLEDGE_GRAPH_UNSELECTED_POST_EDGE_LIMIT,
  selectKnowledgeGraphFocusedPresentationLinks,
} from '../graph/edge-presentation';
import { getKnowledgeGraphEndpointArrow } from '../graph/edge-geometry';
import {
  KNOWLEDGE_GRAPH_FAMILY_PRESENTATION_CONFIG,
  getKnowledgeGraphCompositeContrastRatio,
  getKnowledgeGraphEffectiveEdgeOpacity,
  getKnowledgeGraphEffectiveEdgeWidth,
} from '../graph/visual-config';
import {
  selectCanonicalDomainRelationEdges,
  selectLearnerVisibleRelationEdges,
} from '../graph/relation-family-controls';

const post = (id: string, sourceId: string, targetId: string) => ({
  id,
  sourceId,
  targetId,
  relation: 'prerequisite',
  relationType: 'prerequisite',
});

describe('shared knowledge graph edge presentation', () => {
  it('keeps a single edge straight and clips it to renderer-accurate boundaries', () => {
    const link = post('straight', 'source', 'target');
    const lanes = buildKnowledgeGraphEdgeLaneCurvatures([link]);
    expect(lanes.get('straight')).toBe(0);

    const twoDimensional = createKnowledgeGraphRendererEdgePath({
      renderer: '2d', link, source: { x: 0, y: 0 }, target: { x: 100, y: 0 },
      sourceNodeType: 'CONCEPT', targetNodeType: 'SCENARIO',
      sourcePresentationRadius: 10, targetPresentationRadius: 10,
      laneCurvature: lanes.get('straight')!,
    });
    const threeDimensional = createKnowledgeGraphRendererEdgePath({
      renderer: '3d', link, source: { x: 0, y: 0, z: 0 }, target: { x: 100, y: 0, z: 0 },
      sourceNodeType: 'CONCEPT', targetNodeType: 'SCENARIO',
      sourcePresentationRadius: 10, targetPresentationRadius: 10,
      laneCurvature: lanes.get('straight')!,
    });

    expect(twoDimensional.kind).toBe('line');
    expect(twoDimensional.start.x).toBeCloseTo(10);
    expect(twoDimensional.end.x).toBeCloseTo(92);
    expect(threeDimensional.kind).toBe('line');
    expect(threeDimensional.start.x).toBeCloseTo(8);
    expect(threeDimensional.end.x).toBeCloseTo(93);
  });

  it('assigns stable signed quadratic lanes to reciprocal and cross-family edges', () => {
    const reciprocal = [post('forward', 'a', 'b'), post('reverse', 'b', 'a')];
    const reciprocalLanes = buildKnowledgeGraphEdgeLaneCurvatures(reciprocal);
    expect([...reciprocalLanes.values()].filter((curvature) => curvature === 0)).toHaveLength(1);
    expect(new Set(reciprocalLanes.values()).size).toBe(2);
    reciprocal.forEach((link) => expect(['line', 'quadratic']).toContain(createKnowledgeGraphRendererEdgePath({
      renderer: '2d', link, source: { x: link.sourceId === 'a' ? 0 : 100, y: 0 },
      target: { x: link.targetId === 'b' ? 100 : 0, y: 0 },
      sourcePresentationRadius: 8, targetPresentationRadius: 8,
      laneCurvature: reciprocalLanes.get(getKnowledgeGraphPresentationLinkKey(link))!,
    }).kind));

    const crossFamily = [
      { id: 'child', sourceId: 'a', targetId: 'b', relation: 'contains' },
      post('post', 'a', 'b'),
      { id: 'association', sourceId: 'a', targetId: 'b', relation: 'related' },
    ];
    const crossFamilyLanes = buildKnowledgeGraphEdgeLaneCurvatures(crossFamily);
    expect(new Set(crossFamily.map((link) => crossFamilyLanes.get(link.id))).size).toBe(3);
    expect([...crossFamilyLanes.values()].filter((curvature) => curvature === 0)).toHaveLength(1);
  });

  it('derives lanes from the complete canonical identity set independent of input order', () => {
    const canonical = [
      { id: 'child', sourceId: 'a', targetId: 'b', relation: 'contains' },
      post('post', 'a', 'b'),
      { id: 'association', sourceId: 'a', targetId: 'b', relation: 'related' },
      post('straight-post', 'b', 'c'),
    ];
    const baseline = buildKnowledgeGraphEdgeLaneCurvatures(canonical);
    const reordered = buildKnowledgeGraphEdgeLaneCurvatures([...canonical].reverse());
    canonical.forEach((link) => expect(reordered.get(link.id)).toBe(baseline.get(link.id)));
    expect(baseline.get('straight-post')).toBe(0);
    expect([baseline.get('post'), baseline.get('child'), baseline.get('association')]
      .filter((curvature) => curvature === 0)).toHaveLength(1);
  });

  it('allocates unique slots for the reviewer reciprocal plus cross-family fixture', () => {
    const fixture = [
      { id: 'child-reverse', sourceId: 'b', targetId: 'a', relation: 'contains' },
      post('post-forward', 'a', 'b'),
      post('post-reverse', 'b', 'a'),
    ];
    const baseline = buildKnowledgeGraphEdgeLaneCurvatures(fixture);
    const values = fixture.map((link) => baseline.get(link.id));
    expect(new Set(values).size).toBe(3);
    expect(values.filter((value) => value === 0)).toHaveLength(1);
    const reordered = buildKnowledgeGraphEdgeLaneCurvatures([fixture[2], fixture[0], fixture[1]]);
    fixture.forEach((link) => expect(reordered.get(link.id)).toBe(baseline.get(link.id)));

    const paths = fixture.map((link) => createKnowledgeGraphRendererEdgePath({
      renderer: '3d',
      link,
      source: { x: link.sourceId === 'a' ? 0 : 100, y: 0, z: 0 },
      target: { x: link.targetId === 'b' ? 100 : 0, y: 0, z: 0 },
      sourcePresentationRadius: 8,
      targetPresentationRadius: 8,
      laneCurvature: baseline.get(link.id)!,
    }));
    expect(paths.filter((path) => path.kind === 'line')).toHaveLength(1);
    expect(new Set(paths.map((path) => path.kind === 'quadratic' ? path.control.y : 0)).size).toBe(3);
    paths.forEach((path) => expect(getKnowledgeGraphEndpointArrow(
      path, { length: 3, halfWidth: 1.5 },
    ).tip).toEqual(path.end));
  });

  it('places directed arrows at the target boundary and keeps associations dashed without arrows', () => {
    const link = post('post', 'a', 'b');
    const path = createKnowledgeGraphRendererEdgePath({
      renderer: '2d', link, source: { x: 0, y: 0 }, target: { x: 40, y: 0 },
      sourcePresentationRadius: 5, targetPresentationRadius: 7, laneCurvature: 0,
    });
    const arrow = getKnowledgeGraphEndpointArrow(path, { length: 3, halfWidth: 1.5 });
    expect(arrow.tip).toEqual(path.end);
    expect(path.end.x).toBeCloseTo(33);

    const association = getKnowledgeGraphEdgePresentation({
      id: 'association', sourceId: 'a', targetId: 'b', relation: 'related',
    });
    expect(association.directed).toBe(false);
    expect(association.style.hasArrow).toBe(false);
    expect(association.style.dash.length).toBeGreaterThan(0);

    const child = getKnowledgeGraphEdgePresentation({
      id: 'child', sourceId: 'a', targetId: 'b', relation: 'contains',
    });
    const postPresentation = getKnowledgeGraphEdgePresentation(link);
    expect(child.style.curvature).toBe(0);
    expect(child.style.dash).not.toEqual(postPresentation.style.dash);
    expect(child.style.dash).not.toEqual(association.style.dash);
    expect(postPresentation.style.dash).toEqual([]);
  });

  it('keeps published reverse Authority predicates directed without swapping endpoints', () => {
    const partOf = getKnowledgeGraphEdgePresentation({
      id: 'part-of', sourceId: 'part', targetId: 'whole', relation: 'part_of',
    });
    const derivedFrom = getKnowledgeGraphEdgePresentation({
      id: 'derived-from', sourceId: 'result', targetId: 'origin', relation: 'derived_from',
    });
    expect(partOf.directed).toBe(true);
    expect(partOf.style.hasArrow).toBe(true);
    expect(derivedFrom.directed).toBe(true);
    expect(derivedFrom.style.hasArrow).toBe(true);
  });

  it('keeps every final edge and legend focus state above the non-text 3:1 contrast contract', () => {
    Object.values(KNOWLEDGE_GRAPH_FAMILY_PRESENTATION_CONFIG).forEach(({ sampleStyle }) => {
      for (const focusState of ['neutral', 'active'] as const) {
        const opacity = getKnowledgeGraphEffectiveEdgeOpacity(sampleStyle, 0, focusState);
        expect(getKnowledgeGraphCompositeContrastRatio(sampleStyle.lightColor, '#ffffff', opacity))
          .toBeGreaterThanOrEqual(3);
        expect(getKnowledgeGraphCompositeContrastRatio(sampleStyle.darkColor, '#091540', opacity))
          .toBeGreaterThanOrEqual(3);
      }
      expect(getKnowledgeGraphCompositeContrastRatio(
        sampleStyle.lightColor, '#ffffff', sampleStyle.opacity,
      )).toBeGreaterThanOrEqual(3);
      expect(getKnowledgeGraphCompositeContrastRatio(
        sampleStyle.darkColor, '#091540', sampleStyle.opacity,
      )).toBeGreaterThanOrEqual(3);
    });
    expect(getKnowledgeGraphEffectiveEdgeOpacity({ opacity: 1 }, 1, 'dimmed')).toBeLessThanOrEqual(0.22);
  });

  it('restricts both renderers to the same active-domain visible subset', () => {
    const visible = selectLearnerVisibleRelationEdges({
      links: [
        { id: 'inside', sourceId: 'a', targetId: 'b', relation: 'prerequisite' },
        { id: 'cross-domain', sourceId: 'a', targetId: 'outside', relation: 'prerequisite' },
      ],
      activeDomainNodeIds: new Set(['a', 'b']),
      enabledFamilies: ['post-requisite'],
      selectedNodeId: 'a',
    });
    expect(visible.map((edge) => edge.relationIds[0])).toEqual(['inside']);

    const system = readFileSync(join(process.cwd(), 'src/features/knowledge/knowledge-graph-system.tsx'), 'utf8');
    expect(system.match(/nodes=\{displayNodes\}/g)).toHaveLength(2);
    expect(system.match(/links=\{renderDisplayLinks\}/g)).toHaveLength(2);
    expect(system).toContain('selectKnowledgeGraphFocusedPresentationLinks');
    expect(system.match(/presentationLinks=\{canonicalPresentationLinks\}/g)).toHaveLength(2);
    expect(system.match(/selectedCorridorEmphasis=\{selectedCorridorEmphasis\}/g)).toHaveLength(2);
    expect(system).toContain('deriveSelectedKnowledgeGraphCorridor');
    expect(system).toContain('adjacentDomainNavigations={(selectedCorridor?.adjacentDomainNavigations ?? [])');
    expect(system).toContain('isKnowledgeGraphTeacherReviewRole(viewerRole)');
    const inspector = readFileSync(join(process.cwd(), 'src/features/knowledge/resource-panel/resource-panel.tsx'), 'utf8');
    expect(inspector).toContain("data-knowledge-corridor-adjacent-navigation={adjacentNavigation ? 'true' : undefined}");
  });

  it('keeps canonical lane input complete while visible associations retain the Task 4.1 cap', () => {
    const links = Array.from({ length: 30 }, (_, index) => ({
      id: `association-${index}`,
      sourceId: 'a',
      targetId: `node-${index}`,
      relation: 'related',
    }));
    const activeDomainNodeIds = new Set(['a', ...links.map((link) => link.targetId)]);
    expect(selectCanonicalDomainRelationEdges({ links, activeDomainNodeIds })).toHaveLength(30);
    expect(selectLearnerVisibleRelationEdges({
      links, activeDomainNodeIds, enabledFamilies: ['association'], selectedNodeId: 'a',
    })).toHaveLength(24);
  });

  it('keeps edge, node, and label layering plus selected emphasis identical in 2D and 3D', () => {
    const emphasis = {
      selectedNodeId: 'a',
      nodeIds: ['a', 'b', 'c'],
      edgeIds: ['corridor-edge', 'corridor-context'],
      primaryEdgeIds: ['corridor-edge'],
      primaryNodeIds: ['a', 'b'],
    };
    const corridor = post('corridor-edge', 'a', 'b');
    const corridorContext = post('corridor-context', 'b', 'c');
    const unrelated = post('unrelated', 'c', 'd');
    const association = { id: 'association-edge', sourceId: 'a', targetId: 'd', relation: 'related' };
    expect(getKnowledgeGraphEdgeEmphasisState({ link: corridor, emphasis })).toBe('active');
    expect(getKnowledgeGraphEdgeEmphasisState({ link: corridorContext, emphasis })).toBe('secondary');
    expect(getKnowledgeGraphEdgeEmphasisState({ link: unrelated, emphasis })).toBe('dimmed');
    expect(getKnowledgeGraphEdgeEmphasisState({ link: association, emphasis })).toBe('secondary');
    expect(getKnowledgeGraphNodeEmphasisOpacity('a', emphasis)).toBe(1);
    expect(getKnowledgeGraphNodeEmphasisOpacity('c', emphasis)).toBeGreaterThan(0.5);
    expect(getKnowledgeGraphNodeEmphasisOpacity('d', emphasis)).toBeLessThanOrEqual(0.2);
    expect(getKnowledgeGraphEffectiveEdgeWidth({ width: 1.1 }, 1, 'active', '2d'))
      .toBeGreaterThanOrEqual(getKnowledgeGraphEffectiveEdgeWidth({ width: 1.1 }, 1, 'dimmed', '2d') * 1.5);

    const twoDimensional = readFileSync(join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-2d.tsx'), 'utf8');
    const threeDimensional = readFileSync(join(process.cwd(), 'src/features/knowledge/graph/knowledge-graph-canvas.tsx'), 'utf8');
    for (const source of [twoDimensional, threeDimensional]) {
      expect(source).toContain('data-knowledge-render-layer-order="edge,node,label"');
      expect(source).toContain('data-knowledge-selected-emphasis-contract="shared-corridor-input"');
      expect(source).toContain('createKnowledgeGraphRendererEdgePath');
      expect(source).toContain('getKnowledgeGraphEdgeEmphasisState');
      expect(source).toContain('getKnowledgeGraphNodeEmphasisOpacity');
    }
  });

  it('chooses a stable directional skeleton and hides the remaining dense post relations from the canvas', () => {
    const links = Array.from({ length: 132 }, (_, targetIndex) => (
      Array.from({ length: 4 }, (_, sourceOffset) => ({
        ...post(
          `post-${String(targetIndex).padStart(3, '0')}-${sourceOffset}`,
          `node-${(targetIndex + sourceOffset + 1) % 132}`,
          `node-${targetIndex}`,
        ),
        strength: sourceOffset === 2 ? 1 : 0.5,
      }))
    )).flat();

    const foreground = selectKnowledgeGraphStructuralForegroundEdgeIds(links);
    const reordered = selectKnowledgeGraphStructuralForegroundEdgeIds([...links].reverse());
    const visible = selectKnowledgeGraphFocusedPresentationLinks({ links });
    const reorderedVisible = selectKnowledgeGraphFocusedPresentationLinks({ links: [...links].reverse() });

    expect(links).toHaveLength(528);
    expect(foreground).toEqual(reordered);
    expect(foreground).toHaveLength(KNOWLEDGE_GRAPH_UNSELECTED_POST_EDGE_LIMIT);
    expect(foreground.every((edgeId) => links.some((link) => link.id === edgeId))).toBe(true);
    expect(foreground.length).toBeLessThan(links.length);
    expect(visible.map((link) => link.id).sort()).toEqual(foreground);
    expect(reorderedVisible).toEqual(visible);
  });

  it('shows only the deterministic primary post trunk while preserving non-post selection context', () => {
    const corridor = Array.from({ length: 4 }, (_, index) => post(`corridor-${index}`, `c-${index}`, `c-${index + 1}`));
    const unfocused = Array.from({ length: 80 }, (_, index) => ({
      ...post(`unfocused-${String(index).padStart(2, '0')}`, `u-${index}`, `u-${index + 1}`),
      strength: index % 3 / 2,
    }));
    const association = { id: 'association', sourceId: 'a', targetId: 'b', relation: 'related' };
    const emphasis = {
      selectedNodeId: 'c-2',
      nodeIds: ['c-0', 'c-1', 'c-2', 'c-3', 'c-4'],
      edgeIds: corridor.map((link) => link.id),
      primaryEdgeIds: ['corridor-1', 'corridor-2'],
      primaryNodeIds: ['c-1', 'c-2', 'c-3'],
    };

    const selected = selectKnowledgeGraphFocusedPresentationLinks({
      links: [...unfocused, association, ...corridor],
      emphasis,
    });
    const reordered = selectKnowledgeGraphFocusedPresentationLinks({
      links: [...corridor, association, ...unfocused].reverse(),
      emphasis,
    });

    expect(selected.filter((link) => link.id.startsWith('unfocused-'))).toHaveLength(0);
    expect(selected.filter((link) => link.id.startsWith('corridor-')).map((link) => link.id))
      .toEqual(['corridor-1', 'corridor-2']);
    expect(selected).toEqual(reordered);
    expect(selected.map((link) => link.id)).toContain('association');
  });

  it('keeps 2D and 3D selected motion on the same eligible-edge, geometry, tangent, and reduced-motion contract', () => {
    const twoDimensional = readFileSync(join(
      process.cwd(), 'src/features/knowledge/graph/knowledge-graph-2d.tsx'
    ), 'utf8');
    const threeDimensional = readFileSync(join(
      process.cwd(), 'src/features/knowledge/graph/knowledge-graph-canvas.tsx'
    ), 'utf8');

    for (const source of [twoDimensional, threeDimensional]) {
      expect(source).toContain('selectKnowledgeGraphMotionMarkerEdgeIds');
      expect(source).toContain('motionEligibleEdgeIds');
      expect(source).toContain('motionSuppressedEdgeIds');
      expect(source).toContain('createKnowledgeGraphRendererEdgePath');
      expect(source).toContain('getKnowledgeGraphMotionMarkerPlacement');
      expect(source).toContain('getKnowledgeGraphMotionMarkerFrame');
      expect(source).toContain('bindKnowledgeGraphMotionEnvironment');
      expect(source).toContain('motionEnvironmentActive');
      expect(source).toContain('prefersReducedKnowledgeGraphMotion');
      expect(source).toContain('KnowledgeGraphMotionFrameLoop');
      expect(source).toContain('data-knowledge-motion-marker-count');
    }
  });
});
