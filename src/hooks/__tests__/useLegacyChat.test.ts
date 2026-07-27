import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

const hookSource = readFileSync(join(process.cwd(), 'src/hooks/useLegacyChat.ts'), 'utf8');

describe('useLegacyChat compatibility hook', () => {
  it('uses the shared legacy message adapter so tool parts remain renderable', () => {
    expect(hookSource).toContain("import { toLegacyMessage, toUIMessage } from '@/lib/ai-message-compat'");
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
});
