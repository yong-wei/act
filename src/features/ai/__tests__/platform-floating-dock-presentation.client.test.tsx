// @vitest-environment jsdom

import { act, useEffect, useState } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  PageFloatingControlsProvider,
  usePageFloatingControls,
} from '@/components/shared/page-floating-controls';

function DockSuppressionHarness() {
  const { registerControl, setWorkspaceDockSuppressed } = usePageFloatingControls();
  const [suppressed, setSuppressed] = useState(false);

  useEffect(() => registerControl({
    id: 'konling-test',
    label: '控灵',
    onSelect: vi.fn(),
  }), [registerControl]);

  useEffect(() => {
    if (!suppressed) return;
    return setWorkspaceDockSuppressed(true);
  }, [setWorkspaceDockSuppressed, suppressed]);

  return (
    <button type="button" onClick={() => setSuppressed((current) => !current)}>
      {suppressed ? '恢复工作区 dock' : '隐藏工作区 dock'}
    </button>
  );
}

describe('platform floating dock presentation ownership', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    vi.stubGlobal('matchMedia', vi.fn().mockReturnValue({ matches: false }));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('removes all dock focus targets while a workspace owns the viewport and restores them afterward', async () => {
    await act(async () => root.render(
      <PageFloatingControlsProvider>
        <DockSuppressionHarness />
      </PageFloatingControlsProvider>,
    ));

    const dockButton = container.querySelector<HTMLButtonElement>('[data-platform-floating-dock-primary="konling"]');
    expect(dockButton).not.toBeNull();
    dockButton?.focus();
    expect(dockButton).toBe(document.activeElement);

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button:not([data-platform-floating-dock-primary])')?.click();
    });
    expect(container.querySelector('[data-page-floating-controls]')).toBeNull();
    expect(container.querySelector('[data-platform-floating-dock-primary="konling"]')).toBeNull();

    await act(async () => {
      container.querySelector<HTMLButtonElement>('button')?.click();
    });
    expect(container.querySelector('[data-platform-floating-dock-primary="konling"]')).not.toBeNull();
  });
});
