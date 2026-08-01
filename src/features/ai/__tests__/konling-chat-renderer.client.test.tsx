// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { fireEvent, getByRole } from '@testing-library/dom';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  KonlingChatMessageList,
  type KonlingStructuredActionRequest,
  type KonlingStructuredActionResult,
} from '@/components/ai/konling-chat-renderer';

const roots: Array<{ root: ReturnType<typeof createRoot>; container: HTMLDivElement }> = [];

afterEach(async () => {
  while (roots.length) {
    const mounted = roots.pop()!;
    await act(async () => mounted.root.unmount());
    mounted.container.remove();
  }
});

function renderAction(
  state: 'pending' | 'conflict' | 'failed',
  onAction: (request: KonlingStructuredActionRequest) => Promise<KonlingStructuredActionResult>,
) {
  const container = document.createElement('div');
  document.body.append(container);
  const root = createRoot(container);
  roots.push({ root, container });
  act(() => root.render(
    <KonlingChatMessageList
      messages={[{
        id: 'assistant-1',
        role: 'assistant',
        metadata: {
          konlingSmartPreparationActions: [{
            actionId: 'action-1',
            operation: 'revise',
            taskId: 'task-1',
            state,
            proposal: { topic: '闭环稳定性' },
          }],
        },
      }]}
      onStructuredAction={onAction}
    />,
  ));
  return container;
}

describe('Konling structured action card interactions', () => {
  it('prevents duplicate apply while one action is pending', async () => {
    let resolveAction!: (value: { state: 'applied'; message: string }) => void;
    const onAction = vi.fn(() => new Promise<{ state: 'applied'; message: string }>((resolve) => {
      resolveAction = resolve;
    }));
    const container = renderAction('pending', onAction);
    const apply = getByRole(container, 'button', { name: '应用' });

    await act(async () => {
      fireEvent.click(apply);
      fireEvent.click(apply);
    });
    expect(onAction).toHaveBeenCalledTimes(1);

    await act(async () => resolveAction({ state: 'applied', message: '已应用。' }));
    expect(container.textContent).toContain('已应用。');
    expect(container.querySelector('button')).toBeNull();
  });

  it.each(['conflict', 'failed'] as const)('offers executable recovery for %s state', async (state) => {
    const onAction = vi.fn(async () => ({ state, message: '保持终态。' }));
    const container = renderAction(state, onAction);

    await act(async () => fireEvent.click(getByRole(container, 'button', { name: '刷新任务' })));
    await act(async () => fireEvent.click(getByRole(container, 'button', { name: '重新生成建议' })));

    expect(onAction).toHaveBeenNthCalledWith(1, expect.objectContaining({ action: 'refresh' }));
    expect(onAction).toHaveBeenNthCalledWith(2, expect.objectContaining({ action: 'regenerate' }));
    expect(container.querySelector('[data-action-state]')?.getAttribute('data-action-state')).toBe(state);
  });
});
