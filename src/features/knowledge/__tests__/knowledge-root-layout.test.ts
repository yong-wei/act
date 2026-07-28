import { describe, expect, it } from 'vitest';

import type { KnowledgeNodeData } from '../knowledge-graph-system';
import {
  KNOWLEDGE_ROOT_PACKING,
  getKnowledgeRootCollisionBounds,
  getKnowledgeRootPresentationRadius,
  packKnowledgeGraphRootNodes,
} from '../graph/root-layout';
import {
  getKnowledgeNodeScale,
  getKnowledgeSemanticRegionStyle,
} from '../graph/visual-config';
import {
  type KnowledgeNodeLabelMeasureText,
} from '../graph/node-label-layout';

const wideGlyphMeasure: KnowledgeNodeLabelMeasureText = (text) => Array.from(text).reduce(
  (width, character) => width + (character === 'W' || character === 'M' ? 16 : 10),
  0
);

function rootNode(id: string, name: string, nodeCount = 24): KnowledgeNodeData {
  return {
    id,
    name,
    nodeType: 'THEORY',
    description: '',
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    metadata: { isCollapsedRoot: true, nodeCount },
  };
}

function coordinates(nodes: ReturnType<typeof packKnowledgeGraphRootNodes>) {
  return Object.fromEntries(nodes.map((node) => [node.id, {
    x: node.x,
    y: node.y,
    z: node.z,
    radius: node.__knowledgeRootPacking?.collisionRadius,
  }]));
}

function expectZeroBodyOverlap(nodes: ReturnType<typeof packKnowledgeGraphRootNodes>) {
  for (let left = 0; left < nodes.length; left += 1) {
    for (let right = left + 1; right < nodes.length; right += 1) {
      const a = nodes[left];
      const b = nodes[right];
      expect(Math.hypot(a.x! - b.x!, a.y! - b.y!)).toBeGreaterThanOrEqual(
        a.__knowledgeRootPacking!.collisionRadius
          + b.__knowledgeRootPacking!.collisionRadius
          + KNOWLEDGE_ROOT_PACKING.minimumGap
          - 0.000002
      );
    }
  }
}

describe('knowledge graph compact root packing', () => {
  const roots = [
    rootNode('chapter-node:状态空间', '状态空间', 80),
    rootNode('chapter-node:基本概念', '基本概念', 12),
    rootNode('chapter-node:系统模型', '系统模型', 40),
    rootNode('chapter-node:未知乙', '未知乙', 20),
    rootNode('chapter-node:未知甲', '未知甲', 20),
    rootNode('chapter-node:时域分析', '时域分析', 64),
    rootNode('chapter-node:频域分析', '频域分析', 32),
    rootNode('chapter-node:系统校正', '系统校正', 48),
    rootNode('chapter-node:离散系统', '离散系统', 16),
  ];

  it('uses fixed reviewed order and is stable when input order changes', () => {
    const first = packKnowledgeGraphRootNodes(roots, {
      viewportWidth: 1440, viewportHeight: 900, graphVersion: 'graph-v1',
    });
    const reordered = packKnowledgeGraphRootNodes([...roots].reverse(), {
      viewportWidth: 1440, viewportHeight: 900, graphVersion: 'graph-v1',
    });

    expect(first.map((node) => node.name)).toEqual([
      '基本概念', '系统模型', '时域分析', '频域分析', '系统校正',
      '离散系统', '状态空间', '未知乙', '未知甲',
    ]);
    expect(coordinates(reordered)).toEqual(coordinates(first));
    expect(new Set(first.map((node) => node.__knowledgeRootPacking.seed)).size).toBe(1);
  });

  it('uses graph version and viewport dimensions in the stable seed', () => {
    const first = packKnowledgeGraphRootNodes(roots, {
      viewportWidth: 1440, viewportHeight: 900, graphVersion: 'graph-v1',
    });
    const nextVersion = packKnowledgeGraphRootNodes(roots, {
      viewportWidth: 1440, viewportHeight: 900, graphVersion: 'graph-v2',
    });
    const portrait = packKnowledgeGraphRootNodes(roots, {
      viewportWidth: 390, viewportHeight: 844, graphVersion: 'graph-v1',
    });

    expect(coordinates(nextVersion)).not.toEqual(coordinates(first));
    expect(coordinates(portrait)).not.toEqual(coordinates(first));
  });

  it('returns an empty layout for an empty root catalog', () => {
    expect(packKnowledgeGraphRootNodes([], { viewportWidth: 320, viewportHeight: 640 })).toEqual([]);
  });

  it.each([
    [1, 1440, 900],
    [2, 320, 640],
    [9, 1440, 900],
    [17, 390, 844],
    [25, 320, 640],
    [26, 320, 640],
    [100, 1440, 900],
  ])('packs %i roots without duplicate coordinates or body overlap at %ix%i', (count, width, height) => {
    const nodes = Array.from({ length: count }, (_, index) => rootNode(
      `chapter-node:${index.toString().padStart(2, '0')}`,
      `领域 ${index.toString().padStart(2, '0')}`,
      (index * 13) % 96
    ));
    const packed = packKnowledgeGraphRootNodes(nodes, { viewportWidth: width, viewportHeight: height });
    const uniqueCoordinates = new Set(packed.map((node) => `${node.x}:${node.y}`));

    expect(uniqueCoordinates.size).toBe(packed.length);
    expectZeroBodyOverlap(packed);
    packed.forEach((node) => {
      expect(node.x).toBe(node.fx);
      expect(node.y).toBe(node.fy);
      expect(node.z).toBe(0);
      expect(node.fz).toBe(0);
    });
  });

  it('uses shared label and maximum focused 2D/3D body bounds', () => {
    const nodes = Array.from({ length: 36 }, (_, index) => ({
      ...rootNode(`chapter-node:radius-${index}`, `半径领域 ${index}`, (index * 17) % 97),
      graphDegree: (index * 7) % 25,
      metadata: {
        isCollapsedRoot: true,
        nodeCount: (index * 17) % 97,
        importance: index % 3 === 0 ? 'core' : index % 3 === 1 ? 'foundation' : 'supporting',
      },
    }));
    const packed = packKnowledgeGraphRootNodes(nodes, { viewportWidth: 1280, viewportHeight: 720 });

    packed.forEach((node) => {
      const focusedScale = getKnowledgeNodeScale({
        metadata: node.metadata,
        degree: node.graphDegree,
        focused: true,
      });
      const semanticRegion = getKnowledgeSemanticRegionStyle(node, false);
      const focusedPresentationRadius = Math.ceil(Math.max(
        focusedScale.radius,
        focusedScale.glowRadius,
        semanticRegion.enabled
          ? Math.min(semanticRegion.maxRadius, focusedScale.radius * semanticRegion.radiusMultiplier)
          : 0
      ) * 1000) / 1000;

      expect(node.__knowledgeRootPacking.collisionRadius).toBeGreaterThanOrEqual(focusedPresentationRadius);
      expect(node.__knowledgeRootPacking.collisionRadius).toBe(
        getKnowledgeRootCollisionBounds(node).collisionRadius
      );
      expect(getKnowledgeRootPresentationRadius(node)).toBeGreaterThanOrEqual(focusedPresentationRadius);
    });
    expectZeroBodyOverlap(packed);
  });

  it('lets a wrapped long label enlarge the root bubble and collision bounds', () => {
    const short = rootNode('chapter-node:short', '短名');
    const long = rootNode(
      'chapter-node:long',
      'A deliberately long English domain name 混合中文文本'
    );

    expect(getKnowledgeRootPresentationRadius(long)).toBeGreaterThan(
      getKnowledgeRootPresentationRadius(short)
    );
    expect(getKnowledgeRootCollisionBounds(long).halfWidth).toBeGreaterThan(
      getKnowledgeRootCollisionBounds(short).halfWidth
    );
  });

  it.each([
    [320, 270],
    [390, 844],
  ])('keeps projected measured label rectangles disjoint after mobile fit at %ix%i', (width, height) => {
    const mobileRoots = Array.from({ length: 9 }, (_, index) => rootNode(
      `chapter-node:mobile-${index}`,
      index % 2 === 0 ? `WWWW领域MMMM-${index}` : `中文混合WW节点-${index}`
    ));
    const packed = packKnowledgeGraphRootNodes(
      mobileRoots,
      { viewportWidth: width, viewportHeight: height },
      wideGlyphMeasure
    );
    const worldBounds = {
      minX: Math.min(...packed.map((node) => node.x - node.__knowledgeRootPacking.labelBounds.halfWidth)),
      maxX: Math.max(...packed.map((node) => node.x + node.__knowledgeRootPacking.labelBounds.halfWidth)),
      minY: Math.min(...packed.map((node) => node.y - node.__knowledgeRootPacking.labelBounds.halfHeight)),
      maxY: Math.max(...packed.map((node) => node.y + node.__knowledgeRootPacking.labelBounds.halfHeight)),
    };
    const fitScale = Math.min(
      1,
      (width - 48) / (worldBounds.maxX - worldBounds.minX),
      (height - 48) / (worldBounds.maxY - worldBounds.minY)
    );
    const rectangles = packed.map((node) => ({
      left: node.x * fitScale - node.__knowledgeRootPacking.labelBounds.halfWidth * fitScale,
      right: node.x * fitScale + node.__knowledgeRootPacking.labelBounds.halfWidth * fitScale,
      top: node.y * fitScale - node.__knowledgeRootPacking.labelBounds.halfHeight * fitScale,
      bottom: node.y * fitScale + node.__knowledgeRootPacking.labelBounds.halfHeight * fitScale,
    }));

    expect(fitScale).toBeGreaterThan(0);

    rectangles.forEach((left, index) => rectangles.slice(index + 1).forEach((right) => {
      const overlaps = left.left < right.right && left.right > right.left
        && left.top < right.bottom && left.bottom > right.top;
      expect(overlaps).toBe(false);
    }));
  });

  it('adapts row direction to the viewport while keeping a bounded centered extent', () => {
    const desktop = packKnowledgeGraphRootNodes(roots, { viewportWidth: 1440, viewportHeight: 900 });
    const mobile = packKnowledgeGraphRootNodes(roots, { viewportWidth: 320, viewportHeight: 640 });
    const extent = (nodes: typeof desktop) => ({
      width: Math.max(...nodes.map((node) => node.x! + node.__knowledgeRootPacking!.collisionRadius))
        - Math.min(...nodes.map((node) => node.x! - node.__knowledgeRootPacking!.collisionRadius)),
      height: Math.max(...nodes.map((node) => node.y! + node.__knowledgeRootPacking!.collisionRadius))
        - Math.min(...nodes.map((node) => node.y! - node.__knowledgeRootPacking!.collisionRadius)),
    });

    expect(extent(desktop).width).toBeGreaterThan(extent(desktop).height);
    expect(extent(mobile).height).toBeGreaterThan(extent(mobile).width);
    for (const packed of [desktop, mobile]) expectZeroBodyOverlap(packed);
  });

  it('forms an irregular centered cluster instead of a grid or complete ring', () => {
    const packed = packKnowledgeGraphRootNodes(roots, {
      viewportWidth: 1440, viewportHeight: 900, graphVersion: 'irregular-v1',
    });
    const uniqueX = new Set(packed.map((node) => node.x));
    const uniqueY = new Set(packed.map((node) => node.y));
    const radii = new Set(packed.map((node) => node.__knowledgeRootPacking.radialDistance));
    const bounds = {
      left: Math.min(...packed.map((node) => node.x - node.__knowledgeRootPacking.collisionRadius)),
      right: Math.max(...packed.map((node) => node.x + node.__knowledgeRootPacking.collisionRadius)),
      top: Math.min(...packed.map((node) => node.y - node.__knowledgeRootPacking.collisionRadius)),
      bottom: Math.max(...packed.map((node) => node.y + node.__knowledgeRootPacking.collisionRadius)),
    };

    expect(uniqueX.size).toBeGreaterThan(3);
    expect(uniqueY.size).toBeGreaterThan(3);
    expect(radii.size).toBeGreaterThan(3);
    expect(bounds.left + bounds.right).toBeCloseTo(0, 5);
    expect(bounds.top + bounds.bottom).toBeCloseTo(0, 5);
  });

  it('uses actual bounds to make 25 ordinary roots wide on landscape and tall on portrait', () => {
    const nodes = Array.from({ length: 25 }, (_, index) => rootNode(
      `chapter-node:direction-${index}`,
      `普通领域 ${index}`
    ));
    const extent = (packed: ReturnType<typeof packKnowledgeGraphRootNodes>) => ({
      width: Math.max(...packed.map((node) => node.x! + node.__knowledgeRootPacking.collisionRadius))
        - Math.min(...packed.map((node) => node.x! - node.__knowledgeRootPacking.collisionRadius)),
      height: Math.max(...packed.map((node) => node.y! + node.__knowledgeRootPacking.collisionRadius))
        - Math.min(...packed.map((node) => node.y! - node.__knowledgeRootPacking.collisionRadius)),
    });
    const landscape = extent(packKnowledgeGraphRootNodes(nodes, {
      viewportWidth: 1440,
      viewportHeight: 900,
    }));
    const portrait = extent(packKnowledgeGraphRootNodes(nodes, {
      viewportWidth: 320,
      viewportHeight: 640,
    }));

    expect(landscape.width).toBeGreaterThan(landscape.height);
    expect(portrait.height).toBeGreaterThan(portrait.width);
  });

  it('returns the same fixed planar coordinates for 2D and 3D consumers', () => {
    const shared = packKnowledgeGraphRootNodes(roots, { viewportWidth: 1280, viewportHeight: 720 });
    const twoDimensional = shared.map(({ id, x, y }) => ({ id, x, y }));
    const threeDimensional = shared.map(({ id, x, y, z }) => ({ id, x, y, z }));

    expect(threeDimensional).toEqual(twoDimensional.map((node) => ({ ...node, z: 0 })));
  });

  it('keeps a finite deterministic large-catalog extent and delegates viewport scaling to root auto-fit', () => {
    const nodes = Array.from({ length: 100 }, (_, index) => rootNode(
      `chapter-node:bounded-${index}`,
      `大集合领域 ${index}`,
      (index * 19) % 97
    ));
    const first = packKnowledgeGraphRootNodes(nodes, { viewportWidth: 1920, viewportHeight: 1080 });
    const second = packKnowledgeGraphRootNodes([...nodes].reverse(), {
      viewportWidth: 1920,
      viewportHeight: 1080,
    });
    const bounds = {
      left: Math.min(...first.map((node) => node.x - node.__knowledgeRootPacking.collisionRadius)),
      right: Math.max(...first.map((node) => node.x + node.__knowledgeRootPacking.collisionRadius)),
      top: Math.min(...first.map((node) => node.y - node.__knowledgeRootPacking.collisionRadius)),
      bottom: Math.max(...first.map((node) => node.y + node.__knowledgeRootPacking.collisionRadius)),
    };

    expect(Object.values(bounds).every(Number.isFinite)).toBe(true);
    expect(Math.max(bounds.right - bounds.left, bounds.bottom - bounds.top)).toBeGreaterThan(1080);
    expect(coordinates(second)).toEqual(coordinates(first));
    expectZeroBodyOverlap(first);
  });

});
