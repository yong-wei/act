// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TextbookReaderWorkspace } from '../textbook-reader-workspace';

describe('TextbookReaderWorkspace', () => {
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

  function renderWorkspace() {
    return act(async () => root.render(createElement(TextbookReaderWorkspace, {
      presentation: 'modal',
      bookId: 'dorf-modern-control-systems',
      edition: '14th Global Edition',
      header: createElement('h1', null, '教材'),
      toc: createElement('nav', { 'aria-label': '教材目录' }, '目录'),
      reading: createElement('section', null, '正文'),
      meta: createElement('h2', null, '当前位置'),
    })));
  }

  it('collapses the catalog, sidebar, and expands the reading surface', async () => {
    await renderWorkspace();
    const reader = () => container.querySelector('[data-textbook-reader="true"]');
    expect(reader()?.getAttribute('data-textbook-reader-toc')).toBe('expanded');
    expect(container.querySelector('#textbook-reader-toc')).not.toBeNull();

    await act(async () => {
      container.querySelector('button[aria-controls="textbook-reader-toc"]')?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
    });
    expect(reader()?.getAttribute('data-textbook-reader-toc')).toBe('collapsed');
    expect(container.querySelector('#textbook-reader-toc')).toBeNull();

    await act(async () => {
      const buttons = [...container.querySelectorAll('button')];
      buttons.find((button) => button.textContent?.includes('最大化阅读'))?.dispatchEvent(
        new MouseEvent('click', { bubbles: true }),
      );
    });
    expect(reader()?.getAttribute('data-textbook-reader-maximized')).toBe('true');
    expect(container.querySelector('#textbook-reader-meta')).toBeNull();
  });
});
