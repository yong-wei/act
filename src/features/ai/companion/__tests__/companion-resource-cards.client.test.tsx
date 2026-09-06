// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { waitFor } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  CompanionResourceCards,
  extractCompanionResourceCards,
} from '@/features/ai/companion/companion-resource-cards';

const fetchMock = vi.fn();

function renderCards(message: unknown): { container: HTMLElement; root: Root } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<CompanionResourceCards message={message} />);
  });
  return { container, root };
}

function verifyResponse(body: unknown) {
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200, headers: { 'content-type': 'application/json' } }));
}

let roots: Root[] = [];

beforeEach(() => {
  roots = [];
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(async () => {
  vi.unstubAllGlobals();
  for (const root of roots) {
    await act(async () => {
      root.unmount();
    });
  }
  document.body.innerHTML = '';
});

function track(render: { container: HTMLElement; root: Root }) {
  roots.push(render.root);
  return render.container;
}

describe('extractCompanionResourceCards', () => {
  it('parses companion-origin snapshots and rejects malformed payloads', () => {
    const message = {
      role: 'assistant',
      origin: 'companion',
      companionContext: {
        resources: [
          { resourceId: 'textbook-unit:book@ed/1', versionHash: 'sha256:x', reason: '单元阅读', kind: 'textbook-unit' },
          { resourceId: 'bad' },
        ],
      },
    };
    const cards = extractCompanionResourceCards(message);
    expect(cards).toHaveLength(1);
    expect(cards[0].kind).toBe('textbook-unit');

    expect(extractCompanionResourceCards({ companionContext: { resources: 'nope' } })).toEqual([]);
    expect(extractCompanionResourceCards(null)).toEqual([]);
  });
});

describe('CompanionResourceCards', () => {
  const textbookCard = {
    resourceId: 'textbook-unit:book@ed/1',
    versionHash: 'sha256:x',
    reason: '《控制理论》第一章',
    kind: 'textbook-unit',
    caption: '回到当前单元继续阅读，预计 3 分钟。',
  };

  it('renders nothing without companion resources', () => {
    const container = track(renderCards({ role: 'assistant', content: 'hi' }));
    expect(container.querySelector('[data-konling-companion-resource-cards]')).toBeNull();
  });

  it('renders knowledge points in-conversation (bubble never shows them)', () => {
    const container = track(renderCards({
      companionContext: { knowledgePoints: ['拉普拉斯变换', '二阶系统阻尼比'] },
    }));
    const block = container.querySelector('[data-konling-companion-knowledge-points]');
    expect(block?.textContent).toContain('本题主涉及的薄弱知识点');
    expect(block?.textContent).toContain('拉普拉斯变换');
    expect(block?.textContent).toContain('二阶系统阻尼比');
    // 无资源卡时不应出现校验请求。
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('shows the resource identity first, then an in-app link after verification', async () => {
    fetchMock.mockImplementation(() => verifyResponse({
      status: 'available',
      href: '/textbooks/book/ed/unit-1',
    }));
    const container = track(renderCards({ companionContext: { resources: [textbookCard] } }));

    expect(container.textContent).toContain('教材单元');
    expect(container.textContent).toContain('《控制理论》第一章');
    expect(container.textContent).toContain('回到当前单元继续阅读，预计 3 分钟。');
    expect(container.textContent).toContain('完成后回到对话可继续讲解');

    const link = await waitFor(() => {
      const found = container.querySelector('a[data-konling-companion-resource-link]');
      if (!found) throw new Error('link not rendered yet');
      return found;
    });
    expect(link.getAttribute('href')).toBe('/textbooks/book/ed/unit-1');
  });

  it('degrades only the stale card with a reason', async () => {
    fetchMock.mockImplementation(() => verifyResponse({ status: 'unavailable', reason: 'hash-drift' }));
    const container = track(renderCards({ companionContext: { resources: [textbookCard] } }));

    const degraded = await waitFor(() => {
      const found = container.querySelector('[data-konling-companion-resource-degraded]');
      if (!found) throw new Error('degraded note not rendered yet');
      return found;
    });
    expect(degraded.textContent).toContain('资源内容已更新');
    expect(container.querySelector('a[data-konling-companion-resource-link]')).toBeNull();
  });

  it('embeds a native video player without autoplay when the resource is media', async () => {
    fetchMock.mockImplementation(() => verifyResponse({
      status: 'available',
      mediaUrl: '/media/lesson.mp4',
      mediaKind: 'video',
    }));
    const container = track(renderCards({ companionContext: { resources: [{
      resourceId: 'res-media', versionHash: 'h', reason: '演示视频', kind: 'interactive-resource',
    }] } }));

    const video = await waitFor(() => {
      const found = container.querySelector('video[data-konling-companion-media="video"]');
      if (!found) throw new Error('video not rendered yet');
      return found;
    });
    expect(video.hasAttribute('controls')).toBe(true);
    expect(video.hasAttribute('autoplay')).toBe(false);
    expect(video.getAttribute('src')).toBe('/media/lesson.mp4');
  });

  it('embeds a native audio player without autoplay for recordings', async () => {
    fetchMock.mockImplementation(() => verifyResponse({
      status: 'available',
      mediaUrl: '/media/clip.mp3',
      mediaKind: 'audio',
    }));
    const container = track(renderCards({ companionContext: { resources: [{
      resourceId: 'res-audio', versionHash: 'h', reason: '讲解录音', kind: 'interactive-resource',
    }] } }));

    const audio = await waitFor(() => {
      const found = container.querySelector('audio[data-konling-companion-media="audio"]');
      if (!found) throw new Error('audio not rendered yet');
      return found;
    });
    expect(audio.hasAttribute('controls')).toBe(true);
    expect(audio.hasAttribute('autoplay')).toBe(false);
  });

  it('falls back to unavailable when verification errors out', async () => {
    fetchMock.mockImplementation(() => Promise.reject(new Error('network')));
    const container = track(renderCards({ companionContext: { resources: [textbookCard] } }));

    const degraded = await waitFor(() => {
      const found = container.querySelector('[data-konling-companion-resource-degraded]');
      if (!found) throw new Error('degraded note not rendered yet');
      return found;
    });
    expect(degraded.textContent).toContain('资源已下架或不可用');
  });
});
