import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

import {
  buildDefaultSelectedRelationTypes,
  getRelationFocusState,
  isHighSignalRelation,
  limitStructureRelationDensity,
  relationPassesDensity,
} from '../graph/filter-utils';
import { getRelationStyle, getRelationThreeDimensionalEncoding } from '../graph/visual-config';

describe('knowledge graph relation visual semantics', () => {
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

    expect(getRelationStyle('prerequisite').dash).toEqual([]);
    expect(source).toContain('实线箭头：前置/基础');
    expect(getRelationStyle('leads_to').dash.length).toBeGreaterThan(0);
    expect(source).toContain('长虚线箭头：后续/引出');
    expect(getRelationStyle('applies_to').dash).not.toEqual(getRelationStyle('leads_to').dash);
    expect(source).toContain('短虚线箭头：应用');
    expect(getRelationStyle('opposite').hasArrow).toBe(false);
    expect(source).toContain('短虚线无箭头：对立');
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

    expect(prerequisite3d.arrowLength).toBeGreaterThan(0);
    expect(related3d.arrowLength).toBe(0);
    expect(opposite3d.directionalParticles).toBeGreaterThan(related3d.directionalParticles);
    expect(opposite3d.particleWidth).toBeGreaterThan(related3d.particleWidth);
    expect(appliesTo3d.directionalParticles).toBeGreaterThan(prerequisite3d.directionalParticles);
  });
});
