import { describe, expect, it } from 'vitest';

import {
  applyCrossDomainClusterLayout,
  crossDomainNodeId,
  readCrossDomainCanonicalId,
  CROSS_DOMAIN_CLUSTER_LAYOUT_DEFAULTS,
  type CrossDomainClusterCircle,
} from '../graph/cross-domain-cluster';
import type { KnowledgeNodeData } from '../knowledge-graph-system';

function node(id: string, overrides: Partial<KnowledgeNodeData & { x?: number; y?: number }> = {}): KnowledgeNodeData & { x?: number; y?: number; __knowledgeCrossClusterCircle?: CrossDomainClusterCircle } {
  return {
    id,
    name: id,
    nodeType: 'THEORY',
    description: '',
    positionX: 0,
    positionY: 0,
    positionZ: 0,
    ...overrides,
  };
}

describe('cross-domain cluster layout (#2052 task 4)', () => {
  it('clusters multiple concepts of the same target domain into one circle', () => {
    const nodes = [
      node('in-1', { x: -100, y: 0 }),
      node('in-2', { x: 100, y: 0 }),
      node(crossDomainNodeId('c1'), { crossDomainClusterDomain: '系统建模' }),
      node(crossDomainNodeId('c2'), { crossDomainClusterDomain: '系统建模' }),
      node(crossDomainNodeId('c3'), { crossDomainClusterDomain: '系统建模' }),
    ];
    applyCrossDomainClusterLayout(nodes, { viewportWidth: 1280, viewportHeight: 720 });
    const circles = nodes
      .filter((node) => node.crossDomainClusterDomain)
      .map((node) => node.__knowledgeCrossClusterCircle!);
    const uniqueCircles = new Set(circles.map((circle) => `${circle.centerX}:${circle.centerY}`));
    expect(uniqueCircles.size).toBe(1);
    // 只有一个代表节点绘制圆与领域名。
    expect(circles.filter((circle) => circle.representative)).toHaveLength(1);
    // 圆内节点分布于小环上（互不重叠的最小距离）。
    const crossNodes = nodes.filter((node) => node.crossDomainClusterDomain);
    const [a, b, c] = crossNodes;
    const spread = Math.hypot(a.x! - b.x!, a.y! - b.y!) + Math.hypot(b.x! - c.x!, b.y! - c.y!);
    expect(spread).toBeGreaterThan(CROSS_DOMAIN_CLUSTER_LAYOUT_DEFAULTS.nodeRingRadius);
  });

  it('anchors cluster circles outside the in-domain overview bounding box', () => {
    const nodes = [
      node('in-1', { x: -200, y: -100 }),
      node('in-2', { x: 200, y: 100 }),
      node(crossDomainNodeId('c1'), { crossDomainClusterDomain: '频域分析' }),
    ];
    applyCrossDomainClusterLayout(nodes, { viewportWidth: 1280, viewportHeight: 720 });
    const cross = nodes.find((node) => node.crossDomainClusterDomain)!;
    const circle = cross.__knowledgeCrossClusterCircle!;
    const overviewRadius = 200;
    expect(Math.hypot(circle.centerX, circle.centerY)).toBeGreaterThanOrEqual(
      overviewRadius + CROSS_DOMAIN_CLUSTER_LAYOUT_DEFAULTS.overviewGap - 1,
    );
  });

  it('is a no-op when no cross-domain relations exist (no circles, no movement)', () => {
    const nodes = [node('in-1', { x: 10, y: 20 }), node('in-2', { x: 30, y: 40 })];
    const before = nodes.map((node) => [node.x, node.y]);
    applyCrossDomainClusterLayout(nodes, { viewportWidth: 1280, viewportHeight: 720 });
    expect(nodes.map((node) => [node.x, node.y])).toEqual(before);
    expect(nodes.every((node) => !node.__knowledgeCrossClusterCircle)).toBe(true);
  });

  it('resolves canonical ids from synthetic cross node ids only', () => {
    expect(readCrossDomainCanonicalId('cross:abc')).toBe('abc');
    expect(readCrossDomainCanonicalId('plain-key')).toBeNull();
    expect(crossDomainNodeId('abc')).toBe('cross:abc');
  });
});
