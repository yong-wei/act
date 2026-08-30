// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { InteractiveAIPanel } from '@/features/interactive/InteractiveAIPanel';
import type { InteractiveAIContextValue } from '@/features/interactive/types';

vi.mock('@/components/ai/konling-chat-renderer', () => ({
  KonlingChatMessageList: ({ messages }: { messages: Array<{ content: string }> }) => (
    <div data-testid="recovered-messages">{messages.map((message) => message.content).join('|')}</div>
  ),
  konlingPromptInputClassName: '',
}));

function createAi(overrides: Partial<InteractiveAIContextValue>): InteractiveAIContextValue {
  return {
    isEnabled: true,
    isPanelOpen: true,
    togglePanel: vi.fn(),
    sendMessage: vi.fn(async () => ''),
    messages: [],
    isLoading: false,
    error: null,
    recoveryStatus: 'ready',
    retryRecovery: vi.fn(),
    ...overrides,
  };
}

describe('InteractiveAIPanel recovery states', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Element.prototype.scrollIntoView = vi.fn();
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => {
      root.unmount();
    });
    container.remove();
  });

  it('shows the explicit one-turn compatibility banner', () => {
    act(() => {
      root.render(<InteractiveAIPanel ai={createAi({ recoveryStatus: 'ephemeral' })} />);
    });
    const banner = container.querySelector('[data-interactive-ai-recovery="ephemeral"]');
    expect(banner?.textContent).toContain('不可恢复');
  });

  it('offers retry when governed recovery is unavailable', () => {
    const retryRecovery = vi.fn();
    act(() => {
      root.render(<InteractiveAIPanel ai={createAi({ recoveryStatus: 'unavailable', retryRecovery })} />);
    });
    const banner = container.querySelector('[data-interactive-ai-recovery="unavailable"]');
    expect(banner?.textContent).toContain('无法恢复学习对话');
    const retry = container.querySelector('button');
    expect(retry?.textContent).toContain('重试');
    act(() => {
      retry?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(retryRecovery).toHaveBeenCalled();
  });

  it('renders recovered history instead of an empty first-visit prompt', () => {
    act(() => {
      root.render(
        <InteractiveAIPanel
          ai={createAi({
            recoveryStatus: 'ready',
            messages: [
              { id: 'u1', role: 'user', content: '上一问', timestamp: 1 },
              { id: 'a1', role: 'assistant', content: '上一答', timestamp: 2 },
            ],
          })}
        />,
      );
    });
    expect(container.querySelector('[data-testid="recovered-messages"]')?.textContent).toBe('上一问|上一答');
    expect(container.textContent).not.toContain('我是你的 AI 学习助手');
  });
});
