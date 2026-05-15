import { describe, expect, it } from 'vitest';

import { shouldRenderKnowledgeNodeLabel } from '../graph/label-policy';

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

  it('shows every label in all-label mode', () => {
    expect(
      shouldRenderKnowledgeNodeLabel({
        labelMode: 'all',
        nodeId: 'ordinary-node',
        globalScale: 0.6,
      })
    ).toBe(true);
  });
});
