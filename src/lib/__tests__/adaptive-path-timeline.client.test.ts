// @vitest-environment jsdom

import { act, createElement, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AdaptivePathTimeline,
  getAdaptivePathResourceVisual,
  type AdaptivePathTimelineNode,
} from '@/features/adaptive/adaptive-path-timeline';
import { GOVERNED_PATH_NODE_TYPES } from '@/lib/resource-node-registry';

const nodes: AdaptivePathTimelineNode[] = [
  {
    nodeId: 'knowledge-card:one',
    title: '认识闭环结构',
    type: 'knowledge_card',
    resourceLabel: '知识卡',
    status: 'completed',
    estimatedMinutes: 8,
  },
  {
    nodeId: 'simulation:two',
    title: '验证阶跃响应',
    type: 'simulation',
    resourceLabel: '虚拟仿真',
    status: 'current',
    estimatedMinutes: 15,
  },
  {
    nodeId: 'arena-task:three',
    title: '完成终端挑战',
    type: 'arena_task',
    resourceLabel: 'Arena',
    status: 'locked',
    estimatedMinutes: 20,
  },
];

describe('AdaptivePathTimeline', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('expands only the focused node in place and keeps actions attached to it', async () => {
    function Harness() {
      const [focusedNodeId, setFocusedNodeId] = useState(nodes[1].nodeId);
      return createElement(AdaptivePathTimeline, {
        nodes,
        focusedNodeId,
        onFocus: setFocusedNodeId,
        renderExpandedContent: (node) => createElement('button', { type: 'button' }, `执行 ${node.title}`),
      });
    }

    await act(async () => root.render(createElement(Harness)));
    const currentNode = container.querySelector('[data-adaptive-path-node="simulation:two"]');
    expect(currentNode?.querySelector('[data-adaptive-path-node-detail="inline"]')?.textContent)
      .toContain('执行 验证阶跃响应');
    expect(container.querySelectorAll('[data-adaptive-path-node-detail="inline"]')).toHaveLength(1);

    const firstNodeButton = container.querySelector<HTMLButtonElement>('[data-adaptive-path-node="knowledge-card:one"] button');
    await act(async () => firstNodeButton?.dispatchEvent(new MouseEvent('click', { bubbles: true })));

    expect(container.querySelector('[data-adaptive-path-node="knowledge-card:one"] [data-adaptive-path-node-detail="inline"]')?.textContent)
      .toContain('执行 认识闭环结构');
    expect(container.querySelectorAll('[data-adaptive-path-node-detail="inline"]')).toHaveLength(1);
  });

  it('keeps start, skip, review, continue, and evidence actions attached to the focused node', async () => {
    const action = vi.fn();
    await act(async () => root.render(createElement(AdaptivePathTimeline, {
      nodes,
      focusedNodeId: nodes[1].nodeId,
      onFocus: vi.fn(),
      renderExpandedContent: () => createElement('div', {
        'data-adaptive-path-node-actions': 'attached',
      }, ['开始学习', '跳过', '回顾', '继续互动', '查看证据'].map((label) => createElement(
        'button',
        { key: label, type: 'button', onClick: () => action(label) },
        label,
      ))),
    })));

    const attachedActions = container.querySelector('[data-adaptive-path-node="simulation:two"] [data-adaptive-path-node-actions="attached"]');
    expect(attachedActions?.querySelectorAll('button')).toHaveLength(5);
    for (const button of attachedActions?.querySelectorAll('button') ?? []) {
      await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    }
    expect(action.mock.calls.map(([label]) => label)).toEqual(['开始学习', '跳过', '回顾', '继续互动', '查看证据']);
    expect(container.querySelector('[data-adaptive-path-node="knowledge-card:one"] [data-adaptive-path-node-actions]')).toBeNull();
  });

  it('renders adaptive connectors and independent resource-type and execution-state cues', async () => {
    await act(async () => root.render(createElement(AdaptivePathTimeline, {
      nodes,
      focusedNodeId: nodes[1].nodeId,
      onFocus: vi.fn(),
      renderExpandedContent: () => null,
    })));

    expect(container.querySelectorAll('[data-adaptive-path-route-connector="adaptive"]')).toHaveLength(2);
    const currentNode = container.querySelector('[data-adaptive-path-node="simulation:two"]');
    expect(currentNode?.getAttribute('data-adaptive-path-resource-type')).toBe('simulation');
    expect(currentNode?.getAttribute('data-adaptive-path-node-state')).toBe('current');
    expect(currentNode?.textContent).toContain('虚拟仿真');
    expect(currentNode?.textContent).toContain('当前节点');
  });
});

describe('adaptive path resource visual map', () => {
  it.each([
    ['interactive_lesson', '互动课程'],
    ['knowledge_card', '知识卡'],
    ['textbook_section', '教材'],
    ['slides', '课件'],
    ['adaptive_quiz', '自适应练习'],
    ['simulation', '虚拟仿真'],
    ['control_workbench', '控制工作台'],
    ['arena_task', 'Arena'],
    ['reflection', '反思'],
    ['external_resource', '外部资源'],
    ['konling', '控灵建议'],
    ['checkpoint', '检查点'],
  ])('maps %s to an accessible text label', (type, label) => {
    const visual = getAdaptivePathResourceVisual(type);
    expect(visual.label).toBe(label);
    expect(visual.Icon).toBeTypeOf('object');
    expect(visual.markerClass).toContain('platform-');
  });

  it('normalizes aliases without changing the execution state dimension', () => {
    expect(getAdaptivePathResourceVisual('interactive-lesson')).toBe(getAdaptivePathResourceVisual('interactive_lesson'));
    expect(getAdaptivePathResourceVisual('quiz')).toBe(getAdaptivePathResourceVisual('adaptive_quiz'));
  });

  it('covers every governed path node type with a named non-fallback visual', () => {
    const visuals = GOVERNED_PATH_NODE_TYPES.map((type) => [type, getAdaptivePathResourceVisual(type)] as const);

    expect(visuals.map(([type]) => type)).toEqual([...GOVERNED_PATH_NODE_TYPES]);
    for (const [type, visual] of visuals) {
      expect(visual.label, `${type} must have a named support-matrix label`).not.toBe('学习资源');
      expect(visual.markerClass, `${type} must have an accessible visual cue`).toContain('platform-');
    }
  });
});
