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

  it('renders only the safe copy with a matching retry action for a service failure', () => {
    act(() => {
      root.render(
        <InteractiveAIPanel
          ai={createAi({
            error: { category: 'service-unavailable', message: '智能助手暂时无法完成请求，请稍后再试。' },
          })}
        />,
      );
    });
    const alert = container.querySelector('[data-interactive-ai-error="service-unavailable"]');
    expect(alert?.getAttribute('role')).toBe('alert');
    expect(alert?.textContent).toContain('智能助手暂时无法完成请求，请稍后再试。');
    expect(alert?.querySelector('button')?.textContent).toContain('稍后重试');
  });

  it('maps conversation loss to session recovery and auth expiry to re-login', () => {
    const retryRecovery = vi.fn();
    act(() => {
      root.render(
        <InteractiveAIPanel
          ai={createAi({
            error: { category: 'conversation-missing', message: '无法恢复学习对话，请重试或返回当前资源。' },
            retryRecovery,
          })}
        />,
      );
    });
    const recoverButton = container.querySelector('[data-interactive-ai-error="conversation-missing"] button');
    expect(recoverButton?.textContent).toContain('恢复会话');
    act(() => {
      recoverButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });
    expect(retryRecovery).toHaveBeenCalled();

    // jsdom 的 location.assign 只读；点击跳转行为由 1814 浏览器回归覆盖，这里锁定按钮契约。
    act(() => {
      root.render(
        <InteractiveAIPanel
          ai={createAi({
            error: { category: 'auth-required', message: '登录状态已失效，请重新登录后再继续。' },
          })}
        />,
      );
    });
    const loginButton = container.querySelector('[data-interactive-ai-error="auth-required"] button');
    expect(loginButton?.textContent).toContain('重新登录');
  });

  it('keeps the specialized isolation state instead of a generic raw error', () => {
    act(() => {
      root.render(
        <InteractiveAIPanel
          ai={createAi({
            error: { category: 'state-conflict', message: '当前资源的对话已隔离，请重新提问。' },
          })}
        />,
      );
    });
    const alert = container.querySelector('[data-interactive-ai-error="state-conflict"]');
    expect(alert?.textContent).toContain('当前资源的对话已隔离，请重新提问。');
    expect(alert?.querySelector('button')?.textContent).toContain('重新提问');
    // 学生可见区域不得出现原始状态码、响应体、供应商或英文异常。
    expect(container.textContent).not.toContain('AI request failed');
    expect(container.textContent).not.toContain('409');
    expect(container.textContent).not.toContain('INTERACTIVE_AI_RESOURCE_MISMATCH');
  });
});
