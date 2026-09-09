import { describe, expect, it } from 'vitest';

import type { KnowledgeLinkData, KnowledgeNodeData } from '../knowledge-graph-system';
import {
  activeAuthorityStructureSignature,
  deriveActiveAuthorityLayout,
  getActiveAuthorityWorldBounds,
  reconcileActiveAuthorityLayout,
  type ActiveAuthorityLayoutSession,
} from '../graph/active-renderer/active-authority-geometry';
import {
  buildActiveAuthorityLabelDescriptors,
  placeActiveAuthorityLabels,
} from '../graph/active-renderer/active-authority-label-geometry';
import { activeAuthorityCameraPoseFrom2DTransform, activeFocusNodeIds } from '../graph/active-renderer/active-authority-visual';

function node(id: string, name: string, conceptKind = 'DomainConcept'): KnowledgeNodeData {
  return {
    id,
    name,
    nodeType: 'THEORY',
    description: '',
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    conceptKind,
    metadata: {
      presentationShape: conceptKind === 'SystemModel' ? 'hexagon' : 'circle',
      activeTone: conceptKind === 'Formula' ? 'amber' : 'cyan',
    },
  };
}

function link(
  id: string,
  sourceId: string,
  targetId: string,
  relation = 'prerequisite',
): KnowledgeLinkData {
  return { id, sourceId, targetId, relation, relationType: relation };
}

describe('active authority renderer geometry', () => {
  it('preserves initialized positions through filters, new neighbors and localized labels', () => {
    const session: ActiveAuthorityLayoutSession = { nodes: new Map(), relayoutVersion: 0 };
    const nodes = Array.from({ length: 153 }, (_, i) => node(`n-${i}`, `概念${i}`));
    const input = { nodes, links: [] as KnowledgeLinkData[], dimension: '2d' as const, relayoutVersion: 0 };
    const initial = reconcileActiveAuthorityLayout(session, input);
    const positions = new Map(initial.map((n) => [n.id, [n.x, n.y, n.z]]));
    reconcileActiveAuthorityLayout(session, { ...input, nodes: nodes.slice(0, 12) });
    const expanded = reconcileActiveAuthorityLayout(session, {
      ...input,
      nodes: [...nodes.map((n) => ({ ...n, name: `English ${n.id}` })), node('new', '新增邻域')],
      links: [link('new-edge', 'n-0', 'new')],
    });
    for (const n of expanded.filter((n) => positions.has(n.id))) {
      expect([n.x, n.y, n.z]).toEqual(positions.get(n.id));
    }
    expect(expanded.find((n) => n.id === 'n-0')).toBe(initial.find((n) => n.id === 'n-0'));
    expect(expanded.find((n) => n.id === 'n-0')?.name).toBe('English n-0');
  });

  it('gives root and disconnected domain 3D graphs comparable extent on all three axes', () => {
    for (const kind of ['root', 'domain']) {
      const nodes = Array.from({ length: kind === 'root' ? 16 : 153 }, (_, i) => ({
        ...node(`${kind}-${i}`, `节点${i}`),
        ...(kind === 'root' ? { metadata: { presentationKind: 'domain' } } : {}),
      }));
      const layout = deriveActiveAuthorityLayout({ nodes, links: [], dimension: '3d' });
      const bounds = getActiveAuthorityWorldBounds(layout);
      expect(bounds.depth / Math.max(bounds.width, bounds.height)).toBeGreaterThan(0.4);
      expect(layout.every((n) => [n.x, n.y, n.z].every(Number.isFinite))).toBe(true);
    }
  });

  it.each(['2d', '3d'] as const)('places isolated nodes around a central connected group in %s', (dimension) => {
    const core = Array.from({ length: 24 }, (_, index) => node('core-' + index, '关联概念' + index));
    const isolated = Array.from({ length: 96 }, (_, index) => node('isolated-' + index, '其他概念' + index));
    const layout = deriveActiveAuthorityLayout({ nodes: [...core, ...isolated],
      links: core.slice(1).map((entry, index) => link('core-link-' + index, core[index].id, entry.id)), dimension });
    const centerNodes = layout.filter((entry) => entry.id.startsWith('core-'));
    const outside = layout.filter((entry) => entry.id.startsWith('isolated-'));
    const center = getActiveAuthorityWorldBounds(centerNodes).center;
    const radius = (entry: typeof layout[number]) => Math.hypot(entry.x - center.x, entry.y - center.y, dimension === '3d' ? entry.z - center.z : 0);
    const coreRadius = Math.max(...centerNodes.map(radius));
    expect(outside.every((entry) => radius(entry) > coreRadius + 80)).toBe(true);
    for (const axis of dimension === '3d' ? ['x', 'y', 'z'] as const : ['x', 'y'] as const) {
      expect(outside.filter((entry) => entry[axis] < center[axis]).length).toBeGreaterThan(30);
      expect(outside.filter((entry) => entry[axis] > center[axis]).length).toBeGreaterThan(30);
    }
    expect(new Set(outside.map((entry) => entry.y.toFixed(1))).size).toBeGreaterThan(80);
  });

  it('packs root entries around the world origin with balanced coordinates', () => {
    const roots = ['modeling', 'frequency', 'stability', 'state-space', 'aggregate'].map((id) => ({
      ...node(`root-entry-${id}`, id),
      metadata: { presentationKind: id === 'aggregate' ? 'aggregate' : 'domain', presentationRadius: 72 },
    }));
    const layout = deriveActiveAuthorityLayout({ nodes: roots, links: [], dimension: '2d' });
    const bounds = getActiveAuthorityWorldBounds(layout);
    expect(bounds.center.x).toBeCloseTo(0, 8);
    expect(bounds.center.y).toBeCloseTo(0, 8);
    expect(new Set(layout.map((row) => `${row.x}:${row.y}`)).size).toBe(layout.length);
  });

  it('uses prerequisite depth and connected components while keeping 3D depth finite', () => {
    const nodes = [
      node('a', '基础概念'),
      node('b', '系统模型', 'SystemModel'),
      node('c', '模型表示'),
      node('d', '旁支对象'),
      node('isolated', '孤立陈述', 'KnowledgeStatement'),
    ];
    const links = [
      link('edge-a-b', 'a', 'b'),
      link('edge-b-c', 'b', 'c'),
      link('edge-c-d', 'c', 'd', 'association'),
    ];
    const first = deriveActiveAuthorityLayout({ nodes, links, dimension: '3d' });
    const second = deriveActiveAuthorityLayout({ nodes: [...nodes].reverse(), links: [...links].reverse(), dimension: '3d' });
    const byId = new Map(first.map((row) => [row.id, row]));
    const secondById = new Map(second.map((row) => [row.id, row]));
    expect(first.map((row) => row.id)).toEqual(['a', 'b', 'c', 'd', 'isolated']);
    expect(byId.get('b')!.layoutLevel).toBeGreaterThan(byId.get('a')!.layoutLevel);
    expect(byId.get('c')!.layoutLevel).toBeGreaterThan(byId.get('b')!.layoutLevel);
    expect(byId.get('isolated')!.layoutComponent).not.toBe(byId.get('a')!.layoutComponent);
    expect(first.map((row) => [row.id, row.x, row.y, row.z])).toEqual(
      second.map((row) => [row.id, row.x, row.y, row.z]),
    );
    expect(getActiveAuthorityWorldBounds(first).depth).toBeGreaterThan(0);
    expect([...secondById.values()].every((row) => [row.x, row.y, row.z].every(Number.isFinite))).toBe(true);
  });

  it('keeps explicit positions stable and changes deterministic seeds on relayout', () => {
    const nodes = [node('a', 'A'), node('b', 'B'), node('c', 'C')];
    const links = [link('edge-a-b', 'a', 'b')];
    const pinned = deriveActiveAuthorityLayout({
      nodes,
      links,
      dimension: '2d',
      layoutState: { version: 1, positionsByNodeId: { b: { x: 91, y: -17, pinned: true } } },
    });
    expect(pinned.find((row) => row.id === 'b')).toMatchObject({ x: 91, y: -17, fx: 91, fy: -17 });
    const initial = deriveActiveAuthorityLayout({ nodes, links, dimension: '2d', layoutSalt: 'initial' });
    const reflowed = deriveActiveAuthorityLayout({ nodes, links, dimension: '2d', layoutSalt: 'relayout' });
    expect(reflowed.map((row) => [row.x, row.y])).not.toEqual(initial.map((row) => [row.x, row.y]));
  });

  it('always provides plain label fallback and gives selected labels priority', () => {
    const nodes = [
      node('plain', '普通节点'),
      { ...node('missing-title', '富标题缺失'), richTitle: { state: 'missing' as const } },
      { ...node('formula', '特征方程', 'Formula'), mathematics: {
        state: 'available' as const,
        display: 'inline' as const,
        latex: 's+1',
        macroProfileId: 'profile',
        macroProfileHash: 'hash',
        accessibleLabel: '特征方程',
        copyLatex: 's+1',
        renderKey: 'formula-key',
      } },
    ];
    const layout = deriveActiveAuthorityLayout({ nodes, links: [], dimension: '2d' });
    const descriptors = buildActiveAuthorityLabelDescriptors({
      nodes: layout,
      kind: 'domain',
      selectedNodeId: 'missing-title',
      hoveredNodeId: null,
    });
    const missing = descriptors.find((label) => label.id === 'missing-title')!;
    const formula = descriptors.find((label) => label.id === 'formula')!;
    expect(missing.fallbackLines.join('')).toContain('富标题缺失');
    expect(missing.priority).toBe(5);
    expect(formula.mathematics?.state).toBe('available');
    expect(formula.humanContext).toBeUndefined();

    const points = new Map(layout.map((row, index) => [row.id, { x: 120 + index * 2, y: 120, scale: 1 }]));
    const placements = placeActiveAuthorityLabels({
      descriptors,
      points,
      width: 280,
      height: 220,
      selectedNodeId: 'missing-title',
      hoveredNodeId: null,
    });
    expect(placements.find((label) => label.id === 'missing-title')?.visible).toBe(true);
    expect(placements.find((label) => label.id === 'missing-title')?.opacity).toBe(1);
  });

  it('shows labels for the selected node and direct neighbors but not unrelated hovered nodes', () => {
    const layout = deriveActiveAuthorityLayout({ nodes: [node('a', '选中概念'), node('b', '直接邻居'), node('c', '其他概念')], links: [link('a-b', 'a', 'b')], dimension: '2d' });
    const points = new Map(layout.map((entry, index) => [entry.id, { x: 100 + 180 * index, y: 100, scale: 1 }]));
    const focused = buildActiveAuthorityLabelDescriptors({ nodes: layout, kind: 'domain', selectedNodeId: 'a', hoveredNodeId: 'c', focusNodeIds: activeFocusNodeIds([link('a-b', 'a', 'b')], 'a') });
    const placed = placeActiveAuthorityLabels({ descriptors: focused, points, width: 600, height: 300, selectedNodeId: 'a', hoveredNodeId: 'c' });
    expect(placed.filter((label) => label.visible).map((label) => label.id).sort()).toEqual(['a', 'b']);
    const cleared = buildActiveAuthorityLabelDescriptors({ nodes: layout, kind: 'domain', selectedNodeId: null, hoveredNodeId: null });
    expect(placeActiveAuthorityLabels({ descriptors: cleared, points, width: 600, height: 300, selectedNodeId: null, hoveredNodeId: null }).filter((label) => label.visible)).toHaveLength(3);
  });

  it('keeps graph identity sensitive to dimension, relayout, and real edges', () => {
    const nodes = [node('a', 'A'), node('b', 'B')];
    const edge = link('edge-a-b', 'a', 'b');
    const base = activeAuthorityStructureSignature(nodes, [edge], '2d', 0);
    expect(activeAuthorityStructureSignature(nodes, [edge], '3d', 0)).not.toBe(base);
    expect(activeAuthorityStructureSignature(nodes, [edge], '2d', 1)).not.toBe(base);
    expect(activeAuthorityStructureSignature(nodes, [], '2d', 0)).not.toBe(base);
  });

  it('records the graph point at the actual 2D screen center for camera restore', () => {
    const pose = activeAuthorityCameraPoseFrom2DTransform({ k: 2, x: 250, y: 180 }, 640, 480);
    expect(pose.target).toEqual({ x: 250, y: 180, z: 0 });
    expect(pose.viewport).toEqual({ width: 640, height: 480 });
  });
});
