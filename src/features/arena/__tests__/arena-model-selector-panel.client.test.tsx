// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { ARENA_CHALLENGE_OBJECTS } from '../data/seed-challenges';
import { ArenaModelSelectorPanel } from '../workbench/arena-model-selector-panel';

describe('Arena model selector formula rendering', () => {
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
    vi.restoreAllMocks();
  });

  it('renders second-order models with a mathematical superscript', async () => {
    await act(async () => root.render(
      <ArenaModelSelectorPanel
        currentObjectId="plant-second-order-underdamped"
        locked
        workspaceMode="multi-representation-linkage"
      />,
    ));

    const renderedFormula = container.querySelector('.katex-html');
    expect(renderedFormula?.querySelector('.msupsub')).not.toBeNull();
    expect(renderedFormula?.textContent).not.toContain('s^2');
  });

  it('keeps the plain display value when a model has no LaTeX', async () => {
    const object = ARENA_CHALLENGE_OBJECTS.find((item) => item.id === 'plant-first-order-lag');
    if (!object?.model) throw new Error('Expected first-order Arena model fixture');
    const latex = object.model.latex;
    delete object.model.latex;

    try {
      await act(async () => root.render(
        <ArenaModelSelectorPanel
          currentObjectId={object.id}
          locked
          workspaceMode="multi-representation-linkage"
        />,
      ));

      expect(container.textContent).toContain(object.model.display);
    } finally {
      object.model.latex = latex;
    }
  });

  it('preserves compatible model selection', async () => {
    const onSelectObject = vi.fn();
    const object = ARENA_CHALLENGE_OBJECTS.find((item) => item.id === 'plant-first-order-lag');
    if (!object) throw new Error('Expected first-order Arena model fixture');

    await act(async () => root.render(
      <ArenaModelSelectorPanel
        locked={false}
        workspaceMode="multi-representation-linkage"
        onSelectObject={onSelectObject}
      />,
    ));
    const button = Array.from(container.querySelectorAll('button'))
      .find((item) => item.textContent?.includes(object.name));

    await act(async () => button?.click());

    expect(onSelectObject).toHaveBeenCalledWith(object.id);
  });
});
