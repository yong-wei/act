// @vitest-environment jsdom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, describe, expect, it } from 'vitest';

import { ILAB_STEPS } from '@/features/ilab/steps';
import { IlabDockSteps } from '../ilab-dock-steps';

const mounts: { root: Root; container: HTMLDivElement }[] = [];

afterEach(async () => {
  for (const { root, container } of mounts.splice(0)) {
    await act(async () => root.unmount());
    container.remove();
  }
});

describe('深海实验步骤栏', () => {
  it('把 24 步放进状态栏，并打开被点中的步骤', async () => {
    const opened: number[] = [];
    const container = document.createElement('div');
    document.body.append(container);
    const root = createRoot(container);
    mounts.push({ root, container });
    await act(async () => {
      root.render(<IlabDockSteps seq={19} onOpen={(seq) => opened.push(seq)} />);
    });
    const buttons = container.querySelectorAll('[data-ilab-step]');
    expect(buttons).toHaveLength(ILAB_STEPS.length);
    expect(container.textContent).toContain('19. 动力定位任务设定');
    expect(container.textContent).toContain('当前进行第 19 步');
    const target = container.querySelector('[data-ilab-step="10"]');
    expect(target).toBeInstanceOf(HTMLButtonElement);
    await act(async () => {
      (target as HTMLButtonElement).click();
    });
    expect(opened).toEqual([10]);
  });
});
