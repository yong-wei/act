// @vitest-environment jsdom

import { act, createElement, useEffect } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { PageFloatingControlsProvider, usePageFloatingControls } from '../page-floating-controls';
import { FLOATING_DOCK_POSITION_KEY } from '../use-floating-dock-position';

function Register({ onSelect }: { onSelect: () => void }) {
  const { registerControl } = usePageFloatingControls();
  useEffect(() => registerControl({ id: 'konling-test', label: '控灵', onSelect }), [onSelect, registerControl]);
  return null;
}

function pointer(target: Element, type: string, x: number, y: number, pointerType = 'mouse') {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y });
  Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true }, pointerType: { value: pointerType } });
  target.dispatchEvent(event);
}

describe('shared Konling dock dragging', () => {
  let container: HTMLDivElement;
  let root: Root;
  let onSelect: ReturnType<typeof vi.fn>;
  let measuredWidth = 112;

  beforeEach(() => {
    measuredWidth = 112;
    vi.stubGlobal('IS_REACT_ACT_ENVIRONMENT', true);
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 1000 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 800 });
    const stored = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => stored.get(key) ?? null,
      setItem: (key: string, value: string) => stored.set(key, value),
      removeItem: (key: string) => stored.delete(key),
    });
    vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
    vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function () {
      const element = this as HTMLElement;
      const right = window.innerWidth - (Number.parseFloat(element.style.right) || 24);
      const bottom = window.innerHeight - (Number.parseFloat(element.style.bottom) || 16);
      return { x: right - measuredWidth, y: bottom - 40, left: right - measuredWidth, top: bottom - 40, right, bottom, width: measuredWidth, height: 40, toJSON() { return {}; } };
    });
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
    onSelect = vi.fn();
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  async function mount() {
    await act(async () => root.render(createElement(PageFloatingControlsProvider, null, createElement(Register, { onSelect }))));
  }

  it('drags without activation, persists across remounts and preserves ordinary click', async () => {
    await mount();
    const button = container.querySelector<HTMLButtonElement>('[data-platform-floating-dock-primary]')!;
    await act(async () => pointer(button, 'pointerdown', 950, 760));
    await act(async () => pointer(button, 'pointermove', 800, 560));
    await act(async () => pointer(button, 'pointerup', 800, 560));
    await act(async () => button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 })));
    expect(onSelect).not.toHaveBeenCalled();
    const saved = JSON.parse(window.localStorage.getItem(FLOATING_DOCK_POSITION_KEY)!);
    expect(saved).toEqual({ right: 174, bottom: 216 });
    await act(async () => root.unmount());
    root = createRoot(container);
    await mount();
    const dock = container.querySelector<HTMLElement>('[data-page-floating-controls]')!;
    expect(dock.style.right).toBe('174px');
    expect(dock.style.bottom).toBe('216px');
    await act(async () => container.querySelector<HTMLButtonElement>('[data-platform-floating-dock-primary]')!.click());
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('constrains touch dragging and restores the default through an accessible control', async () => {
    await mount();
    const button = container.querySelector<HTMLButtonElement>('[data-platform-floating-dock-primary]')!;
    await act(async () => pointer(button, 'pointerdown', 950, 760, 'touch'));
    await act(async () => pointer(button, 'pointermove', -1000, -1000, 'touch'));
    await act(async () => pointer(button, 'pointerup', -1000, -1000, 'touch'));
    const dock = container.querySelector<HTMLElement>('[data-page-floating-controls]')!;
    expect(dock.style.right).toBe('876px');
    expect(dock.style.bottom).toBe('748px');
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 320 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, value: 480 });
    await act(async () => window.dispatchEvent(new Event('resize')));
    expect(dock.style.right).toBe('196px');
    expect(dock.style.bottom).toBe('428px');
    await act(async () => container.querySelector<HTMLButtonElement>('[aria-label="恢复控灵默认位置"]')!.click());
    expect(window.localStorage.getItem(FLOATING_DOCK_POSITION_KEY)).toBeNull();
    expect(dock.dataset.platformFloatingDockSafeArea).toBe('bottom-right');
  });

  it('clamps the final registered dock width after restoring a saved mobile position', async () => {
    Object.defineProperty(window, 'innerWidth', { configurable: true, value: 390 });
    measuredWidth = 126;
    window.localStorage.setItem(FLOATING_DOCK_POSITION_KEY, JSON.stringify({ right: 268, bottom: 40 }));
    await mount();
    const dock = container.querySelector<HTMLElement>('[data-page-floating-controls]')!;
    expect(dock.style.right).toBe('252px');
    expect(dock.getBoundingClientRect().left).toBe(12);
  });

  it('rolls a cancelled drag back without saving it', async () => {
    await mount();
    const button = container.querySelector<HTMLButtonElement>('[data-platform-floating-dock-primary]')!;
    await act(async () => pointer(button, 'pointerdown', 950, 760));
    await act(async () => pointer(button, 'pointermove', 800, 560));
    await act(async () => pointer(button, 'pointercancel', 800, 560));
    expect(container.querySelector<HTMLElement>('[data-page-floating-controls]')!.dataset.platformFloatingDockSafeArea).toBe('bottom-right');
    expect(window.localStorage.getItem(FLOATING_DOCK_POSITION_KEY)).toBeNull();
  });
});
