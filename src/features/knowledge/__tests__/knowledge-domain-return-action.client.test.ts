// @vitest-environment jsdom

import { act, createElement, useRef, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent } from '@testing-library/dom';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { KnowledgeDomainReturnAction } from '../graph/domain-return-action';

function Harness() {
  const [domainId, setDomainId] = useState<string | null>('chapter-node:系统模型');
  const rootFocusRef = useRef<HTMLButtonElement>(null);
  return createElement('div', null,
    createElement('button', {
      ref: rootFocusRef,
      type: 'button',
      onClick: () => setDomainId('chapter-node:时域分析'),
      'data-testid': 'domain-switch',
    }, '切换领域'),
    createElement(KnowledgeDomainReturnAction, {
      domainId,
      onReturn: () => setDomainId(null),
      returnFocusRef: rootFocusRef,
    }),
    createElement('output', { 'data-testid': 'view' }, domainId ?? 'root')
  );
}

describe('KnowledgeDomainReturnAction', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('is visible only in a domain and exposes title and accessible name', async () => {
    await act(async () => root.render(createElement(Harness)));
    const action = container.querySelector<HTMLButtonElement>('[data-knowledge-return-root]')!;

    expect(action).not.toBeNull();
    expect(action.getAttribute('aria-label')).toBe('返回全部领域');
    expect(action.title).toBe('返回全部领域');

    await act(async () => fireEvent.click(action));
    expect(container.querySelector('[data-knowledge-return-root]')).toBeNull();
    expect(container.querySelector('[data-testid="view"]')?.textContent).toBe('root');
  });

  it('uses the native click contract produced by pointer and touch activation', async () => {
    await act(async () => root.render(createElement(Harness)));
    const action = container.querySelector<HTMLButtonElement>('[data-knowledge-return-root]')!;

    await act(async () => userEvent.setup().click(action));

    expect(container.querySelector('[data-testid="view"]')?.textContent).toBe('root');
    expect(document.activeElement).toBe(container.querySelector('[data-testid="domain-switch"]'));
  });

  it.each(['Enter', ' '])('supports native %s activation and returns focus to the root context', async (key) => {
    await act(async () => root.render(createElement(Harness)));
    const action = container.querySelector<HTMLButtonElement>('[data-knowledge-return-root]')!;
    action.focus();

    await act(async () => userEvent.setup().keyboard(key === 'Enter' ? '{Enter}' : ' '));

    expect(container.querySelector('[data-testid="view"]')?.textContent).toBe('root');
    expect(document.activeElement).toBe(container.querySelector('[data-testid="domain-switch"]'));
  });

  it('remains available after switching to another domain', async () => {
    await act(async () => root.render(createElement(Harness)));
    await act(async () => fireEvent.click(container.querySelector('[data-testid="domain-switch"]')!));

    expect(container.querySelector('[data-testid="view"]')?.textContent).toBe('chapter-node:时域分析');
    expect(container.querySelector('[data-knowledge-return-root]')).not.toBeNull();
  });
});
