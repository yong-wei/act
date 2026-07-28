import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import {
  buildKonlingConversationListUrl,
  visibleKonlingMessages,
} from '@/hooks/useKonlingConversationLibrary';
import type { Message } from '@/types/ai-message';

const sidebarSource = readFileSync(
  join(process.cwd(), 'src/components/ai/global-ai-sidebar.tsx'),
  'utf8',
);
const libraryHookSource = readFileSync(
  join(process.cwd(), 'src/hooks/useKonlingConversationLibrary.ts'),
  'utf8',
);
const legacyChatSource = readFileSync(
  join(process.cwd(), 'src/hooks/useLegacyChat.ts'),
  'utf8',
);
const providerSource = readFileSync(
  join(process.cwd(), 'src/components/providers/global-ai-provider.tsx'),
  'utf8',
);

describe('Konling conversation library UI contracts', () => {
  it('builds title-only list searches and hides server context records from restored chat state', () => {
    expect(buildKonlingConversationListUrl('  稳态 误差  '))
      .toBe('/api/ai/sessions?search=%E7%A8%B3%E6%80%81%20%E8%AF%AF%E5%B7%AE');

    const messages = [
      { id: 'context', role: 'system', content: '[控灵当前页面上下文]' },
      { id: 'user', role: 'user', content: '解释稳态误差' },
      { id: 'assistant', role: 'assistant', content: '稳态误差是……' },
    ] as Message[];
    expect(visibleKonlingMessages(messages).map((message) => message.id))
      .toEqual(['user', 'assistant']);
  });

  it('keeps collection, active detail, and library mutations inside the hook', () => {
    expect(libraryHookSource).toContain('fetch(buildKonlingConversationListUrl(search))');
    expect(libraryHookSource).toContain('fetch(`/api/ai/sessions/${activeConversationId}`)');
    expect(libraryHookSource).toContain("method: 'POST'");
    expect(libraryHookSource).toContain("method: 'PATCH'");
    expect(libraryHookSource).toContain("method: 'DELETE'");
    expect(libraryHookSource).toContain('body: JSON.stringify({ confirmed: true })');
    expect(libraryHookSource).toContain('listRequestRef.current !== requestId');
    expect(libraryHookSource).not.toContain('messages: pageContext');
  });

  it('shows persistent conversations only on server-authorized page contexts', () => {
    expect(providerSource).toContain('resolveRegisteredAIContextFromPath(pathname)');
    expect(providerSource).toContain("pathname === '/teacher/smart-prep'");
    expect(providerSource).toContain('if (!persistentConversationEnabled) setIsOpen(false)');
    expect(sidebarSource).toContain('const conversationPageId = useMemo(() =>');
    expect(sidebarSource).toContain('enabled: mounted && enabled');
    expect(sidebarSource).toContain('pageId: conversationPageId');
  });

  it('restores selected history into AI SDK state and sends the canonical conversation identity', () => {
    expect(sidebarSource).toContain('setMessages(visibleKonlingMessages(activeConversation.messages))');
    expect(sidebarSource).toContain('conversationId: activeConversationId ?? undefined');
    expect(sidebarSource).toContain('{ ...chatBody, conversationId: conversation.id }');
    expect(sidebarSource).toContain('agentSessionId: agentSessionId ?? undefined');
    expect(sidebarSource).toContain('modeClientContextHints: effectiveServerContext');
    expect(sidebarSource).toContain('refreshActiveConversation(),');
    expect(legacyChatSource).toContain('{ body: { ...bodyRef.current, ...requestBody } }');
  });

  it('creates and sends one-shot assistant requests in a separate conversation', () => {
    expect(providerSource).toContain('startAssistantConversation');
    expect(providerSource).toContain('pendingAssistantRequest');
    expect(sidebarSource).toContain('await createConversation()');
    expect(sidebarSource).toContain("await append(");
    expect(sidebarSource).toContain('completeAssistantRequest(pendingAssistantRequest.id)');
    expect(sidebarSource).toContain('failAssistantRequest(pendingAssistantRequest.id, cause)');
  });

  it('does not restore a stale conversation snapshot when streaming finishes', () => {
    const restoreEffectStart = sidebarSource.indexOf(
      "if (!activeConversation || activeConversation.id !== activeConversationId) return;",
    );
    const restoreEffectEnd = sidebarSource.indexOf('// 自动滚动到底部', restoreEffectStart);
    const restoreEffect = sidebarSource.slice(restoreEffectStart, restoreEffectEnd);

    expect(restoreEffect).toContain('setMessages(visibleKonlingMessages(activeConversation.messages))');
    expect(restoreEffect).not.toContain('isLoading');
    expect(restoreEffect).toContain(
      '[activeConversation, activeConversationId, setMessages]',
    );
  });

  it('clears stale detail immediately and refuses to send it after a delayed selection load', () => {
    const selectStart = libraryHookSource.indexOf('const selectConversation');
    const selectEnd = libraryHookSource.indexOf('const renameConversation', selectStart);
    const selectHandler = libraryHookSource.slice(selectStart, selectEnd);
    expect(selectHandler.indexOf('setActiveConversation(null)'))
      .toBeLessThan(selectHandler.indexOf('setActiveConversationId(conversationId)'));
    expect(libraryHookSource).toContain('selectedConversationIdRef.current !== selectedConversationId');
    expect(libraryHookSource).toContain("throw new Error('控灵会话已切换，请重新发送。')");
    expect(sidebarSource).toContain('if (isLoading || isConversationLoading || isConversationMutating) return;');
    expect(sidebarSource).toContain('disabled={isLoading || isConversationLoading || isConversationMutating}');
  });

  it('blocks conversation switching and destructive actions while a response is streaming', () => {
    expect(sidebarSource).toContain('if (isLoading) return;');
    expect(sidebarSource).toContain("if (isLoading || !window.confirm('确认删除此对话？此操作无法撤销。')) return;");
    expect(sidebarSource).toContain('const actionsDisabled = isLoading || isConversationMutating;');
    expect(sidebarSource).toContain('disabled={isLoading || isConversationMutating}');
  });

  it('opens a new blank conversation after confirmed deletion of the active conversation', () => {
    const deleteHandlerStart = sidebarSource.indexOf('const handleDeleteConversation');
    const deleteHandlerEnd = sidebarSource.indexOf('// 构建欢迎消息', deleteHandlerStart);
    const deleteHandler = sidebarSource.slice(deleteHandlerStart, deleteHandlerEnd);

    expect(deleteHandler).toContain('const deletedActiveConversation = await deleteConversation(conversationId)');
    expect(deleteHandler).toContain('if (deletedActiveConversation)');
    expect(deleteHandler).toContain('await createConversation()');
    expect(deleteHandler).toContain('setMessages([])');
  });
});
