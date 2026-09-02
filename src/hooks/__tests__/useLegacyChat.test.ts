import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const hookSource = readFileSync(join(process.cwd(), 'src/hooks/useLegacyChat.ts'), 'utf8');

describe('useLegacyChat compatibility hook', () => {
  it('uses the shared legacy message adapter so tool parts remain renderable', () => {
    expect(hookSource).toContain("import { toLegacyMessage, toUIMessage } from '@/lib/ai/message-compat'");
    expect(hookSource).toContain('messages: chat.messages.map(toLegacyMessage)');
  });

  it('keeps the transport stable while resolving request body from the latest ref', () => {
    expect(hookSource).toContain('const bodyRef = useRef(body)');
    expect(hookSource).toContain('bodyRef.current = body');
    expect(hookSource).toContain('body: () => bodyRef.current ?? {}');
    expect(hookSource).toContain('[api, onResponse]');
  });

  it('keeps the compatibility setMessages callback stable for conversation restore effects', () => {
    expect(hookSource).toContain('setChatMessagesRef.current?.((current) => {');
    expect(hookSource).toContain('}, []);');
    expect(hookSource).not.toContain('}, [chat]);');
  });

  it('normalizes transport failures at the shared boundary and never exposes raw Error.message', () => {
    expect(hookSource).toContain("from '@/lib/konling-chat-failure'");
    expect(hookSource).toContain('fetch: createKonlingSafeFetch(onResponse)');
    expect(hookSource).toContain('error: safeError');
    expect(hookSource).not.toContain('error: chat.error,');
    expect(hookSource).not.toContain('出错了');
  });

  it('restores pending input when a submitted turn fails', () => {
    expect(hookSource).toContain('lastSubmittedTextRef.current = text;');
    expect(hookSource).toContain('if (pending && !input) setInput(pending);');
    // append（快捷问题）同样绑定待恢复文本，失败后不恢复上一次的陈旧问题
    expect(hookSource).toContain('lastSubmittedTextRef.current = message.content;');
  });

  it('suppresses duplicate sends while a turn is submitted or streaming', () => {
    expect(hookSource).toContain("if (!text || chat.status === 'submitted' || chat.status === 'streaming') {");
    expect(hookSource).toContain('return;');
  });
});
