import { readFileSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import type { KnowledgeLinkData, KnowledgeNodeData } from '../knowledge-graph-system';
import { deriveActiveAuthorityLayout } from '../graph/active-renderer/active-authority-geometry';
import {
  balanceActiveRootLabelLines,
  buildActiveAuthorityLabelDescriptors,
  placeActiveAuthorityLabels,
} from '../graph/active-renderer/active-authority-label-geometry';
import {
  fallbackActiveCanvasPalette,
  hslTripletToHex,
  withAlpha,
} from '../graph/active-renderer/active-authority-palette';
import { activeFocusNodeIds } from '../graph/active-renderer/active-authority-visual';

function rootEntry(id: string, name: string, memberCount: number): KnowledgeNodeData {
  return {
    id: `root-entry-${id}`,
    name,
    nodeType: 'THEORY',
    description: '',
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    metadata: { presentationKind: 'active-root-navigation', rootEntryKind: 'domain', memberCount },
  };
}

function concept(id: string, name: string): KnowledgeNodeData {
  return {
    id,
    name,
    nodeType: 'THEORY',
    description: '',
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    conceptKind: 'DomainConcept',
    metadata: { presentationShape: 'circle', activeTone: 'cyan' },
  };
}

function link(id: string, sourceId: string, targetId: string): KnowledgeLinkData {
  return { id, sourceId, targetId, relation: 'prerequisite', relationType: 'prerequisite' };
}

const DOMAIN_NAMES = [
  '控制系统建模', '时域分析', '根轨迹法', '频域分析', '稳定性判据', '状态空间分析', '离散时间控制分析',
  '非线性系统', '校正设计', '采样系统', '最优控制', '鲁棒控制', '系统辨识', '过程控制', '综合应用',
];

function rootLayout() {
  const roots = DOMAIN_NAMES.map((name, index) => rootEntry(`d${index}`, name, 8 + index * 11));
  return deriveActiveAuthorityLayout({ nodes: roots, links: [], dimension: '2d' });
}

describe('active Authority root instrument layout', () => {
  it('packs every domain bubble without overlap, deterministically', () => {
    const first = rootLayout();
    const second = rootLayout();
    expect(second.map((row) => [row.id, row.x, row.y])).toEqual(first.map((row) => [row.id, row.x, row.y]));
    for (let i = 0; i < first.length; i += 1) {
      for (let j = i + 1; j < first.length; j += 1) {
        const a = first[i];
        const b = first[j];
        expect(Math.hypot(a.x - b.x, a.y - b.y)).toBeGreaterThanOrEqual(a.renderRadius + b.renderRadius);
      }
    }
  });

  it('sizes bubbles by knowledge-point count when names are comparable', () => {
    const rows = deriveActiveAuthorityLayout({
      nodes: [rootEntry('small', '时域分析', 4), rootEntry('large', '频域分析', 400)],
      links: [],
      dimension: '2d',
    });
    const radius = new Map(rows.map((row) => [row.id, row.renderRadius]));
    expect(radius.get('root-entry-large')!).toBeGreaterThan(radius.get('root-entry-small')!);
  });

  it('balances long root names instead of leaving a single orphan glyph', () => {
    const lines = balanceActiveRootLabelLines('离散时间控制分析', 90);
    expect(lines.length).toBeGreaterThan(1);
    expect(Math.min(...lines.map((line) => Array.from(line).length))).toBeGreaterThan(1);
    expect(lines.join('')).toBe('离散时间控制分析');
    expect(balanceActiveRootLabelLines('时域分析', 200)).toEqual(['时域分析']);
  });

  it('keeps root labels inside their bubble with an optional caption line', () => {
    const rows = rootLayout();
    const captions = new Map([[rows[0].id, '42 个知识点']]);
    const descriptors = buildActiveAuthorityLabelDescriptors({
      nodes: rows,
      kind: 'root',
      selectedNodeId: null,
      hoveredNodeId: null,
      captions,
    });
    for (const label of descriptors) {
      const row = rows.find((entry) => entry.id === label.id)!;
      expect(label.isRoot).toBe(true);
      expect(label.width).toBeLessThanOrEqual(row.renderRadius * 2);
    }
    expect(descriptors.find((label) => label.id === rows[0].id)?.caption).toBe('42 个知识点');
  });
});

describe('active Authority domain flow', () => {
  it('lays a deep prerequisite chain out left-to-right in 2D', () => {
    const ids = ['c0', 'c1', 'c2', 'c3', 'c4', 'c5', 'c6'];
    const nodes = ids.map((id) => concept(id, `前置概念${id}`));
    const links = ids.slice(1).map((id, index) => link(`${ids[index]}-${id}`, ids[index], id));
    const rows = deriveActiveAuthorityLayout({ nodes, links, dimension: '2d' });
    const xs = rows.map((row) => row.x);
    const ys = rows.map((row) => row.y);
    expect(Math.max(...xs) - Math.min(...xs)).toBeGreaterThan(Math.max(...ys) - Math.min(...ys));
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get('c6')!.x).toBeGreaterThan(byId.get('c0')!.x);
  });
});

describe('active Authority selection labels', () => {
  it('places the selected node and its crowded neighbours without overlapping labels', () => {
    const ids = ['hub', 'n1', 'n2', 'n3', 'n4', 'n5', 'n6'];
    const nodes = ids.map((id) => concept(id, id === 'hub' ? '传递函数' : `相邻概念${id}`));
    const links = ids.slice(1).map((id) => link(`hub-${id}`, 'hub', id));
    const layout = deriveActiveAuthorityLayout({ nodes, links, dimension: '2d' });
    const points = new Map(ids.map((id, index) => [id, {
      x: 300 + (index === 0 ? 0 : Math.cos(index) * 60),
      y: 220 + (index === 0 ? 0 : Math.sin(index) * 40),
      scale: 1,
    }]));
    const descriptors = buildActiveAuthorityLabelDescriptors({
      nodes: layout,
      kind: 'domain',
      selectedNodeId: 'hub',
      hoveredNodeId: null,
      focusNodeIds: activeFocusNodeIds(links, 'hub'),
    });
    const visible = placeActiveAuthorityLabels({
      descriptors,
      points,
      width: 600,
      height: 440,
      selectedNodeId: 'hub',
      hoveredNodeId: null,
    }).filter((label) => label.visible);
    expect(visible.map((label) => label.id)).toContain('hub');
    for (let i = 0; i < visible.length; i += 1) {
      for (let j = i + 1; j < visible.length; j += 1) {
        const a = visible[i];
        const b = visible[j];
        const overlapX = Math.abs(a.x - b.x) < (a.width + b.width) / 2;
        const overlapY = Math.abs(a.y - b.y) < (a.height + b.height) / 2;
        expect(overlapX && overlapY, `${a.id} overlaps ${b.id}`).toBe(false);
      }
    }
  });
});

describe('active Authority palette', () => {
  it('converts token triplets and provides distinct theme fallbacks', () => {
    expect(hslTripletToHex('0 0% 100%')).toBe('#ffffff');
    expect(hslTripletToHex('0 0% 0%')).toBe('#000000');
    expect(withAlpha('#ffffff', 0.5)).toMatch(/^rgba\(255, ?255, ?255, ?0\.5\)$/u);
    const dark = fallbackActiveCanvasPalette('dark');
    const light = fallbackActiveCanvasPalette('light');
    expect(dark.fgPrimary).not.toBe(light.fgPrimary);
    expect(dark.canvas).not.toBe(light.canvas);
    for (const palette of [dark, light]) {
      for (const color of [
        palette.rootDomain,
        palette.rootAggregate,
        ...Object.values(palette.tone),
        ...Object.values(palette.relation),
        ...Object.values(palette.mastery),
      ]) {
        expect(color).toMatch(/^#[0-9a-f]{6}$/u);
      }
    }
  });
});

describe('active Authority paint-only overlays', () => {
  const source = (relative: string) => readFileSync(path.join(process.cwd(), 'src/features/knowledge', relative), 'utf8');

  it('keeps mastery and captions out of the layout derivation', () => {
    const renderer = source('graph/active-renderer/active-authority-renderer.tsx');
    const layoutBlock = renderer.slice(
      renderer.indexOf('const layoutNodes = useMemo('),
      renderer.indexOf('const labels = useMemo('),
    );
    expect(layoutBlock).toContain('reconcileActiveAuthorityLayout');
    expect(layoutBlock).not.toMatch(/mastery|caption/iu);
  });

  it('draws migrated workspace colours from theme tokens instead of raw hex', () => {
    for (const relative of [
      'graph/active-renderer/active-authority-graph-2d.tsx',
      'graph/active-renderer/active-authority-graph-3d.tsx',
      'graph/active-renderer/active-authority-visual.ts',
      'graph/active-renderer/active-authority-label-layer.tsx',
      'active-authority-filter-panel.tsx',
      'active-authority-mastery.tsx',
    ]) {
      expect(source(relative), relative).not.toMatch(/#[0-9a-f]{6}\b|#[0-9a-f]{3}\b/iu);
    }
  });
});
