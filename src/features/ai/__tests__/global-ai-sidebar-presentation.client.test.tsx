// @vitest-environment jsdom

import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { fireEvent, getByRole } from '@testing-library/dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const testState = vi.hoisted(() => ({
  chatMounts: 0,
  libraryMounts: 0,
  chatLoading: false,
  mediaMatches: false,
  mediaListeners: new Set<() => void>(),
  isOpen: true,
  pathAdvisorMode: false,
  requestedPathAdvisor: false,
  submitChat: vi.fn(),
  chatMessages: [] as Array<Record<string, unknown>>,
  chatError: null as Error | null,
  closeSidebar: vi.fn(),
  suppressDock: vi.fn(() => vi.fn()),
  setStreamingOrComposing: vi.fn(),
}));

vi.mock('@/hooks/useLegacyChat', async () => {
  const React = await import('react');
  return {
    useChat: () => {
      const [input, setInput] = React.useState('');
      const [messages, setMessages] = React.useState(testState.chatMessages);
      React.useEffect(() => {
        testState.chatMounts += 1;
        return () => {
          testState.chatMounts -= 1;
        };
      }, []);
      return {
        messages,
        input,
        handleInputChange: (event: React.ChangeEvent<HTMLInputElement>) => setInput(event.target.value),
        handleSubmit: testState.submitChat,
        isLoading: testState.chatLoading,
        error: testState.chatError,
        reload: vi.fn(),
        stop: vi.fn(),
        append: vi.fn(),
        setMessages,
      };
    },
  };
});

vi.mock('@/hooks/useKonlingConversationLibrary', async () => {
  const React = await import('react');
  const conversation = {
    id: 'conversation-1',
    title: '连续会话',
    pinned: false,
    messages: [{ id: 'message-1', role: 'assistant', content: '保持连续的回答' }],
  };
  const conversations = [
    conversation,
    ...Array.from({ length: 39 }, (_, index) => ({
      ...conversation,
      id: `conversation-${index + 2}`,
      title: `历史会话 ${index + 2}`,
      messages: [],
    })),
  ];
  return {
    visibleKonlingMessages: (messages: unknown[]) => messages,
    useKonlingConversationLibrary: () => {
      React.useEffect(() => {
        testState.libraryMounts += 1;
        return () => {
          testState.libraryMounts -= 1;
        };
      }, []);
      return {
        conversations,
        activeConversationId: conversation.id,
        activeConversation: conversation,
        activeAssistantBinding: testState.pathAdvisorMode
          ? { teachingAssistantModeId: 'path-advisor', modeClientContextHints: {} }
          : null,
        search: '',
        setSearch: vi.fn(),
        isLoading: false,
        isMutating: false,
        error: null,
        refreshConversations: vi.fn(),
        refreshActiveConversation: vi.fn(),
        createConversation: vi.fn(),
        ensureConversation: vi.fn().mockResolvedValue(conversation),
        selectConversation: vi.fn(),
        renameConversation: vi.fn(),
        setConversationPinned: vi.fn(),
        deleteConversation: vi.fn(),
      };
    },
  };
});

vi.mock('@/components/providers/global-ai-provider', () => ({
  useGlobalAI: () => ({
    pageContext: { courseId: 'course-1', pageType: 'workspace', topic: '测试工作区' },
    userProfile: { role: 'STUDENT' },
    enabled: true,
    isOpen: testState.isOpen,
    closeSidebar: testState.closeSidebar,
    tools: [],
    systemPromptExtension: undefined,
    assistantEntryPoint: testState.requestedPathAdvisor ? {
      mode: 'path-advisor', serverContext: { goalId: 'goal-1', modeContextToken: 'signed-token' },
    } : undefined,
    knowledgeWorkspaceHint: undefined,
    quickQuestions: [],
    clearUnread: vi.fn(),
    pathname: '/workspace',
    setStreamingOrComposing: testState.setStreamingOrComposing,
  }),
}));

vi.mock('@/components/shared/page-floating-controls', () => ({
  useOptionalPageFloatingControls: () => ({
    setWorkspaceDockSuppressed: testState.suppressDock,
  }),
}));

vi.mock('@/lib/ai-context-resolver', () => ({
  resolveRegisteredAIContextFromPath: () => undefined,
}));

vi.mock('@/lib/ai-theme-styles', () => ({
  TRANSITION_CLASSES: { panel: 'transition-all duration-300 ease-out' },
  useAIThemeStyles: () => ({
    container: 'theme-container',
    header: 'theme-header',
    border: 'theme-border',
    input: 'theme-input',
    button: 'theme-button',
    buttonSecondary: 'theme-button-secondary',
    text: { primary: 'text-primary', secondary: 'text-secondary', muted: 'text-muted' },
    message: { assistant: 'message-assistant' },
  }),
}));

vi.mock('@/components/ai/konling-avatar', () => ({
  KonlingAvatar: () => <span aria-hidden="true">K</span>,
}));

vi.mock('@/components/ai/konling-chat-renderer', () => ({
  konlingPromptInputClassName: 'min-w-0 flex-1',
  KonlingChatMessageList: ({ messages }: { messages: Array<{ id: string; content: string }> }) => (
    <div data-testid="message-list">
      {messages.map((message) => <p key={message.id}>{message.content}</p>)}
    </div>
  ),
}));

vi.mock('@/lib/ai-branding', () => ({
  KONLING_BRAND: {
    name: '控灵',
    subtitle: '智能助教',
    welcomeMessages: {
      default: '欢迎',
      quiz: '测验',
      reflection: '反思',
    },
  },
  getQuickQuestions: () => [],
}));

import { GlobalAISidebar } from '@/components/ai/global-ai-sidebar';

async function flush() {
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

async function setNarrowViewport(matches: boolean) {
  testState.mediaMatches = matches;
  await act(async () => {
    testState.mediaListeners.forEach((listener) => listener());
  });
}

describe('GlobalAISidebar presentation continuity', () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    testState.chatMounts = 0;
    testState.libraryMounts = 0;
    testState.chatLoading = false;
    testState.mediaMatches = false;
    testState.mediaListeners.clear();
    testState.isOpen = true;
    testState.pathAdvisorMode = false;
    testState.requestedPathAdvisor = false;
    testState.submitChat.mockReset();
    testState.chatError = null;
    testState.chatMessages = [
      { id: 'message-1', role: 'assistant', content: '保持连续的回答' },
    ];
    testState.closeSidebar.mockReset();
    testState.suppressDock.mockClear();
    (globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
    Object.defineProperty(HTMLElement.prototype, 'offsetParent', {
      configurable: true,
      get: () => document.body,
    });
    Object.defineProperty(HTMLElement.prototype, 'scrollIntoView', {
      configurable: true,
      value: vi.fn(),
    });
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0);
      return 1;
    });
    vi.stubGlobal('cancelAnimationFrame', vi.fn());
    vi.stubGlobal('matchMedia', vi.fn().mockImplementation((media: string) => ({
      get matches() {
        return testState.mediaMatches;
      },
      media,
      addEventListener: (_type: string, listener: () => void) => testState.mediaListeners.add(listener),
      removeEventListener: (_type: string, listener: () => void) => testState.mediaListeners.delete(listener),
    })));
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => root.unmount());
    container.remove();
    vi.unstubAllGlobals();
  });

  it('sends the signed path advisor context on the first turn before a conversation binding is persisted', async () => {
    testState.requestedPathAdvisor = true;
    await act(async () => root.render(<GlobalAISidebar />));
    await flush();
    const input = getByRole(container, 'textbox', { name: '全局 AI 问题输入框' });
    await act(async () => fireEvent.change(input, { target: { value: '请生成学习路径' } }));
    await act(async () => fireEvent.submit(input.closest('form')!));
    expect(testState.submitChat).toHaveBeenCalledWith(undefined, expect.objectContaining({
      conversationId: 'conversation-1', teachingAssistantModeId: 'path-advisor',
      modeClientContextHints: { goalId: 'goal-1', modeContextToken: 'signed-token' },
    }));
  });

  it('keeps one hook instance and the same draft, messages, scroll container, and focus across mode changes', async () => {
    await act(async () => root.render(<GlobalAISidebar />));
    await flush();

    const input = getByRole(container, 'textbox', { name: '全局 AI 问题输入框' }) as HTMLInputElement;
    const messageList = container.querySelector('[data-testid="message-list"]');
    const scrollContainer = container.querySelector('[data-konling-message-scroll-container]') as HTMLDivElement;
    scrollContainer.scrollTop = 137;
    await act(async () => fireEvent.change(input, { target: { value: '尚未发送的草稿' } }));
    testState.chatLoading = true;
    await act(async () => root.render(<GlobalAISidebar />));
    expect(container.textContent).toContain('控灵正在思考...');

    const maximize = getByRole(container, 'button', { name: '最大化控灵工作区' });
    await act(async () => maximize.click());

    expect(container.querySelector('[data-konling-presentation-mode="maximized"]')).not.toBeNull();
    expect(testState.chatMounts).toBe(1);
    expect(testState.libraryMounts).toBe(1);
    expect(getByRole(container, 'textbox', { name: '全局 AI 问题输入框' })).toBe(input);
    expect(container.querySelector('[data-testid="message-list"]')).toBe(messageList);
    expect(container.querySelector('[data-konling-message-scroll-container]')).toBe(scrollContainer);
    expect(input.value).toBe('尚未发送的草稿');
    expect(scrollContainer.scrollTop).toBe(137);
    expect(container.textContent).toContain('保持连续的回答');
    expect(testState.suppressDock).toHaveBeenCalledWith(true);

    const restore = getByRole(container, 'button', { name: '恢复控灵侧栏' });
    await act(async () => restore.click());

    expect(container.querySelector('[data-konling-presentation-mode="side"]')).not.toBeNull();
    expect(getByRole(container, 'textbox', { name: '全局 AI 问题输入框' })).toBe(input);
    expect(container.querySelector('[data-testid="message-list"]')).toBe(messageList);
    expect(container.querySelector('[data-konling-message-scroll-container]')).toBe(scrollContainer);
    expect(scrollContainer.scrollTop).toBe(137);
    expect(getByRole(container, 'button', { name: '最大化控灵工作区' })).toBe(document.activeElement);
  });

  it('persists one governed candidate selection before publishing the same-batch refresh event', async () => {
    testState.pathAdvisorMode = true;
    testState.chatMessages = [{
      id: 'message-selection',
      role: 'assistant',
      content: '',
      toolInvocations: [{
        toolName: 'select_learning_path',
        state: 'result',
        result: {
          status: 'pending_commit',
          pathId: 'path-1',
          batchId: 'batch-1',
          candidateId: 'candidate-1',
          selectedOptionId: 'option-1',
          selectedStyleId: 'guided',
          idempotencyKey: 'selection-1',
          toolRunId: 'tool-run-selection-1',
          autoStart: false,
        },
      }],
    }];
    const fetchMock = vi.fn().mockResolvedValue({ ok: true });
    vi.stubGlobal('fetch', fetchMock);
    const refreshEvents: unknown[] = [];
    window.addEventListener('konling:adaptive-path-updated', (event) => {
      refreshEvents.push((event as CustomEvent).detail);
    }, { once: true });

    await act(async () => root.render(<GlobalAISidebar />));
    await flush();
    await act(async () => root.render(<GlobalAISidebar />));
    await flush();

    const selectionCalls = fetchMock.mock.calls.filter(([url]) => String(url).includes('/learning-paths/path-1/choices'));
    expect(selectionCalls).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/learning-paths/path-1/choices', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        action: 'selection',
        batchId: 'batch-1',
        candidateId: 'candidate-1',
        selectedOptionId: 'option-1',
        selectedStyleId: 'guided',
        idempotencyKey: 'selection-1',
        toolRunId: 'tool-run-selection-1',
      }),
    }));
    expect(refreshEvents).toEqual([{
      mode: 'path-advisor',
      batchId: 'batch-1',
      candidateId: 'candidate-1',
      pathId: 'path-1',
      source: 'candidate-selection',
    }]);
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('/execute'))).toBe(false);
  });

  it('publishes a generated candidate batch onto the path page without selecting it', async () => {
    testState.pathAdvisorMode = true;
    testState.chatMessages = [{
      id: 'message-generation',
      role: 'assistant',
      content: '',
      toolInvocations: [{
        toolName: 'generate_learning_path',
        state: 'result',
        result: {
          operation: 'generated',
          generationStatus: 'persisted',
          pathId: 'path-generated-1',
          candidateBatch: { id: 'batch-generated-1', candidateIds: ['candidate-a'] },
        },
      }],
    }];
    const refreshEvents: unknown[] = [];
    window.addEventListener('konling:adaptive-path-updated', (event) => {
      refreshEvents.push((event as CustomEvent).detail);
    }, { once: true });

    await act(async () => root.render(<GlobalAISidebar />));
    await flush();

    expect(refreshEvents).toEqual([{
      mode: 'path-advisor',
      batchId: 'batch-generated-1',
      pathId: 'path-generated-1',
      source: 'path-generation',
    }]);
    expect(container.querySelector('[data-konling-presentation-mode="side"]')).not.toBeNull();
    expect(container.textContent).toContain('学习路径已生成，请在路径页比较方案。');
  });

  it('keeps a pending selection unconfirmed after a lost response and retries it after remount', async () => {
    testState.pathAdvisorMode = true;
    testState.chatMessages = [{
      id: 'message-selection-retry',
      role: 'assistant',
      content: '',
      toolInvocations: [{
        toolName: 'select_learning_path',
        state: 'result',
        result: {
          status: 'pending_commit',
          pathId: 'path-1',
          batchId: 'batch-1',
          candidateId: 'candidate-1',
          selectedOptionId: 'option-1',
          selectedStyleId: 'guided',
          idempotencyKey: 'selection-retry-1',
          toolRunId: 'tool-run-selection-retry-1',
          autoStart: false,
        },
      }],
    }];
    let selectionAttempts = 0;
    const fetchMock = vi.fn(async (url: string) => {
      if (String(url).includes('/learning-paths/path-1/choices')) {
        selectionAttempts += 1;
        if (selectionAttempts === 1) {
          throw new Error('response lost');
        }
        return { ok: true };
      }
      return { ok: true, json: async () => ({}) };
    });
    vi.stubGlobal('fetch', fetchMock);
    const refreshEvents: unknown[] = [];
    const listener = (event: Event) => refreshEvents.push((event as CustomEvent).detail);
    window.addEventListener('konling:adaptive-path-updated', listener);

    await act(async () => root.render(<GlobalAISidebar />));
    await flush();
    const selectionCallsAfterFirstMount = fetchMock.mock.calls.filter(([url]) => String(url).includes('/learning-paths/path-1/choices'));
    expect(selectionCallsAfterFirstMount).toHaveLength(1);
    expect(refreshEvents).toEqual([]);
    expect(container.textContent).toContain('路径选择未能同步，请重试。');

    await act(async () => root.unmount());
    root = createRoot(container);
    await act(async () => root.render(<GlobalAISidebar />));
    await flush();

    const selectionCallsAfterRemount = fetchMock.mock.calls.filter(([url]) => String(url).includes('/learning-paths/path-1/choices'));
    expect(selectionCallsAfterRemount).toHaveLength(2);
    expect(refreshEvents).toEqual([expect.objectContaining({
      batchId: 'batch-1',
      candidateId: 'candidate-1',
      source: 'candidate-selection',
    })]);
    expect(container.textContent).toContain('路径选择已同步，等待你开始学习。');
    window.removeEventListener('konling:adaptive-path-updated', listener);
  });

  it('closes mobile history before restoring, then closes the side presentation on Escape', async () => {
    testState.mediaMatches = true;
    await act(async () => root.render(<GlobalAISidebar />));
    await flush();

    await act(async () => getByRole(container, 'button', { name: '最大化控灵工作区' }).click());
    await act(async () => getByRole(container, 'button', { name: '打开控灵会话库' }).click());
    expect(container.querySelector('[data-konling-mobile-history-drawer="open"]')).not.toBeNull();

    await act(async () => fireEvent.keyDown(window, { key: 'Escape' }));
    expect(container.querySelector('[data-konling-presentation-mode="maximized"]')).not.toBeNull();
    expect(container.querySelector('[data-konling-mobile-history-drawer="open"]')).toBeNull();

    await act(async () => fireEvent.keyDown(window, { key: 'Escape' }));
    expect(container.querySelector('[data-konling-presentation-mode="side"]')).not.toBeNull();
    expect(getByRole(container, 'button', { name: '最大化控灵工作区' })).toBe(document.activeElement);

    await act(async () => fireEvent.keyDown(window, { key: 'Escape' }));
    expect(testState.closeSidebar).toHaveBeenCalledTimes(1);
  });

  it('releases the conversation from drawer inert state when the viewport expands to desktop', async () => {
    testState.mediaMatches = true;
    testState.isOpen = false;
    await act(async () => root.render(<GlobalAISidebar />));
    await flush();
    testState.isOpen = true;
    await act(async () => root.render(<GlobalAISidebar />));
    await flush();

    await act(async () => getByRole(container, 'button', { name: '最大化控灵工作区' }).click());
    await act(async () => getByRole(container, 'button', { name: '打开控灵会话库' }).click());

    const conversation = container.querySelector<HTMLElement>('[data-konling-active-conversation]');
    const composer = getByRole(container, 'textbox', { name: '全局 AI 问题输入框' }) as HTMLInputElement;
    const dialog = getByRole(container, 'dialog', { name: '控灵全局 AI 侧栏' });
    expect(conversation?.hasAttribute('inert')).toBe(true);
    expect(getByRole(container, 'searchbox', { name: '搜索对话标题' })).toBe(document.activeElement);

    const focusableOutsideInert = Array.from(dialog.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((item) => !item.closest('[inert]'));
    focusableOutsideInert.at(-1)?.focus();
    await act(async () => fireEvent.keyDown(dialog, { key: 'Tab' }));
    expect(document.activeElement).toBe(focusableOutsideInert[0]);
    expect(document.activeElement).not.toBe(composer);

    await setNarrowViewport(false);

    expect(conversation?.hasAttribute('inert')).toBe(false);
    expect(container.querySelector('[data-konling-mobile-history-drawer="open"]')).toBeNull();
    composer.focus();
    expect(composer).toBe(document.activeElement);
    expect(container.querySelector('[data-konling-presentation-mode="maximized"]')).not.toBeNull();
  });

  it('restores the existing opener after the side presentation closes', async () => {
    const opener = document.createElement('button');
    opener.textContent = '页面入口';
    document.body.appendChild(opener);
    opener.focus();
    await act(async () => root.render(<GlobalAISidebar />));
    await flush();

    const closeButton = container.querySelector<HTMLButtonElement>('button[aria-label="关闭 AI 侧栏"]');
    await act(async () => closeButton?.click());
    testState.isOpen = false;
    await act(async () => root.render(<GlobalAISidebar />));
    await flush();

    expect(opener).toBe(document.activeElement);
    opener.remove();
  });

  it('resets externally closed maximized state without remounting conversation hooks', async () => {
    const opener = document.createElement('button');
    opener.textContent = '外部页面入口';
    document.body.appendChild(opener);
    testState.isOpen = false;
    await act(async () => root.render(<GlobalAISidebar />));
    await flush();
    opener.focus();
    testState.isOpen = true;
    await act(async () => root.render(<GlobalAISidebar />));
    await flush();

    const input = getByRole(container, 'textbox', { name: '全局 AI 问题输入框' }) as HTMLInputElement;
    const messageList = container.querySelector('[data-testid="message-list"]');
    await act(async () => fireEvent.change(input, { target: { value: '外部关闭前的草稿' } }));
    await act(async () => getByRole(container, 'button', { name: '最大化控灵工作区' }).click());
    expect(container.querySelector('[data-konling-presentation-mode="maximized"]')).not.toBeNull();

    testState.isOpen = false;
    await act(async () => root.render(<GlobalAISidebar />));
    await flush();
    expect(opener).toBe(document.activeElement);

    testState.isOpen = true;
    await act(async () => root.render(<GlobalAISidebar />));
    await flush();

    expect(container.querySelector('[data-konling-presentation-mode="side"]')).not.toBeNull();
    expect(getByRole(container, 'textbox', { name: '全局 AI 问题输入框' })).toBe(input);
    expect(container.querySelector('[data-testid="message-list"]')).toBe(messageList);
    expect(input.value).toBe('外部关闭前的草稿');
    expect(testState.chatMounts).toBe(1);
    expect(testState.libraryMounts).toBe(1);
    opener.remove();
  });

  it('returns focus to mobile history after the drawer backdrop closes and keeps Tab inside the dialog', async () => {
    testState.mediaMatches = true;
    testState.isOpen = false;
    await act(async () => root.render(<GlobalAISidebar />));
    await flush();
    testState.isOpen = true;
    await act(async () => root.render(<GlobalAISidebar />));
    await flush();

    await act(async () => getByRole(container, 'button', { name: '最大化控灵工作区' }).click());
    const historyControl = getByRole(container, 'button', { name: '打开控灵会话库' });
    await act(async () => historyControl.click());
    expect(container.querySelector('[data-konling-mobile-history-drawer="open"]')).not.toBeNull();

    await act(async () => getByRole(container, 'button', { name: '关闭控灵会话库' }).click());
    expect(container.querySelector('[data-konling-mobile-history-drawer="open"]')).toBeNull();
    expect(historyControl).toBe(document.activeElement);

    const dialog = getByRole(container, 'dialog', { name: '控灵全局 AI 侧栏' });
    await act(async () => fireEvent.keyDown(dialog, { key: 'Tab', shiftKey: true }));
    expect(dialog.contains(document.activeElement)).toBe(true);
    expect(document.activeElement).not.toBe(document.body);
  });

  it('exposes a desktop history rail and overflow-safe active conversation in maximized mode', async () => {
    await act(async () => root.render(<GlobalAISidebar />));
    await flush();
    await act(async () => getByRole(container, 'button', { name: '最大化控灵工作区' }).click());

    const rail = container.querySelector<HTMLElement>('[data-konling-conversation-library-mode="workspace-rail"]');
    const conversationList = container.querySelector<HTMLElement>('[data-konling-conversation-list]');
    expect(rail).not.toBeNull();
    expect(rail?.className).toContain('flex-col');
    expect(rail?.className).toContain('md:flex');
    expect(rail?.className).not.toContain('md:block');
    expect(conversationList?.className).toContain('min-h-0');
    expect(conversationList?.className).toContain('flex-1');
    expect(conversationList?.className).toContain('overflow-y-auto');
    expect(conversationList?.querySelectorAll('[data-konling-conversation-active]')).toHaveLength(40);
    expect(container.querySelector('[data-konling-active-conversation]')?.className).toContain('min-w-0');
    expect(container.querySelector('[data-konling-message-scroll-container]')?.className).toContain('overflow-x-hidden');
    expect(container.querySelector('[data-konling-motion-policy="geometry motion-reduce"]')?.className)
      .toContain('motion-reduce:transition-none');
  });

  it('renders student-safe copy and matched recovery for raw transport failures', async () => {
    const cases = [
      {
        error: new Error(
          '{"error":"AI_SERVICE_UNAVAILABLE","trace":"INTERNAL-STACK-CANARY-1814","provider":"SiliconFlow"}',
        ),
        copy: '智能助手暂时无法完成请求，请稍后再试。',
        buttons: ['稍后重试'],
        forbidden: ['INTERNAL-STACK-CANARY-1814', 'AI_SERVICE_UNAVAILABLE', 'SiliconFlow', '出错了'],
      },
      {
        error: new Error('{"error":"未授权"}'),
        copy: '登录状态已失效，请重新登录后再继续。',
        buttons: ['重新登录'],
        forbidden: ['未授权'],
      },
      {
        error: new Error('Conversation not found'),
        copy: '当前会话已不存在，请刷新会话或开启新对话。',
        buttons: ['刷新会话', '开启新对话'],
        forbidden: ['Conversation not found'],
      },
    ];

    for (const testCase of cases) {
      testState.chatError = testCase.error;
      await act(async () => root.render(<GlobalAISidebar />));
      await flush();

      expect(container.textContent).toContain(testCase.copy);
      for (const forbidden of testCase.forbidden) {
        expect(container.textContent).not.toContain(forbidden);
      }
      for (const label of testCase.buttons) {
        expect(getByRole(container, 'button', { name: label })).toBeDefined();
      }
    }
  });
});
