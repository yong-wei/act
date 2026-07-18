import { describe, expect, it } from 'vitest';

import { getKnowledgeNodeLabelPresentation, shouldRenderKnowledgeNodeLabel } from '../graph/label-policy';

describe('shouldRenderKnowledgeNodeLabel', () => {
  it('shows only focus labels until the graph is zoomed in', () => {
    expect(
      shouldRenderKnowledgeNodeLabel({
        labelMode: 'focus',
        nodeId: 'chapter-node:时域分析',
        globalScale: 1,
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
    ).toBe(false);

    expect(
      shouldRenderKnowledgeNodeLabel({
        labelMode: 'focus',
        nodeId: 'ordinary-node',
        globalScale: 1.7,
      })
    ).toBe(true);
  });

  it('defers labels below the readable projected font size in all-label mode', () => {
    expect(
      shouldRenderKnowledgeNodeLabel({
        labelMode: 'all',
        nodeId: 'ordinary-node',
        globalScale: 0.6,
      })
    ).toBe(false);
    expect(
      shouldRenderKnowledgeNodeLabel({
        labelMode: 'all',
        nodeId: 'ordinary-node',
        globalScale: 0.7,
      })
    ).toBe(false);
    expect(shouldRenderKnowledgeNodeLabel({
      labelMode: 'all', nodeId: 'ordinary-node', globalScale: 1,
    })).toBe(true);
  });

  it('makes visibility imply at least 12px on both sides of the projection threshold', () => {
    const below = getKnowledgeNodeLabelPresentation({
      labelMode: 'all', nodeId: 'ordinary', globalScale: 12 / 13 - 0.001,
    });
    const above = getKnowledgeNodeLabelPresentation({
      labelMode: 'all', nodeId: 'ordinary', globalScale: 12 / 13 + 0.001,
    });
    expect(below.visible).toBe(false);
    expect(above.visible).toBe(true);
    expect(above.fontSize).toBeGreaterThanOrEqual(12);
    const selected = getKnowledgeNodeLabelPresentation({
      labelMode: 'all', nodeId: 'selected', selectedNodeId: 'selected', globalScale: 0.01,
    });
    expect(selected.visible).toBe(true);
    expect(selected.fontSize).toBe(12);
  });

  it('keeps root names complete inside at every zoom without changing ordinary nodes', () => {
    const root = getKnowledgeNodeLabelPresentation({
      labelMode: 'focus', nodeId: 'chapter-node:系统模型', globalScale: 0.01,
    });
    const ordinary = getKnowledgeNodeLabelPresentation({
      labelMode: 'focus', nodeId: 'system-model', globalScale: 0.01,
    });

    expect(root).toMatchObject({
      visible: true,
      placement: 'inside',
      complete: true,
      fontSize: 14,
    });
    expect(ordinary).toMatchObject({
      visible: false,
      placement: 'external',
      complete: false,
    });
  });
});
