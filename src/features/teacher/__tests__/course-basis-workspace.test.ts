// @vitest-environment jsdom

import { act, createElement } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { CourseBasisWorkspace } from '../course-basis-workspace';

const page = (offset = 0, total = 0, hasMore = false) => ({ offset, limit: 20, total, hasMore });
const version = (id: string) => ({
  id, versionNumber: Number(id.replace(/\D/g, '')) || 1, sourceName: `${id}.txt`, extractionState: 'FAILED',
  reviewState: 'PENDING', failureReason: 'failed', retiredAt: null, segments: [],
});
const basisDocument = (id: string, versions = [version('version-1')], hasMore = false) => ({
  id, title: id, kind: 'STANDARD', versions, versionPagination: page(0, hasMore ? 21 : versions.length, hasMore),
});
const basis = (id: string, documents = [basisDocument('document-1')], hasMore = false) => ({
  id, courseIdentity: id, title: id, description: null, documents,
  documentPagination: page(0, hasMore ? 21 : documents.length, hasMore),
});
const response = (courseBases: ReturnType<typeof basis>[]) => Promise.resolve({
  ok: true,
  json: async () => ({ courseBases, pagination: { hasMore: false } }),
} as Response);

describe('CourseBasisWorkspace pagination', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    container = document.createElement('div');
    document.body.append(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('keeps a basis from a later page selected after refresh', async () => {
    const bases = Array.from({ length: 51 }, (_, index) => basis(`basis-${index + 1}`));
    const fetch = vi.fn(() => response([bases[50]]));
    vi.stubGlobal('fetch', fetch);
    await act(async () => root.render(createElement(CourseBasisWorkspace, { initialCourseBases: bases })));

    await act(async () => button('basis-51').click());
    await act(async () => button('刷新').click());

    expect(container.textContent).toContain('basis-51');
    expect(container.querySelector('[class*="border-primary"]')?.textContent).toContain('basis-51');
  });

  it('deduplicates concurrent course-basis page requests', async () => {
    let resolvePage!: (value: Response) => void;
    const pageRequest = new Promise<Response>((resolve) => { resolvePage = resolve; });
    const fetch = vi.fn(() => pageRequest);
    vi.stubGlobal('fetch', fetch);
    const bases = Array.from({ length: 50 }, (_, index) => basis(`basis-${index + 1}`));
    await act(async () => root.render(createElement(CourseBasisWorkspace, { initialCourseBases: bases })));

    act(() => {
      button('加载更多课程依据').click();
      button('加载更多课程依据').click();
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => resolvePage(await response([basis('basis-51')])));
    expect([...container.querySelectorAll('button')].filter((item) => item.textContent?.includes('basis-51'))).toHaveLength(1);
  });

  it('keeps a targeted basis outside the first page without shifting the next page offset', async () => {
    const firstPage = Array.from({ length: 50 }, (_, index) => basis(`basis-${index + 1}`));
    const targeted = basis('basis-75');
    const fetch = vi.fn(() => response([basis('basis-51')]));
    vi.stubGlobal('fetch', fetch);
    await act(async () => root.render(createElement(CourseBasisWorkspace, {
      initialCourseBases: [...firstPage, targeted],
      initialSelectedId: targeted.id,
      initialBaseOffset: 50,
      initialHasMoreBases: true,
    })));

    expect(container.querySelector('[class*="border-primary"]')?.textContent).toContain('basis-75');
    await act(async () => button('加载更多课程依据').click());

    expect(fetch).toHaveBeenCalledWith('/api/teacher/course-bases?offset=50&limit=50', { cache: 'no-store' });
    expect(container.textContent).toContain('basis-51');
  });

  it('keeps expanded history when switching away and back', async () => {
    const expanded = basis('basis-1', [basisDocument('document-1'), basisDocument('document-21')]);
    const fetch = vi.fn()
      .mockImplementationOnce(() => response([basis('basis-2')]))
      .mockImplementationOnce(() => response([basis('basis-1')]));
    vi.stubGlobal('fetch', fetch);
    await act(async () => root.render(createElement(CourseBasisWorkspace, { initialCourseBases: [expanded, basis('basis-2')] })));

    await act(async () => button('basis-2').click());
    await act(async () => button('basis-1').click());
    expect(container.textContent).toContain('document-21');
  });

  it('loads document and version pages once when buttons are double-clicked', async () => {
    let resolveDocuments!: (value: Response) => void;
    const documentRequest = new Promise<Response>((resolve) => { resolveDocuments = resolve; });
    const fetch = vi.fn()
      .mockImplementationOnce(() => documentRequest)
      .mockImplementationOnce(() => response([basis('basis-1', [{
        ...basisDocument('document-1', [version('version-2')]),
        versionPagination: page(20, 21, false),
      }])]))
      .mockImplementationOnce(() => response([basis('basis-1', [basisDocument('document-1', [version('version-3')], true)], true)]))
      .mockImplementationOnce(() => Promise.resolve({
        ok: true,
        json: async () => ({ version: { ...version('version-21'), documentId: 'document-2' } }),
      } as Response))
      .mockImplementationOnce(() => response([basis('basis-1', [basisDocument('document-1', [version('version-3')], true)], true)]));
    vi.stubGlobal('fetch', fetch);
    await act(async () => root.render(createElement(CourseBasisWorkspace, {
      initialCourseBases: [basis('basis-1', [basisDocument('document-1', [version('version-1')], true)], true)],
    })));

    act(() => {
      button('加载更多文档').click();
      button('加载更多文档').click();
    });
    expect(fetch).toHaveBeenCalledTimes(1);
    await act(async () => resolveDocuments(await response([basis('basis-1', [basisDocument('document-2', [version('version-20')])], false)])));
    expect(container.textContent).toContain('document-2');

    await act(async () => {
      button('加载更多版本').click();
      button('加载更多版本').click();
    });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect(container.textContent).toContain('version-2.txt');

    await act(async () => button('刷新').click());
    expect(container.textContent).toContain('document-2');
    expect(container.textContent).toContain('version-2.txt');
    expect(container.textContent).toContain('version-3.txt');

    await act(async () => buttonWithin('document-2', '重试为新版本').click());
    expect(container.textContent).toContain('version-21.txt');
  });

  function button(label: string) {
    const match = [...container.querySelectorAll('button')].find((item) => item.textContent?.includes(label));
    if (!match) throw new Error(`button not found: ${label}`);
    return match;
  }

  function buttonWithin(containerText: string, label: string) {
    const scope = [...container.querySelectorAll('article')].find((item) => item.textContent?.includes(containerText));
    const match = [...(scope?.querySelectorAll('button') ?? [])].find((item) => item.textContent?.includes(label));
    if (!match) throw new Error(`button not found: ${containerText} / ${label}`);
    return match;
  }
});
