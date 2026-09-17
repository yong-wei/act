// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InspectorKnowledgeCardPanel } from '../inspector-learner-markdown';

describe('InspectorKnowledgeCardPanel', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
  });

  it('shows the homepage and keeps the distinct explanation collapsed until 详情 is clicked', async () => {
    await act(async () => root.render(createElement(InspectorKnowledgeCardPanel, {
      summary: '首页定义。',
      insight: '核心直觉。',
      explanation: '完整解释正文。',
    })));

    expect(container.textContent).toContain('首页定义。');
    expect(container.textContent).toContain('核心直觉。');
    expect(container.textContent).not.toContain('完整解释正文。');
    expect(container.querySelector('[data-inspector-card-detail]')).toBeNull();

    const toggle = container.querySelector<HTMLButtonElement>('[data-inspector-card-detail-toggle]');
    expect(toggle).not.toBeNull();
    expect(toggle?.getAttribute('aria-expanded')).toBe('false');
    await act(async () => toggle!.click());
    expect(container.querySelector('[data-inspector-card-detail="true"]')?.textContent).toContain('完整解释正文。');
    expect(toggle?.getAttribute('aria-expanded')).toBe('true');

    await act(async () => toggle!.click());
    expect(container.querySelector('[data-inspector-card-detail]')).toBeNull();
    expect(container.textContent).not.toContain('完整解释正文。');
  });

  it('does not render a detail toggle when the explanation repeats the homepage', async () => {
    await act(async () => root.render(createElement(InspectorKnowledgeCardPanel, {
      summary: '同一句话。',
      insight: null,
      explanation: '同一句话。',
    })));
    expect(container.querySelector('[data-inspector-card-detail-toggle]')).toBeNull();
    expect(container.textContent).toContain('同一句话。');
  });
});
