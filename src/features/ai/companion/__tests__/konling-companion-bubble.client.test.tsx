// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { KonlingCompanionBubble, type CompanionBubbleRequest } from '@/features/ai/companion/konling-companion-bubble';

/** 本 vitest jsdom 配置不带 localStorage，用内存实现替换（组件只依赖同源语义）。 */
function createMemoryStorage(): Storage {
  const store = new Map<string, string>();
  return {
    get length() { return store.size; },
    clear: () => store.clear(),
    getItem: (key: string) => store.get(key) ?? null,
    key: (index: number) => [...store.keys()][index] ?? null,
    removeItem: (key: string) => { store.delete(key); },
    setItem: (key: string, value: string) => { store.set(key, value); },
  };
}

function renderBubble(
  props: Parameters<typeof KonlingCompanionBubble>[0],
): { container: HTMLElement; root: Root } {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);
  act(() => {
    root.render(<KonlingCompanionBubble {...props} />);
  });
  return { container, root };
}

async function flush() {
  await act(async () => {
    await Promise.resolve();
  });
}

const request: CompanionBubbleRequest = { eventId: 'event-1', message: '卡住了吗？控灵可以帮你梳理。' };

describe('KonlingCompanionBubble', () => {
  let roots: Root[] = [];

  beforeEach(() => {
    roots = [];
    vi.stubGlobal('localStorage', createMemoryStorage());
    vi.useFakeTimers();
  });

  afterEach(async () => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    for (const root of roots) {
      await act(async () => {
        root.unmount();
      });
    }
    document.body.innerHTML = '';
  });

  function track(rendered: { container: HTMLElement; root: Root }) {
    roots.push(rendered.root);
    return rendered.container;
  }

  it('renders the bubble for a fresh event and auto-dismisses after the window', async () => {
    const container = track(renderBubble({ userId: 'student-1', request, onOpen: vi.fn(), onDismissed: vi.fn() }));
    expect(container.querySelector('[data-konling-companion-bubble]')).not.toBeNull();

    await act(async () => {
      vi.advanceTimersByTime(12_500);
    });
    expect(container.querySelector('[data-konling-companion-bubble]')).toBeNull();
  });

  it('never re-shows the same event within the session', async () => {
    const onOpen = vi.fn();
    const first = renderBubble({ userId: 'student-1', request, onOpen, onDismissed: vi.fn() });
    roots.push(first.root);
    await act(async () => {
      vi.advanceTimersByTime(12_500);
    });
    first.root.unmount();

    const second = track(renderBubble({ userId: 'student-1', request, onOpen, onDismissed: vi.fn() }));
    expect(second.querySelector('[data-konling-companion-bubble]')).toBeNull();
  });

  it('blocks a second tab through the localStorage lease', () => {
    window.localStorage.setItem(
      'konling-companion-lease:student-2',
      JSON.stringify({ eventId: 'event-other', at: Date.now() }),
    );
    const container = track(renderBubble({
      userId: 'student-2', request: { ...request, eventId: 'event-2' }, onOpen: vi.fn(), onDismissed: vi.fn(),
    }));
    expect(container.querySelector('[data-konling-companion-bubble]')).toBeNull();
  });

  it('invokes onOpen on click and onDismissed on close', () => {
    const onOpen = vi.fn();
    const onDismissed = vi.fn();
    const container = track(renderBubble({ userId: 'student-3', request, onOpen, onDismissed }));

    act(() => {
      fireEvent.click(container.querySelector<HTMLButtonElement>('button:not([aria-label])')!);
    });
    expect(onOpen).toHaveBeenCalledWith(request);

    const second = track(renderBubble({
      userId: 'student-4', request: { ...request, eventId: 'event-4' }, onOpen, onDismissed,
    }));
    act(() => {
      fireEvent.click(second.querySelector<HTMLButtonElement>('button[aria-label="关闭控灵陪伴提示"]')!);
    });
    expect(onDismissed).toHaveBeenCalled();
  });
});
