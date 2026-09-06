import { describe, expect, it } from 'vitest';

import { getKnowledgeNodeLabelPresentation, shouldRenderKnowledgeNodeLabel } from '../graph/label-policy';

describe('shouldRenderKnowledgeNodeLabel', () => {
  it('keeps ordinary labels eligible without a zoom or font-size gate', () => {
    expect(
      shouldRenderKnowledgeNodeLabel({
        labelMode: 'focus',
        nodeId: 'chapter-node:时域分析',
        globalScale: 1,
        isRootBubble: true,
      })
    ).toBe(true);

    expect(
      shouldRenderKnowledgeNodeLabel({
        labelMode: 'focus',
        nodeId: 'damping-ratio',
        selectedNodeId: 'damping-ratio',
        globalScale: 1,
      })
    ).toBe(true);

    expect(
      shouldRenderKnowledgeNodeLabel({
        labelMode: 'focus',
        nodeId: 'phase-margin',
        hoveredNodeId: 'phase-margin',
        globalScale: 1,
      })
    ).toBe(true);

    expect(
      shouldRenderKnowledgeNodeLabel({
        labelMode: 'focus',
        nodeId: 'ordinary-node',
        globalScale: 1,
      })
    ).toBe(true);

    expect(
      shouldRenderKnowledgeNodeLabel({
        labelMode: 'all',
        nodeId: 'ordinary-node',
        globalScale: 0.6,
      })
    ).toBe(true);
  });

  it('makes visibility imply at least 12px on both sides of the projection threshold', () => {
    const below = getKnowledgeNodeLabelPresentation({
      labelMode: 'all', nodeId: 'ordinary', globalScale: 12 / 13 - 0.001,
    });
    const above = getKnowledgeNodeLabelPresentation({
      labelMode: 'all', nodeId: 'ordinary', globalScale: 12 / 13 + 0.001,
    });
    expect(below.visible).toBe(true);
    expect(above.visible).toBe(true);
    expect(below.fontSize).toBeGreaterThanOrEqual(12);
    expect(above.fontSize).toBeGreaterThanOrEqual(12);
    const selected = getKnowledgeNodeLabelPresentation({
      labelMode: 'all', nodeId: 'selected', selectedNodeId: 'selected', globalScale: 0.01,
    });
    expect(selected.visible).toBe(true);
    expect(selected.fontSize).toBe(12);
  });

  it('uses explicit root packing state instead of chapter ids for inside labels', () => {
    const root = getKnowledgeNodeLabelPresentation({
      labelMode: 'focus', nodeId: 'chapter-node:系统模型', globalScale: 0.01,
      isRootBubble: true,
    });
    const domainChapter = getKnowledgeNodeLabelPresentation({
      labelMode: 'all', nodeId: 'chapter-node:系统模型', globalScale: 1,
    });

    expect(root).toMatchObject({
      visible: true,
      placement: 'inside',
      complete: true,
      fontSize: 12,
    });
    expect(root.scale).toBeCloseTo(12 / 0.14);
    expect(domainChapter).toMatchObject({
      visible: true,
      placement: 'external',
      complete: false,
      fontSize: 13,
    });
  });

  it('keeps the 2D root label screen-readable across zoom levels', () => {
    const zoomedOut = getKnowledgeNodeLabelPresentation({
      labelMode: 'focus', nodeId: 'chapter-node:系统模型', globalScale: 0.5,
      isRootBubble: true,
    });
    const zoomedIn = getKnowledgeNodeLabelPresentation({
      labelMode: 'focus', nodeId: 'chapter-node:系统模型', globalScale: 2,
      isRootBubble: true,
    });

    expect(zoomedOut.fontSize).toBe(12);
    expect(zoomedOut.scale).toBeCloseTo(12 / 7);
    expect(zoomedIn.fontSize).toBe(28);
    expect(zoomedIn.scale).toBe(1);
  });
});
