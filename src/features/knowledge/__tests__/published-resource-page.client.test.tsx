// @vitest-environment jsdom

import { act, createElement, type ReactNode } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('next-auth/react', () => ({
  useSession: () => ({ data: null, status: 'unauthenticated' }),
}));
vi.mock('next/navigation', () => ({
  usePathname: () => '/learning-resources/act:card:demo',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), prefetch: vi.fn() }),
}));
vi.mock('next/image', () => ({
  default: function MockImage({ alt, src }: { alt: string; src: string }) {
    const React = require('react') as typeof import('react');
    return React.createElement('img', { alt, src });
  },
}));
vi.mock('@/features/interactive/interactive-learning-shell', () => ({
  InteractiveLearningShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
}));
vi.mock('../knowledge-card', () => ({
  KnowledgeCard: ({ name, description, metadata }: {
    name: string;
    description: string;
    metadata: { content?: string };
  }) => <div data-knowledge-card={name}>{description}{metadata.content}</div>,
}));

import { PublishedResourcePage } from '../published-resource-page';

describe('PublishedResourcePage companion infograph', () => {
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

  it('renders the sibling infograph on a full knowledge-card path page', async () => {
    await act(async () => root.render(createElement(PublishedResourcePage, {
      resource: {
        title: '滞后补偿',
        kindLabel: '知识卡',
        summary: '首页定义。',
        estimatedMinutes: 8,
        knowledgeCount: 1,
        limitation: null,
        kind: 'card',
        imageSrc: '/api/knowledge/published-infograph/ctc_lag?resourceRef=ref',
        card: {
          summary: '首页定义。',
          insight: '核心直觉。',
          explanation: '完整解释。',
        },
      },
    })));

    const figure = container.querySelector('[data-published-resource-infograph="companion"] img');
    expect(figure).not.toBeNull();
    expect(figure?.getAttribute('alt')).toBe('滞后补偿 信息图');
    expect(figure?.getAttribute('src')).toContain('/api/knowledge/published-infograph/ctc_lag');
    expect(container.textContent).toContain('首页定义。');
    expect(container.textContent).toContain('核心直觉。');
    expect(container.textContent).toContain('完整解释。');
  });
});
